/**
 * Restore Service
 *
 * Handles restoring client MCP configurations from backups.
 * Works in conjunction with backup-service.ts.
 *
 * @module core/restore-service
 * @version 2.0
 */

import * as fs from 'fs';
import type { ClientName } from '../domain/config-v2.types';
import { getBackup, type BackupMetadata } from './backup-service';

/**
 * Restore result
 */
export interface RestoreResult {
  success: boolean;
  backupPath: string;
  restoredPath: string;
  error?: string;
}

/**
 * Restore a backup to a client configuration path
 *
 * @param client - Client name
 * @param timestamp - Backup timestamp
 * @param targetPath - Path to restore to
 * @returns Restore result
 */
export function restoreBackup(
  client: ClientName,
  timestamp: string,
  targetPath: string
): RestoreResult {
  // Find the backup
  const backup = getBackup(client, timestamp);

  if (!backup) {
    return {
      success: false,
      backupPath: '',
      restoredPath: targetPath,
      error: `Backup not found for ${client} at ${timestamp}`,
    };
  }

  try {
    // Validate backup before restoring
    const validationError = validateBackup(backup);
    if (validationError) {
      return {
        success: false,
        backupPath: backup.path,
        restoredPath: targetPath,
        error: validationError,
      };
    }

    // Read backup content
    const backupContent = fs.readFileSync(backup.path, 'utf-8');

    // Ensure target directory exists
    const targetDir = targetPath.substring(0, targetPath.lastIndexOf('/'));
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Write to target path
    fs.writeFileSync(targetPath, backupContent, 'utf-8');

    return {
      success: true,
      backupPath: backup.path,
      restoredPath: targetPath,
    };
  } catch (error) {
    return {
      success: false,
      backupPath: backup.path,
      restoredPath: targetPath,
      error: `Failed to restore backup: ${(error as Error).message}`,
    };
  }
}

/**
 * Restore the latest backup for a client
 *
 * @param client - Client name
 * @param targetPath - Path to restore to
 * @returns Restore result
 */
export function restoreLatestBackup(
  client: ClientName,
  targetPath: string
): RestoreResult {
  const { getLatestBackup } = require('./backup-service');
  const latestBackup = getLatestBackup(client);

  if (!latestBackup) {
    return {
      success: false,
      backupPath: '',
      restoredPath: targetPath,
      error: `No backups found for ${client}`,
    };
  }

  return restoreBackup(client, latestBackup.timestamp, targetPath);
}

/**
 * Validate a backup before restoring
 *
 * @param backup - Backup metadata
 * @returns Error message if invalid, null if valid
 */
export function validateBackup(backup: BackupMetadata): string | null {
  // Check if backup file exists
  if (!fs.existsSync(backup.path)) {
    return `Backup file not found: ${backup.path}`;
  }

  try {
    // Read and parse backup content
    const content = fs.readFileSync(backup.path, 'utf-8');
    const parsed = JSON.parse(content);

    // Validate structure (basic check for mcpServers or servers key)
    if (!parsed.mcpServers && !parsed.servers) {
      return 'Invalid backup: Missing mcpServers or servers key';
    }

    // Check for valid MCP server structure
    const servers = parsed.mcpServers || parsed.servers;
    if (typeof servers !== 'object' || servers === null) {
      return 'Invalid backup: MCP servers must be an object';
    }

    // Validate each MCP server has required fields
    for (const [name, config] of Object.entries(servers)) {
      if (typeof config !== 'object' || config === null) {
        return `Invalid backup: MCP ${name} configuration is not an object`;
      }

      const mcpConfig = config as any;
      if (!mcpConfig.command) {
        return `Invalid backup: MCP ${name} missing required 'command' field`;
      }
    }

    return null; // Valid
  } catch (error) {
    if (error instanceof SyntaxError) {
      return `Invalid backup: Not valid JSON - ${error.message}`;
    }
    return `Failed to validate backup: ${(error as Error).message}`;
  }
}

/**
 * Preview a backup without restoring
 *
 * @param client - Client name
 * @param timestamp - Backup timestamp
 * @returns Backup content or null if not found
 */
export function previewBackup(
  client: ClientName,
  timestamp: string
): any | null {
  const backup = getBackup(client, timestamp);

  if (!backup) {
    return null;
  }

  try {
    const content = fs.readFileSync(backup.path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Compare a backup with current configuration
 *
 * @param client - Client name
 * @param timestamp - Backup timestamp
 * @param currentPath - Path to current configuration
 * @returns Comparison result
 */
export interface ComparisonResult {
  hasChanges: boolean;
  backupMcps: string[];
  currentMcps: string[];
  added: string[]; // In backup but not in current
  removed: string[]; // In current but not in backup
  error?: string;
}

export function compareBackupWithCurrent(
  client: ClientName,
  timestamp: string,
  currentPath: string
): ComparisonResult {
  const backup = getBackup(client, timestamp);

  if (!backup) {
    return {
      hasChanges: false,
      backupMcps: [],
      currentMcps: [],
      added: [],
      removed: [],
      error: `Backup not found for ${client} at ${timestamp}`,
    };
  }

  try {
    // Read backup
    const backupContent = JSON.parse(fs.readFileSync(backup.path, 'utf-8'));
    const backupServers = backupContent.mcpServers || backupContent.servers || {};
    const backupMcps = Object.keys(backupServers);

    // Read current config (if exists)
    let currentMcps: string[] = [];
    if (fs.existsSync(currentPath)) {
      const currentContent = JSON.parse(fs.readFileSync(currentPath, 'utf-8'));
      const currentServers = currentContent.mcpServers || currentContent.servers || {};
      currentMcps = Object.keys(currentServers);
    }

    // Calculate differences
    const backupSet = new Set(backupMcps);
    const currentSet = new Set(currentMcps);

    const added = backupMcps.filter((mcp) => !currentSet.has(mcp));
    const removed = currentMcps.filter((mcp) => !backupSet.has(mcp));

    return {
      hasChanges: added.length > 0 || removed.length > 0,
      backupMcps,
      currentMcps,
      added,
      removed,
    };
  } catch (error) {
    return {
      hasChanges: false,
      backupMcps: [],
      currentMcps: [],
      added: [],
      removed: [],
      error: `Failed to compare: ${(error as Error).message}`,
    };
  }
}
