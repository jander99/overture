/**
 * Backup Service Tests
 *
 * Comprehensive tests for backup service functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupService, type BackupServiceDeps } from './backup-service.js';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { OutputPort } from '@overture/ports-output';

// Helper to create mock dependencies
function createMockDeps(): BackupServiceDeps {
  return {
    filesystem: {
      exists: vi.fn().mockResolvedValue(true),
      mkdir: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue('{}'),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue([]),
      stat: vi.fn().mockResolvedValue({ size: 100 }),
      rm: vi.fn().mockResolvedValue(undefined),
    } as unknown as FilesystemPort,
    output: {
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as OutputPort,
    getBackupDir: vi.fn(() => '/home/user/.config/overture/backups'),
  };
}

describe('BackupService', () => {
  let deps: BackupServiceDeps;
  let service: BackupService;

  beforeEach(() => {
    deps = createMockDeps();
    service = new BackupService(deps);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T10:30:00.000Z'));
  });

  describe('backup()', () => {
    it('should create backup of client config', async () => {
      const configContent = JSON.stringify({ mcpServers: { github: {} } });
      vi.mocked(deps.filesystem.readFile).mockResolvedValue(configContent);

      const result = await service.backup(
        'claude-code',
        '/home/user/.claude.json',
      );

      expect(result).toMatch(/claude-code-2025-01-15T10-30-00-000Z\.json$/);
      expect(deps.filesystem.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('claude-code-2025-01-15T10-30-00-000Z.json'),
        configContent,
      );
    });

    it('should create backup directory if it does not exist', async () => {
      vi.mocked(deps.filesystem.exists)
        .mockResolvedValueOnce(false) // backup dir doesn't exist
        .mockResolvedValueOnce(true); // config file exists

      await service.backup('claude-code', '/home/user/.claude.json');

      expect(deps.filesystem.mkdir).toHaveBeenCalledWith(
        '/home/user/.config/overture/backups',
        { recursive: true },
      );
    });

    it('should throw error if config file not found', async () => {
      vi.mocked(deps.filesystem.exists)
        .mockResolvedValueOnce(true) // backup dir exists
        .mockResolvedValueOnce(false); // config file doesn't exist

      await expect(
        service.backup('claude-code', '/missing/config.json'),
      ).rejects.toThrow('Config file not found');
    });

    it('should cleanup old backups after creating new one', async () => {
      // Mock 12 existing backups - cleanupOldBackups will be called with keepCount=10
      // So 2 should be deleted
      const oldBackupFiles = [
        'claude-code-2025-01-01T00-00-00-000Z.json',
        'claude-code-2025-01-02T00-00-00-000Z.json',
        'claude-code-2025-01-03T00-00-00-000Z.json',
        'claude-code-2025-01-04T00-00-00-000Z.json',
        'claude-code-2025-01-05T00-00-00-000Z.json',
        'claude-code-2025-01-06T00-00-00-000Z.json',
        'claude-code-2025-01-07T00-00-00-000Z.json',
        'claude-code-2025-01-08T00-00-00-000Z.json',
        'claude-code-2025-01-09T00-00-00-000Z.json',
        'claude-code-2025-01-10T00-00-00-000Z.json',
        'claude-code-2025-01-11T00-00-00-000Z.json',
        'claude-code-2025-01-12T00-00-00-000Z.json',
      ];

      vi.mocked(deps.filesystem.readdir).mockResolvedValue(oldBackupFiles);
      vi.mocked(deps.filesystem.stat).mockResolvedValue({ size: 100 } as any);

      await service.backup('claude-code', '/home/user/.claude.json');

      // Should have called rm for backups beyond the keep count (10)
      // Since we have 12 backups and keep 10, 2 oldest should be deleted
      expect(deps.filesystem.rm).toHaveBeenCalledTimes(2);
    });
  });

  describe('listBackups()', () => {
    it('should list backups for a specific client', async () => {
      vi.mocked(deps.filesystem.readdir).mockResolvedValue([
        'claude-code-2025-01-15T10-00-00-000Z.json',
        'claude-code-2025-01-14T10-00-00-000Z.json',
        'copilot-cli-2025-01-15T09-00-00-000Z.json',
      ]);
      vi.mocked(deps.filesystem.stat).mockResolvedValue({ size: 256 } as any);

      const result = await service.listBackups('claude-code');

      expect(result).toHaveLength(2);
      expect(result[0].client).toBe('claude-code');
      expect(result[0].timestamp).toBe('2025-01-15T10-00-00-000Z');
      expect(result[1].timestamp).toBe('2025-01-14T10-00-00-000Z');
    });

    it('should list all backups when client not specified', async () => {
      vi.mocked(deps.filesystem.readdir).mockResolvedValue([
        'claude-code-2025-01-15T10-00-00-000Z.json',
        'copilot-cli-2025-01-15T09-00-00-000Z.json',
      ]);
      vi.mocked(deps.filesystem.stat).mockResolvedValue({ size: 256 } as any);

      const result = await service.listBackups();

      expect(result).toHaveLength(2);
    });

    it('should return empty array if backup dir does not exist', async () => {
      vi.mocked(deps.filesystem.exists).mockResolvedValue(false);

      const result = await service.listBackups();

      expect(result).toEqual([]);
    });

    it('should skip non-JSON files', async () => {
      vi.mocked(deps.filesystem.readdir).mockResolvedValue([
        'claude-code-2025-01-15T10-00-00-000Z.json',
        'readme.txt',
        '.gitignore',
      ]);
      vi.mocked(deps.filesystem.stat).mockResolvedValue({ size: 256 } as any);

      const result = await service.listBackups();

      expect(result).toHaveLength(1);
    });

    it('should sort backups by timestamp (newest first)', async () => {
      vi.mocked(deps.filesystem.readdir).mockResolvedValue([
        'claude-code-2025-01-10T10-00-00-000Z.json',
        'claude-code-2025-01-15T10-00-00-000Z.json',
        'claude-code-2025-01-12T10-00-00-000Z.json',
      ]);
      vi.mocked(deps.filesystem.stat).mockResolvedValue({ size: 256 } as any);

      const result = await service.listBackups();

      expect(result[0].timestamp).toBe('2025-01-15T10-00-00-000Z');
      expect(result[1].timestamp).toBe('2025-01-12T10-00-00-000Z');
      expect(result[2].timestamp).toBe('2025-01-10T10-00-00-000Z');
    });
  });

  describe('getBackup()', () => {
    it('should return backup by client and timestamp', async () => {
      vi.mocked(deps.filesystem.readdir).mockResolvedValue([
        'claude-code-2025-01-15T10-00-00-000Z.json',
      ]);
      vi.mocked(deps.filesystem.stat).mockResolvedValue({ size: 256 } as any);

      const result = await service.getBackup(
        'claude-code',
        '2025-01-15T10-00-00-000Z',
      );

      expect(result).not.toBeNull();
      expect(result?.client).toBe('claude-code');
      expect(result?.timestamp).toBe('2025-01-15T10-00-00-000Z');
    });

    it('should return null if backup not found', async () => {
      vi.mocked(deps.filesystem.readdir).mockResolvedValue([]);

      const result = await service.getBackup(
        'claude-code',
        '2025-01-15T10-00-00-000Z',
      );

      expect(result).toBeNull();
    });
  });

  describe('deleteBackup()', () => {
    it('should delete backup file', async () => {
      await service.deleteBackup('/backups/claude-code-2025-01-15.json');

      expect(deps.filesystem.rm).toHaveBeenCalledWith(
        '/backups/claude-code-2025-01-15.json',
      );
    });

    it('should not throw if file does not exist', async () => {
      vi.mocked(deps.filesystem.exists).mockResolvedValue(false);

      await expect(
        service.deleteBackup('/backups/missing.json'),
      ).resolves.not.toThrow();
    });
  });

  describe('getLatestBackup()', () => {
    it('should return the most recent backup', async () => {
      vi.mocked(deps.filesystem.readdir).mockResolvedValue([
        'claude-code-2025-01-10T10-00-00-000Z.json',
        'claude-code-2025-01-15T10-00-00-000Z.json',
      ]);
      vi.mocked(deps.filesystem.stat).mockResolvedValue({ size: 256 } as any);

      const result = await service.getLatestBackup('claude-code');

      expect(result?.timestamp).toBe('2025-01-15T10-00-00-000Z');
    });

    it('should return null if no backups exist', async () => {
      vi.mocked(deps.filesystem.readdir).mockResolvedValue([]);

      const result = await service.getLatestBackup('claude-code');

      expect(result).toBeNull();
    });
  });

  describe('cleanupOldBackups()', () => {
    it('should keep only specified number of backups', async () => {
      vi.mocked(deps.filesystem.readdir).mockResolvedValue([
        'claude-code-2025-01-15T10-00-00-000Z.json',
        'claude-code-2025-01-14T10-00-00-000Z.json',
        'claude-code-2025-01-13T10-00-00-000Z.json',
      ]);
      vi.mocked(deps.filesystem.stat).mockResolvedValue({ size: 256 } as any);

      await service.cleanupOldBackups('claude-code', 2);

      // Should delete the oldest backup (3rd one)
      expect(deps.filesystem.rm).toHaveBeenCalledTimes(1);
      expect(deps.filesystem.rm).toHaveBeenCalledWith(
        expect.stringContaining('2025-01-13'),
      );
    });

    it('should not delete if fewer backups than keep count', async () => {
      vi.mocked(deps.filesystem.readdir).mockResolvedValue([
        'claude-code-2025-01-15T10-00-00-000Z.json',
      ]);
      vi.mocked(deps.filesystem.stat).mockResolvedValue({ size: 256 } as any);

      await service.cleanupOldBackups('claude-code', 10);

      expect(deps.filesystem.rm).not.toHaveBeenCalled();
    });
  });
});
