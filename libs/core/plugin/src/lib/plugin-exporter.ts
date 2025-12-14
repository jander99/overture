/**
 * Plugin Exporter Service
 *
 * Exports installed Claude Code plugins to Overture user config.
 * Provides interactive selection and config file updates while preserving structure.
 *
 * Uses hexagonal architecture with dependency injection for testability.
 *
 * @module lib/plugin-exporter
 * @version 3.0.0
 */

import type { FilesystemPort } from '@overture/ports-filesystem';
import type { OutputPort } from '@overture/ports-output';
import type { EnvironmentPort } from '@overture/ports-process';
import type { InstalledPlugin, ExportOptions } from '@overture/config-types';
import type { OvertureConfig } from '@overture/config-types';
import { PluginDetector } from './plugin-detector.js';
import { PluginError } from '@overture/errors';
import * as yaml from 'js-yaml';

/**
 * Plugin selection for export
 */
export interface PluginSelection {
  /**
   * Selected plugin names
   */
  selectedPlugins: string[];
}

/**
 * Plugin Exporter Service
 *
 * Exports installed Claude Code plugins to Overture user configuration.
 * Supports interactive selection via checkbox prompts and non-interactive mode
 * with explicit plugin lists.
 *
 * @example
 * ```typescript
 * import { PluginExporter } from '@overture/plugin-core';
 * import { NodeFilesystemAdapter, ConsoleOutputAdapter, NodeEnvironmentAdapter } from '@overture/adapters-node';
 *
 * const filesystem = new NodeFilesystemAdapter();
 * const output = new ConsoleOutputAdapter();
 * const environment = new NodeEnvironmentAdapter();
 * const detector = new PluginDetector(filesystem, environment);
 * const exporter = new PluginExporter(filesystem, output, detector);
 *
 * // Interactive export (prompts user)
 * await exporter.exportPlugins({ interactive: true });
 *
 * // Non-interactive export (explicit list)
 * await exporter.exportPlugins({
 *   interactive: false,
 *   pluginNames: ['python-development', 'backend-development']
 * });
 * ```
 */
export class PluginExporter {
  private readonly filesystem: FilesystemPort;
  private readonly output: OutputPort;
  private readonly detector: PluginDetector;
  private readonly environment: EnvironmentPort;

  constructor(
    filesystem: FilesystemPort,
    output: OutputPort,
    detector: PluginDetector,
    environment: EnvironmentPort
  ) {
    this.filesystem = filesystem;
    this.output = output;
    this.detector = detector;
    this.environment = environment;
  }

  /**
   * Export installed plugins to user config
   *
   * Workflow:
   * 1. Detect all installed plugins
   * 2. Prompt user to select plugins (interactive) or use provided list
   * 3. Update ~/.config/overture.yml with selected plugins
   * 4. Preserve existing config structure and formatting
   *
   * @param options - Export options (interactive mode, explicit plugin list)
   * @returns Promise that resolves when export is complete
   * @throws {PluginError} If config update fails
   *
   * @example
   * ```typescript
   * // Interactive selection
   * await exporter.exportPlugins({ interactive: true });
   *
   * // Explicit plugin list
   * await exporter.exportPlugins({
   *   interactive: false,
   *   pluginNames: ['python-development']
   * });
   * ```
   */
  async exportPlugins(options: ExportOptions = {}): Promise<void> {
    const interactive = options.interactive ?? true;

    // Detect installed plugins
    const installedPlugins = await this.detector.detectInstalledPlugins();

    if (installedPlugins.length === 0) {
      this.output.info('ℹ️  No plugins installed. Nothing to export.');
      return;
    }

    // Select plugins to export
    let selectedPlugins: InstalledPlugin[];

    if (interactive) {
      // Interactive mode - prompt user
      selectedPlugins = await this.promptPluginSelection(installedPlugins);

      if (selectedPlugins.length === 0) {
        this.output.info('ℹ️  No plugins selected. Export cancelled.');
        return;
      }
    } else {
      // Non-interactive mode - use explicit list
      if (!options.pluginNames || options.pluginNames.length === 0) {
        throw new PluginError(
          'Non-interactive mode requires pluginNames option',
          undefined
        );
      }

      selectedPlugins = installedPlugins.filter((plugin) =>
        options.pluginNames!.includes(plugin.name)
      );

      if (selectedPlugins.length === 0) {
        throw new PluginError(
          `No installed plugins match the provided names: ${options.pluginNames.join(', ')}`,
          undefined
        );
      }
    }

    // Update user config with selected plugins
    await this.updateUserConfig(selectedPlugins);

    this.output.success(`✅ Updated user config with ${selectedPlugins.length} plugins:`);
    for (const plugin of selectedPlugins) {
      this.output.info(`   • ${plugin.name}@${plugin.marketplace}`);
    }
  }

