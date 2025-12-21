/**
 * Tests for EnvironmentPort interface
 *
 * Validates type definitions and interface contracts.
 */

import { describe, it, expect } from 'vitest';
import type { EnvironmentPort, Platform } from './environment.port.js';

describe('EnvironmentPort', () => {
  describe('interface contract', () => {
    it('should define platform method that returns Platform type', () => {
      const mockPort: EnvironmentPort = {
        platform: (): Platform => 'linux',
        homedir: (): string => '/home/user',
        env: {},
      };

      expect(mockPort).toBeDefined();
      expect(typeof mockPort.platform).toBe('function');
      expect(typeof mockPort.homedir).toBe('function');
      expect(typeof mockPort.env).toBe('object');
    });

    it('should define homedir method that returns string', () => {
      const mockPort: EnvironmentPort = {
        platform: (): Platform => 'linux',
        homedir: (): string => '/home/testuser',
        env: {},
      };

      const home = mockPort.homedir();
      expect(typeof home).toBe('string');
      expect(home).toBe('/home/testuser');
    });

    it('should define env property as Record<string, string | undefined>', () => {
      const mockPort: EnvironmentPort = {
        platform: (): Platform => 'linux',
        homedir: (): string => '/home/user',
        env: {
          PATH: '/usr/bin:/usr/local/bin',
          HOME: '/home/user',
          UNDEFINED_VAR: undefined,
        },
      };

      expect(mockPort.env.PATH).toBe('/usr/bin:/usr/local/bin');
      expect(mockPort.env.HOME).toBe('/home/user');
      expect(mockPort.env.UNDEFINED_VAR).toBeUndefined();
      expect(mockPort.env.NONEXISTENT).toBeUndefined();
    });
  });

  describe('Platform type', () => {
    it('should accept linux platform', () => {
      const platform: Platform = 'linux';
      expect(platform).toBe('linux');
    });

    it('should accept darwin platform', () => {
      const platform: Platform = 'darwin';
      expect(platform).toBe('darwin');
    });

    it('should accept win32 platform', () => {
      const platform: Platform = 'win32';
      expect(platform).toBe('win32');
    });

    it('should work with all platform types in a mock', () => {
      const platforms: Platform[] = ['linux', 'darwin', 'win32'];

      platforms.forEach((platform) => {
        const mockPort: EnvironmentPort = {
          platform: (): Platform => platform,
          homedir: (): string => '/home/user',
          env: {},
        };

        expect(mockPort.platform()).toBe(platform);
      });
    });
  });

  describe('mock implementations', () => {
    it('should support Linux environment', () => {
      const mockPort: EnvironmentPort = {
        platform: (): Platform => 'linux',
        homedir: (): string => '/home/user',
        env: {
          PATH: '/usr/bin:/usr/local/bin',
          HOME: '/home/user',
          SHELL: '/bin/bash',
        },
      };

      expect(mockPort.platform()).toBe('linux');
      expect(mockPort.homedir()).toBe('/home/user');
      expect(mockPort.env.SHELL).toBe('/bin/bash');
    });

    it('should support macOS environment', () => {
      const mockPort: EnvironmentPort = {
        platform: (): Platform => 'darwin',
        homedir: (): string => '/Users/user',
        env: {
          PATH: '/usr/bin:/usr/local/bin',
          HOME: '/Users/user',
          SHELL: '/bin/zsh',
        },
      };

      expect(mockPort.platform()).toBe('darwin');
      expect(mockPort.homedir()).toBe('/Users/user');
      expect(mockPort.env.SHELL).toBe('/bin/zsh');
    });

    it('should support Windows environment', () => {
      const mockPort: EnvironmentPort = {
        platform: (): Platform => 'win32',
        homedir: (): string => 'C:\\Users\\user',
        env: {
          PATH: 'C:\\Windows\\System32;C:\\Program Files',
          USERPROFILE: 'C:\\Users\\user',
          COMSPEC: 'C:\\Windows\\System32\\cmd.exe',
        },
      };

      expect(mockPort.platform()).toBe('win32');
      expect(mockPort.homedir()).toBe('C:\\Users\\user');
      expect(mockPort.env.COMSPEC).toBe('C:\\Windows\\System32\\cmd.exe');
    });

    it('should support environment variable access patterns', () => {
      const mockPort: EnvironmentPort = {
        platform: (): Platform => 'linux',
        homedir: (): string => '/home/user',
        env: {
          NODE_ENV: 'test',
          DEBUG: 'true',
          API_KEY: 'secret123',
        },
      };

      // Direct access
      expect(mockPort.env.NODE_ENV).toBe('test');

      // With fallback for undefined
      const debug = mockPort.env.DEBUG ?? 'false';
      expect(debug).toBe('true');

      const missing = mockPort.env.MISSING ?? 'default';
      expect(missing).toBe('default');

      // Conditional access
      if (mockPort.env.API_KEY) {
        expect(mockPort.env.API_KEY).toBe('secret123');
      }
    });

    it('should support platform-specific path construction', () => {
      const createConfigPath = (port: EnvironmentPort): string => {
        const home = port.homedir();
        const separator = port.platform() === 'win32' ? '\\' : '/';
        return `${home}${separator}.config${separator}overture.yml`;
      };

      const linuxPort: EnvironmentPort = {
        platform: (): Platform => 'linux',
        homedir: (): string => '/home/user',
        env: {},
      };

      const windowsPort: EnvironmentPort = {
        platform: (): Platform => 'win32',
        homedir: (): string => 'C:\\Users\\user',
        env: {},
      };

      expect(createConfigPath(linuxPort)).toBe(
        '/home/user/.config/overture.yml',
      );
      expect(createConfigPath(windowsPort)).toBe(
        'C:\\Users\\user\\.config\\overture.yml',
      );
    });

    it('should support environment detection logic', () => {
      const isProduction = (port: EnvironmentPort): boolean => {
        return port.env.NODE_ENV === 'production';
      };

      const isWSL = (port: EnvironmentPort): boolean => {
        return (
          port.platform() === 'linux' && port.env.WSL_DISTRO_NAME !== undefined
        );
      };

      const prodPort: EnvironmentPort = {
        platform: (): Platform => 'linux',
        homedir: (): string => '/home/user',
        env: { NODE_ENV: 'production' },
      };

      const wslPort: EnvironmentPort = {
        platform: (): Platform => 'linux',
        homedir: (): string => '/home/user',
        env: { WSL_DISTRO_NAME: 'Ubuntu' },
      };

      expect(isProduction(prodPort)).toBe(true);
      expect(isWSL(wslPort)).toBe(true);
    });
  });

  describe('integration with ProcessPort patterns', () => {
    it('should support platform-specific command construction', () => {
      const getShellCommand = (port: EnvironmentPort): string => {
        const platform = port.platform();
        if (platform === 'win32') {
          return 'cmd.exe';
        }
        return port.env.SHELL ?? '/bin/sh';
      };

      const linuxPort: EnvironmentPort = {
        platform: (): Platform => 'linux',
        homedir: (): string => '/home/user',
        env: { SHELL: '/bin/bash' },
      };

      const windowsPort: EnvironmentPort = {
        platform: (): Platform => 'win32',
        homedir: (): string => 'C:\\Users\\user',
        env: {},
      };

      expect(getShellCommand(linuxPort)).toBe('/bin/bash');
      expect(getShellCommand(windowsPort)).toBe('cmd.exe');
    });
  });
});
