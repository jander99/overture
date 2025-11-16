/**
 * Sync Engine - Orchestrates MCP Configuration Synchronization
 *
 * Main orchestration layer for v0.2 multi-client sync workflow:
 * 1. Load user and project configs
 * 2. Merge with proper precedence
 * 3. Filter MCPs by client, platform, transport, scope
 * 4. Acquire process lock
 * 5. Backup existing configs
 * 6. Convert to client format
 * 7. Apply environment variable expansion
 * 8. Generate diff
 * 9. Write configs
 * 10. Release lock
 *
 * @module core/sync-engine
 * @version 2.0
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import type { OvertureConfig, ClientName, Platform } from '../domain/config.types';
import type { ClientAdapter } from '../adapters/client-adapter.interface';
import type { ClientMcpConfig } from '../adapters/client-adapter.interface';
import { getAdapterForClient } from '../adapters/adapter-registry';
import { loadUserConfig, loadProjectConfig, mergeConfigs } from './config-loader';
import { filterMcpsForClient } from './exclusion-filter';
import { getTransportWarnings, hasTransportIssues } from './transport-validator';
import { expandEnvVarsInClientConfig } from './client-env-service';
import { backupClientConfig } from './backup-service';
import { generateDiff } from './config-diff';
import { acquireLock, releaseLock } from './process-lock';
import { findProjectRoot } from './path-resolver';
import { BinaryDetector } from './binary-detector';
import type { BinaryDetectionResult } from '../domain/config.types';
import { PluginDetector } from './plugin-detector';
import { PluginInstaller } from './plugin-installer';
import type { InstallationResult } from '../domain/plugin.types';
import { getUnmanagedMcps } from './mcp-detector';

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
 * Get current platform
 */
function getCurrentPlatform(): Platform {
  const platform = os.platform();
  if (platform === 'darwin') return 'darwin';
  if (platform === 'win32') return 'win32';
  return 'linux';
}

/**
 * Get dry-run output path for debugging
 * Writes to dist/ directory with client name prepended
 *
 * @param clientName - Name of the client
 * @param originalPath - Original config path
 * @returns Path in dist/ directory
 */
function getDryRunOutputPath(clientName: ClientName, originalPath: string): string {
  const distDir = path.join(process.cwd(), 'dist');
  const filename = path.basename(originalPath);
  return path.join(distDir, `${clientName}-${filename}`);
}

/**
 * Ensure dist/ directory exists for dry-run output
 */
function ensureDistDirectory(): void {
  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
}

/**
 * Sync MCP configuration to a single client
 *
 * @param client - Client adapter
 * @param overtureConfig - Merged Overture configuration
 * @param options - Sync options
 * @returns Sync result for this client
 */
