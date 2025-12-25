import { Command } from 'commander';
import type { AppDependencies } from '../../composition-root';
import type { ClientName } from '@overture/config-types';
import { formatDiff } from '@overture/sync-core';
import { ErrorHandler } from '@overture/utils';

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
    .description('Sync MCP configuration and Agent Skills to AI clients')
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
        output.section('🔍 Detecting clients...');
        output.nl();

        // Separate clients by detection status and whether they were actually skipped
        const detectedClients = result.results.filter(
          (r) => r.binaryDetection?.status === 'found',
        );
        const actuallySkippedClients = result.results.filter(
          (r) => r.error === 'Skipped - client not detected on system',
        );
        const undetectedButSyncedClients = result.results.filter(
          (r) =>
            r.binaryDetection?.status === 'not-found' &&
            r.error !== 'Skipped - client not detected on system',
        );

        // Show detected clients
        for (const clientResult of detectedClients) {
          const detection = clientResult.binaryDetection;
          if (!detection) continue;
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
          output.skip(`${clientResult.client} - not detected, skipped`);
        }

        // ==================== Phase 1.5: Plugin Sync Plan (detail mode) ====================
        if (detailMode && result.pluginSyncDetails) {
          const details = result.pluginSyncDetails;
          output.section('📦 Plugin Sync Plan:');
          output.nl();
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
          output.nl();
        }

        // ==================== Phase 1.6: Skill Sync Summary ====================
        if (result.skillSyncSummary && result.skillSyncSummary.total > 0) {
          const summary = result.skillSyncSummary;
          output.info('📚 Skills:');
          if (summary.synced > 0) {
            output.success(`  ✓ Synced ${summary.synced} skill(s) to clients`);
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
          output.nl();
        }

        // ==================== Phase 2: Sync Summary ====================
        const syncedClients = [
          ...detectedClients,
          ...undetectedButSyncedClients,
        ];
        if (syncedClients.length > 0) {
          output.section('⚙️  Syncing configurations...');
          output.nl();

          for (const clientResult of syncedClients) {
            if (clientResult.success) {
              output.success(`${clientResult.client} - synchronized`);

              // Show diff in detail mode
              if (
                detailMode &&
                clientResult.diff &&
                clientResult.diff.hasChanges
              ) {
                output.nl();

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
                    `Configuration changes for ${clientResult.client}:`,
                  );
                  output.nl();

                  if (globalMcps.length > 0) {
                    output.info(`Global MCPs (${globalMcps.length}):`);
                    for (const mcpName of globalMcps.sort()) {
                      output.info(`  ~ ${mcpName}`);
                    }
                    output.nl();
                  }

                  if (projectMcps.length > 0) {
                    output.info(`Project MCPs (${projectMcps.length}):`);
                    for (const mcpName of projectMcps.sort()) {
                      output.info(`  ~ ${mcpName}`);
                    }
                    output.nl();
                  }
                }

                const diffOutput = formatDiff(clientResult.diff);
                console.log(diffOutput); // Use console.log to preserve formatting
                output.nl();
              }
            } else {
              output.error(`${clientResult.client} - sync failed`);
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
          output.section('⚠️  Warnings:');

          // Show global warnings first (config validation issues)
          if (globalWarnings.length > 0) {
            output.nl();
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
              output.nl();
              output.warn('Critical:');
            }
            for (const item of criticalWarnings) {
              output.warn(`  - ${item.client}: ${item.warning}`);
            }
          }

          if (detailMode && informationalWarnings.length > 0) {
            output.nl();
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
            output.section('💡 Tips:');
          } else {
            output.nl();
          }
          for (const tip of tips) {
            output.info(`  ${tip}`);
          }
        }

        // Show global errors
        if (result.errors.length > 0) {
          output.section('❌ Errors:');
          for (const error of result.errors) {
            output.error(`  - ${error}`);
          }
        }

        // ==================== Phase 4: Backup Info (detail mode) ====================
        if (detailMode) {
          const backups = result.results.filter((r) => r.backupPath);
          if (backups.length > 0) {
            output.section('💾 Backups:');
            for (const clientResult of backups) {
              output.info(
                `  ${clientResult.client}: ${clientResult.backupPath}`,
              );
            }
          }
        }

        // Final status
        output.nl();
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