  /**
   * Prompt user to select plugins for export
   *
   * Uses inquirer checkbox prompt to allow multi-select of installed plugins.
   * This method should be implemented with inquirer when the feature is built.
   *
   * @param plugins - Available installed plugins
   * @returns Array of selected plugins
   *
   * @example
   * ```typescript
   * const selected = await exporter.promptPluginSelection(installedPlugins);
   * // User selects via checkbox interface
   * ```
   */
  private async promptPluginSelection(
    plugins: InstalledPlugin[]
  ): Promise<InstalledPlugin[]> {
    // TODO: Implement with inquirer in actual implementation
    // This is a placeholder for the interface design
    //
    // Expected implementation:
    // ```typescript
    // import inquirer from 'inquirer';
    //
    // const choices = plugins.map(p => ({
    //   name: `${p.name}@${p.marketplace}${p.enabled ? '' : ' (disabled)'}`,
    //   value: p.name,
    //   checked: true
    // }));
    //
    // const answers = await inquirer.prompt<PluginSelection>([
    //   {
    //     type: 'checkbox',
    //     name: 'selectedPlugins',
    //     message: 'Select plugins to export to config:',
    //     choices
    //   }
    // ]);
    //
    // return plugins.filter(p => answers.selectedPlugins.includes(p.name));
    // ```

    throw new Error(
      'Interactive plugin selection not yet implemented. Use non-interactive mode with pluginNames option.'
    );
  }

  /**
   * Update user config with selected plugins
   *
   * Reads existing user config, adds/updates plugin entries, and writes back
   * while preserving YAML structure and comments.
   *
   * Plugin format in config:
   * ```yaml
   * plugins:
   *   python-development:
   *     marketplace: claude-code-workflows
   *     enabled: true
   *     mcps: []  # Preserve existing mcps if present
   * ```
   *
   * @param selectedPlugins - Plugins to add to config
   * @throws {PluginError} If config file cannot be read or written
   *
   * @example
   * ```typescript
   * await exporter.updateUserConfig([
   *   { name: 'python-development', marketplace: 'claude-code-workflows', enabled: true }
   * ]);
   * ```
   */
  private async updateUserConfig(selectedPlugins: InstalledPlugin[]): Promise<void> {
    const configPath = this.getUserConfigPath();

    try {
      // Read existing config (or create empty if not exists)
      let existingConfig: OvertureConfig;

      const exists = await this.filesystem.exists(configPath);
      if (exists) {
        const content = await this.filesystem.readFile(configPath);
        existingConfig = yaml.load(content) as OvertureConfig;
      } else {
        // File doesn't exist - create minimal config
        existingConfig = {
          version: '2.0',
          mcp: {},
        };
      }

      // Ensure plugins section exists
      const updatedConfig: any = {
        ...existingConfig,
        plugins: existingConfig.plugins || {},
      };

      // Add selected plugins to config
      for (const plugin of selectedPlugins) {
        const existingPluginConfig = updatedConfig.plugins[plugin.name] || {};

        updatedConfig.plugins[plugin.name] = {
          marketplace: plugin.marketplace,
          enabled: plugin.enabled,
          // Preserve existing mcps array if present, otherwise empty
          mcps: existingPluginConfig.mcps || [],
        };
      }

      // Write updated config back to file
      const yamlContent = yaml.dump(updatedConfig, {
        indent: 2,
        lineWidth: 100,
        noRefs: true,
        sortKeys: false, // Preserve key order
      });

      await this.filesystem.writeFile(configPath, yamlContent);
    } catch (error) {
      throw new PluginError(
        `Failed to update user config: ${(error as Error).message}`,
        undefined
      );
    }
  }

