/**
 * WSL2Detector Tests
 *
 * @module lib/wsl2-detector.spec
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WSL2Detector } from './wsl2-detector.js';
import {
  createMockProcessPort,
  createMockEnvironmentPort,
  createMockFilesystem,
  createFilesystemFunctions,
  joinPath,
} from './test-helpers.js';

describe('WSL2Detector', () => {
  describe('isWSL2', () => {
    it('should detect WSL2 via environment variable', async () => {
      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort('linux', {
        WSL_DISTRO_NAME: 'Ubuntu',
      });

      const detector = new WSL2Detector(
        processPort,
        environmentPort,
        () => false,
        () => '',
        () => [],
        () => false,
        joinPath
      );

      const result = await detector.isWSL2();

      expect(result).toBe(true);
    });

    it('should detect WSL2 via /proc/version', async () => {
      const fs = createMockFilesystem();
      fs.files.set('/proc/version', 'Linux version 5.10.16.3-microsoft-standard-WSL2');

      const { readFile } = createFilesystemFunctions(fs);

      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort('linux');

      const detector = new WSL2Detector(
        processPort,
        environmentPort,
        () => false,
        readFile,
        () => [],
        () => false,
        joinPath
      );

      const result = await detector.isWSL2();

      expect(result).toBe(true);
    });

    it('should return false when not in WSL2', async () => {
      const fs = createMockFilesystem();
      fs.files.set('/proc/version', 'Linux version 5.10.0-generic');

      const { readFile } = createFilesystemFunctions(fs);

      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort('linux');

      const detector = new WSL2Detector(
        processPort,
        environmentPort,
        () => false,
        readFile,
        () => [],
        () => false,
        joinPath
      );

      const result = await detector.isWSL2();

      expect(result).toBe(false);
    });
  });

  describe('getDistroName', () => {
    it('should return distro name from environment', () => {
      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort('linux', {
        WSL_DISTRO_NAME: 'Ubuntu-22.04',
      });

      const detector = new WSL2Detector(
        processPort,
        environmentPort,
        () => false,
        () => '',
        () => [],
        () => false,
        joinPath
      );

      const result = detector.getDistroName();

      expect(result).toBe('Ubuntu-22.04');
    });

    it('should return undefined when not set', () => {
      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort('linux');

      const detector = new WSL2Detector(
        processPort,
        environmentPort,
        () => false,
        () => '',
        () => [],
        () => false,
        joinPath
      );

      const result = detector.getDistroName();

      expect(result).toBeUndefined();
    });
  });

  describe('getWindowsUserProfile', () => {
    it('should get profile via cmd.exe', async () => {
      const execResults = new Map([
        ['/mnt/c/Windows/System32/cmd.exe /c echo %USERPROFILE%', {
          stdout: 'C:\\Users\\jeff\r\n',
          stderr: '',
          exitCode: 0,
        }],
      ]);

      const processPort = createMockProcessPort(execResults);
      const environmentPort = createMockEnvironmentPort('linux');

      const detector = new WSL2Detector(
        processPort,
        environmentPort,
        () => false,
        () => '',
        () => [],
        () => false,
        joinPath
      );

      const result = await detector.getWindowsUserProfile();

      expect(result).toBe('/mnt/c/Users/jeff');
    });

    it('should infer profile from /mnt/c/Users/', async () => {
      const execResults = new Map();
      const fs = createMockFilesystem();
      fs.directories.add('/mnt/c/Users');
      fs.directories.add('/mnt/c/Users/jeff');
      fs.directories.add('/mnt/c/Users/jeff/Desktop');

      const { fileExists, readDir, isDirectory } = createFilesystemFunctions(fs);

      const processPort = createMockProcessPort(execResults);
      const environmentPort = createMockEnvironmentPort('linux');

      const detector = new WSL2Detector(
        processPort,
        environmentPort,
        fileExists,
        () => '',
        readDir,
        isDirectory,
        joinPath
      );

      const result = await detector.getWindowsUserProfile();

      expect(result).toBe('/mnt/c/Users/jeff');
    });

    it('should filter out system users when inferring', async () => {
      const execResults = new Map();
      const fs = createMockFilesystem();
      fs.directories.add('/mnt/c/Users');
      fs.directories.add('/mnt/c/Users/Public');
      fs.directories.add('/mnt/c/Users/Default');
      fs.directories.add('/mnt/c/Users/jeff');

      const { fileExists, readDir, isDirectory } = createFilesystemFunctions(fs);

      const processPort = createMockProcessPort(execResults);
      const environmentPort = createMockEnvironmentPort('linux');

      const detector = new WSL2Detector(
        processPort,
        environmentPort,
        fileExists,
        () => '',
        readDir,
        isDirectory,
        joinPath
      );

      const result = await detector.getWindowsUserProfile();

      expect(result).toBe('/mnt/c/Users/jeff');
    });
  });

  describe('translateWindowsPath', () => {
    it('should translate Windows path to WSL2 mount', () => {
      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort('linux');

      const detector = new WSL2Detector(
        processPort,
        environmentPort,
        () => false,
        () => '',
        () => [],
        () => false,
        joinPath
      );

      const result = detector.translateWindowsPath('C:\\Users\\jeff\\Documents');

      expect(result).toBe('/mnt/c/Users/jeff/Documents');
    });

    it('should handle different drive letters', () => {
      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort('linux');

      const detector = new WSL2Detector(
        processPort,
        environmentPort,
        () => false,
        () => '',
        () => [],
        () => false,
        joinPath
      );

      const result = detector.translateWindowsPath('D:\\Projects\\MyApp');

      expect(result).toBe('/mnt/d/Projects/MyApp');
    });

    it('should return path unchanged if not Windows format', () => {
      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort('linux');

      const detector = new WSL2Detector(
        processPort,
        environmentPort,
        () => false,
        () => '',
        () => [],
        () => false,
        joinPath
      );

      const result = detector.translateWindowsPath('/mnt/c/Users/jeff');

      expect(result).toBe('/mnt/c/Users/jeff');
    });
  });

  describe('getWindowsInstallPaths', () => {
    it('should return installation paths for a client', () => {
      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort('linux');

      const detector = new WSL2Detector(
        processPort,
        environmentPort,
        () => false,
        () => '',
        () => [],
        () => false,
        joinPath
      );

      const paths = detector.getWindowsInstallPaths('claude-code', '/mnt/c/Users/jeff');

      expect(paths).toContain('/mnt/c/Users/jeff/AppData/Local/Programs/claude-code/claude.exe');
      expect(paths).toContain('/mnt/c/Users/jeff/AppData/Roaming/npm/claude.cmd');
    });

    it('should return empty array for unknown client', () => {
      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort('linux');

      const detector = new WSL2Detector(
        processPort,
        environmentPort,
        () => false,
        () => '',
        () => [],
        () => false,
        joinPath
      );

      const paths = detector.getWindowsInstallPaths('unknown-client' as any, '/mnt/c/Users/jeff');

      expect(paths).toEqual([]);
    });
  });

  describe('getWindowsConfigPath', () => {
    it('should return config path for a client', () => {
      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort('linux');

      const detector = new WSL2Detector(
        processPort,
        environmentPort,
        () => false,
        () => '',
        () => [],
        () => false,
        joinPath
      );

      const configPath = detector.getWindowsConfigPath('claude-code', '/mnt/c/Users/jeff');

      expect(configPath).toBe('/mnt/c/Users/jeff/AppData/Roaming/Claude/mcp.json');
    });

    it('should return undefined for client without config path', () => {
      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort('linux');

      const detector = new WSL2Detector(
        processPort,
        environmentPort,
        () => false,
        () => '',
        () => [],
        () => false,
        joinPath
      );

      const configPath = detector.getWindowsConfigPath('unknown-client' as any, '/mnt/c/Users/jeff');

      expect(configPath).toBeUndefined();
    });
  });

  describe('detectEnvironment', () => {
    it('should cache detection result', async () => {
      let execCount = 0;
      const execResults = new Map();
      const processPort = createMockProcessPort(execResults);
      const environmentPort = createMockEnvironmentPort('linux', {
        WSL_DISTRO_NAME: 'Ubuntu',
      });

      const detector = new WSL2Detector(
        processPort,
        environmentPort,
        () => false,
        () => {
          execCount++;
          return '';
        },
        () => [],
        () => false,
        joinPath
      );

      // First call
      const result1 = await detector.detectEnvironment();
      expect(result1.isWSL2).toBe(true);

      // Second call (should use cache)
      const result2 = await detector.detectEnvironment();
      expect(result2.isWSL2).toBe(true);

      // Cache means readFile not called multiple times
      expect(execCount).toBe(0); // Environment variable path, no file read
    });

    it('should allow cache reset', async () => {
      const processPort = createMockProcessPort();
      const environmentPort = createMockEnvironmentPort('linux', {
        WSL_DISTRO_NAME: 'Ubuntu',
      });

      const detector = new WSL2Detector(
        processPort,
        environmentPort,
        () => false,
        () => '',
        () => [],
        () => false,
        joinPath
      );

      await detector.detectEnvironment();
      detector.resetCache();
      const result = await detector.detectEnvironment();

      expect(result.isWSL2).toBe(true);
    });
  });
});
