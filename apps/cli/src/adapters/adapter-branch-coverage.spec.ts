/**
 * Adapter Branch Coverage Tests
 *
 * Tests to achieve 100% branch coverage for all adapters.
 * Each adapter is tested individually to ensure all code paths are covered.
 *
 * @module adapters/adapter-branch-coverage.spec
 */

import * as fs from 'fs';
import { ClaudeCodeAdapter } from './claude-code-adapter';
import { ClaudeDesktopAdapter } from './claude-desktop-adapter';
import { VSCodeAdapter } from './vscode-adapter';
import { CursorAdapter } from './cursor-adapter';
import { WindsurfAdapter } from './windsurf-adapter';
import { CopilotCliAdapter } from './copilot-cli-adapter';
import { JetBrainsCopilotAdapter } from './jetbrains-copilot-adapter';
import { AdapterRegistry } from './adapter-registry';
import type { OvertureConfig } from '../domain/config.types';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock path-resolver
jest.mock('../core/path-resolver', () => ({
  getPlatform: jest.fn(() => 'linux'),
  getClaudeCodeGlobalPath: jest.fn(() => '/home/user/.config/claude/mcp.json'),
  getClaudeCodeProjectPath: jest.fn(() => '/project/.mcp.json'),
  getClaudeDesktopPath: jest.fn(() => '/home/user/Library/Application Support/Claude/claude_desktop_config.json'),
  getVSCodeGlobalPath: jest.fn(() => '/home/user/.config/Code/User/mcp.json'),
  getVSCodeWorkspacePath: jest.fn(() => '/project/.vscode/mcp.json'),
  getCursorGlobalPath: jest.fn(() => '/home/user/.config/Cursor/User/globalStorage/mcp.json'),
  getCursorProjectPath: jest.fn(() => '/project/.cursor/mcp.json'),
  getWindsurfPath: jest.fn(() => '/home/user/.codeium/windsurf/mcp_config.json'),
  getCopilotCliPath: jest.fn(() => '/home/user/.config/github-copilot/mcp.json'),
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

describe('ClaudeDesktopAdapter - Complete Branch Coverage', () => {
  let adapter: ClaudeDesktopAdapter;

  beforeEach(() => {
    adapter = new ClaudeDesktopAdapter();
    jest.clearAllMocks();
  });

  it('should handle convertFromOverture with all override branches', () => {
    const overtureConfig: OvertureConfig = {
      version: '2.0',
      mcp: {
        withPlatformCommand: {
          command: 'base-cmd',
          args: ['base-arg'],
          env: {},
          transport: 'stdio',
          platforms: {
            commandOverrides: {
              darwin: 'darwin-cmd',
            },
          },
        },
        withPlatformArgs: {
          command: 'cmd',
          args: ['base'],
          env: {},
          transport: 'stdio',
          platforms: {
            argsOverrides: {
              darwin: ['darwin-arg1', 'darwin-arg2'],
            },
          },
        },
        withClientOverride: {
          command: 'base',
          args: ['base'],
          env: { BASE: 'val' },
          transport: 'stdio',
          clients: {
            overrides: {
              'claude-desktop': {
                command: 'override-cmd',
                args: ['override-arg'],
                env: { OVERRIDE: 'val' },
              },
            },
          },
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'darwin');
    expect(result.mcpServers.withPlatformCommand.command).toBe('darwin-cmd');
    expect(result.mcpServers.withPlatformArgs.args).toEqual(['darwin-arg1', 'darwin-arg2']);
    expect(result.mcpServers.withClientOverride.command).toBe('override-cmd');
    expect(result.mcpServers.withClientOverride.args).toEqual(['override-arg']);
    expect(result.mcpServers.withClientOverride.env).toEqual({ BASE: 'val', OVERRIDE: 'val' });
  });

  it('should omit env when empty after overrides', () => {
    const overtureConfig: OvertureConfig = {
      version: '2.0',
      mcp: {
        test: {
          command: 'test',
          args: [],
          env: {},
          transport: 'stdio',
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'darwin');
    expect(result.mcpServers.test.env).toBeUndefined();
  });

  it('should read config and handle missing mcpServers key', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ other: 'data' }));

    const config = adapter.readConfig('/test/path');
    expect(config).toEqual({ mcpServers: {} });
  });

  it('should write config and create directory', () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);

    adapter.writeConfig('/path/to/config.json', { mcpServers: {} });
    expect(mockFs.mkdirSync).toHaveBeenCalledWith('/path/to', { recursive: true });
  });
});

describe('CopilotCliAdapter - Complete Branch Coverage', () => {
  let adapter: CopilotCliAdapter;

  beforeEach(() => {
    adapter = new CopilotCliAdapter();
    jest.clearAllMocks();
  });

  it('should handle all override branches', () => {
    const overtureConfig: OvertureConfig = {
      version: '2.0',
      mcp: {
        test: {
          command: 'base',
          args: ['base'],
          env: { BASE: 'val' },
          transport: 'stdio',
          platforms: {
            commandOverrides: { linux: 'linux-cmd' },
            argsOverrides: { linux: ['linux-arg'] },
          },
          clients: {
            overrides: {
              'copilot-cli': {
                command: 'copilot-cmd',
                args: ['copilot-arg'],
                env: { COPILOT: 'val' },
              },
            },
          },
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.mcpServers.test.command).toBe('copilot-cmd');
    expect(result.mcpServers.test.args).toEqual(['copilot-arg']);
    expect(result.mcpServers.test.env).toEqual({ BASE: 'val', COPILOT: 'val' });
  });

  it('should handle missing mcpServers key in config', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ other: {} }));

    const config = adapter.readConfig('/test/path');
    expect(config).toEqual({ mcpServers: {} });
  });

  it('should create directory when writing', () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);

    adapter.writeConfig('/test/mcp.json', { mcpServers: {} });
    expect(mockFs.mkdirSync).toHaveBeenCalled();
  });
});

