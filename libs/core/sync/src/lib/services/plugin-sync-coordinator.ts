/**
 * Plugin Sync Coordinator - Handles plugin synchronization logic
 *
 * @module @overture/sync-core/services/plugin-sync-coordinator
 */

import type {
  OvertureConfig,
  PluginSyncResult,
  InstallationResult,
} from '@overture/config-types';
import type { OutputPort } from '@overture/ports-output';
import type { PluginInstaller, PluginDetector } from '@overture/plugin-core';

export interface PluginSyncCoordinatorDeps {
  output: OutputPort;
  pluginInstaller: PluginInstaller;
  pluginDetector: PluginDetector;
}

export interface PluginSyncDetails {
  configured: number;
  installed: number;
  toInstall: Array<{ name: string; marketplace: string }>;
}

export class PluginSyncCoordinator {
  constructor(private deps: PluginSyncCoordinatorDeps) {}

  async buildPluginSyncDetails(
    userConfig: OvertureConfig | null,
  ): Promise<PluginSyncDetails> {
    const configuredPlugins = userConfig?.plugins || {};
    const pluginNames = Object.keys(configuredPlugins);

    if (pluginNames.length === 0) {
      return {
        configured: 0,
        installed: 0,
        toInstall: [],
      };
    }

    const installedPlugins =
      await this.deps.pluginDetector.detectInstalledPlugins();

    const installedSet = new Set(
      installedPlugins.map((p) => `${p.name}@${p.marketplace}`),
    );

    const toInstall: Array<{ name: string; marketplace: string }> = [];
    let installedCount = 0;

    for (const name of pluginNames) {
      if (Object.hasOwn(configuredPlugins, name)) {
        const config = configuredPlugins[name];
        const key = `${name}@${config.marketplace}`;

        if (installedSet.has(key)) {
          installedCount++;
        } else {
          toInstall.push({ name, marketplace: config.marketplace });
        }
      }
    }

    return {
      configured: pluginNames.length,
      installed: installedCount,
      toInstall,
    };
  }

  async syncPlugins(
    userConfig: OvertureConfig | null,
    projectConfig: OvertureConfig | null,
    options: { dryRun?: boolean },
  ): Promise<PluginSyncResult> {
    const dryRun = options.dryRun ?? false;

    this.warnAboutProjectPlugins(projectConfig);

    const configuredPlugins = userConfig?.plugins || {};
    const pluginNames = Object.keys(configuredPlugins);

    if (pluginNames.length === 0) {
      return {
        totalPlugins: 0,
        installed: 0,
        skipped: 0,
        failed: 0,
        results: [],
        warnings: [],
      };
    }

    const installedPlugins =
      await this.deps.pluginDetector.detectInstalledPlugins();

    const installedSet = new Set(
      installedPlugins.map((p) => `${p.name}@${p.marketplace}`),
    );

    const { missingPlugins, skippedPlugins } = this.categorizePlugins(
      pluginNames,
      configuredPlugins,
      installedSet,
    );

    this.outputSyncStatus(dryRun, pluginNames.length, installedPlugins.length);

    if (missingPlugins.length === 0) {
      this.deps.output.info('All plugins already installed\n');
      return {
        totalPlugins: pluginNames.length,
        installed: 0,
        skipped: skippedPlugins.length,
        failed: 0,
        results: [],
        warnings: [],
      };
    }

    const results = await this.installMissingPlugins(missingPlugins, dryRun);

    return this.buildSyncResult(
      pluginNames.length,
      results,
      skippedPlugins.length,
    );
  }

  private warnAboutProjectPlugins(projectConfig: OvertureConfig | null): void {
    if (
      projectConfig?.plugins &&
      Object.keys(projectConfig.plugins).length > 0
    ) {
      const pluginNames = Object.keys(projectConfig.plugins).join(', ');
      this.deps.output.warn(
        'Warning: Plugin configuration found in project config',
      );
      this.deps.output.warn(`    Plugins found: ${pluginNames}`);
      this.deps.output.warn('    Claude Code plugins are installed globally');
      this.deps.output.warn('    Move to ~/.config/overture.yml');
    }
  }

  private categorizePlugins(
    pluginNames: string[],
    configuredPlugins: NonNullable<OvertureConfig['plugins']>,
    installedSet: Set<string>,
  ): {
    missingPlugins: Array<{ name: string; marketplace: string }>;
    skippedPlugins: string[];
  } {
    const missingPlugins: Array<{ name: string; marketplace: string }> = [];
    const skippedPlugins: string[] = [];

    for (const name of pluginNames) {
      if (Object.hasOwn(configuredPlugins, name)) {
        const config = configuredPlugins[name];
        const key = `${name}@${config.marketplace}`;

        if (installedSet.has(key)) {
          skippedPlugins.push(key);
        } else {
          missingPlugins.push({ name, marketplace: config.marketplace });
        }
      }
    }

    return { missingPlugins, skippedPlugins };
  }

  private outputSyncStatus(
    dryRun: boolean,
    totalConfigured: number,
    totalInstalled: number,
  ): void {
    if (dryRun) {
      this.deps.output.info('\nDRY RUN: Syncing plugins from user config...');
    } else {
      this.deps.output.info('\nSyncing plugins from user config...');
    }

    this.deps.output.info(
      `Found ${totalConfigured} plugins in config, ${totalInstalled} already installed`,
    );
  }

  private async installMissingPlugins(
    missingPlugins: Array<{ name: string; marketplace: string }>,
    dryRun: boolean,
  ): Promise<InstallationResult[]> {
    this.deps.output.info(
      `\n Installing ${missingPlugins.length} missing plugins:`,
    );

    const results: InstallationResult[] = [];

    for (const { name, marketplace } of missingPlugins) {
      const result = await this.deps.pluginInstaller.installPlugin(
        name,
        marketplace,
        { dryRun },
      );
      results.push(result);
    }

    return results;
  }

  private buildSyncResult(
    totalPlugins: number,
    results: InstallationResult[],
    skippedCount: number,
  ): PluginSyncResult {
    const installed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    this.deps.output.info(
      `\nPlugin sync: ${installed} installed, ${skippedCount} skipped, ${failed} failed\n`,
    );

    if (failed > 0) {
      this.deps.output.info('Failed installations:');
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          this.deps.output.info(`   ${r.plugin}@${r.marketplace}`);
          if (r.error) {
            this.deps.output.info(`     Error: ${r.error}`);
          }
        });
      this.deps.output.info('');
    }

    return {
      totalPlugins,
      installed,
      skipped: skippedCount,
      failed,
      results,
      warnings: [],
    };
  }
}
