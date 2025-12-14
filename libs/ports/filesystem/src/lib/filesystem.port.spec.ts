/**
 * Tests for FilesystemPort interface
 *
 * This test suite verifies:
 * 1. The interface is properly exported
 * 2. The Stats type is properly exported
 * 3. Mock implementations can be created for testing
 * 4. Type safety is enforced
 */

import { describe, it, expect, vi } from 'vitest';
import type { FilesystemPort, Stats } from './filesystem.port.js';

describe('FilesystemPort', () => {
  describe('interface contract', () => {
    it('should allow creation of mock implementations', () => {
      // Create a mock implementation
      const mockFilesystem: FilesystemPort = {
        readFile: vi.fn().mockResolvedValue('file contents'),
        writeFile: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        mkdir: vi.fn().mockResolvedValue(undefined),
        readdir: vi.fn().mockResolvedValue(['file1.txt', 'file2.txt']),
        stat: vi.fn().mockResolvedValue({
          isFile: () => true,
          isDirectory: () => false,
          size: 1024,
          mtime: new Date('2025-01-01'),
        }),
        rm: vi.fn().mockResolvedValue(undefined),
      };

      // Verify mock has all required methods
      expect(mockFilesystem.readFile).toBeDefined();
      expect(mockFilesystem.writeFile).toBeDefined();
      expect(mockFilesystem.exists).toBeDefined();
      expect(mockFilesystem.mkdir).toBeDefined();
      expect(mockFilesystem.readdir).toBeDefined();
      expect(mockFilesystem.stat).toBeDefined();
      expect(mockFilesystem.rm).toBeDefined();
    });

    it('should enforce async return types', async () => {
      const mockFilesystem: FilesystemPort = {
        readFile: vi.fn().mockResolvedValue('content'),
        writeFile: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(true),
        mkdir: vi.fn().mockResolvedValue(undefined),
        readdir: vi.fn().mockResolvedValue([]),
        stat: vi.fn().mockResolvedValue({
          isFile: () => true,
          isDirectory: () => false,
          size: 0,
          mtime: new Date(),
        }),
        rm: vi.fn().mockResolvedValue(undefined),
      };

      // All methods should return Promises
      await expect(mockFilesystem.readFile('/test')).resolves.toBe('content');
      await expect(mockFilesystem.writeFile('/test', 'data')).resolves.toBeUndefined();
      await expect(mockFilesystem.exists('/test')).resolves.toBe(true);
      await expect(mockFilesystem.mkdir('/test')).resolves.toBeUndefined();
      await expect(mockFilesystem.readdir('/test')).resolves.toEqual([]);
      await expect(mockFilesystem.stat('/test')).resolves.toBeDefined();
      await expect(mockFilesystem.rm('/test')).resolves.toBeUndefined();
    });
  });

  describe('readFile', () => {
    it('should accept path parameter and return string', async () => {
      const mockFilesystem: FilesystemPort = {
        readFile: vi.fn().mockResolvedValue('file contents'),
        writeFile: vi.fn(),
        exists: vi.fn(),
        mkdir: vi.fn(),
        readdir: vi.fn(),
        stat: vi.fn(),
        rm: vi.fn(),
      };

      const result = await mockFilesystem.readFile('/path/to/file.txt');
      expect(result).toBe('file contents');
      expect(mockFilesystem.readFile).toHaveBeenCalledWith('/path/to/file.txt');
    });
  });

  describe('writeFile', () => {
    it('should accept path and content parameters', async () => {
      const mockFilesystem: FilesystemPort = {
        readFile: vi.fn(),
        writeFile: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn(),
        mkdir: vi.fn(),
        readdir: vi.fn(),
        stat: vi.fn(),
        rm: vi.fn(),
      };

      await mockFilesystem.writeFile('/path/to/file.txt', 'new content');
      expect(mockFilesystem.writeFile).toHaveBeenCalledWith(
        '/path/to/file.txt',
        'new content'
      );
    });
  });

  describe('exists', () => {
    it('should accept path parameter and return boolean', async () => {
      const mockFilesystem: FilesystemPort = {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        exists: vi.fn().mockResolvedValue(true),
        mkdir: vi.fn(),
        readdir: vi.fn(),
        stat: vi.fn(),
        rm: vi.fn(),
      };

      const result = await mockFilesystem.exists('/path/to/check');
      expect(result).toBe(true);
      expect(mockFilesystem.exists).toHaveBeenCalledWith('/path/to/check');
    });

    it('should return false when path does not exist', async () => {
      const mockFilesystem: FilesystemPort = {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        exists: vi.fn().mockResolvedValue(false),
        mkdir: vi.fn(),
        readdir: vi.fn(),
        stat: vi.fn(),
        rm: vi.fn(),
      };

      const result = await mockFilesystem.exists('/nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('mkdir', () => {
    it('should accept path parameter', async () => {
      const mockFilesystem: FilesystemPort = {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        exists: vi.fn(),
        mkdir: vi.fn().mockResolvedValue(undefined),
        readdir: vi.fn(),
        stat: vi.fn(),
        rm: vi.fn(),
      };

      await mockFilesystem.mkdir('/path/to/dir');
      expect(mockFilesystem.mkdir).toHaveBeenCalledWith('/path/to/dir');
    });

    it('should accept optional recursive option', async () => {
      const mockFilesystem: FilesystemPort = {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        exists: vi.fn(),
        mkdir: vi.fn().mockResolvedValue(undefined),
        readdir: vi.fn(),
        stat: vi.fn(),
        rm: vi.fn(),
      };

      await mockFilesystem.mkdir('/path/to/deep/dir', { recursive: true });
      expect(mockFilesystem.mkdir).toHaveBeenCalledWith('/path/to/deep/dir', {
        recursive: true,
      });
    });
  });

  describe('readdir', () => {
    it('should accept path parameter and return string array', async () => {
      const mockFilesystem: FilesystemPort = {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        exists: vi.fn(),
        mkdir: vi.fn(),
        readdir: vi.fn().mockResolvedValue(['file1.txt', 'file2.txt', 'subdir']),
        stat: vi.fn(),
        rm: vi.fn(),
      };

      const result = await mockFilesystem.readdir('/path/to/dir');
      expect(result).toEqual(['file1.txt', 'file2.txt', 'subdir']);
      expect(mockFilesystem.readdir).toHaveBeenCalledWith('/path/to/dir');
    });

    it('should return empty array for empty directory', async () => {
      const mockFilesystem: FilesystemPort = {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        exists: vi.fn(),
        mkdir: vi.fn(),
        readdir: vi.fn().mockResolvedValue([]),
        stat: vi.fn(),
        rm: vi.fn(),
      };

      const result = await mockFilesystem.readdir('/empty/dir');
      expect(result).toEqual([]);
    });
  });

  describe('stat', () => {
    it('should accept path parameter and return Stats', async () => {
      const mockStats: Stats = {
        isFile: () => true,
        isDirectory: () => false,
        size: 2048,
        mtime: new Date('2025-01-15T12:00:00Z'),
      };

      const mockFilesystem: FilesystemPort = {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        exists: vi.fn(),
        mkdir: vi.fn(),
        readdir: vi.fn(),
        stat: vi.fn().mockResolvedValue(mockStats),
        rm: vi.fn(),
      };

      const result = await mockFilesystem.stat('/path/to/file.txt');
      expect(result).toBe(mockStats);
      expect(result.isFile()).toBe(true);
      expect(result.isDirectory()).toBe(false);
      expect(result.size).toBe(2048);
      expect(result.mtime).toEqual(new Date('2025-01-15T12:00:00Z'));
    });

    it('should work for directories', async () => {
      const mockStats: Stats = {
        isFile: () => false,
        isDirectory: () => true,
        size: 4096,
        mtime: new Date('2025-01-10T08:30:00Z'),
      };

      const mockFilesystem: FilesystemPort = {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        exists: vi.fn(),
        mkdir: vi.fn(),
        readdir: vi.fn(),
        stat: vi.fn().mockResolvedValue(mockStats),
        rm: vi.fn(),
      };

      const result = await mockFilesystem.stat('/path/to/dir');
      expect(result.isFile()).toBe(false);
      expect(result.isDirectory()).toBe(true);
    });
  });

  describe('rm', () => {
    it('should accept path parameter', async () => {
      const mockFilesystem: FilesystemPort = {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        exists: vi.fn(),
        mkdir: vi.fn(),
        readdir: vi.fn(),
        stat: vi.fn(),
        rm: vi.fn().mockResolvedValue(undefined),
      };

      await mockFilesystem.rm('/path/to/file.txt');
      expect(mockFilesystem.rm).toHaveBeenCalledWith('/path/to/file.txt');
    });

    it('should accept optional recursive option', async () => {
      const mockFilesystem: FilesystemPort = {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        exists: vi.fn(),
        mkdir: vi.fn(),
        readdir: vi.fn(),
        stat: vi.fn(),
        rm: vi.fn().mockResolvedValue(undefined),
      };

      await mockFilesystem.rm('/path/to/dir', { recursive: true });
      expect(mockFilesystem.rm).toHaveBeenCalledWith('/path/to/dir', {
        recursive: true,
      });
    });
  });
});

describe('Stats', () => {
  it('should allow creation of Stats objects', () => {
    const stats: Stats = {
      isFile: () => true,
      isDirectory: () => false,
      size: 1024,
      mtime: new Date('2025-01-01'),
    };

    expect(stats.isFile()).toBe(true);
    expect(stats.isDirectory()).toBe(false);
    expect(stats.size).toBe(1024);
    expect(stats.mtime).toEqual(new Date('2025-01-01'));
  });

  it('should enforce required properties', () => {
    // This test verifies that TypeScript enforces the interface
    const stats: Stats = {
      isFile: () => false,
      isDirectory: () => true,
      size: 0,
      mtime: new Date(),
    };

    // All required properties must be present
    expect(stats).toHaveProperty('isFile');
    expect(stats).toHaveProperty('isDirectory');
    expect(stats).toHaveProperty('size');
    expect(stats).toHaveProperty('mtime');
  });
});

describe('FilesystemPort usage examples', () => {
  it('should demonstrate typical file operations workflow', async () => {
    const mockFilesystem: FilesystemPort = {
      readFile: vi.fn().mockResolvedValue('{}'),
      writeFile: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
      mkdir: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue([]),
      stat: vi.fn().mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 2,
        mtime: new Date(),
      }),
      rm: vi.fn().mockResolvedValue(undefined),
    };

    // Check if directory exists
    const dirExists = await mockFilesystem.exists('/config');
    expect(dirExists).toBe(false);

    // Create directory if it doesn't exist
    if (!dirExists) {
      await mockFilesystem.mkdir('/config', { recursive: true });
    }

    // Write config file
    await mockFilesystem.writeFile('/config/app.json', '{}');

    // Read config file
    const content = await mockFilesystem.readFile('/config/app.json');
    expect(content).toBe('{}');

    // Get file stats
    const stats = await mockFilesystem.stat('/config/app.json');
    expect(stats.isFile()).toBe(true);

    // List directory contents
    const files = await mockFilesystem.readdir('/config');
    expect(Array.isArray(files)).toBe(true);
  });

  it('should demonstrate error handling pattern', async () => {
    const mockFilesystem: FilesystemPort = {
      readFile: vi.fn().mockRejectedValue(new Error('ENOENT: file not found')),
      writeFile: vi.fn(),
      exists: vi.fn(),
      mkdir: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      rm: vi.fn(),
    };

    // Consumers should handle errors
    await expect(mockFilesystem.readFile('/nonexistent.txt')).rejects.toThrow(
      'ENOENT: file not found'
    );
  });
});
