/**
 * Extended Client Adapters Tests
 *
 * Tests for CursorAdapter, WindsurfAdapter, CopilotCliAdapter, and JetBrainsCopilotAdapter
 *
 * @module adapters/extended-adapters.spec
 */

import * as fs from 'fs';
import { CursorAdapter } from './cursor-adapter';
import { WindsurfAdapter } from './windsurf-adapter';
import { CopilotCliAdapter } from './copilot-cli-adapter';
import { JetBrainsCopilotAdapter } from './jetbrains-copilot-adapter';
import type { OvertureConfigV2 } from '../domain/config-v2.types';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock path-resolver
jest.mock('../core/path-resolver', () => ({
  getCursorGlobalPath: jest.fn(() => '/home/user/.config/Cursor/User/globalStorage/mcp.json'),
  getCursorProjectPath: jest.fn(() => '/project/.cursor/mcp.json'),
  getWindsurfPath: jest.fn(() => '/home/user/.codeium/windsurf/mcp_config.json'),
  getCopilotCliPath: jest.fn(() => '/home/user/.config/github-copilot/mcp.json'),
  getJetBrainsCopilotPath: jest.fn(() => '/home/user/.config/github-copilot/intellij/mcp.json'),
  getJetBrainsCopilotWorkspacePath: jest.fn(() => '/project/.vscode/mcp.json'),
}));

