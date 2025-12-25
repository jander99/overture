/**
 * Client Adapters Tests
 *
 * Tests for the client adapters library structure, factory, and DI.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { EnvironmentPort } from '@overture/ports-process';
import {
  createAdapterRegistry,
  createAdapter,
  ClaudeCodeAdapter,
  AdapterRegistry,
  getAdapterForClient,
} from '../index.js';

/**
 * Create a mock filesystem port for testing
 */
function createMockFilesystem(): FilesystemPort {
  return {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    exists: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    rm: vi.fn(),
  };
}

/**
 * Create a mock environment port for testing
 */
function createMockEnvironment(): EnvironmentPort {
  return {
    platform: vi.fn(() => 'linux'),
    homedir: vi.fn(() => '/home/user'),
    cwd: vi.fn(() => '/home/user/project'),
    env: {
      HOME: '/home/user',
      XDG_CONFIG_HOME: '/home/user/.config',
    },
  };
}

describe('@overture/client-adapters', () => {
  let filesystem: FilesystemPort;
  let environment: EnvironmentPort;

  beforeEach(() => {
    filesystem = createMockFilesystem();
    environment = createMockEnvironment();
  });

  describe('createAdapterRegistry', () => {
    it('should create registry with all 3 client adapters registered', () => {
      const registry = createAdapterRegistry(filesystem, environment);

      expect(registry).toBeInstanceOf(AdapterRegistry);
      expect(registry.size).toBe(3); // ClaudeCodeAdapter, CopilotCliAdapter, and OpenCodeAdapter
      expect(registry.has('claude-code')).toBe(true);
      expect(registry.has('copilot-cli')).toBe(true);
      expect(registry.has('opencode')).toBe(true);
    });

    it('should inject filesystem port into adapters', () => {
      const registry = createAdapterRegistry(filesystem, environment);
      const adapter = registry.get('claude-code');

      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(ClaudeCodeAdapter);
    });
  });

  describe('createAdapter', () => {
    it('should create ClaudeCodeAdapter with DI', () => {
      const adapter = createAdapter('claude-code', filesystem, environment);

      expect(adapter).toBeInstanceOf(ClaudeCodeAdapter);
      expect(adapter.name).toBe('claude-code');
    });

    it('should throw for unknown adapter', () => {
      expect(() =>
        createAdapter('unknown-adapter' as never, filesystem, environment),
      ).toThrow('Unknown adapter');
    });
  });

  describe('AdapterRegistry', () => {
    let registry: AdapterRegistry;

    beforeEach(() => {
      registry = new AdapterRegistry();
    });

    it('should register and retrieve adapter', () => {
      const adapter = new ClaudeCodeAdapter(filesystem, environment);
      registry.register(adapter);

      expect(registry.get('claude-code')).toBe(adapter);
      expect(registry.has('claude-code')).toBe(true);
    });

    it('should return all registered adapters', () => {
      const adapter = new ClaudeCodeAdapter(filesystem, environment);
      registry.register(adapter);

      const all = registry.getAll();
      expect(all).toHaveLength(1);
      expect(all[0]).toBe(adapter);
    });

    it('should return all registered names', () => {
      const adapter = new ClaudeCodeAdapter(filesystem, environment);
      registry.register(adapter);

      const names = registry.getAllNames();
      expect(names).toEqual(['claude-code']);
    });

    it('should clear all adapters', () => {
      const adapter = new ClaudeCodeAdapter(filesystem, environment);
      registry.register(adapter);
      expect(registry.size).toBe(1);

      registry.clear();
      expect(registry.size).toBe(0);
    });

    it('should detect installed clients (integration with adapter)', () => {
      const adapter = new ClaudeCodeAdapter(filesystem, environment);
      registry.register(adapter);

      // Mock detectConfigPath to return non-null (client installed)
      const installed = registry.detectInstalledClients('linux');
      expect(Array.isArray(installed)).toBe(true);
    });
  });

  describe('getAdapterForClient', () => {
    let registry: AdapterRegistry;

    beforeEach(() => {
      registry = createAdapterRegistry(filesystem, environment);
    });

    it('should return adapter for registered client', () => {
      const adapter = getAdapterForClient(registry, 'claude-code');

      expect(adapter).toBeInstanceOf(ClaudeCodeAdapter);
      expect(adapter.name).toBe('claude-code');
    });

    it('should throw for unregistered client', () => {
      expect(() =>
        getAdapterForClient(registry, 'unknown-client' as never),
      ).toThrow('No adapter registered for client: unknown-client');
    });
  });

  describe('ClaudeCodeAdapter', () => {
    let adapter: ClaudeCodeAdapter;

    beforeEach(() => {
      adapter = new ClaudeCodeAdapter(filesystem, environment);
    });

    it('should have correct metadata', () => {
      expect(adapter.name).toBe('claude-code');
      expect(adapter.schemaRootKey).toBe('mcpServers');
    });

    it('should detect config paths', () => {
      const paths = adapter.detectConfigPath('linux');

      expect(paths).toBeDefined();
      expect(typeof paths).toBe('object');
      expect(paths).toHaveProperty('user');
      expect(paths).toHaveProperty('project');
    });

    it('should support all transports', () => {
      expect(adapter.supportsTransport('stdio')).toBe(true);
      expect(adapter.supportsTransport('http')).toBe(true);
      expect(adapter.supportsTransport('sse')).toBe(true);
    });

    it('should not need env var expansion', () => {
      expect(adapter.needsEnvVarExpansion()).toBe(false);
    });

    it('should have claude binary name', () => {
      expect(adapter.getBinaryNames()).toEqual(['claude']);
    });

    it('should require binary', () => {
      expect(adapter.requiresBinary()).toBe(true);
    });

    it('should not have app bundle paths', () => {
      expect(adapter.getAppBundlePaths('linux')).toEqual([]);
      expect(adapter.getAppBundlePaths('darwin')).toEqual([]);
      expect(adapter.getAppBundlePaths('win32')).toEqual([]);
    });

    describe('readConfig', () => {
      it('should return empty config when file does not exist', async () => {
        vi.mocked(filesystem.exists).mockResolvedValue(false);

        const config = await adapter.readConfig('/test/path.json');

        expect(config).toEqual({ mcpServers: {} });
        expect(filesystem.exists).toHaveBeenCalledWith('/test/path.json');
      });

      it('should read and parse existing config', async () => {
        const mockConfig = {
          mcpServers: { test: { command: 'test', args: [] } },
        };
        vi.mocked(filesystem.exists).mockResolvedValue(true);
        vi.mocked(filesystem.readFile).mockResolvedValue(
          JSON.stringify(mockConfig),
        );

        const config = await adapter.readConfig('/test/path.json');

        expect(config).toEqual(mockConfig);
        expect(filesystem.readFile).toHaveBeenCalledWith('/test/path.json');
      });

      it('should add mcpServers key if missing', async () => {
        vi.mocked(filesystem.exists).mockResolvedValue(true);
        vi.mocked(filesystem.readFile).mockResolvedValue('{}');

        const config = await adapter.readConfig('/test/path.json');

        expect(config).toEqual({ mcpServers: {} });
      });

      it('should throw on parse error', async () => {
        vi.mocked(filesystem.exists).mockResolvedValue(true);
        vi.mocked(filesystem.readFile).mockResolvedValue('invalid json');

        await expect(adapter.readConfig('/test/path.json')).rejects.toThrow(
          'Failed to read Claude Code config',
        );
      });
    });

    describe('writeConfig', () => {
      it('should create directory if it does not exist', async () => {
        vi.mocked(filesystem.exists).mockResolvedValue(false);
        vi.mocked(filesystem.mkdir).mockResolvedValue(undefined);
        vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

        const config = { mcpServers: {} };
        await adapter.writeConfig('/test/dir/config.json', config);

        expect(filesystem.mkdir).toHaveBeenCalledWith('/test/dir', {
          recursive: true,
        });
        expect(filesystem.writeFile).toHaveBeenCalledWith(
          '/test/dir/config.json',
          JSON.stringify(config, null, 2),
        );
      });

      it('should not create directory if it exists', async () => {
        vi.mocked(filesystem.exists).mockResolvedValue(true);
        vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

        const config = { mcpServers: {} };
        await adapter.writeConfig('/test/dir/config.json', config);

        expect(filesystem.mkdir).not.toHaveBeenCalled();
        expect(filesystem.writeFile).toHaveBeenCalledWith(
          '/test/dir/config.json',
          JSON.stringify(config, null, 2),
        );
      });
    });

    describe('convertFromOverture', () => {
      it('should convert Overture config to client format', () => {
        const overtureConfig = {
          version: '1.0',
          project: { name: 'test', type: 'generic' },
          mcp: {
            'test-server': {
              command: 'test-cmd',
              args: ['arg1', 'arg2'],
              env: { KEY: 'value' },
              transport: 'stdio' as const,
            },
          },
        };

        const clientConfig = adapter.convertFromOverture(
          overtureConfig,
          'linux',
        );

        expect(clientConfig).toEqual({
          mcpServers: {
            'test-server': {
              command: 'test-cmd',
              args: ['arg1', 'arg2'],
              env: { KEY: 'value' },
            },
          },
        });
      });

      it('should exclude MCPs based on platform', () => {
        const overtureConfig = {
          version: '1.0',
          project: { name: 'test', type: 'generic' },
          mcp: {
            'test-server': {
              command: 'test-cmd',
              args: [],
              transport: 'stdio' as const,
              platforms: {
                exclude: ['linux' as const],
              },
            },
          },
        };

        const clientConfig = adapter.convertFromOverture(
          overtureConfig,
          'linux',
        );

        expect(clientConfig).toEqual({ mcpServers: {} });
      });

      it('should exclude MCPs based on client exclusion', () => {
        const overtureConfig = {
          version: '1.0',
          project: { name: 'test', type: 'generic' },
          mcp: {
            'test-server': {
              command: 'test-cmd',
              args: [],
              transport: 'stdio' as const,
              clients: {
                exclude: ['claude-code' as const],
              },
            },
          },
        };

        const clientConfig = adapter.convertFromOverture(
          overtureConfig,
          'linux',
        );

        expect(clientConfig).toEqual({ mcpServers: {} });
      });
    });
  });
});
