/**
 * Restore Service
 *
 * Handles restoring client MCP configurations from backups.
 * Works in conjunction with backup-service.ts.
 *
 * @module @overture/sync-core/restore-service
 * @version 3.0
 */

import type { ClientName } from '@overture/config-types';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { OutputPort } from '@overture/ports-output';
import type { BackupService, BackupMetadata } from './backup-service.js';

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
 * Comparison result
 */
export interface ComparisonResult {
  hasChanges: boolean;
  backupMcps: string[];
  currentMcps: string[];
  added: string[]; // In backup but not in current
  removed: string[]; // In current but not in backup
  error?: string;
}

/**
 * Dependencies for RestoreService
 */
export interface RestoreServiceDeps {
  filesystem: FilesystemPort;
  output: OutputPort;
  backupService: BackupService;
}

/**
 * Restore Service with Dependency Injection
 */
export class RestoreService {
  constructor(private deps: RestoreServiceDeps) {}

  /**
   * Restore a backup to a client configuration path
   *
   * @param client - Client name
   * @param timestamp - Backup timestamp
   * @param targetPath - Path to restore to
   * @returns Restore result
   */
  async restore(
    client: ClientName,
    timestamp: string,
    targetPath: string
  ): Promise<RestoreResult> {
    // Find the backup
    const backup = await this.deps.backupService.getBackup(client, timestamp);

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
      const validationError = await this.validateBackup(backup);
      if (validationError) {
        return {
          success: false,
          backupPath: backup.path,
          restoredPath: targetPath,
          error: validationError,
        };
      }

      // Read backup content
      const backupContent = await this.deps.filesystem.readFile(backup.path);

      // Ensure target directory exists
      const targetDir = targetPath.substring(0, targetPath.lastIndexOf('/'));
      if (!(await this.deps.filesystem.exists(targetDir))) {
        await this.deps.filesystem.mkdir(targetDir, { recursive: true });
      }

      // Write to target path
      await this.deps.filesystem.writeFile(targetPath, backupContent);

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
  async restoreLatest(client: ClientName, targetPath: string): Promise<RestoreResult> {
    const latestBackup = await this.deps.backupService.getLatestBackup(client);

    if (!latestBackup) {
      return {
        success: false,
        backupPath: '',
        restoredPath: targetPath,
        error: `No backups found for ${client}`,
      };
    }

    return this.restore(client, latestBackup.timestamp, targetPath);
  }

  /**
   * Validate a backup before restoring
   *
   * @param backup - Backup metadata
   * @returns Error message if invalid, null if valid
   */
  private async validateBackup(backup: BackupMetadata): Promise<string | null> {
    // Check if backup file exists
    if (!(await this.deps.filesystem.exists(backup.path))) {
      return `Backup file not found: ${backup.path}`;
    }

    try {
      // Read and parse backup content
      const content = await this.deps.filesystem.readFile(backup.path);
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
  async preview(client: ClientName, timestamp: string): Promise<any | null> {
    const backup = await this.deps.backupService.getBackup(client, timestamp);

    if (!backup) {
      return null;
    }

    try {
      const content = await this.deps.filesystem.readFile(backup.path);
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
  async compare(
    client: ClientName,
    timestamp: string,
    currentPath: string
  ): Promise<ComparisonResult> {
    const backup = await this.deps.backupService.getBackup(client, timestamp);

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
      const backupContent = JSON.parse(await this.deps.filesystem.readFile(backup.path));
      const backupServers = backupContent.mcpServers || backupContent.servers || {};
      const backupMcps = Object.keys(backupServers);

      // Read current config (if exists)
      let currentMcps: string[] = [];
      if (await this.deps.filesystem.exists(currentPath)) {
        const currentContent = JSON.parse(
          await this.deps.filesystem.readFile(currentPath)
        );
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
}
