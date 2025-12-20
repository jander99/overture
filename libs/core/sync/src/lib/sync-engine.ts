/**
 * Sync Engine - Orchestrates MCP Configuration Synchronization
 *
 * Main orchestration layer for v0.2 multi-client sync workflow with dependency injection.
 * This is the refactored version that uses hexagonal architecture with injected dependencies.
 *
 * @module @overture/sync-core/sync-engine
 * @version 3.0
 */

import type {
  OvertureConfig,
  ClientName,
  Platform,
  BinaryDetectionResult,
  InstallationResult,
} from '@overture/config-types';
import type { ClientAdapter, ClientMcpConfig } from '@overture/client-adapters';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { ProcessPort } from '@overture/ports-process';
import type { OutputPort } from '@overture/ports-output';
import type { EnvironmentPort } from '@overture/ports-process';
import type { ConfigLoader } from '@overture/config-core';
import type { AdapterRegistry } from '@overture/client-adapters';
import type { PluginInstaller, PluginDetector } from '@overture/plugin-core';
import type { BinaryDetector } from '@overture/discovery-core';

import { filterMcpsForClient } from './exclusion-filter.js';
import { getTransportWarnings, hasTransportIssues } from './transport-validator.js';
import { expandEnvVarsInClientConfig } from './client-env-service.js';
import { generateDiff } from './config-diff.js';
import { getUnmanagedMcps } from './mcp-detector.js';

/**
 * Sync options
 */
export interface SyncOptions {
  /** Clients to sync (default: all installed) */
  clients?: ClientName[];
  /** Dry run - show what would change without writing */
  dryRun?: boolean;
  /** Force sync even with transport warnings */
  force?: boolean;
  /** Project root directory (optional, auto-detected if not provided) */
  projectRoot?: string;
  /** Platform override (defaults to current platform) */
  platform?: Platform;
  /** Skip binary detection for clients */
  skipBinaryDetection?: boolean;
  /** Skip plugin installation (default: false) */
  skipPlugins?: boolean;
  /** Skip clients that are not detected on system (default: true) */
  skipUndetected?: boolean;
}

/**
 * Sync result for a single client
 */
export interface ClientSyncResult {
  client: ClientName;
  success: boolean;
  configPath: string;
  diff?: any;
  backupPath?: string;
  binaryDetection?: BinaryDetectionResult;
  warnings: string[];
  error?: string;
}

/**
 * Overall sync result
 */
export interface SyncResult {
  success: boolean;
  results: ClientSyncResult[];
  warnings: string[];
  errors: string[];
}

/**
 * Plugin sync result
 */
export interface PluginSyncResult {
  installed: number;
  skipped: number;
  failed: number;
  results: InstallationResult[];
}

/**
 * Dependencies required by SyncEngine
 *
 * All services and ports injected via constructor for testability and decoupling.
 */
export interface SyncEngineDeps {
  /** Filesystem operations port */
  filesystem: FilesystemPort;
  /** Process execution port */
  process: ProcessPort;
  /** Output/logging port */
  output: OutputPort;
  /** Environment information port */
  environment: EnvironmentPort;
  /** Configuration loader service */
  configLoader: ConfigLoader;
  /** Client adapter registry */
  adapterRegistry: AdapterRegistry;
  /** Plugin installer service */
  pluginInstaller: PluginInstaller;
  /** Plugin detector service */
  pluginDetector: PluginDetector;
  /** Binary detector service */
  binaryDetector: BinaryDetector;
  /** Backup service */
  backupService: {
    backup(client: ClientName, configPath: string): string;
  };
  /** Path resolver */
  pathResolver: {
    findProjectRoot(): string | null;
    getDryRunOutputPath(clientName: ClientName, originalPath: string): string;
  };
}

/**
 * Sync Engine with Dependency Injection
 *
 * Orchestrates the entire MCP synchronization workflow using injected dependencies.
 * This design enables:
 * - Easy testing with mocked dependencies
 * - Flexible deployment with different adapters
 * - Clear separation of concerns
 * - No direct Node.js API dependencies
 */
export class SyncEngine {
  constructor(private deps: SyncEngineDeps) {}

  /**
   * Sync MCP configuration to multiple clients
   *
   * Main entry point for the sync engine. Orchestrates the entire sync workflow.
   */
  async syncClients(options: SyncOptions = {}): Promise<SyncResult> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Auto-detect project root if not provided
      const detectedProjectRoot = options.projectRoot || this.deps.pathResolver.findProjectRoot();