describe('WindsurfAdapter - Complete Branch Coverage', () => {
  let adapter: WindsurfAdapter;

  beforeEach(() => {
    adapter = new WindsurfAdapter();
    jest.clearAllMocks();
  });

  it('should handle all override branches', () => {
    const overtureConfig: OvertureConfig = {
      version: '2.0',
      mcp: {
        test: {
          command: 'base',
          args: ['base'],
          env: { BASE: 'val' },
          transport: 'stdio',
          platforms: {
            commandOverrides: { linux: 'linux-cmd' },
            argsOverrides: { linux: ['linux-arg'] },
          },
          clients: {
            overrides: {
              windsurf: {
                command: 'windsurf-cmd',
                args: ['windsurf-arg'],
                env: { WINDSURF: 'val' },
              },
            },
          },
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.mcpServers.test.command).toBe('windsurf-cmd');
    expect(result.mcpServers.test.args).toEqual(['windsurf-arg']);
    expect(result.mcpServers.test.env).toEqual({ BASE: 'val', WINDSURF: 'val' });
  });

  it('should handle missing mcpServers key', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({}));

    const config = adapter.readConfig('/test/path');
    expect(config).toEqual({ mcpServers: {} });
  });

  it('should create directory when needed', () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);

    adapter.writeConfig('/home/user/.codeium/windsurf/mcp_config.json', { mcpServers: {} });
    expect(mockFs.mkdirSync).toHaveBeenCalledWith('/home/user/.codeium/windsurf', { recursive: true });
  });
});

describe('JetBrainsCopilotAdapter - Complete Branch Coverage', () => {
  let adapter: JetBrainsCopilotAdapter;

  beforeEach(() => {
    adapter = new JetBrainsCopilotAdapter();
    jest.clearAllMocks();
    process.env.TEST_TOKEN = 'token-value';
  });

  afterEach(() => {
    delete process.env.TEST_TOKEN;
  });

  it('should handle all override branches with env expansion', () => {
    const overtureConfig: OvertureConfig = {
      version: '2.0',
      mcp: {
        test: {
          command: 'base',
          args: ['base'],
          env: { BASE: 'val', TOKEN: '${TEST_TOKEN}' },
          transport: 'stdio',
          platforms: {
            commandOverrides: { linux: 'linux-cmd' },
            argsOverrides: { linux: ['linux-arg'] },
          },
          clients: {
            overrides: {
              'jetbrains-copilot': {
                command: 'jetbrains-cmd',
                args: ['jetbrains-arg'],
                env: { JETBRAINS: 'val' },
              },
            },
          },
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.mcpServers.test.command).toBe('jetbrains-cmd');
    expect(result.mcpServers.test.args).toEqual(['jetbrains-arg']);
    expect(result.mcpServers.test.env?.JETBRAINS).toBe('val');
    expect(result.mcpServers.test.env?.TOKEN).toBe('token-value');
  });

  it('should handle missing mcpServers key', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ unrelated: {} }));

    const config = adapter.readConfig('/test/path');
    expect(config).toEqual({ mcpServers: {} });
  });

  it('should create directory when writing', () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);

    adapter.writeConfig('/test/mcp.json', { mcpServers: {} });
    expect(mockFs.mkdirSync).toHaveBeenCalled();
  });
});

