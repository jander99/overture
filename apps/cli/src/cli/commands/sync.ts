import { Command } from 'commander';
import { syncClients } from '../../core/sync-engine';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../core/error-handler';
import type { ClientName } from '../../domain/config.types';

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
          clients: options.client ? [options.client as ClientName] : undefined,
        };

        // Run sync
        Logger.info('Syncing MCP configurations...');
        const result = await syncClients(syncOptions);

        // Display results
        Logger.nl();
        if (result.success) {
          Logger.success('Sync complete!');
        } else {
          Logger.error('Sync completed with errors');
        }

        // Show per-client results
        if (result.results.length > 0) {
          Logger.nl();
          Logger.info('Client sync results:');
          for (const clientResult of result.results) {
            const status = clientResult.success ? '✓' : '✗';
            const statusColor = clientResult.success ? 'green' : 'red';

            Logger.info(`  ${status} ${clientResult.client}:`);

            if (clientResult.success) {
              Logger.info(`      Config: ${clientResult.configPath}`);
              if (clientResult.backupPath) {
                Logger.info(`      Backup: ${clientResult.backupPath}`);
              }
            } else if (clientResult.error) {
              Logger.error(`      Error: ${clientResult.error}`);
            }

            // Show warnings
            if (clientResult.warnings.length > 0) {
              clientResult.warnings.forEach((warning) => {
                Logger.warn(`      ${warning}`);
              });
            }
          }
        }

        // Show global warnings
        if (result.warnings.length > 0) {
          Logger.nl();
          Logger.warn('Warnings:');
          result.warnings.forEach((warning) => {
            Logger.warn(`  - ${warning}`);
          });
        }

        // Show global errors
        if (result.errors.length > 0) {
          Logger.nl();
          Logger.error('Errors:');
          result.errors.forEach((error) => {
            Logger.error(`  - ${error}`);
          });
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
