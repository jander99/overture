/**
 * OpenCode Adapter Tests
 *
 * Comprehensive test suite for OpenCodeAdapter with ≥85% coverage target.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { EnvironmentPort } from '@overture/ports-process';
import { OpenCodeAdapter } from './opencode.adapter.js';
import type { OvertureConfig } from '@overture/config-types';

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
      APPDATA: 'C:\\Users\\user\\AppData\\Roaming',
      PWD: '/home/user/project',
    },
  };
}

describe('OpenCodeAdapter', () => {
  let adapter: OpenCodeAdapter;
  let filesystem: FilesystemPort;
  let environment: EnvironmentPort;

  beforeEach(() => {
    filesystem = createMockFilesystem();
    environment = createMockEnvironment();
    adapter = new OpenCodeAdapter(filesystem, environment);
  });

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(adapter.name).toBe('opencode');
    });

    it('should have correct schemaRootKey', () => {
      expect(adapter.schemaRootKey).toBe('mcp');
    });
  });

  describe('detectConfigPath', () => {
    it('should detect Linux user path correctly', () => {
      const paths = adapter.detectConfigPath('linux');

      expect(paths).toEqual({
        user: '/home/user/.config/opencode/opencode.json',
        project: '/home/user/project/opencode.json',
      });
    });

    it('should detect macOS user path correctly', () => {
      const paths = adapter.detectConfigPath('darwin');

      expect(paths).toEqual({
        user: '/home/user/.config/opencode/opencode.json',
        project: '/home/user/project/opencode.json',
      });
    });

    it('should detect Windows user path correctly', () => {
      const paths = adapter.detectConfigPath('win32');

      expect(paths).toEqual({
        user: 'C:\\Users\\user\\AppData\\Roaming/opencode/opencode.json',
        project: '/home/user/project/opencode.json',
      });
    });

    it('should use custom project root when provided', () => {
      const paths = adapter.detectConfigPath('linux', '/custom/project');

      expect(paths).toEqual({
        user: '/home/user/.config/opencode/opencode.json',
        project: '/custom/project/opencode.json',
      });
    });

    it('should return correct path structure', () => {
      const paths = adapter.detectConfigPath('linux');

      expect(paths).toHaveProperty('user');
      expect(paths).toHaveProperty('project');
      expect(typeof paths).toBe('object');
    });
  });

  describe('readConfig', () => {
    it('should return empty config when file does not exist', async () => {
      vi.mocked(filesystem.exists).mockResolvedValue(false);

      const config = await adapter.readConfig('/test/path.json');

      expect(config).toEqual({ mcp: {} });
      expect(filesystem.exists).toHaveBeenCalledWith('/test/path.json');
    });

    it('should read and parse existing config', async () => {
      const mockConfig = {
        mcp: {
          'test-server': {
            type: 'local',
            enabled: true,
            command: ['npx', 'test-server'],
            environment: { API_KEY: '{env:MY_KEY}' },
          },
        },
      };
      vi.mocked(filesystem.exists).mockResolvedValue(true);
      vi.mocked(filesystem.readFile).mockResolvedValue(
        JSON.stringify(mockConfig),
      );

      const config = await adapter.readConfig('/test/path.json');

      expect(config).toEqual(mockConfig);
      expect(filesystem.readFile).toHaveBeenCalledWith('/test/path.json');
    });

    it('should add mcp key if missing', async () => {
      vi.mocked(filesystem.exists).mockResolvedValue(true);
      vi.mocked(filesystem.readFile).mockResolvedValue('{}');

      const config = await adapter.readConfig('/test/path.json');

      expect(config).toEqual({ mcp: {} });
    });

    it('should throw McpError on parse error', async () => {
      vi.mocked(filesystem.exists).mockResolvedValue(true);
      vi.mocked(filesystem.readFile).mockResolvedValue('invalid json');

      await expect(adapter.readConfig('/test/path.json')).rejects.toThrow(
        'Failed to read OpenCode config',
      );
    });

    it('should handle config with other sections', async () => {
      const mockConfig = {
        model: 'anthropic/claude-sonnet-4-5',
        theme: 'custom-theme',
        agent: { 'my-agent': { description: 'Test' } },
        mcp: { 'test-server': { type: 'local', command: ['test'] } },
      };
      vi.mocked(filesystem.exists).mockResolvedValue(true);
      vi.mocked(filesystem.readFile).mockResolvedValue(
        JSON.stringify(mockConfig),
      );

      const config = await adapter.readConfig('/test/path.json');

      expect(config).toEqual(mockConfig);
      expect(config.mcp).toBeDefined();
    });
  });

  describe('writeConfig', () => {
    it('should create directory if it does not exist', async () => {
      vi.mocked(filesystem.exists).mockResolvedValue(false);
      vi.mocked(filesystem.mkdir).mockResolvedValue(undefined);
      vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

      const config = { mcp: {} };
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
      vi.mocked(filesystem.exists)
        .mockResolvedValueOnce(false) // file doesn't exist
        .mockResolvedValueOnce(true); // dir exists
      vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

      const config = {
        mcp: { test: { command: 'cmd', args: [], type: 'local' } },
      };
      await adapter.writeConfig('/test/dir/config.json', config);

      expect(filesystem.mkdir).not.toHaveBeenCalled();
      expect(filesystem.writeFile).toHaveBeenCalled();
    });

    it('should preserve custom agents when merging', async () => {
      const existingConfig = {
        model: 'anthropic/claude-sonnet-4-5',
        agent: {
          'my-agent': {
            description: 'Custom agent',
            mode: 'primary',
          },
        },
        mcp: {
          'old-server': { type: 'local', command: ['old'] },
        },
      };

      vi.mocked(filesystem.exists)
        .mockResolvedValueOnce(true) // dir exists
        .mockResolvedValueOnce(true); // file exists
      vi.mocked(filesystem.readFile).mockResolvedValue(
        JSON.stringify(existingConfig),
      );
      vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

      const newConfig = {
        mcp: {
          'new-server': { command: 'new', args: [], type: 'local' },
        },
      };

      await adapter.writeConfig('/test/config.json', newConfig);

      const writtenContent = vi.mocked(filesystem.writeFile).mock.calls[0][1];
      const written = JSON.parse(writtenContent);

      expect(written.model).toBe('anthropic/claude-sonnet-4-5');
      expect(written.agent).toEqual(existingConfig.agent);
      expect(written.mcp['new-server'].command).toEqual(['new']);
      expect(written.mcp['old-server']).toBeUndefined();
    });

    it('should preserve custom commands when merging', async () => {
      const existingConfig = {
        command: {
          'my-command': {
            template: 'Test command',
            description: 'Test',
          },
        },
        mcp: {},
      };

      vi.mocked(filesystem.exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      vi.mocked(filesystem.readFile).mockResolvedValue(
        JSON.stringify(existingConfig),
      );
      vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

      const newConfig = {
        mcp: { test: { type: 'local', command: ['test'], args: [] } },
      };
      await adapter.writeConfig('/test/config.json', newConfig);

      const writtenContent = vi.mocked(filesystem.writeFile).mock.calls[0][1];
      const written = JSON.parse(writtenContent);

      expect(written.command).toEqual(existingConfig.command);
    });

    it('should preserve permissions when merging', async () => {
      const existingConfig = {
        permission: {
          edit: 'ask',
          bash: { '*': 'ask', git: 'allow' },
        },
        mcp: {},
      };

      vi.mocked(filesystem.exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      vi.mocked(filesystem.readFile).mockResolvedValue(
        JSON.stringify(existingConfig),
      );
      vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

      const newConfig = {
        mcp: { test: { type: 'local', command: ['test'], args: [] } },
      };
      await adapter.writeConfig('/test/config.json', newConfig);

      const writtenContent = vi.mocked(filesystem.writeFile).mock.calls[0][1];
      const written = JSON.parse(writtenContent);

      expect(written.permission).toEqual(existingConfig.permission);
    });

    it('should preserve theme when merging', async () => {
      const existingConfig = {
        theme: 'custom-dark-theme',
        mcp: {},
      };

      vi.mocked(filesystem.exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      vi.mocked(filesystem.readFile).mockResolvedValue(
        JSON.stringify(existingConfig),
      );
      vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

      const newConfig = {
        mcp: { test: { type: 'local', command: ['test'], args: [] } },
      };
      await adapter.writeConfig('/test/config.json', newConfig);

      const writtenContent = vi.mocked(filesystem.writeFile).mock.calls[0][1];
      const written = JSON.parse(writtenContent);

      expect(written.theme).toBe('custom-dark-theme');
    });

    it('should update only mcp section', async () => {
      const existingConfig = {
        model: 'test-model',
        mcp: {
          'old-server': { type: 'local', command: ['old'] },
        },
      };

      vi.mocked(filesystem.exists)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      vi.mocked(filesystem.readFile).mockResolvedValue(
        JSON.stringify(existingConfig),
      );
      vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

      const newConfig = {
        mcp: {
          'new-server': { command: 'new', args: [], type: 'local' },
        },
      };

      await adapter.writeConfig('/test/config.json', newConfig);

      const writtenContent = vi.mocked(filesystem.writeFile).mock.calls[0][1];
      const written = JSON.parse(writtenContent);

      expect(written.mcp['new-server'].command).toEqual(['new']);
      expect(written.mcp['old-server']).toBeUndefined();
    });

    it('should write new config when file does not exist', async () => {
      vi.mocked(filesystem.exists)
        .mockResolvedValueOnce(false) // dir doesn't exist
        .mockResolvedValueOnce(false); // file doesn't exist
      vi.mocked(filesystem.mkdir).mockResolvedValue(undefined);
      vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

      const config = {
        mcp: { test: { command: 'test-cmd', args: ['arg1'], type: 'local' } },
      };
      await adapter.writeConfig('/test/config.json', config);

      const writtenContent = vi.mocked(filesystem.writeFile).mock.calls[0][1];
      const written = JSON.parse(writtenContent);

      expect(written.mcp['test'].command).toEqual(['test-cmd', 'arg1']);
      expect(written.mcp['test'].enabled).toBe(true);
    });

    it('should combine command and args when writing', async () => {
      vi.mocked(filesystem.exists)
        .mockResolvedValueOnce(false) // file doesn't exist
        .mockResolvedValueOnce(true); // dir exists
      vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

      const config = {
        mcp: {
          'python-repl': {
            command: 'uvx',
            args: ['mcp-server-python'],
            type: 'local',
          },
        },
      };

      await adapter.writeConfig('/test/config.json', config);

      const writtenContent = vi.mocked(filesystem.writeFile).mock.calls[0][1];
      const written = JSON.parse(writtenContent);

      expect(written.mcp['python-repl'].command).toEqual([
        'uvx',
        'mcp-server-python',
      ]);
    });

    it('should rename env to environment when writing', async () => {
      vi.mocked(filesystem.exists)
        .mockResolvedValueOnce(false) // file doesn't exist
        .mockResolvedValueOnce(true); // dir exists
      vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

      const config = {
        mcp: {
          'test-server': {
            command: 'test',
            args: [],
            env: { API_KEY: '{env:MY_KEY}' },
            type: 'local',
          },
        },
      };

      await adapter.writeConfig('/test/config.json', config);

      const writtenContent = vi.mocked(filesystem.writeFile).mock.calls[0][1];
      const written = JSON.parse(writtenContent);

      expect(written.mcp['test-server'].environment).toEqual({
        API_KEY: '{env:MY_KEY}',
      });
      expect(written.mcp['test-server'].env).toBeUndefined();
    });

    it('should add enabled true when writing', async () => {
      vi.mocked(filesystem.exists)
        .mockResolvedValueOnce(false) // file doesn't exist
        .mockResolvedValueOnce(true); // dir exists
      vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

      const config = {
        mcp: {
          'test-server': {
            command: 'test',
            args: [],
            type: 'local',
          },
        },
      };

      await adapter.writeConfig('/test/config.json', config);

      const writtenContent = vi.mocked(filesystem.writeFile).mock.calls[0][1];
      const written = JSON.parse(writtenContent);

      expect(written.mcp['test-server'].enabled).toBe(true);
    });
  });

  describe('convertFromOverture', () => {
    it('should keep command and args separate', () => {
      const overtureConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test', type: 'generic' },
        mcp: {
          'python-repl': {
            command: 'uvx',
            args: ['mcp-server-python'],
            transport: 'stdio',
          },
        },
      };

      const clientConfig = adapter.convertFromOverture(overtureConfig, 'linux');

      expect(clientConfig.mcp['python-repl'].command).toBe('uvx');
      expect(clientConfig.mcp['python-repl'].args).toEqual([
        'mcp-server-python',
      ]);
    });

    it('should translate env vars and keep as env property', () => {
      const overtureConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test', type: 'generic' },
        mcp: {
          'test-server': {
            command: 'test',
            args: [],
            env: { API_KEY: '${MY_KEY}' },
            transport: 'stdio',
          },
        },
      };

      const clientConfig = adapter.convertFromOverture(overtureConfig, 'linux');

      expect(clientConfig.mcp['test-server'].env).toEqual({
        API_KEY: '{env:MY_KEY}',
      });
    });

    it('should add type local', () => {
      const overtureConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test', type: 'generic' },
        mcp: {
          'test-server': {
            command: 'test',
            args: [],
            transport: 'stdio',
          },
        },
      };

      const clientConfig = adapter.convertFromOverture(overtureConfig, 'linux');

      expect(clientConfig.mcp['test-server'].type).toBe('local');
    });

    it('should translate ${VAR} to {env:VAR}', () => {
      const overtureConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test', type: 'generic' },
        mcp: {
          'test-server': {
            command: 'test',
            args: [],
            env: { API_KEY: '${MY_KEY}' },
            transport: 'stdio',
          },
        },
      };

      const clientConfig = adapter.convertFromOverture(overtureConfig, 'linux');

      expect(clientConfig.mcp['test-server'].env).toEqual({
        API_KEY: '{env:MY_KEY}',
      });
    });

    it('should translate ${env:VAR} to {env:VAR}', () => {
      const overtureConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test', type: 'generic' },
        mcp: {
          'test-server': {
            command: 'test',
            args: [],
            env: { API_KEY: '${env:MY_KEY}' },
            transport: 'stdio',
          },
        },
      };

      const clientConfig = adapter.convertFromOverture(overtureConfig, 'linux');

      expect(clientConfig.mcp['test-server'].env).toEqual({
        API_KEY: '{env:MY_KEY}',
      });
    });

    it('should filter MCPs by platform exclusions', () => {
      const overtureConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test', type: 'generic' },
        mcp: {
          'test-server': {
            command: 'test',
            args: [],
            transport: 'stdio',
            platforms: {
              exclude: ['linux'],
            },
          },
        },
      };

      const clientConfig = adapter.convertFromOverture(overtureConfig, 'linux');

      expect(clientConfig).toEqual({ mcp: {} });
    });

    it('should filter MCPs by client exclusions', () => {
      const overtureConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test', type: 'generic' },
        mcp: {
          'test-server': {
            command: 'test',
            args: [],
            transport: 'stdio',
            clients: {
              exclude: ['opencode'],
            },
          },
        },
      };

      const clientConfig = adapter.convertFromOverture(overtureConfig, 'linux');

      expect(clientConfig).toEqual({ mcp: {} });
    });

    it('should apply platform overrides', () => {
      const overtureConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test', type: 'generic' },
        mcp: {
          'test-server': {
            command: 'default-cmd',
            args: ['default-arg'],
            transport: 'stdio',
            platforms: {
              commandOverrides: { linux: 'linux-cmd' },
              argsOverrides: { linux: ['linux-arg'] },
            },
          },
        },
      };

      const clientConfig = adapter.convertFromOverture(overtureConfig, 'linux');

      expect(clientConfig.mcp['test-server'].command).toBe('linux-cmd');
      expect(clientConfig.mcp['test-server'].args).toEqual(['linux-arg']);
    });

    it('should apply client overrides', () => {
      const overtureConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test', type: 'generic' },
        mcp: {
          'test-server': {
            command: 'default-cmd',
            args: ['default-arg'],
            env: { DEFAULT: 'value' },
            transport: 'stdio',
            clients: {
              overrides: {
                opencode: {
                  command: 'opencode-cmd',
                  args: ['opencode-arg'],
                  env: { OVERRIDE: 'overridden' },
                },
              },
            },
          },
        },
      };

      const clientConfig = adapter.convertFromOverture(overtureConfig, 'linux');

      expect(clientConfig.mcp['test-server'].command).toBe('opencode-cmd');
      expect(clientConfig.mcp['test-server'].args).toEqual(['opencode-arg']);
      expect(clientConfig.mcp['test-server'].env).toEqual({
        DEFAULT: 'value',
        OVERRIDE: 'overridden',
      });
    });

    it('should handle multiple MCPs', () => {
      const overtureConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test', type: 'generic' },
        mcp: {
          server1: {
            command: 'cmd1',
            args: ['arg1'],
            transport: 'stdio',
          },
          server2: {
            command: 'cmd2',
            args: ['arg2'],
            transport: 'stdio',
          },
        },
      };

      const clientConfig = adapter.convertFromOverture(overtureConfig, 'linux');

      expect(Object.keys(clientConfig.mcp)).toHaveLength(2);
      expect(clientConfig.mcp['server1'].command).toBe('cmd1');
      expect(clientConfig.mcp['server1'].args).toEqual(['arg1']);
      expect(clientConfig.mcp['server2'].command).toBe('cmd2');
      expect(clientConfig.mcp['server2'].args).toEqual(['arg2']);
    });

    it('should handle empty env correctly', () => {
      const overtureConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'test', type: 'generic' },
        mcp: {
          'test-server': {
            command: 'test',
            args: [],
            transport: 'stdio',
          },
        },
      };

      const clientConfig = adapter.convertFromOverture(overtureConfig, 'linux');

      expect(clientConfig.mcp['test-server'].env).toBeUndefined();
    });
  });

  describe('transport and binary detection', () => {
    it('should support all transport types', () => {
      expect(adapter.supportsTransport('stdio')).toBe(true);
      expect(adapter.supportsTransport('http')).toBe(true);
      expect(adapter.supportsTransport('sse')).toBe(true);
    });

    it('should not need env var expansion', () => {
      expect(adapter.needsEnvVarExpansion()).toBe(false);
    });

    it('should have opencode binary name', () => {
      expect(adapter.getBinaryNames()).toEqual(['opencode']);
    });

    it('should require binary', () => {
      expect(adapter.requiresBinary()).toBe(true);
    });

    it('should not have app bundle paths', () => {
      expect(adapter.getAppBundlePaths('linux')).toEqual([]);
      expect(adapter.getAppBundlePaths('darwin')).toEqual([]);
      expect(adapter.getAppBundlePaths('win32')).toEqual([]);
    });
  });
});
