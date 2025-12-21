/**
 * Backup Service
 *
 * Handles backing up client MCP configurations before modifications.
 * Implements timestamped backups with automatic retention policy.
 *
 * Backup location: ~/.config/overture/backups/{client}-{timestamp}.json
 * Retention: Keep last 10 backups per client
 *
 * @module @overture/sync-core/backup-service
 * @version 3.0
 */

import type { ClientName } from '@overture/config-types';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { OutputPort } from '@overture/ports-output';
import { ConfigError } from '@overture/errors';

/**
 * Backup metadata
 */
export interface BackupMetadata {
  client: ClientName;
  timestamp: string;
  path: string;
  size: number;
}

/**
 * Dependencies for BackupService
 */
export interface BackupServiceDeps {
  filesystem: FilesystemPort;
  output: OutputPort;
  getBackupDir: () => string;
}

/**
 * Backup Service with Dependency Injection
 */
export class BackupService {
  constructor(private deps: BackupServiceDeps) {}

  /**
   * Backup client configuration
   *
   * @param client - Client name
   * @param configPath - Path to client config file
   * @returns Path to backup file
   */
  async backup(client: ClientName, configPath: string): Promise<string> {
    const backupDir = this.deps.getBackupDir();

    // Ensure backup directory exists
    if (!(await this.deps.filesystem.exists(backupDir))) {
      await this.deps.filesystem.mkdir(backupDir, { recursive: true });
    }

    // Read current config
    if (!(await this.deps.filesystem.exists(configPath))) {
      throw new ConfigError(`Config file not found: ${configPath}`, configPath);
    }

    const configContent = await this.deps.filesystem.readFile(configPath);

    // Generate timestamped filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `${client}-${timestamp}.json`;
    const backupPath = `${backupDir}/${backupFilename}`;

    // Write backup
    await this.deps.filesystem.writeFile(backupPath, configContent);

    // Apply retention policy (keep last 10 backups)
    await this.cleanupOldBackups(client, 10);

    return backupPath;
  }

  /**
   * List all backups for a client
   *
   * @param client - Client name (optional, lists all if not specified)
   * @returns Array of backup metadata sorted by timestamp (newest first)
   */
  async listBackups(client?: ClientName): Promise<BackupMetadata[]> {
    const backupDir = this.deps.getBackupDir();

    if (!(await this.deps.filesystem.exists(backupDir))) {
      return [];
    }

    const files = await this.deps.filesystem.readdir(backupDir);
    const backups: BackupMetadata[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      // Parse filename: {client}-{timestamp}.json
      const match = file.match(
        /^(.+)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.json$/,
      );
      if (!match) continue;

      const [, fileClient, timestamp] = match;

      // Filter by client if specified
      if (client && fileClient !== client) continue;

      const filePath = `${backupDir}/${file}`;
      const stats = await this.deps.filesystem.stat(filePath);

      backups.push({
        client: fileClient as ClientName,
        timestamp,
        path: filePath,
        size: stats.size,
      });
    }

    // Sort by timestamp (newest first)
    backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return backups;
  }

  /**
   * Get a specific backup by client and timestamp
   *
   * @param client - Client name
   * @param timestamp - Backup timestamp
   * @returns Backup metadata or null if not found
   */
  async getBackup(
    client: ClientName,
    timestamp: string,
  ): Promise<BackupMetadata | null> {
    const backups = await this.listBackups(client);
    return backups.find((b) => b.timestamp === timestamp) || null;
  }

  /**
   * Delete a specific backup
   *
   * @param backupPath - Path to backup file
   */
  async deleteBackup(backupPath: string): Promise<void> {
    if (await this.deps.filesystem.exists(backupPath)) {
      await this.deps.filesystem.rm(backupPath);
    }
  }

  /**
   * Cleanup old backups for a client, keeping only the most recent N backups
   *
   * @param client - Client name
   * @param keepCount - Number of backups to keep (default: 10)
   */
  async cleanupOldBackups(client: ClientName, keepCount = 10): Promise<void> {
    const backups = await this.listBackups(client);

    // Delete backups beyond the keep count
    const toDelete = backups.slice(keepCount);
    for (const backup of toDelete) {
      await this.deleteBackup(backup.path);
    }
  }

  /**
   * Get the latest backup for a client
   *
   * @param client - Client name
   * @returns Latest backup metadata or null if no backups exist
   */
  async getLatestBackup(client: ClientName): Promise<BackupMetadata | null> {
    const backups = await this.listBackups(client);
    return backups.length > 0 ? backups[0] : null;
  }
}