describe('CursorAdapter', () => {
  let adapter: CursorAdapter;

  beforeEach(() => {
    adapter = new CursorAdapter();
    jest.clearAllMocks();
  });

  it('should have correct properties', () => {
    expect(adapter.name).toBe('cursor');
    expect(adapter.schemaRootKey).toBe('mcpServers');
  });

  it('should detect user and project config paths', () => {
    const paths = adapter.detectConfigPath('linux', '/project');
    expect(paths).toEqual({
      user: '/home/user/.config/Cursor/User/globalStorage/mcp.json',
      project: '/project/.cursor/mcp.json',
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
    const overtureConfig: OvertureConfigV2 = {
      version: '2.0',
      mcp: {
        github: {
          command: 'mcp-server-github',
          args: [],
          env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
          transport: 'stdio',
          scope: 'global',
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.mcpServers.github).toBeDefined();
    expect(result.mcpServers.github.command).toBe('mcp-server-github');
    expect(result.mcpServers.github.env).toEqual({ GITHUB_TOKEN: '${GITHUB_TOKEN}' });
  });

  it('should support stdio and http transports', () => {
    expect(adapter.supportsTransport('stdio')).toBe(true);
    expect(adapter.supportsTransport('http')).toBe(true);
    expect(adapter.supportsTransport('sse')).toBe(false);
  });

  it('should not need env var expansion', () => {
    expect(adapter.needsEnvVarExpansion()).toBe(false);
  });

  it('should apply platform overrides', () => {
    const overtureConfig: OvertureConfigV2 = {
      version: '2.0',
      mcp: {
        python: {
          command: 'python',
          args: ['-m', 'mcp_server'],
          env: {},
          transport: 'stdio',
          scope: 'global',
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
    const overtureConfig: OvertureConfigV2 = {
      version: '2.0',
      mcp: {
        test: {
          command: 'base-command',
          args: ['base-arg'],
          env: { BASE: 'value' },
          transport: 'stdio',
          scope: 'global',
          clients: {
            overrides: {
              cursor: {
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
    const overtureConfig: OvertureConfigV2 = {
      version: '2.0',
      mcp: {
        included: {
          command: 'test',
          args: [],
          env: {},
          transport: 'stdio',
          scope: 'global',
        },
        excluded: {
          command: 'test',
          args: [],
          env: {},
          transport: 'stdio',
          scope: 'global',
          clients: {
            exclude: ['cursor'],
          },
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.mcpServers.included).toBeDefined();
    expect(result.mcpServers.excluded).toBeUndefined();
  });

  it('should filter sse transport MCPs', () => {
    const overtureConfig: OvertureConfigV2 = {
      version: '2.0',
      mcp: {
        stdio: {
          command: 'test',
          args: [],
          env: {},
          transport: 'stdio',
          scope: 'global',
        },
        sse: {
          command: 'test',
          args: [],
          env: {},
          transport: 'sse',
          scope: 'global',
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.mcpServers.stdio).toBeDefined();
    expect(result.mcpServers.sse).toBeUndefined(); // Filtered out
  });
});

describe('WindsurfAdapter', () => {
  let adapter: WindsurfAdapter;

  beforeEach(() => {
    adapter = new WindsurfAdapter();
    jest.clearAllMocks();
  });

  it('should have correct properties', () => {
    expect(adapter.name).toBe('windsurf');
    expect(adapter.schemaRootKey).toBe('mcpServers');
  });

  it('should detect user config path only', () => {
    const path = adapter.detectConfigPath('linux');
    expect(path).toBe('/home/user/.codeium/windsurf/mcp_config.json');
  });

  it('should support stdio transport only', () => {
    expect(adapter.supportsTransport('stdio')).toBe(true);
    expect(adapter.supportsTransport('http')).toBe(false);
    expect(adapter.supportsTransport('sse')).toBe(false);
  });

  it('should not need env var expansion', () => {
    expect(adapter.needsEnvVarExpansion()).toBe(false);
  });

  it('should filter http transport MCPs', () => {
    const overtureConfig: OvertureConfigV2 = {
      version: '2.0',
      mcp: {
        stdio: {
          command: 'test',
          args: [],
          env: {},
          transport: 'stdio',
          scope: 'global',
        },
        http: {
          command: 'test',
          args: [],
          env: {},
          transport: 'http',
          scope: 'global',
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.mcpServers.stdio).toBeDefined();
    expect(result.mcpServers.http).toBeUndefined(); // Filtered out
  });

  it('should convert Overture config correctly', () => {
    const overtureConfig: OvertureConfigV2 = {
      version: '2.0',
      mcp: {
        python: {
          command: 'uvx',
          args: ['mcp-server-python'],
          env: {},
          transport: 'stdio',
          scope: 'global',
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.mcpServers.python).toBeDefined();
    expect(result.mcpServers.python.command).toBe('uvx');
  });
});

describe('CopilotCliAdapter', () => {
  let adapter: CopilotCliAdapter;

  beforeEach(() => {
    adapter = new CopilotCliAdapter();
    jest.clearAllMocks();
  });

  it('should have correct properties', () => {
    expect(adapter.name).toBe('copilot-cli');
    expect(adapter.schemaRootKey).toBe('mcpServers');
  });

  it('should detect user config path only', () => {
    const path = adapter.detectConfigPath('linux');
    expect(path).toBe('/home/user/.config/github-copilot/mcp.json');
  });

  it('should support stdio transport only', () => {
    expect(adapter.supportsTransport('stdio')).toBe(true);
    expect(adapter.supportsTransport('http')).toBe(false);
    expect(adapter.supportsTransport('sse')).toBe(false);
  });

  it('should not need env var expansion', () => {
    expect(adapter.needsEnvVarExpansion()).toBe(false);
  });

  it('should filter excluded MCPs (e.g., github)', () => {
    const overtureConfig: OvertureConfigV2 = {
      version: '2.0',
      mcp: {
        filesystem: {
          command: 'test',
          args: [],
          env: {},
          transport: 'stdio',
          scope: 'global',
        },
        github: {
          command: 'mcp-server-github',
          args: [],
          env: {},
          transport: 'stdio',
          scope: 'global',
          clients: {
            exclude: ['copilot-cli'], // Bundled in Copilot CLI
          },
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.mcpServers.filesystem).toBeDefined();
    expect(result.mcpServers.github).toBeUndefined(); // Filtered out
  });

  it('should convert Overture config correctly', () => {
    const overtureConfig: OvertureConfigV2 = {
      version: '2.0',
      mcp: {
        filesystem: {
          command: 'mcp-server-filesystem',
          args: [],
          env: {},
          transport: 'stdio',
          scope: 'global',
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.mcpServers.filesystem).toBeDefined();
  });
});

describe('JetBrainsCopilotAdapter', () => {
  let adapter: JetBrainsCopilotAdapter;

  beforeEach(() => {
    adapter = new JetBrainsCopilotAdapter();
    jest.clearAllMocks();
  });

  it('should have correct properties', () => {
    expect(adapter.name).toBe('jetbrains-copilot');
    expect(adapter.schemaRootKey).toBe('mcpServers');
  });

  it('should detect user and workspace config paths', () => {
    const paths = adapter.detectConfigPath('linux', '/project');
    expect(paths).toEqual({
      user: '/home/user/.config/github-copilot/intellij/mcp.json',
      project: '/project/.vscode/mcp.json', // Shared with VS Code!
    });
  });

  it('should support stdio transport only', () => {
    expect(adapter.supportsTransport('stdio')).toBe(true);
    expect(adapter.supportsTransport('http')).toBe(false);
    expect(adapter.supportsTransport('sse')).toBe(false);
  });

  it('should need env var expansion', () => {
    expect(adapter.needsEnvVarExpansion()).toBe(true);
  });

  it('should expand environment variables', () => {
    // Mock process.env
    process.env.GITHUB_TOKEN = 'test-token-456';

    const overtureConfig: OvertureConfigV2 = {
      version: '2.0',
      mcp: {
        github: {
          command: 'mcp-server-github',
          args: [],
          env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
          transport: 'stdio',
          scope: 'global',
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.mcpServers.github.env?.GITHUB_TOKEN).toBe('test-token-456');

    delete process.env.GITHUB_TOKEN;
  });

  it('should convert Overture config correctly', () => {
    const overtureConfig: OvertureConfigV2 = {
      version: '2.0',
      mcp: {
        python: {
          command: 'uvx',
          args: ['mcp-server-python'],
          env: {},
          transport: 'stdio',
          scope: 'global',
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.mcpServers.python).toBeDefined();
    expect(result.mcpServers.python.command).toBe('uvx');
  });

  it('should apply client overrides', () => {
    const overtureConfig: OvertureConfigV2 = {
      version: '2.0',
      mcp: {
        test: {
          command: 'base-command',
          args: ['base-arg'],
          env: { BASE: 'value' },
          transport: 'stdio',
          scope: 'global',
          clients: {
            overrides: {
              'jetbrains-copilot': {
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
});
