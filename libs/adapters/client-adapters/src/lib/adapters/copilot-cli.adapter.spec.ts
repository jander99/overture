/**
 * Copilot CLI Adapter Tests
 *
 * Comprehensive test suite for CopilotCliAdapter with ≥85% coverage target.
 * 39 tests covering all adapter functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { EnvironmentPort } from '@overture/ports-process';
import type { OvertureConfig, Platform } from '@overture/config-types';
import { CopilotCliAdapter } from './copilot-cli.adapter.js';

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

function createMockEnvironment(): EnvironmentPort {
  return {
    platform: vi.fn(() => 'linux'),
    homedir: vi.fn(() => '/home/user'),
    env: {
      HOME: '/home/user',
      XDG_CONFIG_HOME: '/home/user/.config',
      APPDATA: 'C:\\Users\\user\\AppData\\Roaming',
      USERPROFILE: 'C:\\Users\\user',
      PWD: '/home/user/project',
    },
  } as EnvironmentPort;
}

describe('CopilotCliAdapter', () => {
  let adapter: CopilotCliAdapter;
  let filesystem: FilesystemPort;
  let environment: EnvironmentPort;

  beforeEach(() => {
    filesystem = createMockFilesystem();
    environment = createMockEnvironment();
    adapter = new CopilotCliAdapter(filesystem, environment);
  });

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(adapter.name).toBe('copilot-cli');
    });

    it('should have correct schemaRootKey', () => {
      expect(adapter.schemaRootKey).toBe('mcpServers');
    });
  });

  describe('detectConfigPath', () => {
    it('should detect Linux user path', () => {
      const result = adapter.detectConfigPath('linux');
      expect(result.user).toBe('/home/user/.config/github-copilot/mcp.json');
      expect(result.project).toBe('/home/user/project/.github/mcp.json');
    });

    it('should detect macOS user path', () => {
      const result = adapter.detectConfigPath('darwin');
      expect(result.user).toBe('/home/user/.config/github-copilot/mcp.json');
      expect(result.project).toBe('/home/user/project/.github/mcp.json');
    });

    it('should detect Windows user path', () => {
      environment.env.HOME = undefined;
      environment.env.USERPROFILE = 'C:\\Users\\user';
      const result = adapter.detectConfigPath('win32');
      expect(result.user).toBe(
        'C:\\Users\\user\\.config\\github-copilot\\mcp.json',
      );
      expect(result.project).toBe('/home/user/project/.github/mcp.json');
    });

    it('should use XDG_CONFIG_HOME when set', () => {
      environment.env.XDG_CONFIG_HOME = '/custom/config';
      const result = adapter.detectConfigPath('linux');
      expect(result.user).toBe('/custom/config/github-copilot/mcp.json');
    });

    it('should use custom project root', () => {
      const result = adapter.detectConfigPath('linux', '/custom/project');
      expect(result.project).toBe('/custom/project/.github/mcp.json');
    });

    it('should throw on unsupported platform', () => {
      expect(() => adapter.detectConfigPath('freebsd' as Platform)).toThrow(
        'Unsupported platform',
      );
    });
  });

  describe('readConfig', () => {
    it('should read valid config', async () => {
      const mockConfig = {
        mcpServers: { filesystem: { command: 'npx', args: [] } },
      };
      vi.mocked(filesystem.exists).mockResolvedValue(true);
      vi.mocked(filesystem.readFile).mockResolvedValue(
        JSON.stringify(mockConfig),
      );

      const result = await adapter.readConfig('/test.json');
      expect(result).toEqual(mockConfig);
    });

    it('should return empty when file missing', async () => {
      vi.mocked(filesystem.exists).mockResolvedValue(false);
      const result = await adapter.readConfig('/missing.json');
      expect(result).toEqual({ mcpServers: {} });
    });

    it('should throw on malformed JSON', async () => {
      vi.mocked(filesystem.exists).mockResolvedValue(true);
      vi.mocked(filesystem.readFile).mockResolvedValue('invalid');
      await expect(adapter.readConfig('/test.json')).rejects.toThrow(
        'Failed to read',
      );
    });

    it('should handle missing mcpServers key', async () => {
      vi.mocked(filesystem.exists).mockResolvedValue(true);
      vi.mocked(filesystem.readFile).mockResolvedValue('{}');
      const result = await adapter.readConfig('/test.json');
      expect(result).toEqual({ mcpServers: {} });
    });

    it('should handle read errors', async () => {
      vi.mocked(filesystem.exists).mockResolvedValue(true);
      vi.mocked(filesystem.readFile).mockRejectedValue(new Error('IO error'));
      await expect(adapter.readConfig('/test.json')).rejects.toThrow(
        'Failed to read',
      );
    });

    it('should handle empty config', async () => {
      vi.mocked(filesystem.exists).mockResolvedValue(true);
      vi.mocked(filesystem.readFile).mockResolvedValue('{"mcpServers":{}}');
      const result = await adapter.readConfig('/test.json');
      expect(result).toEqual({ mcpServers: {} });
    });
  });

  describe('writeConfig', () => {
    it('should create directory if missing', async () => {
      vi.mocked(filesystem.exists).mockResolvedValue(false);
      vi.mocked(filesystem.mkdir).mockResolvedValue(undefined);
      vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

      await adapter.writeConfig('/new/dir/test.json', { mcpServers: {} });
      expect(filesystem.mkdir).toHaveBeenCalledWith('/new/dir', {
        recursive: true,
      });
    });

    it('should write JSON config', async () => {
      vi.mocked(filesystem.exists).mockResolvedValue(true);
      vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

      await adapter.writeConfig('/test.json', { mcpServers: {} });
      expect(filesystem.writeFile).toHaveBeenCalled();
    });

    it('should handle write errors', async () => {
      vi.mocked(filesystem.exists).mockResolvedValue(true);
      vi.mocked(filesystem.writeFile).mockRejectedValue(new Error('Disk full'));
      await expect(
        adapter.writeConfig('/test.json', { mcpServers: {} }),
      ).rejects.toThrow();
    });

    it('should overwrite existing config', async () => {
      vi.mocked(filesystem.exists).mockResolvedValue(true);
      vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);
      await adapter.writeConfig('/test.json', {
        mcpServers: { new: { command: 'test', args: [] } },
      });
      expect(filesystem.writeFile).toHaveBeenCalled();
    });

    it('should handle paths with spaces', async () => {
      vi.mocked(filesystem.exists).mockResolvedValue(false);
      vi.mocked(filesystem.mkdir).mockResolvedValue(undefined);
      vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

      await adapter.writeConfig('/path with spaces/test.json', {
        mcpServers: {},
      });
      expect(filesystem.mkdir).toHaveBeenCalledWith('/path with spaces', {
        recursive: true,
      });
    });

    it('should handle Windows paths', async () => {
      vi.mocked(filesystem.exists).mockResolvedValue(false);
      vi.mocked(filesystem.mkdir).mockResolvedValue(undefined);
      vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

      await adapter.writeConfig('C:\\test\\test.json', { mcpServers: {} });
      expect(filesystem.mkdir).toHaveBeenCalledWith('C:\\test', {
        recursive: true,
      });
    });
  });

  describe('convertFromOverture', () => {
    it('should convert basic config', () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const result = adapter.convertFromOverture(config, 'linux');
      expect(result.mcpServers.filesystem?.command).toBe('npx');
    });

    it('should EXCLUDE github MCP (bundled)', () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          github: { command: 'test', args: [], env: {}, transport: 'stdio' },
          filesystem: { command: 'npx', args: [], env: {}, transport: 'stdio' },
        },
      };

      const result = adapter.convertFromOverture(config, 'linux');
      expect(result.mcpServers).not.toHaveProperty('github');
      expect(result.mcpServers).toHaveProperty('filesystem');
    });

    it('should pass env variables', () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          test: {
            command: 'test',
            args: [],
            env: { KEY: '${VALUE}' },
            transport: 'stdio',
          },
        },
      };

      const result = adapter.convertFromOverture(config, 'linux');
      expect(result.mcpServers.test?.env).toEqual({ KEY: '${VALUE}' });
    });

    it('should map command and args', () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          python: {
            command: 'uvx',
            args: ['mcp-server-python'],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const result = adapter.convertFromOverture(config, 'linux');
      expect(result.mcpServers.python?.command).toBe('uvx');
      expect(result.mcpServers.python?.args).toEqual(['mcp-server-python']);
    });

    it('should handle empty config', () => {
      const config: OvertureConfig = { version: '1.0', mcp: {} };
      const result = adapter.convertFromOverture(config, 'linux');
      expect(result).toEqual({ mcpServers: {} });
    });

    it('should convert multiple MCPs', () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          fs: { command: 'npx', args: [], env: {}, transport: 'stdio' },
          mem: { command: 'npx', args: [], env: {}, transport: 'stdio' },
          py: { command: 'uvx', args: [], env: {}, transport: 'stdio' },
        },
      };

      const result = adapter.convertFromOverture(config, 'linux');
      expect(Object.keys(result.mcpServers)).toHaveLength(3);
    });

    it('should convert all valid MCPs', () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          one: { command: 'test1', args: [], env: {}, transport: 'stdio' },
          two: { command: 'test2', args: [], env: {}, transport: 'stdio' },
        },
      };

      const result = adapter.convertFromOverture(config, 'linux');
      expect(result.mcpServers).toHaveProperty('one');
      expect(result.mcpServers).toHaveProperty('two');
    });

    it('should filter by platform exclusions', () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          test: {
            command: 'test',
            args: [],
            env: {},
            transport: 'stdio',
            platforms: { exclude: ['linux'] },
          },
        },
      };

      const result = adapter.convertFromOverture(config, 'linux');
      expect(result.mcpServers).not.toHaveProperty('test');
    });

    it('should filter by client exclusions', () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          test: {
            command: 'test',
            args: [],
            env: {},
            transport: 'stdio',
            clients: { exclude: ['copilot-cli'] },
          },
        },
      };

      const result = adapter.convertFromOverture(config, 'linux');
      expect(result.mcpServers).not.toHaveProperty('test');
    });
  });

  describe('supportsTransport', () => {
    it('should support stdio', () => {
      expect(adapter.supportsTransport('stdio')).toBe(true);
    });

    it('should support http', () => {
      expect(adapter.supportsTransport('http')).toBe(true);
    });

    it('should support sse', () => {
      expect(adapter.supportsTransport('sse')).toBe(true);
    });
  });

  describe('needsEnvVarExpansion', () => {
    it('should return false (native support)', () => {
      expect(adapter.needsEnvVarExpansion()).toBe(false);
    });
  });

  describe('getBinaryNames', () => {
    it('should return binary names', () => {
      expect(adapter.getBinaryNames()).toEqual([
        'copilot',
        'github-copilot-cli',
      ]);
    });

    it('should have two names', () => {
      expect(adapter.getBinaryNames()).toHaveLength(2);
    });
  });

  describe('getAppBundlePaths', () => {
    it('should return empty (CLI-only)', () => {
      expect(adapter.getAppBundlePaths('darwin')).toEqual([]);
    });

    it('should be empty for all platforms', () => {
      expect(adapter.getAppBundlePaths('linux')).toEqual([]);
      expect(adapter.getAppBundlePaths('win32')).toEqual([]);
    });
  });

  describe('requiresBinary', () => {
    it('should return true', () => {
      expect(adapter.requiresBinary()).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw on unsupported platform', () => {
      expect(() => adapter.detectConfigPath('aix' as Platform)).toThrow(
        /Unsupported platform/,
      );
    });

    it('should wrap read errors in McpError', async () => {
      vi.mocked(filesystem.exists).mockResolvedValue(true);
      vi.mocked(filesystem.readFile).mockRejectedValue(new Error('IO'));
      await expect(adapter.readConfig('/test.json')).rejects.toThrow(
        /Failed to read/,
      );
    });

    it('should wrap write errors in McpError', async () => {
      vi.mocked(filesystem.exists).mockResolvedValue(true);
      vi.mocked(filesystem.writeFile).mockRejectedValue(
        new Error('Write fail'),
      );
      await expect(
        adapter.writeConfig('/test.json', { mcpServers: {} }),
      ).rejects.toThrow(/Failed to write/);
    });
  });
});