  /**
   * Export all installed plugins to config
   *
   * Convenience method to export all installed plugins without prompting.
   *
   * @returns Promise that resolves when export is complete
   *
   * @example
   * ```typescript
   * await exporter.exportAllPlugins();
   * ```
   */
  async exportAllPlugins(): Promise<void> {
    const installedPlugins = await this.detector.detectInstalledPlugins();

    if (installedPlugins.length === 0) {
      this.output.info('ℹ️  No plugins installed. Nothing to export.');
      return;
    }

    await this.updateUserConfig(installedPlugins);

    this.output.success(`✅ Exported all ${installedPlugins.length} installed plugins to config`);
  }

  /**
   * Check which plugins are in config vs installed
   *
   * Compares installed plugins with plugins in user config to identify:
   * - Plugins installed but not in config
   * - Plugins in config but not installed
   * - Plugins both installed and in config
   *
   * @returns Object with categorized plugins
   *
   * @example
   * ```typescript
   * const comparison = await exporter.compareInstalledWithConfig();
   * console.log('Not in config:', comparison.installedOnly);
   * console.log('Not installed:', comparison.configOnly);
   * console.log('Synced:', comparison.both);
   * ```
   */
  async compareInstalledWithConfig(): Promise<{
    installedOnly: InstalledPlugin[];
    configOnly: string[];
    both: InstalledPlugin[];
  }> {
    // Detect installed plugins
    const installedPlugins = await this.detector.detectInstalledPlugins();

    // Read config
    const configPath = this.getUserConfigPath();
    let configPlugins: Set<string> = new Set();

    try {
      const exists = await this.filesystem.exists(configPath);
      if (exists) {
        const content = await this.filesystem.readFile(configPath);
        const config = yaml.load(content) as OvertureConfig;

        if (config.plugins) {
          configPlugins = new Set(Object.keys(config.plugins));
        }
      }
    } catch (error) {
      // Log other errors (permission denied, disk full, malformed YAML, etc.)
      this.output.warn(`⚠️  Could not read config: ${(error as Error).message}`);
    }

    // Categorize plugins
    const installedOnly: InstalledPlugin[] = [];
    const both: InstalledPlugin[] = [];

    for (const plugin of installedPlugins) {
      if (configPlugins.has(plugin.name)) {
        both.push(plugin);
        configPlugins.delete(plugin.name);
      } else {
        installedOnly.push(plugin);
      }
    }

    // Remaining plugins in configPlugins are in config but not installed
    const configOnly = Array.from(configPlugins);

    return {
      installedOnly,
      configOnly,
      both,
    };
  }

  /**
   * Get user config path based on platform
   *
   * @returns Path to user Overture config
   * @internal
   */
  private getUserConfigPath(): string {
    const homeDir = this.environment.homedir();
    const platform = this.environment.platform();
    const separator = platform === 'win32' ? '\\' : '/';

    if (platform === 'linux') {
      // Linux: XDG_CONFIG_HOME or ~/.config
      const xdgConfigHome = this.environment.env.XDG_CONFIG_HOME;
      if (xdgConfigHome) {
        return `${xdgConfigHome}${separator}overture.yml`;
      }
      return `${homeDir}${separator}.config${separator}overture.yml`;
    }

    // macOS and Windows: ~/.config
    return `${homeDir}${separator}.config${separator}overture.yml`;
  }
}