describe('VSCodeAdapter - Complete Branch Coverage', () => {
  let adapter: VSCodeAdapter;

  beforeEach(() => {
    adapter = new VSCodeAdapter();
    jest.clearAllMocks();
    process.env.API_KEY = 'api-key-value';
  });

  afterEach(() => {
    delete process.env.API_KEY;
  });

  it('should handle all override branches with env expansion', () => {
    const overtureConfig: OvertureConfig = {
      version: '2.0',
      mcp: {
        test: {
          command: 'base',
          args: ['base'],
          env: { BASE: 'val', KEY: '${API_KEY}' },
          transport: 'stdio',
          platforms: {
            commandOverrides: { linux: 'linux-cmd' },
            argsOverrides: { linux: ['linux-arg'] },
          },
          clients: {
            overrides: {
              vscode: {
                command: 'vscode-cmd',
                args: ['vscode-arg'],
                env: { VSCODE: 'val' },
                transport: 'http',
              },
            },
          },
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.servers.test.command).toBe('vscode-cmd');
    expect(result.servers.test.args).toEqual(['vscode-arg']);
    expect(result.servers.test.type).toBe('http');
    expect(result.servers.test.env?.VSCODE).toBe('val');
    expect(result.servers.test.env?.KEY).toBe('api-key-value');
  });

  it('should handle missing servers key', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ wrong: {} }));

    const config = adapter.readConfig('/test/path');
    expect(config).toEqual({ servers: {} });
  });

  it('should create directory when writing', () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);

    adapter.writeConfig('/test/mcp.json', { servers: {} });
    expect(mockFs.mkdirSync).toHaveBeenCalled();
  });
});

describe('CursorAdapter - Complete Branch Coverage', () => {
  let adapter: CursorAdapter;

  beforeEach(() => {
    adapter = new CursorAdapter();
    jest.clearAllMocks();
  });

  it('should handle all override branches', () => {
    const overtureConfig: OvertureConfig = {
      version: '2.0',
      mcp: {
        test: {
          command: 'base',
          args: ['base'],
          env: { BASE: 'val' },
          transport: 'stdio',
          platforms: {
            commandOverrides: { linux: 'linux-cmd' },
            argsOverrides: { linux: ['linux-arg'] },
          },
          clients: {
            overrides: {
              cursor: {
                command: 'cursor-cmd',
                args: ['cursor-arg'],
                env: { CURSOR: 'val' },
              },
            },
          },
        },
      },
    };

    const result = adapter.convertFromOverture(overtureConfig, 'linux');
    expect(result.mcpServers.test.command).toBe('cursor-cmd');
    expect(result.mcpServers.test.args).toEqual(['cursor-arg']);
    expect(result.mcpServers.test.env).toEqual({ BASE: 'val', CURSOR: 'val' });
  });

  it('should handle missing mcpServers key', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ bad: {} }));

    const config = adapter.readConfig('/test/path');
    expect(config).toEqual({ mcpServers: {} });
  });

  it('should create directory when writing', () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);

    adapter.writeConfig('/test/config.json', { mcpServers: {} });
    expect(mockFs.mkdirSync).toHaveBeenCalled();
  });
});

describe('AdapterRegistry - Complete Coverage', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  it('should handle getAdapterForClient with unregistered adapter', () => {
    const { getAdapterForClient } = require('./adapter-registry');

    expect(() => getAdapterForClient('claude-code')).toThrow('No adapter registered for client: claude-code');
  });

  it('should return installed adapters correctly', () => {
    const mockAdapter1 = {
      name: 'claude-code' as const,
      schemaRootKey: 'mcpServers' as const,
      detectConfigPath: jest.fn(() => '/path'),
      readConfig: jest.fn(),
      writeConfig: jest.fn(),
      convertFromOverture: jest.fn(),
      supportsTransport: jest.fn(),
      needsEnvVarExpansion: jest.fn(),
      isInstalled: jest.fn(() => true),
    };

    const mockAdapter2 = {
      name: 'vscode' as const,
      schemaRootKey: 'servers' as const,
      detectConfigPath: jest.fn(() => null),
      readConfig: jest.fn(),
      writeConfig: jest.fn(),
      convertFromOverture: jest.fn(),
      supportsTransport: jest.fn(),
      needsEnvVarExpansion: jest.fn(),
      isInstalled: jest.fn(() => false),
    };

    registry.register(mockAdapter1);
    registry.register(mockAdapter2);

    const installed = registry.getInstalledAdapters('linux');
    expect(installed).toHaveLength(1);
    expect(installed[0].name).toBe('claude-code');
  });
});
