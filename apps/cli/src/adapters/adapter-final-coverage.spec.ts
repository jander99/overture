/**
 * Adapter Final Coverage Tests
 *
 * Tests to achieve 100% coverage for remaining uncovered lines.
 *
 * @module adapters/adapter-final-coverage.spec
 */

import * as fs from 'fs';
import { ClaudeCodeAdapter } from './claude-code-adapter';
import { ClaudeDesktopAdapter } from './claude-desktop-adapter';
import { VSCodeAdapter } from './vscode-adapter';
import { CursorAdapter } from './cursor-adapter';
import { WindsurfAdapter } from './windsurf-adapter';
import { CopilotCliAdapter } from './copilot-cli-adapter';
import { JetBrainsCopilotAdapter } from './jetbrains-copilot-adapter';
import { AdapterRegistry, getAdapterForClient } from './adapter-registry';
import type { OvertureConfig } from '../domain/config.types';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock path-resolver
jest.mock('../core/path-resolver', () => ({
  getPlatform: jest.fn(() => 'linux'),
  getClaudeCodeGlobalPath: jest.fn(() => '/home/user/.config/claude/mcp.json'),
  getClaudeCodeProjectPath: jest.fn(() => '/project/.mcp.json'),
  getClaudeDesktopPath: jest.fn(() => ({
    user: '/home/user/Library/Application Support/Claude/claude_desktop_config.json',
  })),
  getVSCodeGlobalPath: jest.fn(() => '/home/user/.config/Code/User/mcp.json'),
  getVSCodeWorkspacePath: jest.fn(() => '/project/.vscode/mcp.json'),
  getCursorGlobalPath: jest.fn(() => '/home/user/.config/Cursor/User/globalStorage/mcp.json'),
  getCursorProjectPath: jest.fn(() => '/project/.cursor/mcp.json'),
  getWindsurfPath: jest.fn(() => ({
    user: '/home/user/.codeium/windsurf/mcp_config.json',
  })),
  getCopilotCliPath: jest.fn(() => ({
    user: '/home/user/.config/github-copilot/mcp.json',
  })),
  getJetBrainsCopilotPath: jest.fn(() => '/home/user/.config/github-copilot/intellij/mcp.json'),
  getJetBrainsCopilotWorkspacePath: jest.fn(() => '/project/.vscode/mcp.json'),
}));

// Mock env-expander
jest.mock('../core/env-expander', () => ({
  expandEnvVarsInObject: jest.fn((env) => {
    const expanded: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      expanded[key] = value.replace(/\$\{(\w+)\}/g, (_, varName) => process.env[varName] || '');
    }
    return expanded;
  }),
}));

