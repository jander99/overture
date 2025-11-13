/**
 * Client-Aware Env Service Tests
 *
 * @module core/client-env-service.spec
 */

import {
  shouldExpandEnvVars,
  expandEnvVarsInMcpConfig,
  expandEnvVarsInClientConfig,
  getClientsNeedingExpansion,
  getClientsWithNativeSupport,
} from './client-env-service';
import type { ClientAdapter } from '../adapters/client-adapter.interface';
import type { ClientMcpConfig } from '../adapters/client-adapter.interface';

// Mock client adapters
const createMockAdapter = (name: string, needsExpansion: boolean): ClientAdapter => ({
  name: name as any,
  schemaRootKey: 'mcpServers',
  detectConfigPath: jest.fn(),
  readConfig: jest.fn(),
  writeConfig: jest.fn(),
  convertFromOverture: jest.fn(),
  supportsTransport: jest.fn(),
  needsEnvVarExpansion: jest.fn(() => needsExpansion),
  isInstalled: jest.fn(() => true),
});

describe('Client Env Service', () => {
  const testEnv = {
    HOME: '/home/user',
    GITHUB_TOKEN: 'ghp_test123',
    USER: 'testuser',
  };

  describe('shouldExpandEnvVars', () => {
    it('should return true for clients needing expansion', () => {
      const adapter = createMockAdapter('vscode', true);
      expect(shouldExpandEnvVars(adapter)).toBe(true);
    });

    it('should return false for clients with native support', () => {
      const adapter = createMockAdapter('claude-code', false);
      expect(shouldExpandEnvVars(adapter)).toBe(false);
    });
  });

  describe('expandEnvVarsInMcpConfig', () => {
    it('should expand env vars for clients needing expansion', () => {
      const adapter = createMockAdapter('vscode', true);

      const mcpConfig = {
        command: '${HOME}/bin/mcp-server',
        args: ['--token', '${GITHUB_TOKEN}'],
        env: {
          USER: '${USER}',
          PATH: '${HOME}/bin',
        },
      };

      const result = expandEnvVarsInMcpConfig(mcpConfig, adapter, testEnv);

      expect(result.command).toBe('/home/user/bin/mcp-server');
      expect(result.args).toEqual(['--token', 'ghp_test123']);
      expect(result.env).toEqual({
        USER: 'testuser',
        PATH: '/home/user/bin',
      });
    });

    it('should not expand for clients with native support', () => {
      const adapter = createMockAdapter('claude-code', false);

      const mcpConfig = {
        command: '${HOME}/bin/mcp-server',
        args: ['--token', '${GITHUB_TOKEN}'],
        env: {
          USER: '${USER}',
        },
      };

      const result = expandEnvVarsInMcpConfig(mcpConfig, adapter, testEnv);

      expect(result.command).toBe('${HOME}/bin/mcp-server');
      expect(result.args).toEqual(['--token', '${GITHUB_TOKEN}']);
      expect(result.env).toEqual({ USER: '${USER}' });
    });

    it('should handle configs without env vars', () => {
      const adapter = createMockAdapter('vscode', true);

      const mcpConfig = {
        command: 'npx',
        args: ['mcp-server'],
        env: {},
      };

      const result = expandEnvVarsInMcpConfig(mcpConfig, adapter, testEnv);

      expect(result).toEqual(mcpConfig);
    });

    it('should handle default values', () => {
      const adapter = createMockAdapter('vscode', true);

      const mcpConfig = {
        command: 'cmd',
        args: ['--path', '${MISSING:-/default/path}'],
        env: {},
      };

      const result = expandEnvVarsInMcpConfig(mcpConfig, adapter, testEnv);

      expect(result.args).toEqual(['--path', '/default/path']);
    });

    it('should handle missing env vars without defaults', () => {
      const adapter = createMockAdapter('vscode', true);

      const mcpConfig = {
        command: 'cmd',
        args: ['--token', '${MISSING_TOKEN}'],
        env: {},
      };

      const result = expandEnvVarsInMcpConfig(mcpConfig, adapter, testEnv);

      expect(result.args).toEqual(['--token', '']);
    });

    it('should preserve non-string values', () => {
      const adapter = createMockAdapter('vscode', true);

      const mcpConfig = {
        command: 'cmd',
        args: ['--port', '8080'],
        env: {
          DEBUG: 'true',
        },
        timeout: 5000,
      };

      const result = expandEnvVarsInMcpConfig(mcpConfig, adapter, testEnv);

      expect(result.timeout).toBe(5000);
    });
  });

  describe('expandEnvVarsInClientConfig', () => {
    it('should expand all MCPs for clients needing expansion', () => {
      const adapter = createMockAdapter('vscode', true);

      const config: ClientMcpConfig = {
        mcpServers: {
          github: {
            command: '${HOME}/bin/gh',
            args: ['--token', '${GITHUB_TOKEN}'],
            env: {},
          },
          filesystem: {
            command: 'fs-server',
            args: ['--root', '${HOME}'],
            env: {
              USER: '${USER}',
            },
          },
        },
      };

      const result = expandEnvVarsInClientConfig(config, adapter, testEnv);

      expect(result.mcpServers.github.command).toBe('/home/user/bin/gh');
      expect(result.mcpServers.github.args).toEqual(['--token', 'ghp_test123']);
      expect(result.mcpServers.filesystem.args).toEqual(['--root', '/home/user']);
      expect(result.mcpServers.filesystem.env).toEqual({ USER: 'testuser' });
    });

    it('should not expand for clients with native support', () => {
      const adapter = createMockAdapter('claude-code', false);

      const config: ClientMcpConfig = {
        mcpServers: {
          github: {
            command: '${HOME}/bin/gh',
            args: ['--token', '${GITHUB_TOKEN}'],
            env: {},
          },
        },
      };

      const result = expandEnvVarsInClientConfig(config, adapter, testEnv);

      expect(result.mcpServers.github.command).toBe('${HOME}/bin/gh');
      expect(result.mcpServers.github.args).toEqual(['--token', '${GITHUB_TOKEN}']);
    });

    it('should handle empty config', () => {
      const adapter = createMockAdapter('vscode', true);

      const config: ClientMcpConfig = {
        mcpServers: {},
      };

      const result = expandEnvVarsInClientConfig(config, adapter, testEnv);

      expect(result).toEqual({ mcpServers: {} });
    });

    it('should work with "servers" root key (VS Code)', () => {
      const adapter = createMockAdapter('vscode', true);
      (adapter as any).schemaRootKey = 'servers';

      const config: ClientMcpConfig = {
        servers: {
          github: {
            command: '${HOME}/bin/gh',
            args: [],
            type: 'stdio',
            env: {},
          },
        },
      };

      const result = expandEnvVarsInClientConfig(config, adapter, testEnv);

      expect(result.servers.github.command).toBe('/home/user/bin/gh');
    });

    it('should preserve config structure and metadata', () => {
      const adapter = createMockAdapter('vscode', true);

      const config: ClientMcpConfig = {
        mcpServers: {
          github: {
            command: '${HOME}/bin/gh',
            args: [],
            env: {},
          },
        },
        metadata: { version: '1.0' },
      };

      const result = expandEnvVarsInClientConfig(config, adapter, testEnv);

      expect(result.metadata).toEqual({ version: '1.0' });
    });
  });

  describe('getClientsNeedingExpansion', () => {
    it('should return clients needing expansion', () => {
      const clients = [
        createMockAdapter('claude-code', false),
        createMockAdapter('vscode', true),
        createMockAdapter('cursor', false),
        createMockAdapter('jetbrains-copilot', true),
      ];

      const result = getClientsNeedingExpansion(clients);

      expect(result).toEqual(['vscode', 'jetbrains-copilot']);
    });

    it('should return empty array if no clients need expansion', () => {
      const clients = [
        createMockAdapter('claude-code', false),
        createMockAdapter('cursor', false),
      ];

      const result = getClientsNeedingExpansion(clients);

      expect(result).toEqual([]);
    });

    it('should handle empty array', () => {
      expect(getClientsNeedingExpansion([])).toEqual([]);
    });
  });

  describe('getClientsWithNativeSupport', () => {
    it('should return clients with native support', () => {
      const clients = [
        createMockAdapter('claude-code', false),
        createMockAdapter('vscode', true),
        createMockAdapter('cursor', false),
        createMockAdapter('jetbrains-copilot', true),
      ];

      const result = getClientsWithNativeSupport(clients);

      expect(result).toEqual(['claude-code', 'cursor']);
    });

    it('should return empty array if all clients need expansion', () => {
      const clients = [
        createMockAdapter('vscode', true),
        createMockAdapter('jetbrains-copilot', true),
      ];

      const result = getClientsWithNativeSupport(clients);

      expect(result).toEqual([]);
    });

    it('should handle empty array', () => {
      expect(getClientsWithNativeSupport([])).toEqual([]);
    });
  });

  describe('Client-specific behavior', () => {
    it('should match VS Code behavior (needs expansion)', () => {
      const adapter = createMockAdapter('vscode', true);

      expect(shouldExpandEnvVars(adapter)).toBe(true);

      const config = {
        command: '${HOME}/bin/cmd',
        args: ['${USER}'],
        env: { TOKEN: '${GITHUB_TOKEN}' },
      };

      const result = expandEnvVarsInMcpConfig(config, adapter, testEnv);

      expect(result.command).toBe('/home/user/bin/cmd');
      expect(result.args).toEqual(['testuser']);
      expect(result.env).toEqual({ TOKEN: 'ghp_test123' });
    });

    it('should match Claude Code behavior (native support)', () => {
      const adapter = createMockAdapter('claude-code', false);

      expect(shouldExpandEnvVars(adapter)).toBe(false);

      const config = {
        command: '${HOME}/bin/cmd',
        args: ['${USER}'],
        env: { TOKEN: '${GITHUB_TOKEN}' },
      };

      const result = expandEnvVarsInMcpConfig(config, adapter, testEnv);

      // Config unchanged - client handles expansion
      expect(result).toEqual(config);
    });

    it('should match JetBrains behavior (needs expansion)', () => {
      const adapter = createMockAdapter('jetbrains-copilot', true);

      expect(shouldExpandEnvVars(adapter)).toBe(true);

      const config = {
        command: 'npx',
        args: ['--prefix', '${HOME}/.local'],
        env: {},
      };

      const result = expandEnvVarsInMcpConfig(config, adapter, testEnv);

      expect(result.args).toEqual(['--prefix', '/home/user/.local']);
    });
  });
});
