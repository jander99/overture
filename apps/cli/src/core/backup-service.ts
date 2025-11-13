/**
 * Backup Service
 *
 * Handles backing up client MCP configurations before modifications.
 * Implements timestamped backups with automatic retention policy.
 *
 * Backup location: ~/.config/overture/backups/{client}-{timestamp}.json
 * Retention: Keep last 10 backups per client
 *
 * @module core/backup-service
 * @version 2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ClientName } from '../domain/config-v2.types';
import { getBackupDir } from './path-resolver';

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
 * Backup client configuration
 *
 * @param client - Client name
 * @param configPath - Path to client config file
 * @returns Path to backup file
 */
export function backupClientConfig(client: ClientName, configPath: string): string {
  const backupDir = getBackupDir();

  // Ensure backup directory exists
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Read current config
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const configContent = fs.readFileSync(configPath, 'utf-8');

  // Generate timestamped filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `${client}-${timestamp}.json`;
  const backupPath = path.join(backupDir, backupFilename);

  // Write backup
  fs.writeFileSync(backupPath, configContent, 'utf-8');

  // Apply retention policy (keep last 10 backups)
  cleanupOldBackups(client, 10);

  return backupPath;
}

/**
 * List all backups for a client
 *
 * @param client - Client name (optional, lists all if not specified)
 * @returns Array of backup metadata sorted by timestamp (newest first)
 */
export function listBackups(client?: ClientName): BackupMetadata[] {
  const backupDir = getBackupDir();

  if (!fs.existsSync(backupDir)) {
    return [];
  }

  const files = fs.readdirSync(backupDir);
  const backups: BackupMetadata[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    // Parse filename: {client}-{timestamp}.json
    const match = file.match(/^(.+)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.json$/);
    if (!match) continue;

    const [, fileClient, timestamp] = match;

    // Filter by client if specified
    if (client && fileClient !== client) continue;

    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);

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
export function getBackup(client: ClientName, timestamp: string): BackupMetadata | null {
  const backups = listBackups(client);
  return backups.find((b) => b.timestamp === timestamp) || null;
}

/**
 * Delete a specific backup
 *
 * @param backupPath - Path to backup file
 */
export function deleteBackup(backupPath: string): void {
  if (fs.existsSync(backupPath)) {
    fs.unlinkSync(backupPath);
  }
}

/**
 * Cleanup old backups for a client, keeping only the most recent N backups
 *
 * @param client - Client name
 * @param keepCount - Number of backups to keep (default: 10)
 */
export function cleanupOldBackups(client: ClientName, keepCount: number = 10): void {
  const backups = listBackups(client);

  // Delete backups beyond the keep count
  const toDelete = backups.slice(keepCount);
  for (const backup of toDelete) {
    deleteBackup(backup.path);
  }
}

/**
 * Get the latest backup for a client
 *
 * @param client - Client name
 * @returns Latest backup metadata or null if no backups exist
 */
export function getLatestBackup(client: ClientName): BackupMetadata | null {
  const backups = listBackups(client);
  return backups.length > 0 ? backups[0] : null;
}
