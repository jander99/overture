/**
 * Restore Service Tests
 *
 * Comprehensive tests for restore service functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RestoreService, type RestoreServiceDeps } from './restore-service.js';
import { BackupService, type BackupServiceDeps } from './backup-service.js';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { OutputPort } from '@overture/ports-output';

// Helper to create mock filesystem
function createMockFilesystem(): FilesystemPort {
  return {
    exists: vi.fn().mockResolvedValue(true),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    stat: vi.fn().mockResolvedValue({ size: 100 }),
    rm: vi.fn().mockResolvedValue(undefined),
  } as unknown as FilesystemPort;
}

// Helper to create mock output
function createMockOutput(): OutputPort {
  return {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as OutputPort;
}

// Helper to create mock backup service
function createMockBackupService(): BackupService {
  const backupDeps: BackupServiceDeps = {
    filesystem: createMockFilesystem(),
    output: createMockOutput(),
    getBackupDir: () => '/backups',
  };
  const service = new BackupService(backupDeps);

  // Override methods with mocks
  service.getBackup = vi.fn();
  service.getLatestBackup = vi.fn();

  return service;
}

describe('RestoreService', () => {
  let deps: RestoreServiceDeps;
  let service: RestoreService;
  let mockBackupService: BackupService;

  beforeEach(() => {
    mockBackupService = createMockBackupService();
    deps = {
      filesystem: createMockFilesystem(),
      output: createMockOutput(),
      backupService: mockBackupService,
    };
    service = new RestoreService(deps);
  });

  describe('restore()', () => {
    it('should restore backup to target path', async () => {
      const backupContent = JSON.stringify({
        mcpServers: { github: { command: 'mcp-github', args: [] } },
      });

      vi.mocked(mockBackupService.getBackup).mockResolvedValue({
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/claude-code-2025-01-15.json',
        size: 256,
      });
      vi.mocked(deps.filesystem.readFile).mockResolvedValue(backupContent);

      const result = await service.restore(
        'claude-code',
        '2025-01-15T10-00-00-000Z',
        '/home/user/.claude.json',
      );

      expect(result.success).toBe(true);
      expect(result.backupPath).toBe('/backups/claude-code-2025-01-15.json');
      expect(result.restoredPath).toBe('/home/user/.claude.json');
      expect(deps.filesystem.writeFile).toHaveBeenCalledWith(
        '/home/user/.claude.json',
        backupContent,
      );
    });

    it('should create target directory if it does not exist', async () => {
      vi.mocked(mockBackupService.getBackup).mockResolvedValue({
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/claude-code.json',
        size: 256,
      });
      vi.mocked(deps.filesystem.readFile).mockResolvedValue(
        JSON.stringify({ mcpServers: {} }),
      );
      vi.mocked(deps.filesystem.exists)
        .mockResolvedValueOnce(true) // backup file exists
        .mockResolvedValueOnce(false); // target dir doesn't exist

      await service.restore(
        'claude-code',
        '2025-01-15T10-00-00-000Z',
        '/new/dir/config.json',
      );

      expect(deps.filesystem.mkdir).toHaveBeenCalledWith('/new/dir', {
        recursive: true,
      });
    });

    it('should return error if backup not found', async () => {
      vi.mocked(mockBackupService.getBackup).mockResolvedValue(null);

      const result = await service.restore(
        'claude-code',
        'missing-timestamp',
        '/home/user/.claude.json',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Backup not found');
    });

    it('should return error if backup file is missing', async () => {
      vi.mocked(mockBackupService.getBackup).mockResolvedValue({
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/missing.json',
        size: 256,
      });
      vi.mocked(deps.filesystem.exists).mockResolvedValue(false);

      const result = await service.restore(
        'claude-code',
        '2025-01-15T10-00-00-000Z',
        '/home/user/.claude.json',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error if backup is invalid JSON', async () => {
      vi.mocked(mockBackupService.getBackup).mockResolvedValue({
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/invalid.json',
        size: 256,
      });
      vi.mocked(deps.filesystem.readFile).mockResolvedValue('invalid json {');

      const result = await service.restore(
        'claude-code',
        '2025-01-15T10-00-00-000Z',
        '/home/user/.claude.json',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not valid JSON');
    });

    it('should return error if backup missing required mcpServers key', async () => {
      vi.mocked(mockBackupService.getBackup).mockResolvedValue({
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/bad.json',
        size: 256,
      });
      vi.mocked(deps.filesystem.readFile).mockResolvedValue('{}');

      const result = await service.restore(
        'claude-code',
        '2025-01-15T10-00-00-000Z',
        '/home/user/.claude.json',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing mcpServers');
    });
  });

  describe('restoreLatest()', () => {
    it('should restore the latest backup', async () => {
      const backupContent = JSON.stringify({ mcpServers: {} });

      vi.mocked(mockBackupService.getLatestBackup).mockResolvedValue({
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/latest.json',
        size: 256,
      });
      vi.mocked(mockBackupService.getBackup).mockResolvedValue({
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/latest.json',
        size: 256,
      });
      vi.mocked(deps.filesystem.readFile).mockResolvedValue(backupContent);

      const result = await service.restoreLatest('claude-code', '/target.json');

      expect(result.success).toBe(true);
    });

    it('should return error if no backups exist', async () => {
      vi.mocked(mockBackupService.getLatestBackup).mockResolvedValue(null);

      const result = await service.restoreLatest('claude-code', '/target.json');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No backups found');
    });
  });

  describe('preview()', () => {
    it('should return backup content as parsed object', async () => {
      const backupData = { mcpServers: { github: {} } };

      vi.mocked(mockBackupService.getBackup).mockResolvedValue({
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/backup.json',
        size: 256,
      });
      vi.mocked(deps.filesystem.readFile).mockResolvedValue(
        JSON.stringify(backupData),
      );

      const result = await service.preview(
        'claude-code',
        '2025-01-15T10-00-00-000Z',
      );

      expect(result).toEqual(backupData);
    });

    it('should return null if backup not found', async () => {
      vi.mocked(mockBackupService.getBackup).mockResolvedValue(null);

      const result = await service.preview('claude-code', 'missing');

      expect(result).toBeNull();
    });

    it('should return null if read fails', async () => {
      vi.mocked(mockBackupService.getBackup).mockResolvedValue({
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/backup.json',
        size: 256,
      });
      vi.mocked(deps.filesystem.readFile).mockRejectedValue(
        new Error('Read failed'),
      );

      const result = await service.preview(
        'claude-code',
        '2025-01-15T10-00-00-000Z',
      );

      expect(result).toBeNull();
    });
  });

  describe('compare()', () => {
    it('should compare backup with current config', async () => {
      vi.mocked(mockBackupService.getBackup).mockResolvedValue({
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/backup.json',
        size: 256,
      });
      vi.mocked(deps.filesystem.readFile)
        .mockResolvedValueOnce(
          JSON.stringify({
            mcpServers: { github: {}, filesystem: {} },
          }),
        ) // backup
        .mockResolvedValueOnce(
          JSON.stringify({
            mcpServers: { github: {}, slack: {} },
          }),
        ); // current

      const result = await service.compare(
        'claude-code',
        '2025-01-15T10-00-00-000Z',
        '/current.json',
      );

      expect(result.hasChanges).toBe(true);
      expect(result.backupMcps).toContain('filesystem');
      expect(result.currentMcps).toContain('slack');
      expect(result.added).toContain('filesystem'); // In backup but not current
      expect(result.removed).toContain('slack'); // In current but not backup
    });

    it('should return no changes when configs are identical', async () => {
      const config = { mcpServers: { github: {} } };

      vi.mocked(mockBackupService.getBackup).mockResolvedValue({
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/backup.json',
        size: 256,
      });
      vi.mocked(deps.filesystem.readFile).mockResolvedValue(
        JSON.stringify(config),
      );

      const result = await service.compare(
        'claude-code',
        '2025-01-15T10-00-00-000Z',
        '/current.json',
      );

      expect(result.hasChanges).toBe(false);
      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
    });

    it('should handle missing current config', async () => {
      vi.mocked(mockBackupService.getBackup).mockResolvedValue({
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/backup.json',
        size: 256,
      });
      vi.mocked(deps.filesystem.readFile).mockResolvedValue(
        JSON.stringify({ mcpServers: { github: {} } }),
      );
      // The compare function checks if current config exists
      vi.mocked(deps.filesystem.exists).mockResolvedValue(false);

      const result = await service.compare(
        'claude-code',
        '2025-01-15T10-00-00-000Z',
        '/missing.json',
      );

      expect(result.hasChanges).toBe(true);
      expect(result.added).toContain('github');
      expect(result.currentMcps).toEqual([]);
    });

    it('should return error if backup not found', async () => {
      vi.mocked(mockBackupService.getBackup).mockResolvedValue(null);

      const result = await service.compare(
        'claude-code',
        'missing',
        '/current.json',
      );

      expect(result.hasChanges).toBe(false);
      expect(result.error).toContain('Backup not found');
    });
  });
});
