import type { Mock, Mocked, MockedObject, MockedFunction, MockInstance } from 'vitest';
/**
 * Adapter Coverage Enhancements
 *
 * Additional tests to achieve 100% coverage for all adapter implementations.
 * Focuses on edge cases, error handling, and uncovered code paths.
 *
 * @module adapters/adapter-coverage-enhancements.spec
 */

import * as fs from 'fs';
import { ClaudeCodeAdapter } from './claude-code-adapter';
import { ClaudeDesktopAdapter } from './claude-desktop-adapter';
import { VSCodeAdapter } from './vscode-adapter';
import { CursorAdapter } from './cursor-adapter';
import { WindsurfAdapter } from './windsurf-adapter';
import { CopilotCliAdapter } from './copilot-cli-adapter';
import { JetBrainsCopilotAdapter } from './jetbrains-copilot-adapter';
import type { OvertureConfig } from '../domain/config.types';

// Mock fs module
vi.mock('fs');
const mockFs = fs as Mocked<typeof fs>;

// Mock path-resolver
vi.mock('../core/path-resolver', () => ({
  getClaudeCodeGlobalPath: vi.fn(() => '/home/user/.config/claude/mcp.json'),
  getClaudeCodeProjectPath: vi.fn(() => '/project/.mcp.json'),
  getClaudeDesktopPath: vi.fn(() => '/home/user/Library/Application Support/Claude/claude_desktop_config.json'),
  getVSCodeGlobalPath: vi.fn(() => '/home/user/.config/Code/User/mcp.json'),
  getVSCodeWorkspacePath: vi.fn(() => '/project/.vscode/mcp.json'),
  getCursorGlobalPath: vi.fn(() => '/home/user/.config/Cursor/User/globalStorage/mcp.json'),
  getCursorProjectPath: vi.fn(() => '/project/.cursor/mcp.json'),
  getWindsurfPath: vi.fn(() => '/home/user/.codeium/windsurf/mcp_config.json'),
  getCopilotCliPath: vi.fn(() => '/home/user/.config/github-copilot/mcp.json'),
  getJetBrainsCopilotPath: vi.fn(() => '/home/user/.config/github-copilot/intellij/mcp.json'),
  getJetBrainsCopilotWorkspacePath: vi.fn(() => '/project/.vscode/mcp.json'),
}));

// Mock env-expander
vi.mock('../core/env-expander', () => ({
  expandEnvVarsInObject: vi.fn((env) => {
    // Simple expansion for testing
    const expanded: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      expanded[key] = value.replace(/\$\{(\w+)\}/g, (_, varName) => process.env[varName] || '');
    }
    return expanded;
  }),
}));

