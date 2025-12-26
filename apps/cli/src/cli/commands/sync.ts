import { Command } from 'commander';
import chalk from 'chalk';
import type { AppDependencies } from '../../composition-root';
import type { ClientName } from '@overture/config-types';
import { formatDiff } from '@overture/sync-core';
import type { SyncResult, ClientSyncResult } from '@overture/sync-core';
import { ErrorHandler } from '@overture/utils';

/**
 * Generates a table showing which MCP servers are configured for which clients.
 * Shows the source level (global/project) for each MCP server and which clients
 * have them configured.
 *
 * @param result - The sync result containing client sync information
 * @returns Formatted table as a string
 */
function generateMcpTable(result: SyncResult): string {
  // Collect all unique MCP server names across all clients
  const allMcpNames = new Set<string>();
  const mcpSourceMap = new Map<string, 'global' | 'project'>();

  // Build a map of client -> MCP servers with their sources
  const clientMcps = new Map<string, Map<string, 'global' | 'project'>>();

  for (const clientResult of result.results) {
    if (!clientResult.success || !clientResult.mcpSources) continue;

    const mcpMap = new Map<string, 'global' | 'project'>();
    for (const [mcpName, source] of Object.entries(clientResult.mcpSources)) {
      allMcpNames.add(mcpName);
      mcpMap.set(mcpName, source);
      // Store the source for the first column
      if (!mcpSourceMap.has(mcpName)) {
        mcpSourceMap.set(mcpName, source);
      }
    }
    clientMcps.set(clientResult.client, mcpMap);
  }

  if (allMcpNames.size === 0) {
    return '';
  }

  // Sort MCP names: global first, then project, then alphabetically within each group
  const sortedMcpNames = Array.from(allMcpNames).sort((a, b) => {
    const sourceA = mcpSourceMap.get(a) || 'project';
    const sourceB = mcpSourceMap.get(b) || 'project';

    if (sourceA === sourceB) {
      return a.localeCompare(b);
    }
    return sourceA === 'global' ? -1 : 1;
  });

  // Get client names from results
  const clientNames = Array.from(clientMcps.keys());

  // Calculate column widths
  const mcpColumnWidth = Math.max(
    15,
    ...sortedMcpNames.map((name) => name.length),
  );
  const sourceColumnWidth = 10;
  const clientColumnWidth = 15;

  // Build table header
  const header = [
    'MCP Server'.padEnd(mcpColumnWidth),
    'Source'.padEnd(sourceColumnWidth),
    ...clientNames.map((name) => name.padEnd(clientColumnWidth)),
  ].join(' | ');

  const separator = [
    '-'.repeat(mcpColumnWidth),
    '-'.repeat(sourceColumnWidth),
    ...clientNames.map(() => '-'.repeat(clientColumnWidth)),
  ].join('-|-');

  // Build table rows
  const rows: string[] = [];
  for (const mcpName of sortedMcpNames) {
    const source = mcpSourceMap.get(mcpName) || 'project';
    const sourceDisplay = source === 'global' ? 'Global' : 'Project';

    const row = [
      mcpName.padEnd(mcpColumnWidth),
      sourceDisplay.padEnd(sourceColumnWidth),
      ...clientNames.map((clientName) => {
        const clientMcp = clientMcps.get(clientName);
        if (clientMcp?.has(mcpName)) {
          const mcpSource = clientMcp.get(mcpName);
          return `✓ (${mcpSource})`.padEnd(clientColumnWidth);
        }
        return '-'.padEnd(clientColumnWidth);
      }),
    ].join(' | ');

    rows.push(row);
  }

  return [header, separator, ...rows].join('\n');
}

/**
 * Determines if a warning is critical and should be displayed.
 * Critical warnings include config file errors, permission issues, and sync failures.
 * Informational warnings about binary detection are filtered out.
 *
 * @param warning - The warning message to check
 * @returns true if the warning is critical and should be shown
 */
function isCriticalWarning(warning: string): boolean {
  const warningLower = warning.toLowerCase();

  // Include critical warnings
  const criticalKeywords = [
    'invalid',
    'error',
    'failed',
    'permission',
    'denied',
  ];
  if (criticalKeywords.some((keyword) => warningLower.includes(keyword))) {
    return true;
  }

  // Exclude informational warnings
  const informationalKeywords = [
    'detected:',
    'not detected on system',
    'will still be generated',
  ];
  if (informationalKeywords.some((keyword) => warningLower.includes(keyword))) {
    return false;
  }

  // Include all other warnings by default
  return true;
}

