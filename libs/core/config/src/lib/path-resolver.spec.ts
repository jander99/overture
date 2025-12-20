/**
 * Path Resolver Tests
 *
 * Tests for PathResolver service with dependency injection.
 * Uses port mocks for filesystem and environment.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PathResolver } from './path-resolver.js';
import type { EnvironmentPort, Platform } from '@overture/ports-process';
import type { FilesystemPort } from '@overture/ports-filesystem';

describe('PathResolver', () => {
  let mockEnvironment: EnvironmentPort;
  let mockFilesystem: FilesystemPort;
  let resolver: PathResolver;

  beforeEach(() => {
    // Create mock environment port
    mockEnvironment = {
      platform: vi.fn(() => 'linux' as Platform),
      homedir: vi.fn(() => '/home/user'),
      env: {
        HOME: '/home/user',
        PWD: '/home/user/project',
      },
    };

    // Create mock filesystem port
    mockFilesystem = {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      exists: vi.fn(() => Promise.resolve(false)),
      mkdir: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      rm: vi.fn(),
    };

    resolver = new PathResolver(mockEnvironment, mockFilesystem);
  });

  describe('getPlatform', () => {
    it('should return current platform from environment', () => {
      expect(resolver.getPlatform()).toBe('linux');
      expect(mockEnvironment.platform).toHaveBeenCalled();
    });
  });

  describe('expandTilde', () => {
    it('should expand ~ to home directory', () => {
      const result = resolver.expandTilde('~/.config/overture.yml');
      expect(result).toBe('/home/user/.config/overture.yml');
    });

    it('should not expand paths without ~', () => {
      const result = resolver.expandTilde('/absolute/path');
      expect(result).toBe('/absolute/path');
    });

    it('should handle ~ at start with forward slash', () => {
      const result = resolver.expandTilde('~/documents');
      expect(result).toBe('/home/user/documents');
    });

    it('should handle ~ at start with backslash (Windows)', () => {
      const result = resolver.expandTilde('~\\documents');
      expect(result).toBe('/home/user\\documents');
    });

    it('should not expand ~ in middle of path', () => {
      const result = resolver.expandTilde('/path/~/.config');
      expect(result).toBe('/path/~/.config');
    });
  });

  describe('getXdgConfigHome', () => {
    it('should return XDG_CONFIG_HOME if set', () => {
      mockEnvironment.env.XDG_CONFIG_HOME = '/custom/config';
      const result = resolver.getXdgConfigHome();
      expect(result).toBe('/custom/config');
    });

    it('should default to ~/.config if XDG_CONFIG_HOME not set', () => {
      delete mockEnvironment.env.XDG_CONFIG_HOME;
      const result = resolver.getXdgConfigHome();
      expect(result).toBe('/home/user/.config');
    });
  });

  describe('getXdgDataHome', () => {
    it('should return XDG_DATA_HOME if set', () => {
      mockEnvironment.env.XDG_DATA_HOME = '/custom/data';
      const result = resolver.getXdgDataHome();
      expect(result).toBe('/custom/data');
    });

    it('should default to ~/.local/share if XDG_DATA_HOME not set', () => {
      delete mockEnvironment.env.XDG_DATA_HOME;
      const result = resolver.getXdgDataHome();
      expect(result).toBe('/home/user/.local/share');
    });
  });

  describe('getHomeDir', () => {
    it('should prefer HOME env var', () => {
      mockEnvironment.env.HOME = '/override/home';
      const result = resolver.getHomeDir();
      expect(result).toBe('/override/home');
    });

    it('should fall back to homedir() if HOME not set', () => {
      delete mockEnvironment.env.HOME;
      vi.mocked(mockEnvironment.homedir).mockReturnValue('/fallback/home');
      const result = resolver.getHomeDir();
      expect(result).toBe('/fallback/home');
      expect(mockEnvironment.homedir).toHaveBeenCalled();
    });
  });

  describe('getUserConfigPath', () => {
    it('should use XDG_CONFIG_HOME on Linux', () => {
      vi.mocked(mockEnvironment.platform).mockReturnValue('linux');
      mockEnvironment.env.XDG_CONFIG_HOME = '/custom/config';

      const result = resolver.getUserConfigPath();
      expect(result).toBe('/custom/config/overture.yml');
    });

    it('should use ~/.config on Linux if XDG_CONFIG_HOME not set', () => {
      vi.mocked(mockEnvironment.platform).mockReturnValue('linux');
      delete mockEnvironment.env.XDG_CONFIG_HOME;

      const result = resolver.getUserConfigPath();
      expect(result).toBe('/home/user/.config/overture.yml');
    });

    it('should use ~/.config on macOS', () => {
      vi.mocked(mockEnvironment.platform).mockReturnValue('darwin');

      const result = resolver.getUserConfigPath();
      expect(result).toBe('/home/user/.config/overture.yml');
    });

    it('should use ~/.config on Windows', () => {
      vi.mocked(mockEnvironment.platform).mockReturnValue('win32');

      const result = resolver.getUserConfigPath();
      expect(result).toBe('/home/user/.config/overture.yml');
    });
  });

  describe('getProjectConfigPath', () => {
    it('should use PWD by default', () => {
      const result = resolver.getProjectConfigPath();
      expect(result).toBe('/home/user/project/.overture/config.yaml');
    });

    it('should use provided project root', () => {
      const result = resolver.getProjectConfigPath('/custom/project');
      expect(result).toBe('/custom/project/.overture/config.yaml');
    });
  });

  describe('getClaudeCodeGlobalPath', () => {
    it('should return XDG path on Linux', () => {
      vi.mocked(mockEnvironment.platform).mockReturnValue('linux');

      const result = resolver.getClaudeCodeGlobalPath();
      expect(result).toBe('/home/user/.claude.json');
    });

    it('should return ~/.config path on macOS', () => {
      vi.mocked(mockEnvironment.platform).mockReturnValue('darwin');

      const result = resolver.getClaudeCodeGlobalPath();
      expect(result).toBe('/home/user/.claude.json');
    });

    it('should return AppData path on Windows', () => {
      vi.mocked(mockEnvironment.platform).mockReturnValue('win32');
      mockEnvironment.env.APPDATA = 'C:/Users/user/AppData/Roaming';

      const result = resolver.getClaudeCodeGlobalPath();
      expect(result).toBe('C:/Users/user/AppData/Roaming/Claude/mcp.json');
    });

    it('should handle platform override', () => {
      const result = resolver.getClaudeCodeGlobalPath('darwin');
      expect(result).toBe('/home/user/.claude.json');
    });
  });

  describe('getBackupDir', () => {
    it('should use OVERTURE_BACKUP_DIR if set', () => {
      mockEnvironment.env.OVERTURE_BACKUP_DIR = '/custom/backups';

      const result = resolver.getBackupDir();
      expect(result).toBe('/custom/backups');
    });

    it('should use XDG path on Linux', () => {
      vi.mocked(mockEnvironment.platform).mockReturnValue('linux');
      delete mockEnvironment.env.OVERTURE_BACKUP_DIR;

      const result = resolver.getBackupDir();
      expect(result).toBe('/home/user/.config/overture/backups');
    });

    it('should use ~/.config on macOS/Windows', () => {
      vi.mocked(mockEnvironment.platform).mockReturnValue('darwin');
      delete mockEnvironment.env.OVERTURE_BACKUP_DIR;

      const result = resolver.getBackupDir();
      expect(result).toBe('/home/user/.config/overture/backups');
    });
  });

  describe('findProjectRoot', () => {
    it('should find project root when .overture/config.yaml exists', async () => {
      vi.mocked(mockFilesystem.exists).mockImplementation(async (path) => {
        return path === '/home/user/project/.overture/config.yaml';
      });

      const result = await resolver.findProjectRoot('/home/user/project/src/deep');
      expect(result).toBe('/home/user/project');
    });

    it('should search up directory tree', async () => {
      vi.mocked(mockFilesystem.exists).mockImplementation(async (path) => {
        return path === '/home/user/.overture/config.yaml';
      });

      const result = await resolver.findProjectRoot('/home/user/project/src');
      expect(result).toBe('/home/user');
    });

    it('should return null if no project root found', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const result = await resolver.findProjectRoot('/home/user/project');
      expect(result).toBeNull();
    });

    it('should check root directory as last resort', async () => {
      vi.mocked(mockFilesystem.exists).mockImplementation(async (path) => {
        return path === '/.overture/config.yaml';
      });

      const result = await resolver.findProjectRoot('/home/user/project');
      expect(result).toBe('/');
    });

    it('should use PWD if no start directory provided', async () => {
      mockEnvironment.env.PWD = '/home/user/current';
      vi.mocked(mockFilesystem.exists).mockImplementation(async (path) => {
        return path === '/home/user/current/.overture/config.yaml';
      });

      const result = await resolver.findProjectRoot();
      expect(result).toBe('/home/user/current');
    });
  });

  describe('isInProject', () => {
    it('should return true if project root found', async () => {
      vi.mocked(mockFilesystem.exists).mockImplementation(async (path) => {
        return path === '/home/user/project/.overture/config.yaml';
      });

      const result = await resolver.isInProject('/home/user/project');
      expect(result).toBe(true);
    });

    it('should return false if no project root found', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const result = await resolver.isInProject('/home/user/project');
      expect(result).toBe(false);
    });
  });

  describe('getClientConfigPath', () => {
    it('should return paths for claude-code', () => {
      const result = resolver.getClientConfigPath('claude-code');
      expect(result).toEqual({
        user: '/home/user/.claude.json',
        project: '/home/user/project/.mcp.json',
      });
    });

    it('should return path for claude-desktop', () => {
      vi.mocked(mockEnvironment.platform).mockReturnValue('darwin');
      const result = resolver.getClientConfigPath('claude-desktop');
      expect(result).toBe('/home/user/Library/Application Support/Claude/claude_desktop_config.json');
    });

    it('should return paths for vscode', () => {
      const result = resolver.getClientConfigPath('vscode');
      expect(result).toEqual({
        user: '/home/user/.config/Code/User/mcp.json',
        project: '/home/user/project/.vscode/mcp.json',
      });
    });

    it('should return path for windsurf', () => {
      const result = resolver.getClientConfigPath('windsurf');
      expect(result).toBe('/home/user/.codeium/windsurf/mcp_config.json');
    });

    it('should throw for unknown client', () => {
      expect(() => {
        resolver.getClientConfigPath('unknown' as any);
      }).toThrow('Unknown client: unknown');
    });
  });
});
