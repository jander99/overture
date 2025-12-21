import type {
  Mock,
  Mocked,
  MockedObject,
  MockedFunction,
  MockInstance,
} from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FsUtils } from './fs-utils';
import { ConfigError } from '@overture/errors';

// Mock fs/promises
vi.mock('fs/promises');

describe('FsUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readFile', () => {
    it('should read file successfully and return content as string', async () => {
      const filePath = '/path/to/file.txt';
      const content = 'file content';

      (fs.readFile as Mock).mockResolvedValue(content);

      const result = await FsUtils.readFile(filePath);

      expect(result).toBe(content);
      expect(fs.readFile).toHaveBeenCalledWith(filePath, 'utf-8');
      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should throw ConfigError when file does not exist', async () => {
      const filePath = '/path/to/missing.txt';
      const error = new Error('ENOENT: no such file or directory');

      (fs.readFile as Mock).mockRejectedValue(error);

      await expect(FsUtils.readFile(filePath)).rejects.toThrow(ConfigError);
      await expect(FsUtils.readFile(filePath)).rejects.toThrow(
        'Failed to read file: ENOENT: no such file or directory',
      );
    });

    it('should include filePath in ConfigError', async () => {
      const filePath = '/path/to/file.txt';
      const error = new Error('ENOENT: no such file or directory');

      (fs.readFile as Mock).mockRejectedValue(error);

      try {
        await FsUtils.readFile(filePath);
        fail('Should have thrown ConfigError');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as ConfigError).filePath).toBe(filePath);
      }
    });

    it('should throw ConfigError with permission denied error', async () => {
      const filePath = '/root/protected.txt';
      const error = new Error('EACCES: permission denied');

      (fs.readFile as Mock).mockRejectedValue(error);

      await expect(FsUtils.readFile(filePath)).rejects.toThrow(ConfigError);
      await expect(FsUtils.readFile(filePath)).rejects.toThrow(
        'Failed to read file: EACCES: permission denied',
      );
    });

    it('should handle empty files', async () => {
      const filePath = '/path/to/empty.txt';
      const content = '';

      (fs.readFile as Mock).mockResolvedValue(content);

      const result = await FsUtils.readFile(filePath);

      expect(result).toBe('');
    });

    it('should handle files with special characters', async () => {
      const filePath = '/path/to/file.txt';
      const content = 'Line 1\nLine 2\nLine 3';

      (fs.readFile as Mock).mockResolvedValue(content);

      const result = await FsUtils.readFile(filePath);

      expect(result).toBe(content);
    });
  });

  describe('writeFile', () => {
    it('should write file successfully with content', async () => {
      const filePath = '/path/to/file.txt';
      const content = 'new content';

      (fs.mkdir as Mock).mockResolvedValue(undefined);
      (fs.writeFile as Mock).mockResolvedValue(undefined);

      await FsUtils.writeFile(filePath, content);

      expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(filePath), {
        recursive: true,
      });
      expect(fs.writeFile).toHaveBeenCalledWith(filePath, content, 'utf-8');
    });

    it('should create parent directories before writing', async () => {
      const filePath = '/deep/nested/path/to/file.txt';
      const content = 'content';
      const expectedDir = path.dirname(filePath);

      (fs.mkdir as Mock).mockResolvedValue(undefined);
      (fs.writeFile as Mock).mockResolvedValue(undefined);

      await FsUtils.writeFile(filePath, content);

      expect(fs.mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(filePath, content, 'utf-8');
    });

    it('should handle writing to existing directory', async () => {
      const filePath = '/existing/dir/file.txt';
      const content = 'content';

      (fs.mkdir as Mock).mockResolvedValue(undefined);
      (fs.writeFile as Mock).mockResolvedValue(undefined);

      await FsUtils.writeFile(filePath, content);

      // mkdir with recursive: true should not throw even if directory exists
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should throw ConfigError when mkdir fails', async () => {
      const filePath = '/path/to/file.txt';
      const content = 'content';
      const error = new Error('EACCES: permission denied');

      (fs.mkdir as Mock).mockRejectedValue(error);

      await expect(FsUtils.writeFile(filePath, content)).rejects.toThrow(
        ConfigError,
      );
      await expect(FsUtils.writeFile(filePath, content)).rejects.toThrow(
        'Failed to write file',
      );
    });

    it('should throw ConfigError when writeFile fails', async () => {
      const filePath = '/path/to/file.txt';
      const content = 'content';
      const error = new Error('ENOSPC: no space left on device');

      (fs.mkdir as Mock).mockResolvedValue(undefined);
      (fs.writeFile as Mock).mockRejectedValue(error);

      await expect(FsUtils.writeFile(filePath, content)).rejects.toThrow(
        ConfigError,
      );
      await expect(FsUtils.writeFile(filePath, content)).rejects.toThrow(
        'Failed to write file: ENOSPC: no space left on device',
      );
    });

    it('should include filePath in ConfigError on write failure', async () => {
      const filePath = '/path/to/file.txt';
      const content = 'content';
      const error = new Error('Write failed');

      (fs.mkdir as Mock).mockResolvedValue(undefined);
      (fs.writeFile as Mock).mockRejectedValue(error);

      try {
        await FsUtils.writeFile(filePath, content);
        fail('Should have thrown ConfigError');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigError);
        expect((err as ConfigError).filePath).toBe(filePath);
      }
    });

    it('should handle empty content', async () => {
      const filePath = '/path/to/empty.txt';
      const content = '';

      (fs.mkdir as Mock).mockResolvedValue(undefined);
      (fs.writeFile as Mock).mockResolvedValue(undefined);

      await FsUtils.writeFile(filePath, content);

      expect(fs.writeFile).toHaveBeenCalledWith(filePath, '', 'utf-8');
    });

    it('should handle large content', async () => {
      const filePath = '/path/to/large.txt';
      const content = 'x'.repeat(10000);

      (fs.mkdir as Mock).mockResolvedValue(undefined);
      (fs.writeFile as Mock).mockResolvedValue(undefined);

      await FsUtils.writeFile(filePath, content);

      expect(fs.writeFile).toHaveBeenCalledWith(filePath, content, 'utf-8');
    });
  });

  describe('exists', () => {
    it('should return true when file exists', async () => {
      const filePath = '/path/to/existing.txt';

      (fs.access as Mock).mockResolvedValue(undefined);

      const result = await FsUtils.exists(filePath);

      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith(filePath);
    });

    it('should return false when file does not exist', async () => {
      const filePath = '/path/to/missing.txt';
      const error = new Error('ENOENT: no such file or directory');

      (fs.access as Mock).mockRejectedValue(error);

      const result = await FsUtils.exists(filePath);

      expect(result).toBe(false);
    });

    it('should return false on permission denied', async () => {
      const filePath = '/root/protected.txt';
      const error = new Error('EACCES: permission denied');

      (fs.access as Mock).mockRejectedValue(error);

      const result = await FsUtils.exists(filePath);

      expect(result).toBe(false);
    });

    it('should check existence without throwing errors', async () => {
      const filePath = '/any/path.txt';
      const error = new Error('Some unexpected error');

      (fs.access as Mock).mockRejectedValue(error);

      const result = await FsUtils.exists(filePath);

      expect(result).toBe(false);
      expect(fs.access).toHaveBeenCalledWith(filePath);
    });

    it('should work with absolute paths', async () => {
      const filePath = '/absolute/path/to/file.txt';

      (fs.access as Mock).mockResolvedValue(undefined);

      const result = await FsUtils.exists(filePath);

      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith(filePath);
    });

    it('should work with relative paths', async () => {
      const filePath = './relative/path/file.txt';

      (fs.access as Mock).mockResolvedValue(undefined);

      const result = await FsUtils.exists(filePath);

      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith(filePath);
    });
  });

  describe('ensureDir', () => {
    it('should create directory successfully', async () => {
      const dirPath = '/path/to/directory';

      (fs.mkdir as Mock).mockResolvedValue(undefined);

      await FsUtils.ensureDir(dirPath);

      expect(fs.mkdir).toHaveBeenCalledWith(dirPath, { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledTimes(1);
    });

    it('should handle existing directory without error', async () => {
      const dirPath = '/existing/directory';

      (fs.mkdir as Mock).mockResolvedValue(undefined);

      await FsUtils.ensureDir(dirPath);

      expect(fs.mkdir).toHaveBeenCalledWith(dirPath, { recursive: true });
    });

    it('should create nested directories', async () => {
      const dirPath = '/deep/nested/directory/structure';

      (fs.mkdir as Mock).mockResolvedValue(undefined);

      await FsUtils.ensureDir(dirPath);

      expect(fs.mkdir).toHaveBeenCalledWith(dirPath, { recursive: true });
    });

    it('should throw error on permission denied', async () => {
      const dirPath = '/root/protected';
      const error = new Error('EACCES: permission denied');

      (fs.mkdir as Mock).mockRejectedValue(error);

      await expect(FsUtils.ensureDir(dirPath)).rejects.toThrow(error);
    });

    it('should use recursive flag for mkdir', async () => {
      const dirPath = '/some/path';

      (fs.mkdir as Mock).mockResolvedValue(undefined);

      await FsUtils.ensureDir(dirPath);

      const callArgs = (fs.mkdir as Mock).mock.calls[0];
      expect(callArgs[1]).toEqual({ recursive: true });
    });
  });

  describe('findUp', () => {
    it('should find file in current directory', async () => {
      const fileName = 'config.yaml';
      const startDir = '/home/user/project';
      const filePath = path.join(startDir, fileName);

      (fs.access as Mock).mockResolvedValue(undefined);

      const result = await FsUtils.findUp(fileName, startDir);

      expect(result).toBe(filePath);
      expect(fs.access).toHaveBeenCalledWith(filePath);
    });

    it('should find file in parent directory', async () => {
      const fileName = 'package.json';
      const startDir = '/home/user/project/src/components';
      const expectedPath = '/home/user/project/package.json';

      // First call fails (current dir)
      // Second call fails (src)
      // Third call fails (src/components already checked)
      // Fourth call succeeds (project)
      (fs.access as Mock).mockImplementation((filePath) => {
        if (filePath === expectedPath) {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error('not found'));
      });

      const result = await FsUtils.findUp(fileName, startDir);

      expect(result).toBe(expectedPath);
    });

    it('should return null when file not found', async () => {
      const fileName = 'nonexistent.txt';
      const startDir = '/home/user/project';

      (fs.access as Mock).mockRejectedValue(new Error('ENOENT: no such file'));

      const result = await FsUtils.findUp(fileName, startDir);

      expect(result).toBeNull();
    });

    it('should stop searching at filesystem root', async () => {
      const fileName = 'root-only.txt';
      const startDir = '/home/user/project';

      (fs.access as Mock).mockRejectedValue(new Error('ENOENT: no such file'));

      const result = await FsUtils.findUp(fileName, startDir);

      expect(result).toBeNull();
      // Should have attempted multiple access calls without throwing
      expect(fs.access).toHaveBeenCalled();
    });

    it('should use process.cwd() as default startDir', async () => {
      const fileName = 'config.yaml';
      const cwdPath = process.cwd();
      const filePath = path.join(cwdPath, fileName);

      (fs.access as Mock).mockResolvedValue(undefined);

      const result = await FsUtils.findUp(fileName);

      expect(result).toBe(filePath);
      expect(fs.access).toHaveBeenCalledWith(filePath);
    });

    it('should handle absolute startDir path', async () => {
      const fileName = 'test.txt';
      const startDir = '/absolute/path/to/dir';
      const filePath = path.join(startDir, fileName);

      (fs.access as Mock).mockResolvedValue(undefined);

      const result = await FsUtils.findUp(fileName, startDir);

      expect(result).toBe(filePath);
    });

    it('should handle relative startDir path', async () => {
      const fileName = 'config.json';
      const startDir = './relative/path';
      const resolvedStart = path.resolve(startDir);
      const filePath = path.join(resolvedStart, fileName);

      (fs.access as Mock).mockResolvedValue(undefined);

      const result = await FsUtils.findUp(fileName, startDir);

      expect(result).toBe(filePath);
    });

    it('should traverse up multiple directory levels', async () => {
      const fileName = 'overture.yaml';
      const startDir = '/home/user/workspace/project/src/cli/commands';
      const expectedPath = '/home/user/workspace/project/overture.yaml';

      const accessCalls: string[] = [];
      (fs.access as Mock).mockImplementation((filePath) => {
        accessCalls.push(filePath);
        if (filePath === expectedPath) {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error('not found'));
      });

      const result = await FsUtils.findUp(fileName, startDir);

      expect(result).toBe(expectedPath);
      // Verify multiple directories were checked
      expect(accessCalls.length).toBeGreaterThan(1);
    });

    it('should stop search when file is found', async () => {
      const fileName = 'early-find.txt';
      const startDir = '/a/b/c';
      const foundPath = '/a/b/early-find.txt';

      const accessCalls: string[] = [];
      (fs.access as Mock).mockImplementation((filePath) => {
        accessCalls.push(filePath);
        if (filePath === foundPath) {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error('not found'));
      });

      const result = await FsUtils.findUp(fileName, startDir);

      expect(result).toBe(foundPath);
      // Should not continue searching after finding
      expect(accessCalls).toContain(foundPath);
    });

    it('should handle special characters in fileName', async () => {
      const fileName = '.overture.config.yaml';
      const startDir = '/home/user/project';
      const filePath = path.join(startDir, fileName);

      (fs.access as Mock).mockResolvedValue(undefined);

      const result = await FsUtils.findUp(fileName, startDir);

      expect(result).toBe(filePath);
      expect(fs.access).toHaveBeenCalledWith(filePath);
    });
  });

  describe('integration scenarios', () => {
    it('should handle readFile then writeFile workflow', async () => {
      const filePath = '/path/to/config.yaml';
      const originalContent = 'original: true';
      const newContent = 'updated: true';

      // Setup mocks
      (fs.readFile as Mock).mockResolvedValue(originalContent);
      (fs.mkdir as Mock).mockResolvedValue(undefined);
      (fs.writeFile as Mock).mockResolvedValue(undefined);

      // Read, modify, write
      const read = await FsUtils.readFile(filePath);
      expect(read).toBe(originalContent);

      await FsUtils.writeFile(filePath, newContent);

      expect(fs.readFile).toHaveBeenCalledWith(filePath, 'utf-8');
      expect(fs.writeFile).toHaveBeenCalledWith(filePath, newContent, 'utf-8');
    });

    it('should handle exists check before reading', async () => {
      const filePath = '/path/to/file.txt';
      const content = 'file content';

      (fs.access as Mock).mockResolvedValue(undefined);
      (fs.readFile as Mock).mockResolvedValue(content);

      const exists = await FsUtils.exists(filePath);
      expect(exists).toBe(true);

      const data = await FsUtils.readFile(filePath);
      expect(data).toBe(content);
    });

    it('should handle findUp then read workflow', async () => {
      const fileName = 'config.yaml';
      const startDir = '/project/src';
      const foundPath = '/project/config.yaml';
      const content = 'config: data';

      // Mock to find file in parent directory
      (fs.access as Mock).mockImplementation((filePath) => {
        if (filePath === foundPath) {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error('not found'));
      });
      (fs.readFile as Mock).mockResolvedValue(content);

      const configPath = await FsUtils.findUp(fileName, startDir);
      expect(configPath).toBe(foundPath);

      const data = await FsUtils.readFile(configPath as string);
      expect(data).toBe(content);
    });
  });
});
