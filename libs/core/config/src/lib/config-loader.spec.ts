/**
 * Config Loader Tests
 *
 * Tests for ConfigLoader service with dependency injection.
 * Uses port mocks for filesystem and path resolution.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigLoader } from './config-loader.js';
import { PathResolver } from './path-resolver.js';
import { ConfigError, ValidationError } from '@overture/errors';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { EnvironmentPort } from '@overture/ports-process';

describe('ConfigLoader', () => {
  let mockFilesystem: FilesystemPort;
  let mockEnvironment: EnvironmentPort;
  let pathResolver: PathResolver;
  let loader: ConfigLoader;

  const validUserConfigYaml = `
version: "2.0"
mcp:
  github:
    command: mcp-server-github
    args: []
    env:
      GITHUB_TOKEN: "\${GITHUB_TOKEN}"
    transport: stdio
`;

  const validProjectConfigYaml = `
version: "2.0"
mcp:
  nx-mcp:
    command: npx
    args: ["@jander99/nx-mcp"]
    env: {}
    transport: stdio
`;

  beforeEach(() => {
    // Create mock filesystem port
    mockFilesystem = {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      exists: vi.fn(() => Promise.resolve(false)),
      mkdir: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      rm: vi.fn(),
    };

    // Create mock environment port
    mockEnvironment = {
      platform: vi.fn(() => 'linux'),
      homedir: vi.fn(() => '/home/user'),
      env: {
        HOME: '/home/user',
        PWD: '/home/user/project',
      },
    };

    pathResolver = new PathResolver(mockEnvironment, mockFilesystem);
    loader = new ConfigLoader(mockFilesystem, pathResolver);
  });

  describe('loadUserConfig', () => {
    it('should load and parse valid user config', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue(validUserConfigYaml);

      const config = await loader.loadUserConfig();

      expect(config).toBeDefined();
      expect(config.version).toBe('2.0');
      expect(config.mcp?.github).toBeDefined();
      expect(config.mcp?.github?.command).toBe('mcp-server-github');
    });

    it('should throw ConfigError if file does not exist', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      await expect(loader.loadUserConfig()).rejects.toThrow(ConfigError);
      await expect(loader.loadUserConfig()).rejects.toThrow('User config file not found');
    });

    it('should throw ConfigError on YAML parse error', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('invalid: yaml: [unclosed');

      await expect(loader.loadUserConfig()).rejects.toThrow(ConfigError);
    });

    it('should throw ValidationError on invalid schema', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue(`
version: "2.0"
mcp:
  broken:
    command: test
    # Missing required fields
`);

      await expect(loader.loadUserConfig()).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError on deprecated scope field', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue(`
version: "2.0"
mcp:
  github:
    command: mcp-server-github
    args: []
    env: {}
    transport: stdio
    scope: global
`);

      await expect(loader.loadUserConfig()).rejects.toThrow(ValidationError);
      await expect(loader.loadUserConfig()).rejects.toThrow(/deprecated 'scope' field/i);
    });

    it('should format YAML errors with line numbers', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue(`
version: "2.0"
mcp:
  test: [unclosed array
`);

      await expect(loader.loadUserConfig()).rejects.toThrow(/line \d+/);
    });
  });

  describe('loadProjectConfig', () => {
    it('should load and parse valid project config', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue(validProjectConfigYaml);

      const config = await loader.loadProjectConfig();

      expect(config).toBeDefined();
      expect(config?.version).toBe('2.0');
      expect(config?.mcp?.['nx-mcp']).toBeDefined();
    });

    it('should return null if file does not exist', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const config = await loader.loadProjectConfig();

      expect(config).toBeNull();
    });

    it('should use provided project root', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue(validProjectConfigYaml);

      const config = await loader.loadProjectConfig('/custom/project');

      expect(mockFilesystem.exists).toHaveBeenCalledWith('/custom/project/.overture/config.yaml');
      expect(config).toBeDefined();
    });

    it('should throw ConfigError on read error', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockRejectedValue(new Error('Permission denied'));

      await expect(loader.loadProjectConfig()).rejects.toThrow(ConfigError);
    });

    it('should throw ValidationError on invalid schema', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue(`
version: "2.0"
mcp:
  broken:
    command: test
`);

      await expect(loader.loadProjectConfig()).rejects.toThrow(ValidationError);
    });
  });

  describe('mergeConfigs', () => {
    it('should return user config if no project config', () => {
      const userConfig = {
        version: '2.0' as const,
        mcp: {
          github: {
            command: 'mcp-server-github',
            args: [],
            env: {},
            transport: 'stdio' as const,
          },
        },
      };

      const merged = loader.mergeConfigs(userConfig, null);

      expect(merged).toEqual(userConfig);
    });

    it('should merge MCP servers with project overriding user', () => {
      const userConfig = {
        version: '2.0' as const,
        mcp: {
          github: {
            command: 'mcp-server-github',
            args: [],
            env: {},
            transport: 'stdio' as const,
          },
        },
      };

      const projectConfig = {
        version: '2.0' as const,
        mcp: {
          'nx-mcp': {
            command: 'npx',
            args: ['@jander99/nx-mcp'],
            env: {},
            transport: 'stdio' as const,
          },
        },
      };

      const merged = loader.mergeConfigs(userConfig, projectConfig);

      expect(merged.mcp?.github).toBeDefined();
      expect(merged.mcp?.['nx-mcp']).toBeDefined();
      expect(Object.keys(merged.mcp || {})).toHaveLength(2);
    });

    it('should override user MCP with project MCP of same name', () => {
      const userConfig = {
        version: '2.0' as const,
        mcp: {
          github: {
            command: 'user-github-server',
            args: ['--user'],
            env: {},
            transport: 'stdio' as const,
          },
        },
      };

      const projectConfig = {
        version: '2.0' as const,
        mcp: {
          github: {
            command: 'project-github-server',
            args: ['--project'],
            env: {},
            transport: 'stdio' as const,
          },
        },
      };

      const merged = loader.mergeConfigs(userConfig, projectConfig);

      expect(merged.mcp?.github?.command).toBe('project-github-server');
      expect(merged.mcp?.github?.args).toEqual(['--project']);
    });

    it('should merge client settings', () => {
      const userConfig = {
        version: '2.0' as const,
        clients: {
          'claude-code': {
            enabled: true,
          },
        },
        mcp: {},
      };

      const projectConfig = {
        version: '2.0' as const,
        clients: {
          'claude-desktop': {
            enabled: false,
          },
        },
        mcp: {},
      };

      const merged = loader.mergeConfigs(userConfig, projectConfig);

      expect(merged.clients?.['claude-code']?.enabled).toBe(true);
      expect(merged.clients?.['claude-desktop']?.enabled).toBe(false);
    });

    it('should use project version if present', () => {
      const userConfig = {
        version: '1.0' as const,
        mcp: {},
      };

      const projectConfig = {
        version: '2.0' as const,
        mcp: {},
      };

      const merged = loader.mergeConfigs(userConfig, projectConfig);

      expect(merged.version).toBe('2.0');
    });
  });

  describe('loadConfig', () => {
    it('should load and merge user and project configs', async () => {
      // Mock project root detection
      vi.mocked(mockFilesystem.exists).mockImplementation(async (path) => {
        return (
          path === '/home/user/.config/overture.yml' ||
          path === '/home/user/project/.overture/config.yaml'
        );
      });

      vi.mocked(mockFilesystem.readFile).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture.yml') {
          return validUserConfigYaml;
        }
        if (path === '/home/user/project/.overture/config.yaml') {
          return validProjectConfigYaml;
        }
        throw new Error('File not found');
      });

      const config = await loader.loadConfig();

      expect(config.mcp?.github).toBeDefined(); // from user config
      expect(config.mcp?.['nx-mcp']).toBeDefined(); // from project config
    });

    it('should load only user config if not in project', async () => {
      vi.mocked(mockFilesystem.exists).mockImplementation(async (path) => {
        return path === '/home/user/.config/overture.yml';
      });

      vi.mocked(mockFilesystem.readFile).mockResolvedValue(validUserConfigYaml);

      const config = await loader.loadConfig();

      expect(config.mcp?.github).toBeDefined();
      expect(config.mcp?.['nx-mcp']).toBeUndefined();
    });

    it('should load only project config if no user config', async () => {
      vi.mocked(mockFilesystem.exists).mockImplementation(async (path) => {
        return path === '/home/user/project/.overture/config.yaml';
      });

      vi.mocked(mockFilesystem.readFile).mockResolvedValue(validProjectConfigYaml);

      const config = await loader.loadConfig();

      expect(config.mcp?.['nx-mcp']).toBeDefined();
      expect(config.mcp?.github).toBeUndefined();
    });

    it('should throw ConfigError if no config found', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      await expect(loader.loadConfig()).rejects.toThrow(ConfigError);
      await expect(loader.loadConfig()).rejects.toThrow(/No configuration found/);
    });

    it('should use provided project root', async () => {
      vi.mocked(mockFilesystem.exists).mockImplementation(async (path) => {
        return (
          path === '/home/user/.config/overture.yml' ||
          path === '/custom/project/.overture/config.yaml'
        );
      });

      vi.mocked(mockFilesystem.readFile).mockImplementation(async (path) => {
        if (path === '/home/user/.config/overture.yml') {
          return validUserConfigYaml;
        }
        if (path === '/custom/project/.overture/config.yaml') {
          return validProjectConfigYaml;
        }
        throw new Error('File not found');
      });

      const config = await loader.loadConfig('/custom/project');

      expect(config.mcp?.github).toBeDefined();
      expect(config.mcp?.['nx-mcp']).toBeDefined();
    });
  });

  describe('hasUserConfig', () => {
    it('should return true if user config exists', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const result = await loader.hasUserConfig();

      expect(result).toBe(true);
      expect(mockFilesystem.exists).toHaveBeenCalledWith('/home/user/.config/overture.yml');
    });

    it('should return false if user config does not exist', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const result = await loader.hasUserConfig();

      expect(result).toBe(false);
    });
  });

  describe('hasProjectConfig', () => {
    it('should return true if project config exists', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const result = await loader.hasProjectConfig();

      expect(result).toBe(true);
      expect(mockFilesystem.exists).toHaveBeenCalledWith('/home/user/project/.overture/config.yaml');
    });

    it('should return false if project config does not exist', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const result = await loader.hasProjectConfig();

      expect(result).toBe(false);
    });

    it('should use provided project root', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      await loader.hasProjectConfig('/custom/project');

      expect(mockFilesystem.exists).toHaveBeenCalledWith('/custom/project/.overture/config.yaml');
    });
  });
});
