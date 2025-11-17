import { Command } from 'commander';
import { syncClients } from '../../core/sync-engine';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../core/error-handler';
import type { ClientName } from '../../domain/config.types';

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
  const criticalKeywords = ['invalid', 'error', 'failed', 'permission', 'denied'];
  if (criticalKeywords.some((keyword) => warningLower.includes(keyword))) {
    return true;
  }

  // Exclude informational warnings
  const informationalKeywords = ['detected:', 'not detected on system', 'will still be generated'];
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
 */
export function createSyncCommand(): Command {
  const command = new Command('sync');

  command
    .description('Sync MCP configuration to AI clients')
    .option('--dry-run', 'Preview changes without writing files')
    .option('--client <name>', 'Sync only for specific client (e.g., claude-code, claude-desktop)')
    .option('--force', 'Force sync even if validation warnings exist')
    .option('--skip-plugins', 'Skip plugin installation, only sync MCPs')
    .option('--no-skip-undetected', 'Generate configs even for clients not detected on system')
    .action(async (options) => {
      try {
        // Show dry-run indicator
        if (options.dryRun) {
          Logger.info('Running in dry-run mode - no changes will be made');
        }

        // Show client filter if specified
        if (options.client) {
          Logger.info(`Syncing for client: ${options.client}`);
        }

        // Build sync options (projectRoot auto-detected by sync engine)
        const syncOptions = {
          dryRun: options.dryRun || false,
          force: options.force || false,
          skipPlugins: options.skipPlugins || false,
          skipUndetected: options.skipUndetected !== false, // Default to true (becomes false only when --no-skip-undetected is used)
          clients: options.client ? [options.client as ClientName] : undefined,
        };

        // Run sync
        const result = await syncClients(syncOptions);

        // ==================== Phase 1: Detection Summary ====================
        Logger.section('🔍 Detecting clients...');
        Logger.nl();

        // Separate clients by detection status and whether they were actually skipped
        const detectedClients = result.results.filter(
          (r) => r.binaryDetection?.status === 'found'
        );
        const actuallySkippedClients = result.results.filter(
          (r) => r.error === 'Skipped - client not detected on system'
        );
        const undetectedButSyncedClients = result.results.filter(
          (r) => r.binaryDetection?.status === 'not-found' && r.error !== 'Skipped - client not detected on system'
        );

        // Show detected clients
        for (const clientResult of detectedClients) {
          const detection = clientResult.binaryDetection!;
          const versionStr = detection.version ? ` (v${detection.version})` : '';
          const configPath = detection.configPath || clientResult.configPath;
          Logger.success(`${clientResult.client}${versionStr} → ${configPath}`);
        }

        // Show undetected but synced clients (when --no-skip-undetected is used)
        for (const clientResult of undetectedButSyncedClients) {
          const configPath = clientResult.configPath;
          Logger.warn(`${clientResult.client} - not detected but config will be generated → ${configPath}`);
        }

        // Show actually skipped clients
        for (const clientResult of actuallySkippedClients) {
          Logger.skip(`${clientResult.client} - not detected, skipped`);
        }

        // ==================== Phase 2: Sync Summary ====================
        const syncedClients = [...detectedClients, ...undetectedButSyncedClients];
        if (syncedClients.length > 0) {
          Logger.section('⚙️  Syncing configurations...');
          Logger.nl();

          for (const clientResult of syncedClients) {
            if (clientResult.success) {
              Logger.success(`${clientResult.client} - synchronized`);
            } else {
              Logger.error(`${clientResult.client} - sync failed`);
            }
          }
        }

        // ==================== Phase 3: Critical Warnings Only ====================
        const criticalWarnings: Array<{ client: string; warning: string }> = [];
        const tips: Set<string> = new Set();

        // Collect critical warnings from client results (not global to avoid duplication)
        for (const clientResult of result.results) {
          for (const warning of clientResult.warnings) {
            // Extract tips separately
            if (warning.includes('💡 Tip:')) {
              tips.add(warning);
              continue;
            }

            if (isCriticalWarning(warning)) {
              criticalWarnings.push({
                client: clientResult.client,
                warning: warning,
              });
            }
          }
        }

        // Show critical warnings if any exist
        if (criticalWarnings.length > 0) {
          Logger.section('⚠️  Warnings:');
          for (const item of criticalWarnings) {
            Logger.warn(`  - ${item.client}: ${item.warning}`);
          }
        }

        // Show unique tips at the end if any exist
        if (tips.size > 0) {
          if (criticalWarnings.length === 0) {
            Logger.section('💡 Tips:');
          } else {
            Logger.nl();
          }
          for (const tip of tips) {
            Logger.info(`  ${tip}`);
          }
        }

        // Show global errors
        if (result.errors.length > 0) {
          Logger.section('❌ Errors:');
          for (const error of result.errors) {
            Logger.error(`  - ${error}`);
          }
        }

        // Final status
        Logger.nl();
        if (result.success) {
          Logger.success('Sync complete!');
        } else {
          Logger.error('Sync completed with errors');
        }

        // Exit with appropriate code
        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        ErrorHandler.handleCommandError(error, 'sync');
        process.exit(1);
      }
    });

  return command;
}