      // Load configurations
      const userConfig = await this.deps.configLoader.loadUserConfig();
      const projectConfig = detectedProjectRoot
        ? await this.deps.configLoader.loadProjectConfig(detectedProjectRoot)
        : null;

      // Merge configs (project overrides user)
      const overtureConfig = this.deps.configLoader.mergeConfigs(userConfig, projectConfig);

      // Pass detected project root to all sync operations
      const syncOptionsWithProject: SyncOptions = {
        ...options,
        projectRoot: detectedProjectRoot || undefined,
      };

      // 1. Sync plugins first (before MCP sync)
      if (!options.skipPlugins) {
        try {
          await this.syncPlugins(userConfig, projectConfig, syncOptionsWithProject);
        } catch (error) {
          // Log plugin sync errors but don't fail the entire sync
          const errorMsg = `Plugin sync failed: ${(error as Error).message}`;
          this.deps.output.warn(`⚠️  ${errorMsg}`);
          warnings.push(errorMsg);
        }
      }

      // Determine which clients to sync
      const targetClients = options.clients || [
        'claude-code',
        'claude-desktop',
        'vscode',
        'cursor',
        'windsurf',
        'copilot-cli',
        'jetbrains-copilot',
      ];

      // Get client adapters
      const clients: ClientAdapter[] = [];
      for (const clientName of targetClients) {
        const adapter = this.deps.adapterRegistry.get(clientName as ClientName);
        if (adapter) {
          clients.push(adapter);
        } else {
          warnings.push(`No adapter registered for ${clientName}`);
        }
      }

      if (clients.length === 0) {
        return {
          success: false,
          results: [],
          warnings,
          errors: ['No valid clients to sync'],
        };
      }

      // Sync to each client
      const results: ClientSyncResult[] = [];
      for (const client of clients) {
        const result = await this.syncToClient(client, overtureConfig, syncOptionsWithProject);
        results.push(result);

        // Collect warnings and errors
        warnings.push(...result.warnings);
        if (!result.success && result.error) {
          errors.push(`${client.name}: ${result.error}`);
        }
      }

      const success = results.every((r) => r.success);