async function syncToClient(
  client: ClientAdapter,
  overtureConfig: OvertureConfig,
  options: SyncOptions
): Promise<ClientSyncResult> {
  const platform = options.platform || getCurrentPlatform();
  const warnings: string[] = [];
  let binaryDetection: BinaryDetectionResult | undefined;

  try {
    // Binary detection (if not skipped)
    const skipDetection =
      options.skipBinaryDetection || overtureConfig.sync?.skipBinaryDetection;

    if (!skipDetection) {
      const detector = new BinaryDetector();
      binaryDetection = await detector.detectClient(client, platform);

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
    // If we're in a project and client supports project configs, use project path
    // Otherwise use user path
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
    // This lets us warn about unsupported transports before they're filtered out
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

    // Filter MCPs for this client (this will remove unsupported transports among other exclusions)
    const filteredMcps = filterMcpsForClient(
      overtureConfig.mcp,
      client,
      platform
    );

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
    newConfig = expandEnvVarsInClientConfig(newConfig, client);

    // Preserve manually-added MCPs (not in Overture config)
    if (oldConfig) {
      const oldMcps = oldConfig[client.schemaRootKey] || {};
      const unmanagedMcps = getUnmanagedMcps(oldMcps, filteredMcps);

      if (Object.keys(unmanagedMcps).length > 0) {
        // Merge: Overture-managed MCPs + preserved manually-added MCPs
        newConfig[client.schemaRootKey] = {
          ...unmanagedMcps,          // Manually-added MCPs first (will be overridden if conflict)
          ...newConfig[client.schemaRootKey],  // Overture-managed MCPs (take precedence)
        };

        // Warn user about preserved MCPs
        const unmanagedNames = Object.keys(unmanagedMcps);
        warnings.push(
          `Preserving ${unmanagedNames.length} manually-added MCP${unmanagedNames.length === 1 ? '' : 's'}: ${unmanagedNames.join(', ')}`
        );
        warnings.push(
          `💡 Tip: Add these to .overture/config.yaml to manage with Overture`
        );
      }
    }

    // Generate diff
    const diff = oldConfig
      ? generateDiff(oldConfig, newConfig, client.schemaRootKey)
      : null;

    // Dry run - write to dist/ directory for debugging
    if (options.dryRun) {
      ensureDistDirectory();
      const dryRunPath = getDryRunOutputPath(client.name, configPath);
      await client.writeConfig(dryRunPath, newConfig);

      return {
        client: client.name,
        success: true,
        configPath: dryRunPath, // Return dist/ path to show user where file was written
        diff,
        binaryDetection,
        warnings,
      };
    }

    // Backup existing config (if exists)
    let backupPath: string | undefined;
    if (oldConfig) {
      try {
        backupPath = backupClientConfig(client.name, configPath);
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
 * Sync plugins from user config
 *
 * Installs missing plugins declared in user global config.
 * Reads from ~/.config/overture/config.yaml only (plugins are global in Claude Code).
 * Warns if plugins found in project config.
 *
 * @param userConfig - User global configuration
 * @param projectConfig - Project configuration (for warning detection)
 * @param options - Sync options
 * @returns Plugin sync result
 */
async function syncPlugins(
  userConfig: OvertureConfig | null,
  projectConfig: OvertureConfig | null,
  options: SyncOptions
): Promise<PluginSyncResult> {
  const dryRun = options.dryRun ?? false;

  // Warn if plugins found in project config
  if (
    projectConfig?.plugins &&
    Object.keys(projectConfig.plugins).length > 0
  ) {
    const pluginNames = Object.keys(projectConfig.plugins).join(', ');
    console.warn('⚠️  Warning: Plugin configuration found in project config');
    console.warn('    Plugins found:', pluginNames);
    console.warn('    Claude Code plugins are installed globally');
    console.warn('    Move to ~/.config/overture/config.yaml');
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
  const detector = new PluginDetector();
  const installedPlugins = await detector.detectInstalledPlugins();

  // Build set of installed plugin keys (name@marketplace)
  const installedSet = new Set(
    installedPlugins.map((p) => `${p.name}@${p.marketplace}`)
  );

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
    console.log('\n🔍 DRY RUN: Syncing plugins from user config...');
  } else {
    console.log('\n🔍 Syncing plugins from user config...');
  }

  console.log(
    `📋 Found ${pluginNames.length} plugins in config, ${installedPlugins.length} already installed`
  );

  // No missing plugins - skip
  if (missingPlugins.length === 0) {
    console.log('✅ All plugins already installed\n');
    return {
      installed: 0,
      skipped: skippedPlugins.length,
      failed: 0,
      results: [],
    };
  }

  // Install missing plugins
  console.log(`\n Installing ${missingPlugins.length} missing plugins:`);

  const installer = new PluginInstaller();
  const results: InstallationResult[] = [];

  for (const { name, marketplace } of missingPlugins) {
    const result = await installer.installPlugin(name, marketplace, {
      dryRun,
    });
    results.push(result);
  }

  // Calculate summary
  const installed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  // Show summary
  console.log(
    `\n📦 Plugin sync: ${installed} installed, ${skippedPlugins.length} skipped, ${failed} failed\n`
  );

  // Show failures if any
  if (failed > 0) {
    console.log('⚠️  Failed installations:');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`   • ${r.plugin}@${r.marketplace}`);
        if (r.error) {
          console.log(`     Error: ${r.error}`);
        }
      });
    console.log('');
  }

  return {
    installed,
    skipped: skippedPlugins.length,
    failed,
    results,
  };
}

/**
 * Sync MCP configuration to multiple clients
 *
 * Main entry point for the sync engine. Orchestrates the entire sync workflow.
 *
 * @param options - Sync options
 * @returns Overall sync result
 *
 * @example
 * ```typescript
 * // Sync to all installed clients (context-aware)
 * const result = await syncClients();
 * // If in project dir → syncs to project-level configs
 * // If outside project → syncs to user-level configs
 *
 * // Sync only to Claude Code
 * const result = await syncClients({ clients: ['claude-code'] });
 *
 * // Dry run to see what would change
 * const result = await syncClients({ dryRun: true });
 *
 * // Force specific project root
 * const result = await syncClients({
 *   projectRoot: '/path/to/project'
 * });
 * ```
 */
export async function syncClients(options: SyncOptions = {}): Promise<SyncResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let lockAcquired = false;

  try {
    // Auto-detect project root if not provided
    const detectedProjectRoot = options.projectRoot || findProjectRoot();

    // Load configurations
    const userConfig = await loadUserConfig();
    const projectConfig = detectedProjectRoot
      ? await loadProjectConfig(detectedProjectRoot)
      : null;

    // Merge configs (project overrides user)
    const overtureConfig = mergeConfigs(userConfig, projectConfig);

    // Pass detected project root to all sync operations
    const syncOptionsWithProject: SyncOptions = {
      ...options,
      projectRoot: detectedProjectRoot || undefined,
    };

    // 1. Sync plugins first (before MCP sync)
    if (!options.skipPlugins) {
      try {
        await syncPlugins(userConfig, projectConfig, syncOptionsWithProject);
      } catch (error) {
        // Log plugin sync errors but don't fail the entire sync
        console.warn(`⚠️  Plugin sync failed: ${(error as Error).message}`);
        warnings.push(`Plugin sync failed: ${(error as Error).message}`);
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
      try {
        const adapter = getAdapterForClient(clientName as ClientName);
        clients.push(adapter);
      } catch (error) {
        warnings.push(`Could not load adapter for ${clientName}: ${(error as Error).message}`);
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

    // Acquire process lock (unless dry run)
    if (!options.dryRun) {
      lockAcquired = await acquireLock({ operation: 'sync' });
      if (!lockAcquired) {
        return {
          success: false,
          results: [],
          warnings,
          errors: ['Failed to acquire process lock'],
        };
      }
    }

    // Sync to each client
    const results: ClientSyncResult[] = [];
    for (const client of clients) {
      const result = await syncToClient(client, overtureConfig, syncOptionsWithProject);
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
  } finally {
    // Release lock
    if (lockAcquired) {
      releaseLock();
    }
  }
}

/**
 * Sync to a single client (convenience function)
 *
 * @param client - Client name
 * @param options - Sync options
 * @returns Sync result
 */
export async function syncClient(
  client: ClientName,
  options: SyncOptions = {}
): Promise<ClientSyncResult> {
  const result = await syncClients({ ...options, clients: [client] });
  return result.results[0] || {
    client,
    success: false,
    configPath: '',
    warnings: result.warnings,
    error: result.errors[0] || 'Unknown error',
  };
}