describe('Uncovered Line Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ClaudeDesktopAdapter - Line 35, 48, 119', () => {
    it('should reach line 35 when file exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ mcpServers: { test: {} } }));

      const adapter = new ClaudeDesktopAdapter();
      const result = adapter.readConfig('/test/path');
      expect(result.mcpServers).toBeDefined();
    });

    it('should throw error on JSON parse failure (line 48)', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new SyntaxError('Unexpected token');
      });

      const adapter = new ClaudeDesktopAdapter();
      expect(() => adapter.readConfig('/test/path')).toThrow(/Failed to read Claude Desktop config/);
    });

    it('should return false for needsEnvVarExpansion (line 119)', () => {
      const adapter = new ClaudeDesktopAdapter();
      expect(adapter.needsEnvVarExpansion()).toBe(false);
    });
  });

  describe('CopilotCliAdapter - Line 37, 50', () => {
    it('should reach line 37 when file exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ mcpServers: {} }));

      const adapter = new CopilotCliAdapter();
      const result = adapter.readConfig('/test/path');
      expect(result).toBeDefined();
    });

    it('should throw error on parse failure (line 50)', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const adapter = new CopilotCliAdapter();
      expect(() => adapter.readConfig('/test/path')).toThrow(/Failed to read Copilot CLI config/);
    });
  });

  describe('WindsurfAdapter - Line 32, 45', () => {
    it('should reach line 32 when file exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ mcpServers: {} }));

      const adapter = new WindsurfAdapter();
      const result = adapter.readConfig('/test/path');
      expect(result).toBeDefined();
    });

    it('should throw error on parse failure (line 45)', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Bad data');
      });

      const adapter = new WindsurfAdapter();
      expect(() => adapter.readConfig('/test/path')).toThrow(/Failed to read Windsurf config/);
    });
  });

  describe('JetBrainsCopilotAdapter - Line 46, 59', () => {
    it('should reach line 46 when file exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ mcpServers: {} }));

      const adapter = new JetBrainsCopilotAdapter();
      const result = adapter.readConfig('/test/path');
      expect(result).toBeDefined();
    });

    it('should throw error on parse failure (line 59)', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Parse error');
      });

      const adapter = new JetBrainsCopilotAdapter();
      expect(() => adapter.readConfig('/test/path')).toThrow(/Failed to read JetBrains Copilot config/);
    });
  });

  describe('VSCodeAdapter - Line 46', () => {
    it('should reach line 46 when file exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ servers: {} }));

      const adapter = new VSCodeAdapter();
      const result = adapter.readConfig('/test/path');
      expect(result).toBeDefined();
    });

    it('should handle error in readConfig', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('I/O error');
      });

      const adapter = new VSCodeAdapter();
      expect(() => adapter.readConfig('/test/path')).toThrow(/Failed to read VS Code config/);
    });
  });

  describe('CursorAdapter - All branches', () => {
    it('should handle all code paths in convertFromOverture', () => {
      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          full: {
            command: 'base',
            args: ['base'],
            env: { KEY: 'val' },
            transport: 'stdio',
            platforms: {
              commandOverrides: { linux: 'new-cmd' },
              argsOverrides: { linux: ['new-arg'] },
            },
            clients: {
              overrides: {
                cursor: {
                  command: 'cursor-cmd',
                  args: ['cursor-arg'],
                  env: { NEW: 'val' },
                },
              },
            },
          },
          minimal: {
            command: 'min',
            args: [],
            env: {},
            transport: 'http',
          },
        },
      };

      const adapter = new CursorAdapter();
      const result = adapter.convertFromOverture(overtureConfig, 'linux');

      // Full config with all overrides
      expect(result.mcpServers.full.command).toBe('cursor-cmd');
      expect(result.mcpServers.full.args).toEqual(['cursor-arg']);
      expect(result.mcpServers.full.env).toEqual({ KEY: 'val', NEW: 'val' });

      // Minimal config
      expect(result.mcpServers.minimal.command).toBe('min');
      expect(result.mcpServers.minimal.env).toBeUndefined();
    });
  });

  describe('AdapterRegistry - Line 24, 140', () => {
    it('should cover getAdapterForClient with registered adapter (line 140)', () => {
      // Clear any existing adapters first
      const { adapterRegistry } = require('./adapter-registry');
      adapterRegistry.clear();

      const adapter = new ClaudeCodeAdapter();
      adapterRegistry.register(adapter);

      const result = getAdapterForClient('claude-code');
      expect(result).toBe(adapter);
    });

    it('should throw error for unregistered adapter (line 140)', () => {
      // Clear registry first
      const { adapterRegistry } = require('./adapter-registry');
      adapterRegistry.clear();

      // This should hit the error path
      expect(() => getAdapterForClient('unregistered' as any)).toThrow('No adapter registered for client: unregistered');
    });
  });
});

