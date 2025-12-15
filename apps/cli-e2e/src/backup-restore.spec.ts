/**
 * E2E Tests for Backup and Restore Functionality
 *
 * Tests the complete backup and restore workflow with real file operations.
 * Simulates the full CLI workflow including adapter integration.
 *
 * @module cli-e2e/backup-restore
 */

// FIXME: This E2E test file has broken imports from old architecture
// These functions moved to @overture/sync-core as BackupService and RestoreService classes
// This test suite should be:
// 1. Moved to libs/core/sync/src/lib/backup-service.spec.ts as unit tests, OR
// 2. Rewritten as true E2E tests using CLI commands via execSync
//
// import * as fs from 'fs';
// import * as path from 'path';
// import * as os from 'os';
// import {
//   backupClientConfig,
//   listBackups,
//   getLatestBackup,
//   cleanupOldBackups,
//   deleteBackup,
//   type BackupMetadata,
// } from '../../cli/src/core/backup-service';
// import {
//   restoreBackup,
//   restoreLatestBackup,
//   validateBackup,
//   previewBackup,
//   compareBackupWithCurrent,
// } from '../../cli/src/core/restore-service';

describe.skip('Backup and Restore E2E Tests', () => {
  let testDir: string;
  let backupDir: string;
  let configDir: string;
  let originalBackupDir: string | undefined;

  /**
   * Setup test environment before each test
   * Creates temporary directories for testing
   */
  beforeEach(() => {
    // Create temporary test directories
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'overture-e2e-'));
    backupDir = path.join(testDir, 'backups');
    configDir = path.join(testDir, 'configs');

    fs.mkdirSync(backupDir, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });

    // Override backup directory for testing
    originalBackupDir = process.env.OVERTURE_BACKUP_DIR;
    process.env.OVERTURE_BACKUP_DIR = backupDir;
  });

  /**
   * Cleanup test environment after each test
   */
  afterEach(() => {
    // Clean up temporary directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Restore original environment
    if (originalBackupDir) {
      process.env.OVERTURE_BACKUP_DIR = originalBackupDir;
    } else {
      delete process.env.OVERTURE_BACKUP_DIR;
    }
  });

  /**
   * Helper: Create a mock client config file
   */
  function createMockConfig(client: string, mcpServers: Record<string, any>): string {
    const configPath = path.join(configDir, `${client}.json`);
    const config = { mcpServers };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return configPath;
  }

  /**
   * Helper: Wait for a short time (to ensure different timestamps)
   */
  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ========================================================================
  // TEST SUITE 1: Backup Creation
  // ========================================================================

  describe('1. Backup Creation During Sync', () => {
    it('should create backup with timestamped filename', () => {
      const mcpServers = {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
        },
      };
      const configPath = createMockConfig('claude-code', mcpServers);

      // Create backup
      const backupPath = backupClientConfig('claude-code', configPath);

      // Verify backup exists
      expect(fs.existsSync(backupPath)).toBe(true);

      // Verify filename format: claude-code-{timestamp}.json
      const filename = path.basename(backupPath);
      expect(filename).toMatch(/^claude-code-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/);

      // Verify backup contains original config
      const backupContent = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
      expect(backupContent).toEqual({ mcpServers });
    });

    it('should create backup in correct directory structure', () => {
      const mcpServers = { memory: { command: 'test' } };
      const configPath = createMockConfig('claude-code', mcpServers);

      backupClientConfig('claude-code', configPath);

      // Verify backup directory exists
      expect(fs.existsSync(backupDir)).toBe(true);

      // Verify at least one backup file exists
      const files = fs.readdirSync(backupDir);
      const backupFiles = files.filter((f) => f.startsWith('claude-code-') && f.endsWith('.json'));
      expect(backupFiles.length).toBeGreaterThan(0);
    });

    it('should throw error when config file does not exist', () => {
      const nonExistentPath = path.join(configDir, 'does-not-exist.json');

      expect(() => {
        backupClientConfig('claude-code', nonExistentPath);
      }).toThrow('Config file not found');
    });
  });

  // ========================================================================
  // TEST SUITE 2: List Backups
  // ========================================================================

  describe('2. List Backups', () => {
    it('should list all backups for all clients', async () => {
      // Create backups for multiple clients
      const cc1 = createMockConfig('claude-code-1', { filesystem: { command: 'test1' } });
      const cc2 = createMockConfig('claude-code-2', { filesystem: { command: 'test2' } });
      const vs1 = createMockConfig('vscode-1', { memory: { command: 'test3' } });

      backupClientConfig('claude-code', cc1);
      await wait(10);
      backupClientConfig('claude-code', cc2);
      await wait(10);
      backupClientConfig('vscode', vs1);

      const backups = listBackups();

      expect(backups.length).toBe(3);
      expect(backups.some((b) => b.client === 'claude-code')).toBe(true);
      expect(backups.some((b) => b.client === 'vscode')).toBe(true);
    });

    it('should return backups sorted by timestamp (newest first)', async () => {
      const config1 = createMockConfig('test-1', { v1: { command: 'first' } });
      const config2 = createMockConfig('test-2', { v2: { command: 'second' } });
      const config3 = createMockConfig('test-3', { v3: { command: 'third' } });

      backupClientConfig('claude-code', config1);
      await wait(10);
      backupClientConfig('claude-code', config2);
      await wait(10);
      backupClientConfig('claude-code', config3);

      const backups = listBackups('claude-code');

      // Verify sorted newest first
      for (let i = 0; i < backups.length - 1; i++) {
        expect(backups[i].timestamp >= backups[i + 1].timestamp).toBe(true);
      }
    });

    it('should include backup metadata (timestamp, size, path)', () => {
      const configPath = createMockConfig('claude-code', {
        filesystem: { command: 'test', args: ['arg1', 'arg2'] },
      });

      backupClientConfig('claude-code', configPath);

      const backups = listBackups('claude-code');

      expect(backups.length).toBe(1);
      const backup = backups[0];

      expect(backup.client).toBe('claude-code');
      expect(backup.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/);
      expect(backup.size).toBeGreaterThan(0);
      expect(backup.path).toContain(backupDir);
      expect(fs.existsSync(backup.path)).toBe(true);
    });

    it('should return empty array when no backups exist', () => {
      const backups = listBackups();
      expect(backups).toEqual([]);
    });

    it('should return empty array when backup directory does not exist', () => {
      // Remove backup directory
      fs.rmSync(backupDir, { recursive: true, force: true });

      const backups = listBackups();
      expect(backups).toEqual([]);
    });
  });

  // ========================================================================
  // TEST SUITE 3: List Backups for Specific Client
  // ========================================================================

  describe('3. List Backups for Specific Client', () => {
    beforeEach(async () => {
      // Create backups for multiple clients
      backupClientConfig('claude-code', createMockConfig('cc1', { fs: { command: 'test1' } }));
      await wait(10);
      backupClientConfig('claude-code', createMockConfig('cc2', { mem: { command: 'test2' } }));
      await wait(10);
      backupClientConfig('vscode', createMockConfig('vs1', { gh: { command: 'test3' } }));
      await wait(10);
      backupClientConfig('cursor', createMockConfig('cu1', { sql: { command: 'test4' } }));
    });

    it('should list only claude-code backups when filtered', () => {
      const backups = listBackups('claude-code');

      expect(backups.length).toBe(2);
      expect(backups.every((b) => b.client === 'claude-code')).toBe(true);
    });

    it('should list only vscode backups when filtered', () => {
      const backups = listBackups('vscode');

      expect(backups.length).toBe(1);
      expect(backups[0].client).toBe('vscode');
    });

    it('should return empty array when client has no backups', () => {
      const backups = listBackups('windsurf');
      expect(backups).toEqual([]);
    });
  });

  // ========================================================================
  // TEST SUITE 4: Restore Latest Backup
  // ========================================================================

  describe('4. Restore Latest Backup', () => {
    it('should restore the most recent backup', async () => {
      const oldMcps = { filesystem: { command: 'old' } };
      const newMcps = { filesystem: { command: 'new' }, memory: { command: 'latest' } };

      // Create two backups (latest should be restored)
      backupClientConfig('claude-code', createMockConfig('old', oldMcps));
      await wait(10);
      backupClientConfig('claude-code', createMockConfig('new', newMcps));

      // Create current config (different from backups)
      const configPath = createMockConfig('claude-code', { different: { command: 'current' } });

      // Restore latest backup
      const result = restoreLatestBackup('claude-code', configPath);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify config was restored to latest backup
      const restoredConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(restoredConfig.mcpServers).toEqual(newMcps);
    });

    it('should return error when no backups exist', () => {
      const configPath = createMockConfig('claude-code', { test: { command: 'current' } });

      const result = restoreLatestBackup('claude-code', configPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No backups found');
    });
  });

  // ========================================================================
  // TEST SUITE 5: Restore Specific Backup
  // ========================================================================

  describe('5. Restore Specific Backup', () => {
    it('should restore a specific backup by timestamp', async () => {
      const backup1Mcps = { filesystem: { command: 'backup1' } };
      const backup2Mcps = { memory: { command: 'backup2' } };
      const backup3Mcps = { github: { command: 'backup3' } };

      // Create multiple backups
      backupClientConfig('claude-code', createMockConfig('b1', backup1Mcps));
      await wait(10);
      backupClientConfig('claude-code', createMockConfig('b2', backup2Mcps));
      await wait(10);
      backupClientConfig('claude-code', createMockConfig('b3', backup3Mcps));

      // Get timestamp of second backup
      const backups = listBackups('claude-code');
      const secondBackupTimestamp = backups[1].timestamp; // Sorted newest first, so [1] is second

      // Create current config
      const configPath = createMockConfig('claude-code', { current: { command: 'now' } });

      // Restore specific backup
      const result = restoreBackup('claude-code', secondBackupTimestamp, configPath);

      expect(result.success).toBe(true);

      // Verify correct backup was restored
      const restoredConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(restoredConfig.mcpServers).toEqual(backup2Mcps);
    });

    it('should return error when timestamp does not exist', () => {
      backupClientConfig('claude-code', createMockConfig('test', { fs: { command: 'test' } }));
      const configPath = createMockConfig('claude-code', { current: { command: 'now' } });

      const result = restoreBackup('claude-code', '2025-01-01T00-00-00-000Z', configPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Backup not found');
    });
  });

  // ========================================================================
  // TEST SUITE 6: Backup Validation
  // ========================================================================

  describe('6. Backup Validation', () => {
    it('should validate a correct backup', () => {
      const configPath = createMockConfig('claude-code', {
        filesystem: { command: 'npx', args: ['test'] },
      });

      backupClientConfig('claude-code', configPath);

      const backups = listBackups('claude-code');
      const error = validateBackup(backups[0]);

      expect(error).toBeNull();
    });

    it('should reject backup with corrupted JSON', () => {
      // Create corrupted backup manually
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `claude-code-${timestamp}.json`;
      const backupPath = path.join(backupDir, filename);
      fs.writeFileSync(backupPath, 'INVALID JSON {{{', 'utf-8');

      const stats = fs.statSync(backupPath);
      const backup: BackupMetadata = {
        client: 'claude-code',
        timestamp,
        path: backupPath,
        size: stats.size,
      };

      const error = validateBackup(backup);

      expect(error).not.toBeNull();
      expect(error).toContain('Not valid JSON');
    });

    it('should reject backup with missing mcpServers key', () => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `claude-code-${timestamp}.json`;
      const backupPath = path.join(backupDir, filename);
      fs.writeFileSync(backupPath, JSON.stringify({ invalid: 'structure' }), 'utf-8');

      const stats = fs.statSync(backupPath);
      const backup: BackupMetadata = {
        client: 'claude-code',
        timestamp,
        path: backupPath,
        size: stats.size,
      };

      const error = validateBackup(backup);

      expect(error).not.toBeNull();
      expect(error).toContain('Missing mcpServers or servers key');
    });

    it('should reject backup with MCP missing command field', () => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `claude-code-${timestamp}.json`;
      const backupPath = path.join(backupDir, filename);
      fs.writeFileSync(
        backupPath,
        JSON.stringify({
          mcpServers: {
            filesystem: { args: ['test'] }, // Missing 'command'
          },
        }),
        'utf-8'
      );

      const stats = fs.statSync(backupPath);
      const backup: BackupMetadata = {
        client: 'claude-code',
        timestamp,
        path: backupPath,
        size: stats.size,
      };

      const error = validateBackup(backup);

      expect(error).not.toBeNull();
      expect(error).toContain("missing required 'command' field");
    });
  });

  // ========================================================================
  // TEST SUITE 7: Backup Cleanup
  // ========================================================================

  describe('7. Backup Cleanup', () => {
    it('should keep only N most recent backups', async () => {
      // Note: backupClientConfig auto-cleans to 10 backups, so we expect 10 max
      for (let i = 0; i < 15; i++) {
        backupClientConfig('claude-code', createMockConfig(`test-${i}`, { test: { command: `backup-${i}` } }));
        await wait(5);
      }

      // After creating 15 backups, auto-cleanup keeps only 10
      const afterAutoCleanup = listBackups('claude-code');
      expect(afterAutoCleanup.length).toBe(10);

      // Manual cleanup keeping only 5
      cleanupOldBackups('claude-code', 5);

      const afterManualCleanup = listBackups('claude-code');
      expect(afterManualCleanup.length).toBe(5);

      // Verify the 5 most recent were kept
      expect(afterManualCleanup).toEqual(afterAutoCleanup.slice(0, 5));
    });

    it('should respect custom keep count', async () => {
      // Create 10 backups (will be kept since auto-cleanup threshold is 10)
      for (let i = 0; i < 10; i++) {
        backupClientConfig('claude-code', createMockConfig(`test-${i}`, { test: { command: `backup-${i}` } }));
        await wait(5);
      }

      const beforeCleanup = listBackups('claude-code');
      expect(beforeCleanup.length).toBe(10);

      // Cleanup keeping only 5
      cleanupOldBackups('claude-code', 5);

      const afterCleanup = listBackups('claude-code');
      expect(afterCleanup.length).toBe(5);
    });

    it('should not delete backups when under threshold', async () => {
      // Use unique client to avoid interference from previous tests
      // Add delays between backups to ensure unique timestamps
      backupClientConfig('windsurf', createMockConfig('t1', { test1: { command: 'a' } }));
      await new Promise((r) => setTimeout(r, 10));
      backupClientConfig('windsurf', createMockConfig('t2', { test2: { command: 'b' } }));
      await new Promise((r) => setTimeout(r, 10));
      backupClientConfig('windsurf', createMockConfig('t3', { test3: { command: 'c' } }));

      // Manual cleanup with threshold of 10 should keep all 3
      cleanupOldBackups('windsurf', 10);

      // Verify all backups still exist
      const backups = listBackups('windsurf');
      expect(backups.length).toBe(3);
    });
  });

  // ========================================================================
  // TEST SUITE 8: Get Latest Backup
  // ========================================================================

  describe('8. Get Latest Backup', () => {
    it('should return the most recent backup', async () => {
      backupClientConfig('claude-code', createMockConfig('old', { v1: { command: 'old' } }));
      await wait(10);
      backupClientConfig('claude-code', createMockConfig('new', { v2: { command: 'new' } }));

      const latest = getLatestBackup('claude-code');

      expect(latest).not.toBeNull();
      expect(latest!.client).toBe('claude-code');

      // Verify it's the newest
      const allBackups = listBackups('claude-code');
      expect(latest!.timestamp).toBe(allBackups[0].timestamp);
    });

    it('should return null when no backups exist', () => {
      const latest = getLatestBackup('claude-code');
      expect(latest).toBeNull();
    });
  });

  // ========================================================================
  // TEST SUITE 9: Preview Backup
  // ========================================================================

  describe('9. Preview Backup', () => {
    it('should return backup content without restoring', () => {
      const mcpServers = {
        filesystem: { command: 'test', args: ['arg1'] },
        memory: { command: 'test2' },
      };

      backupClientConfig('claude-code', createMockConfig('preview', mcpServers));

      const backups = listBackups('claude-code');
      const preview = previewBackup('claude-code', backups[0].timestamp);

      expect(preview).not.toBeNull();
      expect(preview.mcpServers).toEqual(mcpServers);
    });

    it('should return null for non-existent backup', () => {
      const preview = previewBackup('claude-code', '2025-01-01T00-00-00-000Z');
      expect(preview).toBeNull();
    });
  });

  // ========================================================================
  // TEST SUITE 10: Compare Backup with Current
  // ========================================================================

  describe('10. Compare Backup with Current', () => {
    it('should detect added MCPs in backup', () => {
      const backupMcps = {
        filesystem: { command: 'test' },
        memory: { command: 'test2' },
        github: { command: 'test3' },
      };
      const currentMcps = {
        filesystem: { command: 'test' },
      };

      backupClientConfig('claude-code', createMockConfig('backup', backupMcps));
      const configPath = createMockConfig('claude-code', currentMcps);

      const backups = listBackups('claude-code');
      const comparison = compareBackupWithCurrent('claude-code', backups[0].timestamp, configPath);

      expect(comparison.hasChanges).toBe(true);
      expect(comparison.added).toEqual(['memory', 'github']);
      expect(comparison.removed).toEqual([]);
    });

    it('should detect removed MCPs in backup', () => {
      const backupMcps = {
        filesystem: { command: 'test' },
      };
      const currentMcps = {
        filesystem: { command: 'test' },
        memory: { command: 'test2' },
        github: { command: 'test3' },
      };

      backupClientConfig('claude-code', createMockConfig('backup', backupMcps));
      const configPath = createMockConfig('claude-code', currentMcps);

      const backups = listBackups('claude-code');
      const comparison = compareBackupWithCurrent('claude-code', backups[0].timestamp, configPath);

      expect(comparison.hasChanges).toBe(true);
      expect(comparison.added).toEqual([]);
      expect(comparison.removed).toEqual(['memory', 'github']);
    });

    it('should detect no changes when identical', () => {
      const mcpServers = {
        filesystem: { command: 'test' },
        memory: { command: 'test2' },
      };

      backupClientConfig('claude-code', createMockConfig('backup', mcpServers));
      const configPath = createMockConfig('claude-code', mcpServers);

      const backups = listBackups('claude-code');
      const comparison = compareBackupWithCurrent('claude-code', backups[0].timestamp, configPath);

      expect(comparison.hasChanges).toBe(false);
      expect(comparison.added).toEqual([]);
      expect(comparison.removed).toEqual([]);
    });
  });

  // ========================================================================
  // TEST SUITE 11: Integration Workflow
  // ========================================================================

  describe('11. Integration with Full Workflow', () => {
    it('should support complete backup-modify-restore cycle', async () => {
      // Create initial config
      const initialMcps = {
        filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] },
        memory: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
      };
      const configPath = createMockConfig('claude-code', initialMcps);

      // Create backup
      const backupPath = backupClientConfig('claude-code', configPath);
      expect(fs.existsSync(backupPath)).toBe(true);

      // Modify config
      const modifiedMcps = {
        filesystem: { command: 'different', args: ['modified'] },
      };
      fs.writeFileSync(configPath, JSON.stringify({ mcpServers: modifiedMcps }, null, 2));

      // Verify modification
      const modified = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(modified.mcpServers).toEqual(modifiedMcps);

      // Restore from backup
      const result = restoreLatestBackup('claude-code', configPath);

      expect(result.success).toBe(true);

      // Verify restoration
      const restored = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(restored.mcpServers).toEqual(initialMcps);
    });

    it('should handle multiple backup-restore cycles', async () => {
      const configPath = createMockConfig('claude-code', { v1: { command: 'first' } });

      // Cycle 1
      backupClientConfig('claude-code', configPath);
      await wait(10);

      // Cycle 2
      fs.writeFileSync(configPath, JSON.stringify({ mcpServers: { v2: { command: 'second' } } }, null, 2));
      backupClientConfig('claude-code', configPath);
      await wait(10);

      // Cycle 3
      fs.writeFileSync(configPath, JSON.stringify({ mcpServers: { v3: { command: 'third' } } }, null, 2));
      backupClientConfig('claude-code', configPath);

      // List backups
      const backups = listBackups('claude-code');
      expect(backups.length).toBe(3);

      // Restore to v2 (second newest)
      const v2Timestamp = backups[1].timestamp;
      const result = restoreBackup('claude-code', v2Timestamp, configPath);

      expect(result.success).toBe(true);

      const restored = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(restored.mcpServers).toEqual({ v2: { command: 'second' } });
    });

    it('should apply retention policy automatically during backup', async () => {
      const configPath = path.join(configDir, 'test.json');

      // Create 12 backups (retention policy is 10)
      for (let i = 0; i < 12; i++) {
        fs.writeFileSync(configPath, JSON.stringify({ mcpServers: { [`mcp${i}`]: { command: `cmd${i}` } } }));
        backupClientConfig('claude-code', configPath);
        await wait(5);
      }

      // Verify only 10 backups remain
      const backups = listBackups('claude-code');
      expect(backups.length).toBe(10);
    });
  });

  // ========================================================================
  // TEST SUITE 12: Error Handling
  // ========================================================================

  describe('12. Error Handling', () => {
    it('should handle non-existent backup file during restore', () => {
      // Use unique client to avoid interference
      const configPath = createMockConfig('copilot-cli-err', { test: { command: 'test' } });
      backupClientConfig('copilot-cli', configPath);

      const backups = listBackups('copilot-cli');
      const backup = backups[0];

      // Delete the backup file
      fs.unlinkSync(backup.path);

      // Try to restore - backup won't be in list anymore since listBackups() only returns existing files
      const result = restoreBackup('copilot-cli', backup.timestamp, configPath);

      expect(result.success).toBe(false);
      // When file is deleted, listBackups won't find it, so we get "Backup not found"
      expect(result.error).toContain('Backup not found');
    });

    it('should create target directory if it does not exist', () => {
      const mcpServers = { test: { command: 'test' } };
      backupClientConfig('claude-code', createMockConfig('backup', mcpServers));

      const backups = listBackups('claude-code');
      const newConfigPath = path.join(testDir, 'new-dir', 'config.json');

      // Restore to non-existent directory
      const result = restoreBackup('claude-code', backups[0].timestamp, newConfigPath);

      expect(result.success).toBe(true);
      expect(fs.existsSync(newConfigPath)).toBe(true);
    });

    it('should handle backup of empty mcpServers object', () => {
      const configPath = createMockConfig('claude-code', {});
      const backupPath = backupClientConfig('claude-code', configPath);

      expect(fs.existsSync(backupPath)).toBe(true);

      const backupContent = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
      expect(backupContent.mcpServers).toEqual({});
    });
  });
});
