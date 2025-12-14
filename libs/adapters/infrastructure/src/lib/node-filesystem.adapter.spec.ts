/**
 * Tests for NodeFilesystemAdapter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NodeFilesystemAdapter } from './node-filesystem.adapter.js';
import fs from 'node:fs/promises';

// Mock Node.js fs/promises module
vi.mock('node:fs/promises');

describe('NodeFilesystemAdapter', () => {
  let adapter: NodeFilesystemAdapter;

  beforeEach(() => {
    adapter = new NodeFilesystemAdapter();
    vi.clearAllMocks();
  });

  describe('readFile', () => {
    it('should read file content as UTF-8 string', async () => {
      const content = 'Hello, World!';
      vi.mocked(fs.readFile).mockResolvedValue(content);

      const result = await adapter.readFile('/path/to/file.txt');

      expect(result).toBe(content);
      expect(fs.readFile).toHaveBeenCalledWith('/path/to/file.txt', 'utf-8');
    });

    it('should throw error if file does not exist', async () => {
      const error = new Error('ENOENT: no such file or directory');
      vi.mocked(fs.readFile).mockRejectedValue(error);

      await expect(adapter.readFile('/missing.txt')).rejects.toThrow(error);
    });

    it('should handle empty files', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('');

      const result = await adapter.readFile('/empty.txt');

      expect(result).toBe('');
    });
  });

  describe('writeFile', () => {
    it('should write content to file as UTF-8', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await adapter.writeFile('/path/to/file.txt', 'content');

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/path/to/file.txt',
        'content',
        'utf-8'
      );
    });

    it('should handle empty content', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await adapter.writeFile('/file.txt', '');

      expect(fs.writeFile).toHaveBeenCalledWith('/file.txt', '', 'utf-8');
    });

    it('should throw error on write failure', async () => {
      const error = new Error('EACCES: permission denied');
      vi.mocked(fs.writeFile).mockRejectedValue(error);

      await expect(
        adapter.writeFile('/protected.txt', 'content')
      ).rejects.toThrow(error);
    });
  });

  describe('exists', () => {
    it('should return true when path exists', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await adapter.exists('/existing/path');

      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith('/existing/path');
    });

    it('should return false when path does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(
        new Error('ENOENT: no such file or directory')
      );

      const result = await adapter.exists('/missing/path');

      expect(result).toBe(false);
    });

    it('should return false on permission denied', async () => {
      vi.mocked(fs.access).mockRejectedValue(
        new Error('EACCES: permission denied')
      );

      const result = await adapter.exists('/protected');

      expect(result).toBe(false);
    });
  });

  describe('mkdir', () => {
    it('should create directory', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await adapter.mkdir('/new/directory');

      expect(fs.mkdir).toHaveBeenCalledWith('/new/directory', undefined);
    });

    it('should create directory recursively', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await adapter.mkdir('/deep/nested/path', { recursive: true });

      expect(fs.mkdir).toHaveBeenCalledWith('/deep/nested/path', {
        recursive: true,
      });
    });

    it('should throw error on mkdir failure', async () => {
      const error = new Error('EACCES: permission denied');
      vi.mocked(fs.mkdir).mockRejectedValue(error);

      await expect(adapter.mkdir('/protected')).rejects.toThrow(error);
    });
  });

  describe('readdir', () => {
    it('should return array of directory entries', async () => {
      const entries = ['file1.txt', 'file2.txt', 'subdir'];
      vi.mocked(fs.readdir).mockResolvedValue(entries as any);

      const result = await adapter.readdir('/path/to/dir');

      expect(result).toEqual(entries);
      expect(fs.readdir).toHaveBeenCalledWith('/path/to/dir');
    });

    it('should return empty array for empty directory', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([] as any);

      const result = await adapter.readdir('/empty/dir');

      expect(result).toEqual([]);
    });

    it('should throw error if path is not a directory', async () => {
      const error = new Error('ENOTDIR: not a directory');
      vi.mocked(fs.readdir).mockRejectedValue(error);

      await expect(adapter.readdir('/file.txt')).rejects.toThrow(error);
    });
  });

  describe('stat', () => {
    it('should return file stats', async () => {
      const mockStats = {
        isFile: () => true,
        isDirectory: () => false,
        size: 1024,
        mtime: new Date('2025-01-01'),
      };
      vi.mocked(fs.stat).mockResolvedValue(mockStats as any);

      const result = await adapter.stat('/path/to/file.txt');

      expect(result.isFile()).toBe(true);
      expect(result.isDirectory()).toBe(false);
      expect(result.size).toBe(1024);
      expect(result.mtime).toEqual(new Date('2025-01-01'));
    });

    it('should return directory stats', async () => {
      const mockStats = {
        isFile: () => false,
        isDirectory: () => true,
        size: 4096,
        mtime: new Date('2025-01-01'),
      };
      vi.mocked(fs.stat).mockResolvedValue(mockStats as any);

      const result = await adapter.stat('/path/to/dir');

      expect(result.isFile()).toBe(false);
      expect(result.isDirectory()).toBe(true);
      expect(result.size).toBe(4096);
    });

    it('should throw error if path does not exist', async () => {
      const error = new Error('ENOENT: no such file or directory');
      vi.mocked(fs.stat).mockRejectedValue(error);

      await expect(adapter.stat('/missing')).rejects.toThrow(error);
    });
  });

  describe('rm', () => {
    it('should remove a file', async () => {
      vi.mocked(fs.rm).mockResolvedValue(undefined);

      await adapter.rm('/path/to/file.txt');

      expect(fs.rm).toHaveBeenCalledWith('/path/to/file.txt', undefined);
    });

    it('should remove directory recursively', async () => {
      vi.mocked(fs.rm).mockResolvedValue(undefined);

      await adapter.rm('/path/to/dir', { recursive: true });

      expect(fs.rm).toHaveBeenCalledWith('/path/to/dir', { recursive: true });
    });

    it('should throw error if path does not exist', async () => {
      const error = new Error('ENOENT: no such file or directory');
      vi.mocked(fs.rm).mockRejectedValue(error);

      await expect(adapter.rm('/missing')).rejects.toThrow(error);
    });
  });

  describe('FilesystemPort compliance', () => {
    it('should implement all FilesystemPort methods', () => {
      expect(adapter).toHaveProperty('readFile');
      expect(adapter).toHaveProperty('writeFile');
      expect(adapter).toHaveProperty('exists');
      expect(adapter).toHaveProperty('mkdir');
      expect(adapter).toHaveProperty('readdir');
      expect(adapter).toHaveProperty('stat');
      expect(adapter).toHaveProperty('rm');
    });

    it('should have all methods as functions', () => {
      expect(typeof adapter.readFile).toBe('function');
      expect(typeof adapter.writeFile).toBe('function');
      expect(typeof adapter.exists).toBe('function');
      expect(typeof adapter.mkdir).toBe('function');
      expect(typeof adapter.readdir).toBe('function');
      expect(typeof adapter.stat).toBe('function');
      expect(typeof adapter.rm).toBe('function');
    });
  });
});