/**
 * Creates the 'sync' command for synchronizing MCP configurations to clients.
 *
 * Usage: overture sync [options]
 *
 * Performs the following operations:
 * 1. Loads user and project configurations
 * 2. Merges configs with proper precedence
 * 3. Filters MCPs by client, platform, and transport
 * 4. Backs up existing client configs
 * 5. Generates client-specific MCP configurations
 * 6. Writes configs to each client's config directory
 *
 * @param deps - Application dependencies from composition root
 * @returns Configured Commander Command instance
 */
export function createSyncCommand(deps: AppDependencies): Command {
  const { syncEngine, output, configLoader, pathResolver } = deps;
  const command = new Command('sync');

  command
    .description(
      'Sync MCP configuration and Agent Skills to AI clients (overwrites existing)',
    )
    .option('--dry-run', 'Preview changes without writing files')
    .option(
      '--client <name>',
      'Sync only for specific client (e.g., claude-code, claude-desktop)',
    )
    .option('--force', 'Force sync even if validation warnings exist')
    .option('--skip-plugins', 'Skip plugin installation, only sync MCPs')
    .option('--skip-skills', 'Skip skill synchronization, only sync MCPs')
    .option(
      '--no-skip-undetected',
      'Generate configs even for clients not detected on system',
    )
    .option(
      '--detail',
      'Show detailed output including diffs, plugin plans, and all warnings',
    )
    .action(async (options) => {
      try {
        // Load config to determine detail mode default
        let detailMode = options.detail || false;
        try {
          const projectRoot = pathResolver.findProjectRoot();
          const userConfig = await configLoader.loadUserConfig();
          const projectConfig = projectRoot
            ? await configLoader.loadProjectConfig(projectRoot)
            : null;
          const overtureConfig = configLoader.mergeConfigs(
            userConfig,
            projectConfig,
          );
          detailMode = options.detail ?? overtureConfig.sync?.detail ?? false;
        } catch {
          // Config load failed, use CLI flag or false
        }

        // Show dry-run indicator
        if (options.dryRun) {
          output.info('Running in dry-run mode - no changes will be made');
        }

        // Show client filter if specified
        if (options.client) {
          output.info(`Syncing for client: ${options.client}`);
        }

        // Build sync options (projectRoot auto-detected by sync engine)
        const syncOptions = {
          dryRun: options.dryRun || false,
          force: options.force || false,
          skipPlugins: options.skipPlugins || false,
          skipSkills: options.skipSkills || false,
          skipUndetected: options.skipUndetected !== false, // Default to true (becomes false only when --no-skip-undetected is used)
          clients: options.client ? [options.client as ClientName] : undefined,
          detail: detailMode,
        };

        // Run sync via injected sync engine
        const result = await syncEngine.syncClients(syncOptions);

        // ==================== Phase 1: Detection Summary ====================
        (output as any).section('🔍 Detecting clients...');
        (output as any).nl();

        // Separate clients by detection status and whether they were actually skipped
        // Note: With dual-sync, we may have 2 results per client (user + project)
        // Deduplicate by client name for detection display
        const seenClients = new Set<string>();
        const detectedClients = result.results.filter((r) => {
          if (seenClients.has(r.client)) return false;
          if (r.binaryDetection?.status === 'found') {
            seenClients.add(r.client);
            return true;
          }
          return false;
        });

        seenClients.clear();
        const actuallySkippedClients = result.results.filter((r) => {
          if (seenClients.has(r.client)) return false;
          if (r.error === 'Skipped - client not detected on system') {
            seenClients.add(r.client);
            return true;
          }
          return false;
        });

        seenClients.clear();
        const undetectedButSyncedClients = result.results.filter((r) => {
          if (seenClients.has(r.client)) return false;
          if (
            r.binaryDetection?.status === 'not-found' &&
            r.error !== 'Skipped - client not detected on system'
          ) {
            seenClients.add(r.client);
            return true;
          }
          return false;
        });

        // Show detected clients
        for (const clientResult of detectedClients) {
          const detection = clientResult.binaryDetection;
          if (!detection) {
            output.warn(
              `${clientResult.client} was detected but has no detection details; skipping from detection summary.`,
            );
            continue;
          }
          const versionStr = detection.version
            ? ` (v${detection.version})`
            : '';
          const configPath = detection.configPath || clientResult.configPath;
          output.success(`${clientResult.client}${versionStr} → ${configPath}`);
        }

        // Show undetected but synced clients (when --no-skip-undetected is used)
        for (const clientResult of undetectedButSyncedClients) {
          const configPath = clientResult.configPath;
          output.warn(
            `${clientResult.client} - not detected but config will be generated → ${configPath}`,
          );
        }

        // Show actually skipped clients
        for (const clientResult of actuallySkippedClients) {
          (output as any).skip(
            `${clientResult.client} - not detected, skipped`,
          );
        }

        // ==================== Phase 1.3: MCP Configuration Table ====================
        const mcpTable = generateMcpTable(result);
        if (mcpTable) {
          console.log();
          console.log(chalk.bold('📋 MCP Server Configuration:'));
          console.log();
          console.log(mcpTable);
          console.log();
        }

        // ==================== Phase 1.5: Plugin Sync Plan (detail mode) ====================
        if (detailMode && result.pluginSyncDetails) {
          const details = result.pluginSyncDetails;
          (output as any).section('📦 Plugin Sync Plan:');
          (output as any).nl();
          output.info(`  Configured: ${details.configured} plugins`);
          output.info(`  Already installed: ${details.installed}`);

          if (details.toInstall.length > 0) {
            output.info(`  To install: ${details.toInstall.length}`);
            for (const plugin of details.toInstall) {
              output.info(`    - ${plugin.name}@${plugin.marketplace}`);
            }
          } else {
            output.success(`  ✅ All plugins already installed`);
          }
          (output as any).nl();
        }

        // ==================== Phase 1.6: Skill Sync Summary ====================
        if (result.skillSyncSummary && result.skillSyncSummary.total > 0) {
          const summary = result.skillSyncSummary;
          output.info('📚 Skills:');
          if (summary.synced > 0) {
            // Calculate unique skills and clients from synced results
            const syncedResults = summary.results.filter(
              (r) => r.success && !r.skipped,
            );
            const uniqueSkills = new Set(syncedResults.map((r) => r.skill));
            const uniqueClients = new Set(syncedResults.map((r) => r.client));

            const skillCount = uniqueSkills.size;
            const clientCount = uniqueClients.size;
            const totalOps = summary.synced;

            output.success(
              `  ✓ Synced ${skillCount} skill(s) to ${clientCount} client(s) (${totalOps} total operations)`,
            );
          }
          if (summary.skipped > 0) {
            output.info(`  ○ Skipped ${summary.skipped} (already synced)`);
          }
          if (summary.failed > 0) {
            output.warn(`  ✗ Failed ${summary.failed} skill(s)`);
            if (detailMode) {
              const failedSkills = summary.results
                .filter((r) => !r.success)
                .map((r) => `${r.skill} (${r.client})`);
              for (const skill of failedSkills) {
                output.warn(`    - ${skill}`);
              }
            }
          }
          (output as any).nl();
        }

        // ==================== Phase 2: Sync Summary ====================
        const syncedClients = [
          ...detectedClients,
          ...undetectedButSyncedClients,
        ];
        if (syncedClients.length > 0) {
          (output as any).section('⚙️  Syncing configurations...');
          (output as any).nl();

          // Group results by client to show user + project syncs together
          const resultsByClient = new Map<string, ClientSyncResult[]>();
          for (const r of result.results) {
            if (!resultsByClient.has(r.client)) {
              resultsByClient.set(r.client, []);
            }
            resultsByClient.get(r.client)!.push(r);
          }

          // Display results grouped by client
          for (const clientName of resultsByClient.keys()) {
            const clientResults = resultsByClient.get(clientName)!;
            const allSuccess = clientResults.every((r) => r.success);

            if (allSuccess) {
              // Show which configs were synced
              const configs = clientResults
                .map((r) => {
                  if (r.configType === 'user') return 'user';
                  if (r.configType === 'project') return 'project';
                  return null;
                })
                .filter(Boolean);

              const configStr =
                configs.length > 1 ? ` (${configs.join(' + ')} configs)` : '';
              output.success(`${clientName} - synchronized${configStr}`);

              // Show diff in detail mode for each config
              if (detailMode) {
                for (const clientResult of clientResults) {
                  if (clientResult.diff && clientResult.diff.hasChanges) {
                    (output as any).nl();

                    const configLabel = clientResult.configType
                      ? ` (${clientResult.configType} config)`
                      : '';

                    // Show MCP sources if available
                    if (clientResult.mcpSources) {
                      const globalMcps: string[] = [];
                      const projectMcps: string[] = [];

                      // Categorize MCPs by source
                      for (const [mcpName, source] of Object.entries(
                        clientResult.mcpSources,
                      )) {
                        if (source === 'global') {
                          globalMcps.push(mcpName);
                        } else {
                          projectMcps.push(mcpName);
                        }
                      }

                      output.info(
                        `Configuration changes for ${clientResult.client}${configLabel}:`,
                      );
                      (output as any).nl();

                      if (globalMcps.length > 0) {
                        output.info(`Global MCPs (${globalMcps.length}):`);
                        for (const mcpName of globalMcps.sort()) {
                          output.info(`  ~ ${mcpName}`);
                        }
                        (output as any).nl();
                      }

                      if (projectMcps.length > 0) {
                        output.info(`Project MCPs (${projectMcps.length}):`);
                        for (const mcpName of projectMcps.sort()) {
                          output.info(`  ~ ${mcpName}`);
                        }
                        (output as any).nl();
                      }
                    }

                    const diffOutput = formatDiff(clientResult.diff);
                    console.log(diffOutput); // Use console.log to preserve formatting
                    (output as any).nl();
                  }
                }
              }
            } else {
              output.error(`${clientName} - sync failed`);
            }
          }
        }

        // ==================== Phase 3: Warnings ====================
        const criticalWarnings: Array<{ client: string; warning: string }> = [];
        const informationalWarnings: Array<{
          client: string;
          warning: string;
        }> = [];
        const globalWarnings: string[] = [];
        const tips: Set<string> = new Set();

        // Collect global warnings (config validation, etc.)
        for (const warning of result.warnings) {
          globalWarnings.push(warning);
        }

        // Collect warnings from client results
        for (const clientResult of result.results) {
          for (const warning of clientResult.warnings) {
            // Extract tips separately
            if (warning.includes('💡 Tip:')) {
              tips.add(warning);
              continue;
            }

            if (detailMode) {
              // Detail mode: categorize all warnings
              if (isCriticalWarning(warning)) {
                criticalWarnings.push({ client: clientResult.client, warning });
              } else {
                informationalWarnings.push({
                  client: clientResult.client,
                  warning,
                });
              }
            } else {
              // Normal mode: only critical warnings
              if (isCriticalWarning(warning)) {
                criticalWarnings.push({ client: clientResult.client, warning });
              }
            }
          }
        }

        // Display warnings
        if (
          globalWarnings.length > 0 ||
          criticalWarnings.length > 0 ||
          informationalWarnings.length > 0
        ) {
          (output as any).section('⚠️  Warnings:');

          // Show global warnings first (config validation issues)
          if (globalWarnings.length > 0) {
            (output as any).nl();
            output.warn('Configuration:');
            for (const warning of globalWarnings) {
              output.warn(`  - ${warning}`);
            }
          }

          if (criticalWarnings.length > 0) {
            if (
              detailMode &&
              (informationalWarnings.length > 0 || globalWarnings.length > 0)
            ) {
              (output as any).nl();
              output.warn('Critical:');
            }
            for (const item of criticalWarnings) {
              output.warn(`  - ${item.client}: ${item.warning}`);
            }
          }

          if (detailMode && informationalWarnings.length > 0) {
            (output as any).nl();
            output.info('Informational:');
            for (const item of informationalWarnings) {
              output.info(`  - ${item.client}: ${item.warning}`);
            }
          }
        }

        // Show unique tips at the end if any exist
        if (tips.size > 0) {
          if (
            criticalWarnings.length === 0 &&
            informationalWarnings.length === 0
          ) {
            (output as any).section('💡 Tips:');
          } else {
            (output as any).nl();
          }
          for (const tip of tips) {
            output.info(`  ${tip}`);
          }
        }

        // Show global errors
        if (result.errors.length > 0) {
          (output as any).section('❌ Errors:');
          for (const error of result.errors) {
            output.error(`  - ${error}`);
          }
        }

        // ==================== Phase 4: Backup Info (detail mode) ====================
        if (detailMode) {
          const backups = result.results.filter((r) => r.backupPath);
          if (backups.length > 0) {
            (output as any).section('💾 Backups:');
            for (const clientResult of backups) {
              output.info(
                `  ${clientResult.client}: ${clientResult.backupPath}`,
              );
            }
          }
        }

        // Final status
        (output as any).nl();
        if (result.success) {
          output.success('Sync complete!');
        } else {
          output.error('Sync completed with errors');
        }

        // Exit with appropriate code
        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        ErrorHandler.handleCommandError(error, 'sync');
      }
    });

  return command;
}