describe('Adapter Error Handling - All Adapters', () => {
  describe('readConfig error scenarios', () => {
    it('ClaudeCodeAdapter should throw error on invalid JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{ invalid json }');

      const adapter = new ClaudeCodeAdapter();
      expect(() => adapter.readConfig('/test/path')).toThrow(/Failed to read Claude Code config/);
    });

    it('ClaudeCodeAdapter should return empty mcpServers when parsed config lacks mcpServers key', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ otherKey: {} }));

      const adapter = new ClaudeCodeAdapter();
      const config = adapter.readConfig('/test/path');
      expect(config).toEqual({ mcpServers: {} });
    });

    it('ClaudeCodeAdapter should throw error on file read failure', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const adapter = new ClaudeCodeAdapter();
      expect(() => adapter.readConfig('/test/path')).toThrow(/Failed to read Claude Code config/);
      expect(() => adapter.readConfig('/test/path')).toThrow(/Permission denied/);
    });

    it('ClaudeDesktopAdapter should throw error on invalid JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('not valid json');

      const adapter = new ClaudeDesktopAdapter();
      expect(() => adapter.readConfig('/test/path')).toThrow(/Failed to read Claude Desktop config/);
    });

    it('VSCodeAdapter should throw error on invalid JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid');

      const adapter = new VSCodeAdapter();
      expect(() => adapter.readConfig('/test/path')).toThrow(/Failed to read VS Code config/);
    });

    it('VSCodeAdapter should return empty servers when parsed config lacks servers key', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ otherKey: {} }));

      const adapter = new VSCodeAdapter();
      const config = adapter.readConfig('/test/path');
      expect(config).toEqual({ servers: {} });
    });

    it('CursorAdapter should throw error on invalid JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{bad}');

      const adapter = new CursorAdapter();
      expect(() => adapter.readConfig('/test/path')).toThrow(/Failed to read Cursor config/);
    });

    it('WindsurfAdapter should throw error on invalid JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('not json');

      const adapter = new WindsurfAdapter();
      expect(() => adapter.readConfig('/test/path')).toThrow(/Failed to read Windsurf config/);
    });

    it('CopilotCliAdapter should throw error on invalid JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('[invalid]');

      const adapter = new CopilotCliAdapter();
      expect(() => adapter.readConfig('/test/path')).toThrow(/Failed to read Copilot CLI config/);
    });

    it('JetBrainsCopilotAdapter should throw error on invalid JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('bad json');

      const adapter = new JetBrainsCopilotAdapter();
      expect(() => adapter.readConfig('/test/path')).toThrow(/Failed to read JetBrains Copilot config/);
    });
  });

  describe('writeConfig error scenarios', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('ClaudeCodeAdapter should create directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockReturnValue(undefined);
      mockFs.writeFileSync.mockReturnValue(undefined);

      const adapter = new ClaudeCodeAdapter();
      adapter.writeConfig('/home/user/.config/claude/mcp.json', { mcpServers: {} });

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/home/user/.config/claude', { recursive: true });
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('ClaudeCodeAdapter should throw error on write failure', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });

      const adapter = new ClaudeCodeAdapter();
      expect(() => adapter.writeConfig('/test/path', { mcpServers: {} })).toThrow(/Failed to write Claude Code config/);
      expect(() => adapter.writeConfig('/test/path', { mcpServers: {} })).toThrow(/Disk full/);
    });

    it('ClaudeDesktopAdapter should throw error on write failure', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const adapter = new ClaudeDesktopAdapter();
      expect(() => adapter.writeConfig('/test/path', { mcpServers: {} })).toThrow(/Failed to write Claude Desktop config/);
    });

    it('VSCodeAdapter should create directory and throw error on mkdirSync failure', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('Cannot create directory');
      });

      const adapter = new VSCodeAdapter();
      expect(() => adapter.writeConfig('/test/path', { servers: {} })).toThrow(/Failed to write VS Code config/);
    });

    it('CursorAdapter should throw error on write failure', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      const adapter = new CursorAdapter();
      expect(() => adapter.writeConfig('/test/path', { mcpServers: {} })).toThrow(/Failed to write Cursor config/);
    });

    it('WindsurfAdapter should throw error on write failure', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('I/O error');
      });

      const adapter = new WindsurfAdapter();
      expect(() => adapter.writeConfig('/test/path', { mcpServers: {} })).toThrow(/Failed to write Windsurf config/);
    });

    it('CopilotCliAdapter should throw error on write failure', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('No space left');
      });

      const adapter = new CopilotCliAdapter();
      expect(() => adapter.writeConfig('/test/path', { mcpServers: {} })).toThrow(/Failed to write Copilot CLI config/);
    });

    it('JetBrainsCopilotAdapter should throw error on write failure', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Access denied');
      });

      const adapter = new JetBrainsCopilotAdapter();
      expect(() => adapter.writeConfig('/test/path', { mcpServers: {} })).toThrow(/Failed to write JetBrains Copilot config/);
    });
  });

  describe('convertFromOverture edge cases', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should omit env object when empty', () => {
      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          test: {
            command: 'test-cmd',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const adapter = new ClaudeCodeAdapter();
      const result = adapter.convertFromOverture(overtureConfig, 'linux');
      expect(result.mcpServers.test.env).toBeUndefined();
    });

    it('should include env object when not empty', () => {
      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          test: {
            command: 'test-cmd',
            args: [],
            env: { KEY: 'value' },
            transport: 'stdio',
          },
        },
      };

      const adapter = new ClaudeCodeAdapter();
      const result = adapter.convertFromOverture(overtureConfig, 'linux');
      expect(result.mcpServers.test.env).toEqual({ KEY: 'value' });
    });

    it('should apply args overrides correctly', () => {
      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          test: {
            command: 'test',
            args: ['original'],
            env: {},
            transport: 'stdio',
            platforms: {
              argsOverrides: {
                linux: ['override1', 'override2'],
              },
            },
          },
        },
      };

      const adapter = new ClaudeCodeAdapter();
      const result = adapter.convertFromOverture(overtureConfig, 'linux');
      expect(result.mcpServers.test.args).toEqual(['override1', 'override2']);
    });

    it('should merge client override env with base env', () => {
      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          test: {
            command: 'test',
            args: [],
            env: { BASE: 'base-value', SHARED: 'original' },
            transport: 'stdio',
            clients: {
              overrides: {
                'claude-code': {
                  env: { OVERRIDE: 'override-value', SHARED: 'overridden' },
                },
              },
            },
          },
        },
      };

      const adapter = new ClaudeCodeAdapter();
      const result = adapter.convertFromOverture(overtureConfig, 'linux');
      expect(result.mcpServers.test.env).toEqual({
        BASE: 'base-value',
        SHARED: 'overridden',
        OVERRIDE: 'override-value',
      });
    });

    it('should handle transport override in client config', () => {
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
                  transport: 'http',
                },
              },
            },
          },
        },
      };

      const adapter = new VSCodeAdapter();
      const result = adapter.convertFromOverture(overtureConfig, 'linux');
      expect(result.servers.test.type).toBe('http');
    });

    it('should handle empty mcp config object', () => {
      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {},
      };

      const adapter = new ClaudeCodeAdapter();
      const result = adapter.convertFromOverture(overtureConfig, 'linux');
      expect(result.mcpServers).toEqual({});
    });
  });

  describe('Platform-specific detection', () => {
    it('should detect config paths for darwin', () => {
      const adapter = new ClaudeCodeAdapter();
      const paths = adapter.detectConfigPath('darwin', '/project');
      expect(paths).toBeDefined();
    });

    it('should detect config paths for win32', () => {
      const adapter = new ClaudeCodeAdapter();
      const paths = adapter.detectConfigPath('win32', '/project');
      expect(paths).toBeDefined();
    });

    it('should detect config paths without project root', () => {
      const adapter = new ClaudeCodeAdapter();
      const paths = adapter.detectConfigPath('linux');
      expect(paths).toBeDefined();
    });
  });

  describe('Environment variable expansion', () => {
    beforeEach(() => {
      process.env.TEST_VAR = 'test-value';
      process.env.GITHUB_TOKEN = 'ghp_test123';
    });

    afterEach(() => {
      delete process.env.TEST_VAR;
      delete process.env.GITHUB_TOKEN;
    });

    it('VSCodeAdapter should expand environment variables', () => {
      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          test: {
            command: 'test',
            args: [],
            env: {
              TEST_VAR: '${TEST_VAR}',
              GITHUB_TOKEN: '${GITHUB_TOKEN}',
            },
            transport: 'stdio',
          },
        },
      };

      const adapter = new VSCodeAdapter();
      const result = adapter.convertFromOverture(overtureConfig, 'linux');
      expect(result.servers.test.env?.TEST_VAR).toBe('test-value');
      expect(result.servers.test.env?.GITHUB_TOKEN).toBe('ghp_test123');
    });

    it('JetBrainsCopilotAdapter should expand environment variables', () => {
      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          test: {
            command: 'test',
            args: [],
            env: {
              TEST_VAR: '${TEST_VAR}',
            },
            transport: 'stdio',
          },
        },
      };

      const adapter = new JetBrainsCopilotAdapter();
      const result = adapter.convertFromOverture(overtureConfig, 'linux');
      expect(result.mcpServers.test.env?.TEST_VAR).toBe('test-value');
    });
  });

  describe('Transport filtering', () => {
    it('ClaudeDesktopAdapter should filter out http transport', () => {
      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          httpOnly: {
            command: 'test',
            args: [],
            env: {},
            transport: 'http',
          },
        },
      };

      const adapter = new ClaudeDesktopAdapter();
      const result = adapter.convertFromOverture(overtureConfig, 'darwin');
      expect(result.mcpServers.httpOnly).toBeUndefined();
    });

    it('ClaudeDesktopAdapter should filter out sse transport', () => {
      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          sseOnly: {
            command: 'test',
            args: [],
            env: {},
            transport: 'sse',
          },
        },
      };

      const adapter = new ClaudeDesktopAdapter();
      const result = adapter.convertFromOverture(overtureConfig, 'darwin');
      expect(result.mcpServers.sseOnly).toBeUndefined();
    });

    it('WindsurfAdapter should filter out non-stdio transports', () => {
      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          stdio: {
            command: 'test',
            args: [],
            env: {},
            transport: 'stdio',
          },
          http: {
            command: 'test',
            args: [],
            env: {},
            transport: 'http',
          },
          sse: {
            command: 'test',
            args: [],
            env: {},
            transport: 'sse',
          },
        },
      };

      const adapter = new WindsurfAdapter();
      const result = adapter.convertFromOverture(overtureConfig, 'linux');
      expect(result.mcpServers.stdio).toBeDefined();
      expect(result.mcpServers.http).toBeUndefined();
      expect(result.mcpServers.sse).toBeUndefined();
    });

    it('CopilotCliAdapter should filter out non-stdio transports', () => {
      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          http: {
            command: 'test',
            args: [],
            env: {},
            transport: 'http',
          },
        },
      };

      const adapter = new CopilotCliAdapter();
      const result = adapter.convertFromOverture(overtureConfig, 'linux');
      expect(result.mcpServers.http).toBeUndefined();
    });

    it('JetBrainsCopilotAdapter should filter out non-stdio transports', () => {
      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          sse: {
            command: 'test',
            args: [],
            env: {},
            transport: 'sse',
          },
        },
      };

      const adapter = new JetBrainsCopilotAdapter();
      const result = adapter.convertFromOverture(overtureConfig, 'linux');
      expect(result.mcpServers.sse).toBeUndefined();
    });

    it('VSCodeAdapter should filter out sse transport', () => {
      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          sse: {
            command: 'test',
            args: [],
            env: {},
            transport: 'sse',
          },
        },
      };

      const adapter = new VSCodeAdapter();
      const result = adapter.convertFromOverture(overtureConfig, 'linux');
      expect(result.servers.sse).toBeUndefined();
    });

    it('CursorAdapter should filter out sse transport', () => {
      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          sse: {
            command: 'test',
            args: [],
            env: {},
            transport: 'sse',
          },
        },
      };

      const adapter = new CursorAdapter();
      const result = adapter.convertFromOverture(overtureConfig, 'linux');
      expect(result.mcpServers.sse).toBeUndefined();
    });
  });
});