describe('Edge Cases for Complete Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle detectConfigPath for all platforms', () => {
    const adapter = new ClaudeCodeAdapter();

    // Test all platforms
    const darwinPaths = adapter.detectConfigPath('darwin', '/project');
    expect(darwinPaths).toBeDefined();

    const linuxPaths = adapter.detectConfigPath('linux', '/project');
    expect(linuxPaths).toBeDefined();

    const win32Paths = adapter.detectConfigPath('win32', '/project');
    expect(win32Paths).toBeDefined();
  });

  it('should handle Windows backslash paths', () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);

    const adapter = new ClaudeCodeAdapter();

    // Test with Windows-style path (using backslash)
    const winPath = 'C:\\Users\\test\\config.json';
    adapter.writeConfig(winPath, { mcpServers: {} });

    // Should handle path extraction correctly
    expect(mockFs.mkdirSync).toHaveBeenCalled();
  });

  it('should handle empty platform overrides', () => {
    const overtureConfig: OvertureConfig = {
      version: '2.0',
      mcp: {
        test: {
          command: 'test',
          args: ['arg'],
          env: { KEY: 'val' },
          transport: 'stdio',
          platforms: {
            // Empty overrides
          },
        },
      },
    };

    const adapter = new ClaudeCodeAdapter();
    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.mcpServers.test.command).toBe('test');
    expect(result.mcpServers.test.args).toEqual(['arg']);
  });

  it('should handle empty client overrides', () => {
    const overtureConfig: OvertureConfig = {
      version: '2.0',
      mcp: {
        test: {
          command: 'test',
          args: [],
          env: {},
          transport: 'stdio',
          clients: {
            overrides: {
              vscode: {
                // Empty override
              },
            },
          },
        },
      },
    };

    const adapter = new VSCodeAdapter();
    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.servers.test.command).toBe('test');
  });

  it('should handle all transport types correctly', () => {
    const claudeCode = new ClaudeCodeAdapter();
    expect(claudeCode.supportsTransport('stdio')).toBe(true);
    expect(claudeCode.supportsTransport('http')).toBe(true);
    expect(claudeCode.supportsTransport('sse')).toBe(true);

    const claudeDesktop = new ClaudeDesktopAdapter();
    expect(claudeDesktop.supportsTransport('stdio')).toBe(true);
    expect(claudeDesktop.supportsTransport('http')).toBe(false);
    expect(claudeDesktop.supportsTransport('sse')).toBe(false);

    const vscode = new VSCodeAdapter();
    expect(vscode.supportsTransport('stdio')).toBe(true);
    expect(vscode.supportsTransport('http')).toBe(true);
    expect(vscode.supportsTransport('sse')).toBe(false);

    const cursor = new CursorAdapter();
    expect(cursor.supportsTransport('stdio')).toBe(true);
    expect(cursor.supportsTransport('http')).toBe(true);
    expect(cursor.supportsTransport('sse')).toBe(false);

    const windsurf = new WindsurfAdapter();
    expect(windsurf.supportsTransport('stdio')).toBe(true);
    expect(windsurf.supportsTransport('http')).toBe(false);
    expect(windsurf.supportsTransport('sse')).toBe(false);

    const copilot = new CopilotCliAdapter();
    expect(copilot.supportsTransport('stdio')).toBe(true);
    expect(copilot.supportsTransport('http')).toBe(false);
    expect(copilot.supportsTransport('sse')).toBe(false);

    const jetbrains = new JetBrainsCopilotAdapter();
    expect(jetbrains.supportsTransport('stdio')).toBe(true);
    expect(jetbrains.supportsTransport('http')).toBe(false);
    expect(jetbrains.supportsTransport('sse')).toBe(false);
  });

  it('should correctly report env expansion needs', () => {
    expect(new ClaudeCodeAdapter().needsEnvVarExpansion()).toBe(false);
    expect(new ClaudeDesktopAdapter().needsEnvVarExpansion()).toBe(false);
    expect(new VSCodeAdapter().needsEnvVarExpansion()).toBe(true);
    expect(new CursorAdapter().needsEnvVarExpansion()).toBe(false);
    expect(new WindsurfAdapter().needsEnvVarExpansion()).toBe(false);
    expect(new CopilotCliAdapter().needsEnvVarExpansion()).toBe(false);
    expect(new JetBrainsCopilotAdapter().needsEnvVarExpansion()).toBe(true);
  });
});
