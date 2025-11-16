/**
 * Path Resolution Utilities Tests
 *
 * @module core/path-resolver.spec
 */

import * as os from 'os';
import * as path from 'path';
import {
  getPlatform,
  expandTilde,
  getXdgConfigHome,
  getXdgDataHome,
  getUserConfigPath,
  getProjectConfigPath,
  getClaudeCodeGlobalPath,
  getClaudeCodeProjectPath,
  getClaudeDesktopPath,
  getVSCodeGlobalPath,
  getVSCodeWorkspacePath,
  getCursorGlobalPath,
  getCursorProjectPath,
  getWindsurfPath,
  getCopilotCliPath,
  getJetBrainsCopilotPath,
  getJetBrainsCopilotWorkspacePath,
  getBackupDir,
  getLockFilePath,
  getClientConfigPath,
} from './path-resolver';

describe('Path Resolver', () => {
  const originalPlatform = process.platform;
  const originalEnv = process.env;
  const originalCwd = process.cwd;

  const mockHomeDir = '/home/testuser';

  beforeEach(() => {
    // Mock os.homedir()
    jest.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);

    // Mock process.cwd()
    process.cwd = jest.fn().mockReturnValue('/mock/project');

    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore mocks
    jest.restoreAllMocks();
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    });
    process.env = originalEnv;
    process.cwd = originalCwd;
  });

  describe('getPlatform', () => {
    it('should return current platform', () => {
      const platform = getPlatform();
      expect(['darwin', 'linux', 'win32']).toContain(platform);
    });
  });

  describe('expandTilde', () => {
    it('should expand ~ to home directory', () => {
      const result = expandTilde('~/.config/overture.yml');
      expect(result).toBe(path.join(mockHomeDir, '.config', 'overture.yml'));
    });

    it('should expand ~/path to home/path', () => {
      const result = expandTilde('~/documents/file.txt');
      expect(result).toBe(path.join(mockHomeDir, 'documents', 'file.txt'));
    });

    it('should not modify paths without tilde', () => {
      const result = expandTilde('/absolute/path/file.txt');
      expect(result).toBe('/absolute/path/file.txt');
    });

    it('should not modify relative paths', () => {
      const result = expandTilde('./relative/path');
      expect(result).toBe('./relative/path');
    });

    it('should handle tilde followed by slash', () => {
      const result = expandTilde('~/');
      expect(result).toBe(mockHomeDir + path.sep);
    });
  });

  describe('getXdgConfigHome', () => {
    it('should return XDG_CONFIG_HOME if set', () => {
      process.env.XDG_CONFIG_HOME = '/custom/config';
      const result = getXdgConfigHome();
      expect(result).toBe('/custom/config');
    });

    it('should return ~/.config if XDG_CONFIG_HOME not set', () => {
      delete process.env.XDG_CONFIG_HOME;
      const result = getXdgConfigHome();
      expect(result).toBe(path.join(mockHomeDir, '.config'));
    });
  });

  describe('getXdgDataHome', () => {
    it('should return XDG_DATA_HOME if set', () => {
      process.env.XDG_DATA_HOME = '/custom/data';
      const result = getXdgDataHome();
      expect(result).toBe('/custom/data');
    });

    it('should return ~/.local/share if XDG_DATA_HOME not set', () => {
      delete process.env.XDG_DATA_HOME;
      const result = getXdgDataHome();
      expect(result).toBe(path.join(mockHomeDir, '.local', 'share'));
    });
  });

  describe('getUserConfigPath', () => {
    it('should return XDG path on Linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      delete process.env.XDG_CONFIG_HOME;

      const result = getUserConfigPath();
      expect(result).toBe(path.join(mockHomeDir, '.config', 'overture.yml'));
    });

    it('should respect XDG_CONFIG_HOME on Linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      process.env.XDG_CONFIG_HOME = '/custom/config';

      const result = getUserConfigPath();
      expect(result).toBe('/custom/config/overture.yml');
    });

    it('should return ~/.config path on macOS', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const result = getUserConfigPath();
      expect(result).toBe(path.join(mockHomeDir, '.config', 'overture.yml'));
    });

    it('should return ~/.config path on Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const result = getUserConfigPath();
      expect(result).toBe(path.join(mockHomeDir, '.config', 'overture.yml'));
    });
  });

  describe('getProjectConfigPath', () => {
    it('should return project config path in cwd', () => {
      const result = getProjectConfigPath();
      expect(result).toBe(path.join('/mock/project', '.overture', 'config.yaml'));
    });

    it('should use provided project root', () => {
      const result = getProjectConfigPath('/custom/project');
      expect(result).toBe(path.join('/custom/project', '.overture', 'config.yaml'));
    });
  });

  describe('getClaudeCodeGlobalPath', () => {
    it('should return correct path for Linux', () => {
      const result = getClaudeCodeGlobalPath('linux');
      expect(result).toBe(path.join(mockHomeDir, '.config', 'claude', 'mcp.json'));
    });

    it('should return correct path for macOS', () => {
      const result = getClaudeCodeGlobalPath('darwin');
      expect(result).toBe(path.join(mockHomeDir, '.config', 'claude', 'mcp.json'));
    });

    it('should return correct path for Windows with APPDATA', () => {
      process.env.APPDATA = 'C:\\Users\\testuser\\AppData\\Roaming';
      const result = getClaudeCodeGlobalPath('win32');
      expect(result).toBe(path.join('C:\\Users\\testuser\\AppData\\Roaming', 'Claude', 'mcp.json'));
    });

    it('should fallback to home/AppData on Windows without APPDATA', () => {
      delete process.env.APPDATA;
      const result = getClaudeCodeGlobalPath('win32');
      expect(result).toBe(path.join(mockHomeDir, 'AppData', 'Roaming', 'Claude', 'mcp.json'));
    });
  });

  describe('getClaudeCodeProjectPath', () => {
    it('should return .mcp.json in cwd', () => {
      const result = getClaudeCodeProjectPath();
      expect(result).toBe('/mock/project/.mcp.json');
    });

    it('should use provided project root', () => {
      const result = getClaudeCodeProjectPath('/custom/project');
      expect(result).toBe('/custom/project/.mcp.json');
    });
  });

  describe('getClaudeDesktopPath', () => {
    it('should return correct path for macOS', () => {
      const result = getClaudeDesktopPath('darwin');
      expect(result).toBe(
        path.join(mockHomeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
      );
    });

    it('should return correct path for Linux', () => {
      const result = getClaudeDesktopPath('linux');
      expect(result).toBe(path.join(mockHomeDir, '.config', 'Claude', 'claude_desktop_config.json'));
    });

    it('should return correct path for Windows', () => {
      process.env.APPDATA = 'C:\\Users\\testuser\\AppData\\Roaming';
      const result = getClaudeDesktopPath('win32');
      expect(result).toBe(path.join('C:\\Users\\testuser\\AppData\\Roaming', 'Claude', 'claude_desktop_config.json'));
    });
  });

  describe('getVSCodeGlobalPath', () => {
    it('should return correct path for macOS', () => {
      const result = getVSCodeGlobalPath('darwin');
      expect(result).toBe(path.join(mockHomeDir, 'Library', 'Application Support', 'Code', 'User', 'mcp.json'));
    });

    it('should return correct path for Linux', () => {
      const result = getVSCodeGlobalPath('linux');
      expect(result).toBe(path.join(mockHomeDir, '.config', 'Code', 'User', 'mcp.json'));
    });

    it('should return correct path for Windows', () => {
      process.env.APPDATA = 'C:\\Users\\testuser\\AppData\\Roaming';
      const result = getVSCodeGlobalPath('win32');
      expect(result).toBe(path.join('C:\\Users\\testuser\\AppData\\Roaming', 'Code', 'User', 'mcp.json'));
    });
  });

  describe('getVSCodeWorkspacePath', () => {
    it('should return .vscode/mcp.json in cwd', () => {
      const result = getVSCodeWorkspacePath();
      expect(result).toBe('/mock/project/.vscode/mcp.json');
    });

    it('should use provided workspace root', () => {
      const result = getVSCodeWorkspacePath('/custom/workspace');
      expect(result).toBe('/custom/workspace/.vscode/mcp.json');
    });
  });

  describe('getCursorGlobalPath', () => {
    it('should return .cursor/mcp.json for macOS', () => {
      const result = getCursorGlobalPath('darwin');
      expect(result).toBe(path.join(mockHomeDir, '.cursor', 'mcp.json'));
    });

    it('should return .cursor/mcp.json for Linux', () => {
      const result = getCursorGlobalPath('linux');
      expect(result).toBe(path.join(mockHomeDir, '.cursor', 'mcp.json'));
    });

    it('should return .cursor/mcp.json for Windows', () => {
      const result = getCursorGlobalPath('win32');
      expect(result).toBe(path.join(mockHomeDir, '.cursor', 'mcp.json'));
    });
  });

  describe('getCursorProjectPath', () => {
    it('should return .cursor/mcp.json in cwd', () => {
      const result = getCursorProjectPath();
      expect(result).toBe('/mock/project/.cursor/mcp.json');
    });
  });

  describe('getWindsurfPath', () => {
    it('should return correct path for all platforms', () => {
      const darwinResult = getWindsurfPath('darwin');
      expect(darwinResult).toBe(path.join(mockHomeDir, '.codeium', 'windsurf', 'mcp_config.json'));

      const linuxResult = getWindsurfPath('linux');
      expect(linuxResult).toBe(path.join(mockHomeDir, '.codeium', 'windsurf', 'mcp_config.json'));

      const win32Result = getWindsurfPath('win32');
      expect(win32Result).toBe(path.join(mockHomeDir, '.codeium', 'windsurf', 'mcp_config.json'));
    });
  });

  describe('getCopilotCliPath', () => {
    it('should return .copilot/mcp-config.json for Linux', () => {
      const result = getCopilotCliPath('linux');
      expect(result).toBe(path.join(mockHomeDir, '.copilot', 'mcp-config.json'));
    });

    it('should return .copilot/mcp-config.json for macOS', () => {
      const result = getCopilotCliPath('darwin');
      expect(result).toBe(path.join(mockHomeDir, '.copilot', 'mcp-config.json'));
    });

    it('should return .copilot/mcp-config.json for Windows', () => {
      const result = getCopilotCliPath('win32');
      expect(result).toBe(path.join(mockHomeDir, '.copilot', 'mcp-config.json'));
    });

    it('should respect XDG_CONFIG_HOME on Linux', () => {
      process.env.XDG_CONFIG_HOME = '/custom/config';
      const result = getCopilotCliPath('linux');
      expect(result).toBe(path.join('/custom/config', '.copilot', 'mcp-config.json'));
      delete process.env.XDG_CONFIG_HOME;
    });
  });

  describe('getJetBrainsCopilotPath', () => {
    it('should return correct path for Windows (confirmed)', () => {
      process.env.LOCALAPPDATA = 'C:\\Users\\testuser\\AppData\\Local';
      const result = getJetBrainsCopilotPath('win32');
      expect(result).toBe(path.join('C:\\Users\\testuser\\AppData\\Local', 'github-copilot', 'intellij', 'mcp.json'));
    });

    it('should return placeholder path for macOS (needs research)', () => {
      const result = getJetBrainsCopilotPath('darwin');
      expect(result).toContain('github-copilot');
      expect(result).toContain('intellij');
      expect(result).toContain('mcp.json');
    });

    it('should return placeholder path for Linux (needs research)', () => {
      const result = getJetBrainsCopilotPath('linux');
      expect(result).toContain('github-copilot');
      expect(result).toContain('intellij');
      expect(result).toContain('mcp.json');
    });
  });

  describe('getJetBrainsCopilotWorkspacePath', () => {
    it('should return .vscode/mcp.json (shared with VS Code)', () => {
      const result = getJetBrainsCopilotWorkspacePath();
      expect(result).toBe('/mock/project/.vscode/mcp.json');
    });
  });

  describe('getBackupDir', () => {
    it('should return XDG path on Linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      const result = getBackupDir();
      expect(result).toBe(path.join(mockHomeDir, '.config', 'overture', 'backups'));
    });

    it('should return ~/.config path on other platforms', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      const result = getBackupDir();
      expect(result).toBe(path.join(mockHomeDir, '.config', 'overture', 'backups'));
    });
  });

  describe('getLockFilePath', () => {
    it('should return XDG path on Linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      const result = getLockFilePath();
      expect(result).toBe(path.join(mockHomeDir, '.config', 'overture', 'overture.lock'));
    });

    it('should return ~/.config path on other platforms', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      const result = getLockFilePath();
      expect(result).toBe(path.join(mockHomeDir, '.config', 'overture', 'overture.lock'));
    });
  });

  describe('getClientConfigPath', () => {
    it('should return both user and project paths for claude-code', () => {
      const result = getClientConfigPath('claude-code', 'linux');
      expect(result).toEqual({
        user: path.join(mockHomeDir, '.config', 'claude', 'mcp.json'),
        project: '/mock/project/.mcp.json',
      });
    });

    it('should return single path for claude-desktop', () => {
      const result = getClientConfigPath('claude-desktop', 'darwin');
      expect(result).toBe(
        path.join(mockHomeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
      );
    });

    it('should return both paths for vscode', () => {
      const result = getClientConfigPath('vscode', 'linux');
      expect(result).toEqual({
        user: path.join(mockHomeDir, '.config', 'Code', 'User', 'mcp.json'),
        project: '/mock/project/.vscode/mcp.json',
      });
    });

    it('should throw error for unknown client', () => {
      expect(() => {
        getClientConfigPath('unknown-client' as any);
      }).toThrow('Unknown client: unknown-client');
    });
  });
});
