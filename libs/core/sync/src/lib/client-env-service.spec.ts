/**
 * Client Environment Service Tests
 *
 * Comprehensive tests for client-aware environment variable expansion.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  shouldExpandEnvVars,
  expandEnvVarsInMcpConfig,
  expandEnvVarsInClientConfig,
  getClientsNeedingExpansion,
  getClientsWithNativeSupport,
} from './client-env-service.js';
import type { ClientAdapter, ClientMcpConfig } from '@overture/client-adapters';
import type { ClientName } from '@overture/config-types';

// Helper to create a mock adapter with configurable env expansion behavior
function createMockAdapter(
  name: string,
  needsExpansion: boolean,
  schemaRootKey: 'mcpServers' | 'servers' | 'mcp' = 'mcpServers',
): ClientAdapter {
  return {
    name: name as ClientName,
    schemaRootKey,
    needsEnvVarExpansion: vi.fn(() => needsExpansion),
    supportsTransport: vi.fn(() => true),
    detectConfigPath: vi.fn(() => null),
    readConfig: vi.fn().mockResolvedValue({ [schemaRootKey]: {} }),
    writeConfig: vi.fn().mockResolvedValue(undefined),
    convertFromOverture: vi.fn(() => ({ [schemaRootKey]: {} })),
    isInstalled: vi.fn(() => true),
    getBinaryNames: vi.fn(() => []),
    getAppBundlePaths: vi.fn(() => []),
    requiresBinary: vi.fn(() => false),
  };
}

describe('shouldExpandEnvVars', () => {
  it('should return true for clients that need expansion', () => {
    const adapter = createMockAdapter('vscode', true);
    expect(shouldExpandEnvVars(adapter)).toBe(true);
    expect(adapter.needsEnvVarExpansion).toHaveBeenCalled();
  });

  it('should return false for clients with native support', () => {
    const adapter = createMockAdapter('claude-code', false);
    expect(shouldExpandEnvVars(adapter)).toBe(false);
  });
});

describe('expandEnvVarsInMcpConfig', () => {
  const testEnv = {
    HOME: '/home/user',
    GITHUB_TOKEN: 'ghp_test123',
    API_URL: 'https://api.example.com',
  };

  it('should expand env vars when client needs expansion', () => {
    const adapter = createMockAdapter('vscode', true);
    const mcpConfig = {
      command: '${HOME}/bin/mcp-server',
      args: ['--token', '${GITHUB_TOKEN}'],
      env: { API: '${API_URL}' },
    };

    const result = expandEnvVarsInMcpConfig(mcpConfig, adapter, testEnv);

    expect(result.command).toBe('/home/user/bin/mcp-server');
    expect(result.args).toEqual(['--token', 'ghp_test123']);
    expect(result.env).toEqual({ API: 'https://api.example.com' });
  });

  it('should not expand env vars when client has native support', () => {
    const adapter = createMockAdapter('claude-code', false);
    const mcpConfig = {
      command: '${HOME}/bin/mcp-server',
      args: ['--token', '${GITHUB_TOKEN}'],
      env: { API: '${API_URL}' },
    };

    const result = expandEnvVarsInMcpConfig(mcpConfig, adapter, testEnv);

    expect(result).toBe(mcpConfig); // Should return exact same object
    expect(result.command).toBe('${HOME}/bin/mcp-server');
  });

  it('should handle MCP config without env field', () => {
    const adapter = createMockAdapter('vscode', true);
    const mcpConfig = {
      command: 'mcp-server',
      args: ['--verbose'],
    };

    const result = expandEnvVarsInMcpConfig(mcpConfig, adapter, testEnv);

    expect(result.command).toBe('mcp-server');
    expect(result.args).toEqual(['--verbose']);
  });

  it('should handle MCP config without args', () => {
    const adapter = createMockAdapter('vscode', true);
    const mcpConfig = {
      command: '${HOME}/bin/mcp',
    };

    const result = expandEnvVarsInMcpConfig(mcpConfig, adapter, testEnv);

    expect(result.command).toBe('/home/user/bin/mcp');
  });

  it('should use default values for missing env vars', () => {
    const adapter = createMockAdapter('vscode', true);
    const mcpConfig = {
      command: 'mcp-server',
      args: ['${MISSING:-default-value}'],
    };

    const result = expandEnvVarsInMcpConfig(mcpConfig, adapter, testEnv);

    expect(result.args).toEqual(['default-value']);
  });
});

describe('expandEnvVarsInClientConfig', () => {
  const testEnv = {
    HOME: '/home/user',
    TOKEN: 'secret123',
  };

  it('should expand env vars in all MCP configs when client needs expansion', () => {
    const adapter = createMockAdapter('vscode', true);
    const config: ClientMcpConfig = {
      mcpServers: {
        github: {
          command: '${HOME}/mcp-github',
          args: ['--token', '${TOKEN}'],
        },
        filesystem: {
          command: 'npx',
          args: ['-y', '@mcp/fs', '${HOME}'],
        },
      },
    };

    const result = expandEnvVarsInClientConfig(config, adapter, testEnv);

    expect(result.mcpServers['github'].command).toBe('/home/user/mcp-github');
    expect(result.mcpServers['github'].args).toEqual(['--token', 'secret123']);
    expect(result.mcpServers['filesystem'].args).toContain('/home/user');
  });

  it('should not modify config when client has native support', () => {
    const adapter = createMockAdapter('claude-code', false);
    const config: ClientMcpConfig = {
      mcpServers: {
        github: {
          command: '${HOME}/mcp-github',
          args: ['--token', '${TOKEN}'],
        },
      },
    };

    const result = expandEnvVarsInClientConfig(config, adapter, testEnv);

    expect(result).toBe(config);
  });

  it('should handle different schema root keys', () => {
    const adapter = createMockAdapter('opencode', true, 'mcp');
    const config: ClientMcpConfig = {
      mcp: {
        github: {
          command: '${HOME}/mcp-github',
          args: [],
        },
      },
    };

    const result = expandEnvVarsInClientConfig(config, adapter, testEnv);

    expect(result.mcp['github'].command).toBe('/home/user/mcp-github');
  });

  it('should handle empty MCP servers', () => {
    const adapter = createMockAdapter('vscode', true);
    const config: ClientMcpConfig = {
      mcpServers: {},
    };

    const result = expandEnvVarsInClientConfig(config, adapter, testEnv);

    expect(result.mcpServers).toEqual({});
  });

  it('should handle missing root key in config', () => {
    const adapter = createMockAdapter('vscode', true);
    const config: ClientMcpConfig = {};

    const result = expandEnvVarsInClientConfig(config, adapter, testEnv);

    expect(result.mcpServers).toEqual({});
  });
});

describe('getClientsNeedingExpansion', () => {
  it('should return clients that need env var expansion', () => {
    const clients = [
      createMockAdapter('claude-code', false),
      createMockAdapter('vscode', true),
      createMockAdapter('jetbrains', true),
    ];

    const result = getClientsNeedingExpansion(clients);

    expect(result).toEqual(['vscode', 'jetbrains']);
  });

  it('should return empty array when no clients need expansion', () => {
    const clients = [
      createMockAdapter('claude-code', false),
      createMockAdapter('cursor', false),
    ];

    const result = getClientsNeedingExpansion(clients);

    expect(result).toEqual([]);
  });

  it('should handle empty client list', () => {
    const result = getClientsNeedingExpansion([]);
    expect(result).toEqual([]);
  });
});

describe('getClientsWithNativeSupport', () => {
  it('should return clients with native env var support', () => {
    const clients = [
      createMockAdapter('claude-code', false),
      createMockAdapter('vscode', true),
      createMockAdapter('cursor', false),
    ];

    const result = getClientsWithNativeSupport(clients);

    expect(result).toEqual(['claude-code', 'cursor']);
  });

  it('should return empty array when all clients need expansion', () => {
    const clients = [
      createMockAdapter('vscode', true),
      createMockAdapter('jetbrains', true),
    ];

    const result = getClientsWithNativeSupport(clients);

    expect(result).toEqual([]);
  });

  it('should handle empty client list', () => {
    const result = getClientsWithNativeSupport([]);
    expect(result).toEqual([]);
  });
});