      return {
        success,
        results,
        warnings,
        errors,
      };
    } catch (error) {
      errors.push((error as Error).message);
      return {
        success: false,
        results: [],
        warnings,
        errors,
      };
    }
  }

  /**
   * Sync to a single client (convenience method)
   */
  async syncClient(client: ClientName, options: SyncOptions = {}): Promise<ClientSyncResult> {
    const result = await this.syncClients({ ...options, clients: [client] });
    return result.results[0] || {
      client,
      success: false,
      configPath: '',
      warnings: result.warnings,
      error: result.errors[0] || 'Unknown error',
    };
  }

  /**
   * Sync MCP configuration to a single client (internal)
   */
  private async syncToClient(
    client: ClientAdapter,
    overtureConfig: OvertureConfig,
    options: SyncOptions
  ): Promise<ClientSyncResult> {
    const platform = options.platform || this.deps.environment.platform();
    const warnings: string[] = [];
    let binaryDetection: BinaryDetectionResult | undefined;

    try {
      // Binary detection (if not skipped)
      const skipDetection =
        options.skipBinaryDetection || overtureConfig.sync?.skipBinaryDetection;

      if (!skipDetection) {
        binaryDetection = await this.deps.binaryDetector.detectClient(client, platform);

        // Add version info to warnings if detected
        if (binaryDetection.status === 'found' && binaryDetection.version) {
          warnings.push(
            `${client.name} detected: ${binaryDetection.version}${binaryDetection.binaryPath ? ` at ${binaryDetection.binaryPath}` : ''}`
          );
        }

        // Add detection warnings
        if (binaryDetection.warnings.length > 0) {
          warnings.push(...binaryDetection.warnings);
        }

        // If binary not found and skipUndetected is enabled, skip this client
        if (binaryDetection.status === 'not-found' && options.skipUndetected) {
          return {
            client: client.name,
            success: true, // Not a failure, just skipped
            configPath: '', // No config written
            binaryDetection,
            warnings: [],
            error: 'Skipped - client not detected on system',
          };
        }

        // If binary not found but skipUndetected is false, add warning but continue
        if (binaryDetection.status === 'not-found') {
          warnings.push(
            `${client.name} binary/application not detected on system. Generating config anyway.`
          );
        }
      } else {
        binaryDetection = {
          status: 'skipped',
          warnings: [],
        };
      }

      // Check if client is installed (config path check)
      if (!client.isInstalled(platform)) {
        return {
          client: client.name,
          success: false,
          configPath: '',
          binaryDetection,
          warnings: [],
          error: `Client ${client.name} is not installed`,
        };
      }

      // Detect config path
      const configPathResult = client.detectConfigPath(platform, options.projectRoot);

      if (!configPathResult) {
        return {
          client: client.name,
          success: false,
          configPath: '',
          binaryDetection,
          warnings: [],
          error: `Could not determine config path for ${client.name}`,
        };
      }

      // Determine which config path to use based on project context
      const inProject = !!options.projectRoot;
      const configPath =
        typeof configPathResult === 'string'
          ? configPathResult
          : inProject && configPathResult.project
          ? configPathResult.project
          : configPathResult.user;

      if (!configPath) {
        return {
          client: client.name,
          success: false,
          configPath: '',
          binaryDetection,
          warnings: [],
          error: `Could not determine config path for ${client.name}`,
        };
      }

      // Check for transport issues on ALL MCPs (before filtering)
      const transportWarnings = getTransportWarnings(overtureConfig.mcp, client);
      if (transportWarnings.length > 0) {
        warnings.push(...transportWarnings.map((w) => w.message));

        if (!options.force && hasTransportIssues(overtureConfig.mcp, client)) {
          return {
            client: client.name,
            success: false,
            configPath,
            binaryDetection,
            warnings,
            error: `Transport issues detected. Use --force to sync anyway.`,
          };
        }
      }

      // Filter MCPs for this client
      const filteredMcps = filterMcpsForClient(overtureConfig.mcp, client, platform);

      // Read existing config (if exists)
      let oldConfig: ClientMcpConfig | null = null;
      try {
        oldConfig = await client.readConfig(configPath);
      } catch {
        // Config doesn't exist yet - that's ok
      }

      // Convert Overture config to client format
      const filteredOvertureConfig: OvertureConfig = {
        ...overtureConfig,
        mcp: filteredMcps,
      };
      let newConfig = client.convertFromOverture(filteredOvertureConfig, platform);

      // Apply environment variable expansion if client needs it
      newConfig = expandEnvVarsInClientConfig(newConfig, client, this.deps.environment.env);

      // Preserve manually-added MCPs (not in Overture config)
      if (oldConfig) {
        const oldMcps = oldConfig[client.schemaRootKey] || {};
        const unmanagedMcps = getUnmanagedMcps(oldMcps, filteredMcps);

        if (Object.keys(unmanagedMcps).length > 0) {
          // Merge: Overture-managed MCPs + preserved manually-added MCPs
          newConfig[client.schemaRootKey] = {
            ...unmanagedMcps, // Manually-added MCPs first
            ...newConfig[client.schemaRootKey], // Overture-managed MCPs (take precedence)
          };

          // Warn user about preserved MCPs
          const unmanagedNames = Object.keys(unmanagedMcps);
          warnings.push(
            `Preserving ${unmanagedNames.length} manually-added MCP${unmanagedNames.length === 1 ? '' : 's'}: ${unmanagedNames.join(', ')}`
          );
          warnings.push(`💡 Tip: Add these to .overture/config.yaml to manage with Overture`);
        }
      }

      // Generate diff
      const diff = oldConfig ? generateDiff(oldConfig, newConfig, client.schemaRootKey) : null;

      // Dry run - write to dist/ directory for debugging
      if (options.dryRun) {
        const dryRunPath = this.deps.pathResolver.getDryRunOutputPath(client.name, configPath);
        await this.ensureDistDirectory();
        await client.writeConfig(dryRunPath, newConfig);

        return {
          client: client.name,
          success: true,
          configPath: dryRunPath, // Return dist/ path
          diff,
          binaryDetection,
          warnings,
        };
      }

      // Backup existing config (if exists and file actually exists on disk)
      let backupPath: string | undefined;
      if (oldConfig && await this.deps.filesystem.exists(configPath)) {
        try {
          backupPath = this.deps.backupService.backup(client.name, configPath);
        } catch (error) {
          warnings.push(`Backup failed: ${(error as Error).message}`);
        }
      }

      // Write new config
      await client.writeConfig(configPath, newConfig);

      return {
        client: client.name,
        success: true,
        configPath,
        diff,
        backupPath,
        binaryDetection,
        warnings,
      };
    } catch (error) {
      return {
        client: client.name,
        success: false,
        configPath: '',
        binaryDetection,
        warnings,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Sync plugins from user config (internal)
   */
  private async syncPlugins(
    userConfig: OvertureConfig | null,
    projectConfig: OvertureConfig | null,
    options: SyncOptions
  ): Promise<PluginSyncResult> {
    const dryRun = options.dryRun ?? false;

    // Warn if plugins found in project config
    if (projectConfig?.plugins && Object.keys(projectConfig.plugins).length > 0) {
      const pluginNames = Object.keys(projectConfig.plugins).join(', ');
      this.deps.output.warn('⚠️  Warning: Plugin configuration found in project config');
      this.deps.output.warn(`    Plugins found: ${pluginNames}`);
      this.deps.output.warn('    Claude Code plugins are installed globally');
      this.deps.output.warn('    Move to ~/.config/overture.yml');
    }

    // Get plugins from user config only
    const configuredPlugins = userConfig?.plugins || {};
    const pluginNames = Object.keys(configuredPlugins);

    // No plugins configured - skip
    if (pluginNames.length === 0) {
      return {
        installed: 0,
        skipped: 0,
        failed: 0,
        results: [],
      };
    }

    // Detect installed plugins
    const installedPlugins = await this.deps.pluginDetector.detectInstalledPlugins();

    // Build set of installed plugin keys (name@marketplace)
    const installedSet = new Set(installedPlugins.map((p) => `${p.name}@${p.marketplace}`));

    // Calculate missing plugins
    const missingPlugins: Array<{ name: string; marketplace: string }> = [];
    const skippedPlugins: string[] = [];

    for (const name of pluginNames) {
      const config = configuredPlugins[name];
      const key = `${name}@${config.marketplace}`;

      if (installedSet.has(key)) {
        skippedPlugins.push(key);
      } else {
        missingPlugins.push({ name, marketplace: config.marketplace });
      }
    }

    // Show sync status
    if (dryRun) {
      this.deps.output.info('\n🔍 DRY RUN: Syncing plugins from user config...');
    } else {
      this.deps.output.info('\n🔍 Syncing plugins from user config...');
    }

    this.deps.output.info(
      `📋 Found ${pluginNames.length} plugins in config, ${installedPlugins.length} already installed`
    );

    // No missing plugins - skip
    if (missingPlugins.length === 0) {
      this.deps.output.info('✅ All plugins already installed\n');
      return {
        installed: 0,
        skipped: skippedPlugins.length,
        failed: 0,
        results: [],
      };
    }

    // Install missing plugins
    this.deps.output.info(`\n Installing ${missingPlugins.length} missing plugins:`);

    const results: InstallationResult[] = [];

    for (const { name, marketplace } of missingPlugins) {
      const result = await this.deps.pluginInstaller.installPlugin(name, marketplace, {
        dryRun,
      });
      results.push(result);
    }

    // Calculate summary
    const installed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    // Show summary
    this.deps.output.info(
      `\n📦 Plugin sync: ${installed} installed, ${skippedPlugins.length} skipped, ${failed} failed\n`
    );

    // Show failures if any
    if (failed > 0) {
      this.deps.output.info('⚠️  Failed installations:');
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          this.deps.output.info(`   • ${r.plugin}@${r.marketplace}`);
          if (r.error) {
            this.deps.output.info(`     Error: ${r.error}`);
          }
        });
      this.deps.output.info('');
    }

    return {
      installed,
      skipped: skippedPlugins.length,
      failed,
      results,
    };
  }

  /**
   * Ensure dist/ directory exists for dry-run output
   */
  private async ensureDistDirectory(): Promise<void> {
    const distPath = this.deps.pathResolver.getDryRunOutputPath('claude-code' as ClientName, '/temp/config.json');
    const distDir = distPath.substring(0, distPath.lastIndexOf('/'));

    if (!(await this.deps.filesystem.exists(distDir))) {
      await this.deps.filesystem.mkdir(distDir, { recursive: true });
    }
  }
}

/**
 * Factory function to create SyncEngine with dependencies
 */
export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  return new SyncEngine(deps);
}
