import { Command } from 'commander';
import chalk from 'chalk';
import {
  listBackups,
  cleanupOldBackups,
  getLatestBackup,
  type BackupMetadata,
} from '../../core/backup-service';
import {
  restoreBackup,
  restoreLatestBackup,
} from '../../core/restore-service';
import { adapterRegistry } from '../../adapters/adapter-registry';
import type { ClientName } from '../../domain/config.types';
import { Logger } from '../../utils/logger';
import { Prompts } from '../../utils/prompts';
import { getPlatform } from '../../core/path-resolver';
import { ErrorHandler, UserCancelledError } from '../../core/error-handler';

/**
 * Creates the 'backup' command group for managing client MCP configuration backups.
 *
 * Usage:
 * - overture backup list                      - List all backups for all clients
 * - overture backup list --client <name>      - List backups for specific client
 * - overture backup restore <client> <timestamp> - Restore specific backup
 * - overture backup restore <client> --latest - Restore most recent backup
 * - overture backup cleanup                   - Remove old backups (keep last 10)
 */
export function createBackupCommand(): Command {
  const command = new Command('backup');

  command.description('Manage client MCP configuration backups');

  // backup list subcommand
  command
    .command('list')
    .description('List all backups')
    .option('-c, --client <name>', 'Filter by client name')
    .action(async (options: { client?: ClientName }) => {
      try {
        const backups = listBackups(options.client);

        if (backups.length === 0) {
          if (options.client) {
            Logger.warn(`No backups found for client: ${options.client}`);
          } else {
            Logger.warn('No backups found');
          }
          return;
        }

        Logger.info(
          options.client
            ? `Backups for ${options.client}:`
            : 'All backups:'
        );
        Logger.nl();

        // Group backups by client
        const backupsByClient = new Map<ClientName, BackupMetadata[]>();
        for (const backup of backups) {
          if (!backupsByClient.has(backup.client)) {
            backupsByClient.set(backup.client, []);
          }
          backupsByClient.get(backup.client)!.push(backup);
        }

        // Display backups grouped by client
        for (const [client, clientBackups] of backupsByClient) {
          console.log(chalk.bold.cyan(`${client}:`));

          for (const backup of clientBackups) {
            const age = formatAge(backup.timestamp);
            const size = formatSize(backup.size);
            const timestamp = formatTimestamp(backup.timestamp);

            console.log(
              `  ${chalk.gray(timestamp)} ${chalk.dim('•')} ${size} ${chalk.dim('•')} ${age}`
            );
          }

          Logger.nl();
        }

        Logger.info(`Total: ${backups.length} backup(s)`);
      } catch (error) {
        const verbose = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
        ErrorHandler.handleCommandError(error, 'backup list', verbose);
      }
    });

  // backup restore subcommand
  command
    .command('restore')
    .description('Restore a backup')
    .argument('<client>', 'Client name')
    .argument('[timestamp]', 'Backup timestamp (omit to use --latest)')
    .option('--latest', 'Restore the most recent backup')
    .option('--no-confirm', 'Skip confirmation prompt')
    .action(
      async (
        client: ClientName,
        timestamp: string | undefined,
        options: { latest?: boolean; confirm: boolean }
      ) => {
        try {
          // Validate client
          const adapter = adapterRegistry.get(client);
          if (!adapter) {
            Logger.error(`Unknown client: ${client}`);
            Logger.info('Available clients:');
            adapterRegistry.getAllNames().forEach((name) => {
              Logger.info(`  - ${name}`);
            });
            throw Object.assign(new Error('Invalid client'), { exitCode: 2 });
          }

          // Determine which backup to restore
          let backupToRestore: BackupMetadata | null = null;
          let isLatest = false;

          if (options.latest || !timestamp) {
            backupToRestore = getLatestBackup(client);
            isLatest = true;

            if (!backupToRestore) {
              Logger.error(`No backups found for ${client}`);
              throw Object.assign(new Error('No backups found'), { exitCode: 2 });
            }
          } else {
            const backups = listBackups(client);
            backupToRestore = backups.find((b) => b.timestamp === timestamp) || null;

            if (!backupToRestore) {
              Logger.error(`Backup not found: ${client} at ${timestamp}`);
              Logger.info(`Available backups for ${client}:`);
              backups.forEach((b) => {
                Logger.info(`  - ${b.timestamp}`);
              });
              throw Object.assign(new Error('Backup not found'), { exitCode: 2 });
            }
          }

          // Show backup details
          Logger.info('Backup details:');
          Logger.info(`  Client: ${chalk.cyan(backupToRestore.client)}`);
          Logger.info(`  Timestamp: ${formatTimestamp(backupToRestore.timestamp)}`);
          Logger.info(`  Size: ${formatSize(backupToRestore.size)}`);
          Logger.info(`  Age: ${formatAge(backupToRestore.timestamp)}`);
          if (isLatest) {
            Logger.info(`  ${chalk.yellow('(Most recent backup)')}`);
          }
          Logger.nl();

          // Confirm restore
          if (options.confirm) {
            const confirmed = await Prompts.confirm(
              `Restore this backup? This will overwrite the current ${client} configuration.`,
              false
            );

            if (!confirmed) {
              throw new UserCancelledError('Restore cancelled');
            }
          }

          // Get target path from adapter
          const platform = getPlatform();
          const configPaths = adapter.detectConfigPath(platform);

          if (!configPaths) {
            Logger.error(`Client ${client} is not installed on this platform`);
            process.exit(2);
          }

          // Use user config for restore (most clients only have user config)
          const configPath = typeof configPaths === 'string'
            ? configPaths
            : configPaths.user;

          // Perform restore
          const result = isLatest
            ? restoreLatestBackup(client, configPath)
            : restoreBackup(client, backupToRestore.timestamp, configPath);

          if (result.success) {
            Logger.success('Backup restored successfully');
            Logger.info(`  From: ${result.backupPath}`);
            Logger.info(`  To: ${result.restoredPath}`);
          } else {
            Logger.error(`Restore failed: ${result.error}`);
            process.exit(1);
          }
        } catch (error) {
          const verbose = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
          ErrorHandler.handleCommandError(error, 'backup restore', verbose);
        }
      }
    );

  // backup cleanup subcommand
  command
    .command('cleanup')
    .description('Remove old backups (keep last 10 per client)')
    .option('-c, --client <name>', 'Cleanup backups for specific client only')
    .option('-k, --keep <count>', 'Number of backups to keep (default: 10)', '10')
    .action(async (options: { client?: ClientName; keep: string }) => {
      try {
        const keepCount = parseInt(options.keep, 10);
        if (isNaN(keepCount) || keepCount < 1) {
          Logger.error('Keep count must be a positive integer');
          throw Object.assign(new Error('Invalid keep count'), { exitCode: 2 });
        }

        // Determine which clients to cleanup
        const clients = options.client
          ? [options.client]
          : adapterRegistry.getAllNames();

        let totalDeleted = 0;

        for (const client of clients) {
          const beforeCount = listBackups(client).length;
          if (beforeCount === 0) continue;

          cleanupOldBackups(client, keepCount);
          const afterCount = listBackups(client).length;
          const deleted = beforeCount - afterCount;

          if (deleted > 0) {
            Logger.info(
              `${chalk.cyan(client)}: Removed ${deleted} old backup(s), kept ${afterCount}`
            );
            totalDeleted += deleted;
          }
        }

        Logger.nl();
        if (totalDeleted > 0) {
          Logger.success(`Cleaned up ${totalDeleted} backup(s)`);
        } else {
          Logger.info('No backups to clean up');
        }
      } catch (error) {
        const verbose = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
        ErrorHandler.handleCommandError(error, 'backup cleanup', verbose);
      }
    });

  return command;
}

/**
 * Format a timestamp for display
 * Converts ISO timestamp to readable format
 *
 * @param timestamp - ISO timestamp from backup filename
 * @returns Formatted timestamp string
 */
function formatTimestamp(timestamp: string): string {
  // Convert from filename format: 2025-01-11T14-30-45-123Z
  // to ISO format: 2025-01-11T14:30:45.123Z
  const isoTimestamp = timestamp
    .replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z');

  const date = new Date(isoTimestamp);
  return date.toLocaleString();
}

/**
 * Format file size for display
 *
 * @param bytes - File size in bytes
 * @returns Formatted size string (e.g., "1.5 KB", "2.3 MB")
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format backup age for display
 *
 * @param timestamp - ISO timestamp from backup filename
 * @returns Human-readable age string (e.g., "2 hours ago", "3 days ago")
 */
function formatAge(timestamp: string): string {
  // Convert from filename format to ISO format
  const isoTimestamp = timestamp
    .replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z');

  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;

  const months = Math.floor(days / 30);
  return `${months} month${months !== 1 ? 's' : ''} ago`;
}
