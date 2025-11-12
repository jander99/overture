/**
 * Backup Service Tests
 *
 * @module core/backup-service.spec
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  backupClientConfig,
  listBackups,
  getBackup,
  deleteBackup,
  cleanupOldBackups,
  getLatestBackup,
} from './backup-service';
import type { ClientName } from '../domain/config-v2.types';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock path-resolver
jest.mock('./path-resolver', () => ({
  getBackupDir: jest.fn(() => '/home/user/.config/overture/backups'),
}));

describe('Backup Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Date.now() to a fixed value for consistent timestamps
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2025-01-15T10:30:00.000Z');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('backupClientConfig', () => {
    it('should create backup directory if it does not exist', () => {
      mockFs.existsSync.mockImplementation((p) => {
        if (p === '/home/user/.config/overture/backups') return false;
        if (p === '/test/config.json') return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue('{"mcpServers":{}}');
      mockFs.readdirSync.mockReturnValue([]);

      backupClientConfig('claude-code', '/test/config.json');

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        '/home/user/.config/overture/backups',
        { recursive: true }
      );
    });

    it('should throw error if config file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => backupClientConfig('claude-code', '/test/config.json')).toThrow(
        'Config file not found: /test/config.json'
      );
    });

    it('should create timestamped backup file', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"mcpServers":{"github":{}}}');
      mockFs.readdirSync.mockReturnValue([]);

      const backupPath = backupClientConfig('claude-code', '/test/config.json');

      expect(backupPath).toBe('/home/user/.config/overture/backups/claude-code-2025-01-15T10-30-00-000Z.json');
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/home/user/.config/overture/backups/claude-code-2025-01-15T10-30-00-000Z.json',
        '{"mcpServers":{"github":{}}}',
        'utf-8'
      );
    });

    it('should trigger cleanup after creating backup', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{}');
      mockFs.readdirSync.mockReturnValue([
        'claude-code-2025-01-01T00-00-00-000Z.json',
        'claude-code-2025-01-02T00-00-00-000Z.json',
      ]);
      mockFs.statSync.mockReturnValue({ size: 100 } as fs.Stats);

      backupClientConfig('claude-code', '/test/config.json');

      // Cleanup is called (tested separately)
      expect(mockFs.readdirSync).toHaveBeenCalled();
    });
  });

  describe('listBackups', () => {
    it('should return empty array if backup directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const backups = listBackups();

      expect(backups).toEqual([]);
    });

    it('should list all backups sorted by timestamp (newest first)', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        'claude-code-2025-01-10T10-00-00-000Z.json',
        'vscode-2025-01-12T10-00-00-000Z.json',
        'claude-code-2025-01-15T10-00-00-000Z.json',
        'invalid-file.txt',
        'malformed-name.json',
      ]);
      mockFs.statSync.mockReturnValue({ size: 100 } as fs.Stats);

      const backups = listBackups();

      expect(backups).toHaveLength(3);
      expect(backups[0].client).toBe('claude-code');
      expect(backups[0].timestamp).toBe('2025-01-15T10-00-00-000Z');
      expect(backups[1].client).toBe('vscode');
      expect(backups[1].timestamp).toBe('2025-01-12T10-00-00-000Z');
      expect(backups[2].client).toBe('claude-code');
      expect(backups[2].timestamp).toBe('2025-01-10T10-00-00-000Z');
    });

    it('should filter backups by client', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        'claude-code-2025-01-10T10-00-00-000Z.json',
        'vscode-2025-01-12T10-00-00-000Z.json',
        'claude-code-2025-01-15T10-00-00-000Z.json',
      ]);
      mockFs.statSync.mockReturnValue({ size: 100 } as fs.Stats);

      const backups = listBackups('claude-code');

      expect(backups).toHaveLength(2);
      expect(backups[0].client).toBe('claude-code');
      expect(backups[1].client).toBe('claude-code');
    });

    it('should include file metadata', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['claude-code-2025-01-15T10-00-00-000Z.json']);
      mockFs.statSync.mockReturnValue({ size: 1024 } as fs.Stats);

      const backups = listBackups();

      expect(backups[0]).toEqual({
        client: 'claude-code',
        timestamp: '2025-01-15T10-00-00-000Z',
        path: '/home/user/.config/overture/backups/claude-code-2025-01-15T10-00-00-000Z.json',
        size: 1024,
      });
    });
  });

  describe('getBackup', () => {
    it('should return backup metadata for specific timestamp', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        'claude-code-2025-01-10T10-00-00-000Z.json',
        'claude-code-2025-01-15T10-00-00-000Z.json',
      ]);
      mockFs.statSync.mockReturnValue({ size: 100 } as fs.Stats);

      const backup = getBackup('claude-code', '2025-01-10T10-00-00-000Z');

      expect(backup).not.toBeNull();
      expect(backup?.timestamp).toBe('2025-01-10T10-00-00-000Z');
    });

    it('should return null if backup not found', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['claude-code-2025-01-15T10-00-00-000Z.json']);
      mockFs.statSync.mockReturnValue({ size: 100 } as fs.Stats);

      const backup = getBackup('claude-code', '2025-01-01T00-00-00-000Z');

      expect(backup).toBeNull();
    });
  });

  describe('deleteBackup', () => {
    it('should delete backup file if it exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      deleteBackup('/test/backup.json');

      expect(mockFs.unlinkSync).toHaveBeenCalledWith('/test/backup.json');
    });

    it('should not throw error if backup does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => deleteBackup('/test/backup.json')).not.toThrow();
      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('cleanupOldBackups', () => {
    it('should keep only the specified number of recent backups', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        'claude-code-2025-01-01T00-00-00-000Z.json',
        'claude-code-2025-01-02T00-00-00-000Z.json',
        'claude-code-2025-01-03T00-00-00-000Z.json',
        'claude-code-2025-01-04T00-00-00-000Z.json',
        'claude-code-2025-01-05T00-00-00-000Z.json',
      ]);
      mockFs.statSync.mockReturnValue({ size: 100 } as fs.Stats);

      cleanupOldBackups('claude-code', 3);

      // Should delete the 2 oldest backups
      expect(mockFs.unlinkSync).toHaveBeenCalledTimes(2);
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        '/home/user/.config/overture/backups/claude-code-2025-01-01T00-00-00-000Z.json'
      );
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        '/home/user/.config/overture/backups/claude-code-2025-01-02T00-00-00-000Z.json'
      );
    });

    it('should not delete anything if backups are within limit', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        'claude-code-2025-01-01T00-00-00-000Z.json',
        'claude-code-2025-01-02T00-00-00-000Z.json',
      ]);
      mockFs.statSync.mockReturnValue({ size: 100 } as fs.Stats);

      cleanupOldBackups('claude-code', 10);

      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should use default keep count of 10', () => {
      mockFs.existsSync.mockReturnValue(true);
      // Create 15 backups
      const backups = Array.from({ length: 15 }, (_, i) =>
        `claude-code-2025-01-${String(i + 1).padStart(2, '0')}T00-00-00-000Z.json`
      );
      mockFs.readdirSync.mockReturnValue(backups);
      mockFs.statSync.mockReturnValue({ size: 100 } as fs.Stats);

      cleanupOldBackups('claude-code');

      // Should delete 5 oldest backups (15 - 10 = 5)
      expect(mockFs.unlinkSync).toHaveBeenCalledTimes(5);
    });
  });

  describe('getLatestBackup', () => {
    it('should return the most recent backup', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        'claude-code-2025-01-10T10-00-00-000Z.json',
        'claude-code-2025-01-15T10-00-00-000Z.json',
        'claude-code-2025-01-05T10-00-00-000Z.json',
      ]);
      mockFs.statSync.mockReturnValue({ size: 100 } as fs.Stats);

      const latest = getLatestBackup('claude-code');

      expect(latest).not.toBeNull();
      expect(latest?.timestamp).toBe('2025-01-15T10-00-00-000Z');
    });

    it('should return null if no backups exist', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([]);

      const latest = getLatestBackup('claude-code');

      expect(latest).toBeNull();
    });
  });
});
