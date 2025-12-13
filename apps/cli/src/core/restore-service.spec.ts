import type { Mock, Mocked, MockedObject, MockedFunction, MockInstance } from 'vitest';
/**
 * Restore Service Tests
 *
 * @module core/restore-service.spec
 */

import * as fs from 'fs';
import {
  restoreBackup,
  restoreLatestBackup,
  validateBackup,
  previewBackup,
  compareBackupWithCurrent,
} from './restore-service';
import type { BackupMetadata } from './backup-service';

// Mock fs module
vi.mock('fs');
const mockFs = fs as Mocked<typeof fs>;

// Mock backup-service
vi.mock('./backup-service', () => ({
  getBackup: vi.fn(),
  getLatestBackup: vi.fn(),
}));

import * as backupService from './backup-service';

describe('Restore Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('restoreBackup', () => {
    it('should restore backup successfully', () => {
      const mockBackup: BackupMetadata = {
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/claude-code-2025-01-15T10-00-00-000Z.json',
        size: 100,
      };

      const backupContent = JSON.stringify({
        mcpServers: {
          github: { command: 'gh', args: [] },
        },
      });

      backupService.getBackup.mockReturnValue(mockBackup);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(backupContent);

      const result = restoreBackup('claude-code', '2025-01-15T10-00-00-000Z', '/test/config.json');

      expect(result.success).toBe(true);
      expect(result.backupPath).toBe(mockBackup.path);
      expect(result.restoredPath).toBe('/test/config.json');
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/test/config.json',
        backupContent,
        'utf-8'
      );
    });

    it('should fail if backup not found', () => {
      backupService.getBackup.mockReturnValue(null);

      const result = restoreBackup('claude-code', '2025-01-15T10-00-00-000Z', '/test/config.json');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Backup not found');
    });

    it('should fail if backup is invalid', () => {
      const mockBackup: BackupMetadata = {
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/invalid.json',
        size: 100,
      };

      backupService.getBackup.mockReturnValue(mockBackup);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"invalid": "structure"}');

      const result = restoreBackup('claude-code', '2025-01-15T10-00-00-000Z', '/test/config.json');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid backup');
    });

    it('should create target directory if it does not exist', () => {
      const mockBackup: BackupMetadata = {
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/backup.json',
        size: 100,
      };

      const backupContent = JSON.stringify({
        mcpServers: { github: { command: 'gh', args: [] } },
      });

      backupService.getBackup.mockReturnValue(mockBackup);
      mockFs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
      mockFs.readFileSync.mockReturnValue(backupContent);

      restoreBackup('claude-code', '2025-01-15T10-00-00-000Z', '/new/dir/config.json');

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/new/dir', { recursive: true });
    });
  });

  describe('restoreLatestBackup', () => {
    it('should restore latest backup', () => {
      const mockBackup: BackupMetadata = {
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/latest.json',
        size: 100,
      };

      const backupContent = JSON.stringify({
        mcpServers: { github: { command: 'gh', args: [] } },
      });

      backupService.getLatestBackup.mockReturnValue(mockBackup);
      backupService.getBackup.mockReturnValue(mockBackup);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(backupContent);

      const result = restoreLatestBackup('claude-code', '/test/config.json');

      expect(result.success).toBe(true);
      expect(backupService.getLatestBackup).toHaveBeenCalledWith('claude-code');
    });

    it('should fail if no backups exist', () => {
      backupService.getLatestBackup.mockReturnValue(null);

      const result = restoreLatestBackup('claude-code', '/test/config.json');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No backups found');
    });
  });

  describe('validateBackup', () => {
    it('should validate valid backup', () => {
      const mockBackup: BackupMetadata = {
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/valid.json',
        size: 100,
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          mcpServers: {
            github: { command: 'gh', args: [] },
          },
        })
      );

      const error = validateBackup(mockBackup);

      expect(error).toBeNull();
    });

    it('should fail if backup file does not exist', () => {
      const mockBackup: BackupMetadata = {
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/missing.json',
        size: 100,
      };

      mockFs.existsSync.mockReturnValue(false);

      const error = validateBackup(mockBackup);

      expect(error).toContain('Backup file not found');
    });

    it('should fail if backup is not valid JSON', () => {
      const mockBackup: BackupMetadata = {
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/invalid.json',
        size: 100,
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('not valid json{');

      const error = validateBackup(mockBackup);

      expect(error).toContain('Not valid JSON');
    });

    it('should fail if backup missing mcpServers/servers key', () => {
      const mockBackup: BackupMetadata = {
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/invalid.json',
        size: 100,
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ other: 'data' }));

      const error = validateBackup(mockBackup);

      expect(error).toContain('Missing mcpServers or servers key');
    });

    it('should fail if MCP server missing command field', () => {
      const mockBackup: BackupMetadata = {
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/invalid.json',
        size: 100,
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          mcpServers: {
            github: { args: [] }, // Missing command
          },
        })
      );

      const error = validateBackup(mockBackup);

      expect(error).toContain("missing required 'command' field");
    });

    it('should validate VS Code format (servers key)', () => {
      const mockBackup: BackupMetadata = {
        client: 'vscode',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/vscode.json',
        size: 100,
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          servers: {
            github: { command: 'gh', args: [], type: 'stdio' },
          },
        })
      );

      const error = validateBackup(mockBackup);

      expect(error).toBeNull();
    });
  });

  describe('previewBackup', () => {
    it('should preview backup content', () => {
      const mockBackup: BackupMetadata = {
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/backup.json',
        size: 100,
      };

      const backupContent = {
        mcpServers: { github: { command: 'gh', args: [] } },
      };

      backupService.getBackup.mockReturnValue(mockBackup);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(backupContent));

      const preview = previewBackup('claude-code', '2025-01-15T10-00-00-000Z');

      expect(preview).toEqual(backupContent);
    });

    it('should return null if backup not found', () => {
      backupService.getBackup.mockReturnValue(null);

      const preview = previewBackup('claude-code', '2025-01-15T10-00-00-000Z');

      expect(preview).toBeNull();
    });
  });

  describe('compareBackupWithCurrent', () => {
    it('should compare backup with current config', () => {
      const mockBackup: BackupMetadata = {
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/backup.json',
        size: 100,
      };

      const backupContent = {
        mcpServers: {
          github: { command: 'gh', args: [] },
          new: { command: 'new', args: [] },
        },
      };

      const currentContent = {
        mcpServers: {
          github: { command: 'gh', args: [] },
          old: { command: 'old', args: [] },
        },
      };

      backupService.getBackup.mockReturnValue(mockBackup);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync
        .mockReturnValueOnce(JSON.stringify(backupContent))
        .mockReturnValueOnce(JSON.stringify(currentContent));

      const result = compareBackupWithCurrent(
        'claude-code',
        '2025-01-15T10-00-00-000Z',
        '/current/config.json'
      );

      expect(result.hasChanges).toBe(true);
      expect(result.backupMcps).toEqual(['github', 'new']);
      expect(result.currentMcps).toEqual(['github', 'old']);
      expect(result.added).toEqual(['new']);
      expect(result.removed).toEqual(['old']);
    });

    it('should handle missing current config', () => {
      const mockBackup: BackupMetadata = {
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/backups/backup.json',
        size: 100,
      };

      const backupContent = {
        mcpServers: { github: { command: 'gh', args: [] } },
      };

      backupService.getBackup.mockReturnValue(mockBackup);
      mockFs.existsSync.mockImplementation((p) => {
        // Current config doesn't exist
        return p !== '/missing/config.json';
      });
      mockFs.readFileSync.mockReturnValueOnce(JSON.stringify(backupContent));

      const result = compareBackupWithCurrent(
        'claude-code',
        '2025-01-15T10-00-00-000Z',
        '/missing/config.json'
      );

      expect(result.hasChanges).toBe(true);
      expect(result.backupMcps).toEqual(['github']);
      expect(result.currentMcps).toEqual([]);
      expect(result.added).toEqual(['github']);
      expect(result.removed).toEqual([]);
    });
  });
});
