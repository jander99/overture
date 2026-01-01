/**
 * Tests for NodeEnvironmentAdapter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NodeEnvironmentAdapter } from './node-environment.adapter.js';
import os from 'node:os';

// Mock Node.js os module
vi.mock('node:os');

describe('NodeEnvironmentAdapter', () => {
  let adapter: NodeEnvironmentAdapter;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    adapter = new NodeEnvironmentAdapter();
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('platform', () => {
    it('should return "linux" on Linux systems', () => {
      vi.mocked(os.platform).mockReturnValue('linux');

      const result = adapter.platform();

      expect(result).toBe('linux');
      expect(os.platform).toHaveBeenCalled();
    });

    it('should return "darwin" on macOS systems', () => {
      vi.mocked(os.platform).mockReturnValue('darwin');

      const result = adapter.platform();

      expect(result).toBe('darwin');
    });

    it('should return "win32" on Windows systems', () => {
      vi.mocked(os.platform).mockReturnValue('win32');

      const result = adapter.platform();

      expect(result).toBe('win32');
    });

    it('should call os.platform() each time', () => {
      vi.mocked(os.platform).mockReturnValue('linux');

      adapter.platform();
      adapter.platform();

      expect(os.platform).toHaveBeenCalledTimes(2);
    });
  });

  describe('homedir', () => {
    it('should return home directory on Linux', () => {
      vi.mocked(os.homedir).mockReturnValue('/home/user');

      const result = adapter.homedir();

      expect(result).toBe('/home/user');
      expect(os.homedir).toHaveBeenCalled();
    });

    it('should return home directory on macOS', () => {
      vi.mocked(os.homedir).mockReturnValue('/Users/user');

      const result = adapter.homedir();

      expect(result).toBe('/Users/user');
    });

    it('should return home directory on Windows', () => {
      vi.mocked(os.homedir).mockReturnValue('C:\\Users\\user');

      const result = adapter.homedir();

      expect(result).toBe('C:\\Users\\user');
    });

    it('should call os.homedir() each time', () => {
      vi.mocked(os.homedir).mockReturnValue('/home/user');

      adapter.homedir();
      adapter.homedir();

      expect(os.homedir).toHaveBeenCalledTimes(2);
    });
  });

  describe('env', () => {
    it('should return process environment variables', () => {
      process.env = {
        NODE_ENV: 'test',
        PATH: '/usr/bin:/usr/local/bin',
      };

      const result = adapter.env;

      expect(result.NODE_ENV).toBe('test');
      expect(result.PATH).toBe('/usr/bin:/usr/local/bin');
    });

    it('should return undefined for unset variables', () => {
      process.env = {
        EXISTING_VAR: 'value',
      };

      const result = adapter.env;

      expect(result.EXISTING_VAR).toBe('value');
      expect(result.NONEXISTENT_VAR).toBeUndefined();
    });

    it('should handle empty environment', () => {
      process.env = {};

      const result = adapter.env;

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should reflect changes to process.env', () => {
      process.env = {
        INITIAL_VAR: 'initial',
      };

      const result1 = adapter.env;
      expect(result1.INITIAL_VAR).toBe('initial');

      // Modify process.env
      process.env.NEW_VAR = 'new value';

      const result2 = adapter.env;
      expect(result2.NEW_VAR).toBe('new value');
    });

    it('should handle special environment variables', () => {
      process.env = {
        HOME: '/home/user',
        USER: 'testuser',
        SHELL: '/bin/bash',
        PWD: '/current/directory',
      };

      const result = adapter.env;

      expect(result.HOME).toBe('/home/user');
      expect(result.USER).toBe('testuser');
      expect(result.SHELL).toBe('/bin/bash');
      expect(result.PWD).toBe('/current/directory');
    });

    it('should handle Windows-style environment variables', () => {
      process.env = {
        USERPROFILE: 'C:\\Users\\user',
        APPDATA: 'C:\\Users\\user\\AppData\\Roaming',
        TEMP: 'C:\\Users\\user\\AppData\\Local\\Temp',
      };

      const result = adapter.env;

      expect(result.USERPROFILE).toBe('C:\\Users\\user');
      expect(result.APPDATA).toBe('C:\\Users\\user\\AppData\\Roaming');
      expect(result.TEMP).toBe('C:\\Users\\user\\AppData\\Local\\Temp');
    });

    it('should handle environment variables with empty strings', () => {
      process.env = {
        EMPTY_VAR: '',
        NORMAL_VAR: 'value',
      };

      const result = adapter.env;

      expect(result.EMPTY_VAR).toBe('');
      expect(result.NORMAL_VAR).toBe('value');
    });

    it('should return same reference to process.env', () => {
      const result1 = adapter.env;
      const result2 = adapter.env;

      expect(result1).toBe(process.env);
      expect(result2).toBe(process.env);
      expect(result1).toBe(result2);
    });
  });

  describe('EnvironmentPort compliance', () => {
    it('should implement all EnvironmentPort methods', () => {
      expect(adapter).toHaveProperty('platform');
      expect(adapter).toHaveProperty('homedir');
      expect(adapter).toHaveProperty('env');
    });

    it('should have platform and homedir as functions', () => {
      expect(typeof adapter.platform).toBe('function');
      expect(typeof adapter.homedir).toBe('function');
    });

    it('should have env as a property getter', () => {
      const descriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(adapter),
        'env',
      );

      expect(descriptor).toBeDefined();
      expect(descriptor?.get).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    it('should provide consistent platform-specific information', () => {
      vi.mocked(os.platform).mockReturnValue('linux');
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      process.env = {
        HOME: '/home/user',
        SHELL: '/bin/bash',
      };

      expect(adapter.platform()).toBe('linux');
      expect(adapter.homedir()).toBe('/home/user');
      expect(adapter.env.HOME).toBe('/home/user');
      expect(adapter.env.SHELL).toBe('/bin/bash');
    });

    it('should work with Windows-style paths', () => {
      vi.mocked(os.platform).mockReturnValue('win32');
      vi.mocked(os.homedir).mockReturnValue('C:\\Users\\user');
      process.env = {
        USERPROFILE: 'C:\\Users\\user',
        COMSPEC: 'C:\\Windows\\system32\\cmd.exe',
      };

      expect(adapter.platform()).toBe('win32');
      expect(adapter.homedir()).toBe('C:\\Users\\user');
      expect(adapter.env.USERPROFILE).toBe('C:\\Users\\user');
    });

    it('should work with macOS configuration', () => {
      vi.mocked(os.platform).mockReturnValue('darwin');
      vi.mocked(os.homedir).mockReturnValue('/Users/user');
      process.env = {
        HOME: '/Users/user',
        SHELL: '/bin/zsh',
      };

      expect(adapter.platform()).toBe('darwin');
      expect(adapter.homedir()).toBe('/Users/user');
      expect(adapter.env.HOME).toBe('/Users/user');
    });
  });
});
