/**
 * WSL2 Detector Tests
 *
 * Tests for WSL2 environment detection and Windows path resolution.
 *
 * @module core/wsl2-detector.spec
 */

import { WSL2Detector, WINDOWS_DEFAULT_PATHS } from './wsl2-detector';
import { ProcessExecutor } from '../infrastructure/process-executor';
import * as fs from 'fs';

// Mock dependencies
jest.mock('../infrastructure/process-executor');
jest.mock('fs');

const mockProcessExecutor = ProcessExecutor as jest.Mocked<typeof ProcessExecutor>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('WSL2Detector', () => {
  let detector: WSL2Detector;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    detector = new WSL2Detector();
    detector.resetCache();
    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.WSL_DISTRO_NAME;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isWSL2', () => {
    it('should detect WSL2 via WSL_DISTRO_NAME environment variable', async () => {
      process.env.WSL_DISTRO_NAME = 'Ubuntu';

      const result = await detector.isWSL2();

      expect(result).toBe(true);
    });

    it('should detect WSL2 via /proc/version containing "microsoft"', async () => {
      mockFs.readFileSync.mockReturnValue(
        'Linux version 5.15.90.1-microsoft-standard-WSL2 (oe-user@oe-host) (gcc (GCC) 11.2.0, GNU ld (GNU Binutils) 2.37)'
      );

      const result = await detector.isWSL2();

      expect(result).toBe(true);
      expect(mockFs.readFileSync).toHaveBeenCalledWith('/proc/version', 'utf-8');
    });

    it('should return false on native Linux without WSL', async () => {
      mockFs.readFileSync.mockReturnValue(
        'Linux version 6.1.0-generic (build@host) (gcc (Ubuntu 12.2.0) 12.2.0)'
      );

      const result = await detector.isWSL2();

      expect(result).toBe(false);
    });

    it('should return false when /proc/version cannot be read', async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const result = await detector.isWSL2();

      expect(result).toBe(false);
    });
  });

  describe('getDistroName', () => {
    it('should return WSL_DISTRO_NAME environment variable', () => {
      process.env.WSL_DISTRO_NAME = 'Ubuntu-22.04';

      const result = detector.getDistroName();

      expect(result).toBe('Ubuntu-22.04');
    });

    it('should return undefined when not in WSL', () => {
      const result = detector.getDistroName();

      expect(result).toBeUndefined();
    });
  });

  describe('detectEnvironment', () => {
    it('should return cached info on subsequent calls', async () => {
      process.env.WSL_DISTRO_NAME = 'Ubuntu';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['jeff'] as any);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);

      const result1 = await detector.detectEnvironment();
      const result2 = await detector.detectEnvironment();

      expect(result1).toBe(result2);
    });

    it('should return isWSL2: false when not in WSL2', async () => {
      mockFs.readFileSync.mockReturnValue('Linux version 6.1.0');

      const result = await detector.detectEnvironment();

      expect(result.isWSL2).toBe(false);
      expect(result.distroName).toBeUndefined();
      expect(result.windowsUserProfile).toBeUndefined();
    });

    it('should detect full WSL2 environment info', async () => {
      process.env.WSL_DISTRO_NAME = 'Ubuntu';
      mockProcessExecutor.exec.mockResolvedValue({
        stdout: 'C:\\Users\\jeff\r\n',
        exitCode: 0,
      });

      const result = await detector.detectEnvironment();

      expect(result.isWSL2).toBe(true);
      expect(result.distroName).toBe('Ubuntu');
      expect(result.windowsUserProfile).toBe('/mnt/c/Users/jeff');
    });
  });

  describe('getWindowsUserProfile', () => {
    it('should get profile via cmd.exe', async () => {
      mockProcessExecutor.exec.mockResolvedValue({
        stdout: 'C:\\Users\\testuser\r\n',
        exitCode: 0,
      });

      const result = await detector.getWindowsUserProfile();

      expect(result).toBe('/mnt/c/Users/testuser');
      expect(mockProcessExecutor.exec).toHaveBeenCalledWith(
        '/mnt/c/Windows/System32/cmd.exe',
        ['/c', 'echo', '%USERPROFILE%']
      );
    });

    it('should handle cmd.exe failure and infer from /mnt/c/Users/', async () => {
      mockProcessExecutor.exec.mockRejectedValue(new Error('cmd.exe failed'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['jeff', 'Public', 'Default'] as any);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);

      const result = await detector.getWindowsUserProfile();

      expect(result).toBe('/mnt/c/Users/jeff');
    });

    it('should handle timeout and fallback to inference', async () => {
      mockProcessExecutor.exec.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 100)
        )
      );
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['alice'] as any);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);

      const result = await detector.getWindowsUserProfile();

      expect(result).toBe('/mnt/c/Users/alice');
    });

    it('should prefer user with Desktop folder when multiple users exist', async () => {
      mockProcessExecutor.exec.mockRejectedValue(new Error('failed'));
      mockFs.existsSync.mockImplementation((path: any) => {
        if (path === '/mnt/c/Users') return true;
        if (path === '/mnt/c/Users/bob/Desktop') return true;
        return false;
      });
      mockFs.readdirSync.mockReturnValue(['alice', 'bob', 'Public'] as any);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);

      const result = await detector.getWindowsUserProfile();

      expect(result).toBe('/mnt/c/Users/bob');
    });

    it('should skip system users when inferring profile', async () => {
      mockProcessExecutor.exec.mockRejectedValue(new Error('failed'));
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        'Public',
        'Default',
        'Default User',
        'All Users',
        'LOCALSERVICE',
        'jeff',
      ] as any);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);

      const result = await detector.getWindowsUserProfile();

      expect(result).toBe('/mnt/c/Users/jeff');
    });

    it('should return undefined when /mnt/c/Users does not exist', async () => {
      mockProcessExecutor.exec.mockRejectedValue(new Error('failed'));
      mockFs.existsSync.mockReturnValue(false);

      const result = await detector.getWindowsUserProfile();

      expect(result).toBeUndefined();
    });
  });

  describe('translateWindowsPath', () => {
    it('should translate C:\\ path to /mnt/c/', () => {
      const result = detector.translateWindowsPath('C:\\Users\\jeff');

      expect(result).toBe('/mnt/c/Users/jeff');
    });

    it('should translate D:\\ path to /mnt/d/', () => {
      const result = detector.translateWindowsPath('D:\\Projects\\code');

      expect(result).toBe('/mnt/d/Projects/code');
    });

    it('should handle lowercase drive letters', () => {
      const result = detector.translateWindowsPath('c:\\Users\\jeff');

      expect(result).toBe('/mnt/c/Users/jeff');
    });

    it('should return path unchanged if not a Windows path', () => {
      const result = detector.translateWindowsPath('/mnt/c/Users/jeff');

      expect(result).toBe('/mnt/c/Users/jeff');
    });

    it('should handle paths with multiple backslashes', () => {
      const result = detector.translateWindowsPath('C:\\Users\\jeff\\AppData\\Local\\Programs');

      expect(result).toBe('/mnt/c/Users/jeff/AppData/Local/Programs');
    });
  });

  describe('pathExists', () => {
    it('should check path existence directly for WSL paths', () => {
      mockFs.existsSync.mockReturnValue(true);

      const result = detector.pathExists('/mnt/c/Users/jeff');

      expect(result).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith('/mnt/c/Users/jeff');
    });

    it('should translate and check Windows paths', () => {
      mockFs.existsSync.mockReturnValue(true);

      const result = detector.pathExists('C:\\Users\\jeff');

      expect(result).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith('/mnt/c/Users/jeff');
    });

    it('should return false for non-existent paths', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = detector.pathExists('/mnt/c/nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getWindowsInstallPaths', () => {
    const windowsProfile = '/mnt/c/Users/jeff';

    it('should return Claude Code installation paths', () => {
      const result = detector.getWindowsInstallPaths('claude-code', windowsProfile);

      expect(result).toContain('/mnt/c/Users/jeff/AppData/Local/Programs/claude-code/claude.exe');
      expect(result).toContain('/mnt/c/Users/jeff/AppData/Roaming/npm/claude.cmd');
    });

    it('should return Claude Desktop installation paths', () => {
      const result = detector.getWindowsInstallPaths('claude-desktop', windowsProfile);

      expect(result).toContain('/mnt/c/Users/jeff/AppData/Local/Programs/Claude/Claude.exe');
    });

    it('should return VS Code installation paths', () => {
      const result = detector.getWindowsInstallPaths('vscode', windowsProfile);

      expect(result.some(p => p.includes('Microsoft VS Code'))).toBe(true);
    });

    it('should return Cursor installation paths', () => {
      const result = detector.getWindowsInstallPaths('cursor', windowsProfile);

      expect(result.some(p => p.includes('cursor'))).toBe(true);
    });

    it('should return empty array for unknown client', () => {
      const result = detector.getWindowsInstallPaths('unknown' as any, windowsProfile);

      expect(result).toEqual([]);
    });
  });

  describe('getWindowsConfigPath', () => {
    const windowsProfile = '/mnt/c/Users/jeff';

    it('should return Claude Code config path', () => {
      const result = detector.getWindowsConfigPath('claude-code', windowsProfile);

      expect(result).toBe('/mnt/c/Users/jeff/AppData/Roaming/Claude/mcp.json');
    });

    it('should return Claude Desktop config path', () => {
      const result = detector.getWindowsConfigPath('claude-desktop', windowsProfile);

      expect(result).toBe('/mnt/c/Users/jeff/AppData/Roaming/Claude/claude_desktop_config.json');
    });

    it('should return Cursor config path', () => {
      const result = detector.getWindowsConfigPath('cursor', windowsProfile);

      expect(result).toBe('/mnt/c/Users/jeff/.cursor/mcp.json');
    });

    it('should return undefined for client without config path', () => {
      // Temporarily override to test undefined case
      const originalPaths = WINDOWS_DEFAULT_PATHS['claude-code'];
      (WINDOWS_DEFAULT_PATHS as any)['test-client'] = { binaryPaths: [] };

      const result = detector.getWindowsConfigPath('test-client' as any, windowsProfile);

      expect(result).toBeUndefined();
      delete (WINDOWS_DEFAULT_PATHS as any)['test-client'];
    });
  });

  describe('WINDOWS_DEFAULT_PATHS', () => {
    it('should have paths defined for all supported clients', () => {
      const expectedClients = [
        'claude-code',
        'claude-desktop',
        'vscode',
        'cursor',
        'windsurf',
        'copilot-cli',
        'jetbrains-copilot',
        'codex',
        'gemini-cli',
      ];

      for (const client of expectedClients) {
        expect(WINDOWS_DEFAULT_PATHS[client as keyof typeof WINDOWS_DEFAULT_PATHS]).toBeDefined();
      }
    });

    it('should have binary paths and config paths for most clients', () => {
      expect(WINDOWS_DEFAULT_PATHS['claude-code'].binaryPaths.length).toBeGreaterThan(0);
      expect(WINDOWS_DEFAULT_PATHS['claude-code'].configPath).toBeDefined();

      expect(WINDOWS_DEFAULT_PATHS['vscode'].binaryPaths.length).toBeGreaterThan(0);
      expect(WINDOWS_DEFAULT_PATHS['vscode'].configPath).toBeDefined();
    });
  });

  describe('resetCache', () => {
    it('should clear cached environment info', async () => {
      process.env.WSL_DISTRO_NAME = 'Ubuntu';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['jeff'] as any);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);

      await detector.detectEnvironment();
      detector.resetCache();

      // Change environment
      delete process.env.WSL_DISTRO_NAME;
      mockFs.readFileSync.mockReturnValue('Linux version 6.1.0');

      const result = await detector.detectEnvironment();

      expect(result.isWSL2).toBe(false);
    });
  });
});
