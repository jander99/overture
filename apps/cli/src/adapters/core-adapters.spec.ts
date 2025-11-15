/**
 * Core Client Adapters Tests
 *
 * Tests for ClaudeCodeAdapter, ClaudeDesktopAdapter, and VSCodeAdapter
 *
 * @module adapters/core-adapters.spec
 */

import * as fs from 'fs';
import { ClaudeCodeAdapter } from './claude-code-adapter';
import { ClaudeDesktopAdapter } from './claude-desktop-adapter';
import { VSCodeAdapter } from './vscode-adapter';
import type { OvertureConfig } from '../domain/config.types';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock path-resolver
jest.mock('../core/path-resolver', () => ({
  getClaudeCodeGlobalPath: jest.fn(() => '/home/user/.config/claude/mcp.json'),
  getClaudeCodeProjectPath: jest.fn(() => '/project/.mcp.json'),
  getClaudeDesktopPath: jest.fn(() => '/home/user/Library/Application Support/Claude/claude_desktop_config.json'),
  getVSCodeGlobalPath: jest.fn(() => '/home/user/.config/Code/User/mcp.json'),
  getVSCodeWorkspacePath: jest.fn(() => '/project/.vscode/mcp.json'),
}));

describe('ClaudeCodeAdapter', () => {
  let adapter: ClaudeCodeAdapter;

  beforeEach(() => {
    adapter = new ClaudeCodeAdapter();
    jest.clearAllMocks();
  });

  it('should have correct properties', () => {
    expect(adapter.name).toBe('claude-code');
    expect(adapter.schemaRootKey).toBe('mcpServers');
  });

  it('should detect user and project config paths', () => {
    const paths = adapter.detectConfigPath('linux', '/project');
    expect(paths).toEqual({
      user: '/home/user/.config/claude/mcp.json',
      project: '/project/.mcp.json',
    });
  });

  it('should read existing config', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      mcpServers: {
        github: {
          command: 'mcp-server-github',
          args: [],
        },
      },
    }));

    const config = adapter.readConfig('/test/path');
    expect(config.mcpServers).toBeDefined();
    expect(config.mcpServers.github).toBeDefined();
  });

  it('should return empty config if file does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);

    const config = adapter.readConfig('/test/path');
    expect(config).toEqual({ mcpServers: {} });
  });

  it('should write config to file', () => {
    mockFs.existsSync.mockReturnValue(true);

    adapter.writeConfig('/test/path', {
      mcpServers: {
        github: { command: 'test', args: [] },
      },
    });

    expect(mockFs.writeFileSync).toHaveBeenCalled();
  });

  it('should convert Overture config correctly', () => {
    const overtureConfig: OvertureConfig = {
      version: '2.0',
      mcp: {
        github: {
          command: 'mcp-server-github',
          args: [],
          env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
          transport: 'stdio',
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.mcpServers.github).toBeDefined();
    expect(result.mcpServers.github.command).toBe('mcp-server-github');
    expect(result.mcpServers.github.env).toEqual({ GITHUB_TOKEN: '${GITHUB_TOKEN}' });
  });

  it('should support all transport types', () => {
    expect(adapter.supportsTransport('stdio')).toBe(true);
    expect(adapter.supportsTransport('http')).toBe(true);
    expect(adapter.supportsTransport('sse')).toBe(true);
  });

  it('should not need env var expansion', () => {
    expect(adapter.needsEnvVarExpansion()).toBe(false);
  });

  it('should apply platform overrides', () => {
    const overtureConfig: OvertureConfig = {
      version: '2.0',
      mcp: {
        python: {
          command: 'python',
          args: ['-m', 'mcp_server'],
          env: {},
          transport: 'stdio',
          platforms: {
            commandOverrides: {
              win32: 'python.exe',
            },
          },
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'win32');
    expect(result.mcpServers.python.command).toBe('python.exe');
  });

  it('should apply client overrides', () => {
    const overtureConfig: OvertureConfig = {
      version: '2.0',
      mcp: {
        test: {
          command: 'base-command',
          args: ['base-arg'],
          env: { BASE: 'value' },
          transport: 'stdio',
          clients: {
            overrides: {
              'claude-code': {
                command: 'override-command',
                args: ['override-arg'],
                env: { OVERRIDE: 'value' },
              },
            },
          },
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.mcpServers.test.command).toBe('override-command');
    expect(result.mcpServers.test.args).toEqual(['override-arg']);
    expect(result.mcpServers.test.env).toEqual({ BASE: 'value', OVERRIDE: 'value' });
  });

  it('should filter excluded MCPs', () => {
    const overtureConfig: OvertureConfig = {
      version: '2.0',
      mcp: {
        included: {
          command: 'test',
          args: [],
          env: {},
          transport: 'stdio',
        },
        excluded: {
          command: 'test',
          args: [],
          env: {},
          transport: 'stdio',
          clients: {
            exclude: ['claude-code'],
          },
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.mcpServers.included).toBeDefined();
    expect(result.mcpServers.excluded).toBeUndefined();
  });
});

describe('ClaudeDesktopAdapter', () => {
  let adapter: ClaudeDesktopAdapter;

  beforeEach(() => {
    adapter = new ClaudeDesktopAdapter();
    jest.clearAllMocks();
  });

  it('should have correct properties', () => {
    expect(adapter.name).toBe('claude-desktop');
    expect(adapter.schemaRootKey).toBe('mcpServers');
  });

  it('should detect user config path only', () => {
    const path = adapter.detectConfigPath('darwin');
    expect(path).toBe('/home/user/Library/Application Support/Claude/claude_desktop_config.json');
  });

  it('should support stdio transport only', () => {
    expect(adapter.supportsTransport('stdio')).toBe(true);
    expect(adapter.supportsTransport('http')).toBe(false);
    expect(adapter.supportsTransport('sse')).toBe(false);
  });

  it('should filter http transport MCPs', () => {
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
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'darwin');
    expect(result.mcpServers.stdio).toBeDefined();
    expect(result.mcpServers.http).toBeUndefined(); // Filtered out
  });
});

describe('VSCodeAdapter', () => {
  let adapter: VSCodeAdapter;

  beforeEach(() => {
    adapter = new VSCodeAdapter();
    jest.clearAllMocks();
  });

  it('should have correct properties', () => {
    expect(adapter.name).toBe('vscode');
    expect(adapter.schemaRootKey).toBe('servers'); // Different from others!
  });

  it('should detect user and workspace config paths', () => {
    const paths = adapter.detectConfigPath('linux', '/project');
    expect(paths).toEqual({
      user: '/home/user/.config/Code/User/mcp.json',
      project: '/project/.vscode/mcp.json',
    });
  });

  it('should read config with "servers" root key', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      servers: {
        github: {
          command: 'mcp-server-github',
          args: [],
          type: 'stdio',
        },
      },
    }));

    const config = adapter.readConfig('/test/path');
    expect(config.servers).toBeDefined();
    expect(config.servers.github).toBeDefined();
  });

  it('should convert with "type" field instead of "transport"', () => {
    const overtureConfig: OvertureConfig = {
      version: '2.0',
      mcp: {
        github: {
          command: 'mcp-server-github',
          args: [],
          env: {},
          transport: 'stdio',
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.servers.github).toBeDefined();
    expect(result.servers.github.type).toBe('stdio'); // Not "transport"
  });

  it('should support stdio and http transports', () => {
    expect(adapter.supportsTransport('stdio')).toBe(true);
    expect(adapter.supportsTransport('http')).toBe(true);
    expect(adapter.supportsTransport('sse')).toBe(false);
  });

  it('should need env var expansion', () => {
    expect(adapter.needsEnvVarExpansion()).toBe(true);
  });

  it('should expand environment variables', () => {
    // Mock process.env
    process.env.GITHUB_TOKEN = 'test-token-123';

    const overtureConfig: OvertureConfig = {
      version: '2.0',
      mcp: {
        github: {
          command: 'mcp-server-github',
          args: [],
          env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
          transport: 'stdio',
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.servers.github.env?.GITHUB_TOKEN).toBe('test-token-123');

    delete process.env.GITHUB_TOKEN;
  });

  it('should filter sse transport MCPs', () => {
    const overtureConfig: OvertureConfig = {
      version: '2.0',
      mcp: {
        stdio: {
          command: 'test',
          args: [],
          env: {},
          transport: 'stdio',
        },
        sse: {
          command: 'test',
          args: [],
          env: {},
          transport: 'sse',
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.servers.stdio).toBeDefined();
    expect(result.servers.sse).toBeUndefined(); // Filtered out
  });
});
