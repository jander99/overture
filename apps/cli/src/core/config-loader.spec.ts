/**
 * Configuration Loader Tests
 *
 * @module core/config-loader.spec
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  loadUserConfig,
  loadProjectConfig,
  mergeConfigs,
  loadConfig,
  hasUserConfig,
  hasProjectConfig,
  ConfigLoadError,
  ConfigValidationError,
} from './config-loader';
import type { OvertureConfig } from '../domain/config.schema';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock os module
jest.mock('os');
const mockOs = os as jest.Mocked<typeof os>;

// Mock path-resolver
jest.mock('./path-resolver', () => ({
  getUserConfigPath: jest.fn(() => '/home/testuser/.config/overture.yml'),
  getProjectConfigPath: jest.fn(() => '/mock/project/.overture/config.yaml'),
  findProjectRoot: jest.fn(() => null),
}));

import * as pathResolver from './path-resolver';
const mockFindProjectRoot = pathResolver.findProjectRoot as jest.Mock;

describe('Config Loader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindProjectRoot.mockReturnValue(null);
  });

  const validUserConfig: OvertureConfig = {
    version: '2.0',
    clients: {
      'claude-code': {
        enabled: true,
      },
    },
    mcp: {
      github: {
        command: 'mcp-server-github',
        args: [],
        env: {},
        transport: 'stdio',
      },
    },
    sync: {
      backup: true,
      backupDir: '~/.config/overture/backups',
      backupRetention: 10,
      mergeStrategy: 'append',
      autoDetectClients: true,
    },
  };

  const validProjectConfig: OvertureConfig = {
    version: '2.0',
    mcp: {
      filesystem: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        env: {},
        transport: 'stdio',
      },
      github: {
        command: 'mcp-server-github-custom',
        args: [],
        env: {
          GITHUB_TOKEN: '${GITHUB_TOKEN}',
        },
        transport: 'http',
      },
    },
  };

  describe('loadUserConfig', () => {
    it('should load valid user config', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
version: "2.0"
clients:
  claude-code:
    enabled: true
mcp:
  github:
    command: mcp-server-github
    args: []
    env: {}
    transport: stdio
sync:
  backup: true
  backupDir: ~/.config/overture/backups
  backupRetention: 10
  mergeStrategy: append
  autoDetectClients: true
`);

      const config = loadUserConfig();
      expect(config.version).toBe('2.0');
      expect(config.mcp.github).toBeDefined();
      expect(config.mcp.github.transport).toBe('stdio');
    });

    it('should throw ConfigLoadError if file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => loadUserConfig()).toThrow(ConfigLoadError);
      expect(() => loadUserConfig()).toThrow('User config file not found');
    });

    it('should throw ConfigLoadError if file cannot be read', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => loadUserConfig()).toThrow(ConfigLoadError);
      expect(() => loadUserConfig()).toThrow('Failed to load user config');
    });

    it('should throw ConfigValidationError for invalid config', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
version: "2.0"
mcp:
  github:
    command: mcp-server-github
    # Missing required transport field
`);

      expect(() => loadUserConfig()).toThrow(ConfigValidationError);
    });

    it('should throw ConfigLoadError for invalid YAML', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
invalid: yaml: [syntax
`);

      expect(() => loadUserConfig()).toThrow(ConfigLoadError);
    });

    it('should validate required transport field', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
version: "2.0"
mcp:
  github:
    command: mcp-server-github
    args: []
    env: {}
`);

      expect(() => loadUserConfig()).toThrow(ConfigValidationError);
    });

    it('should accept optional version field', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
version: "2.0"
mcp:
  github:
    command: mcp-server-github
    args: []
    env: {}
    transport: stdio
    version: "1.2.3"
`);

      const config = loadUserConfig();
      expect(config.mcp.github.version).toBe('1.2.3');
    });
  });

  describe('loadProjectConfig', () => {
    it('should load valid project config', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    env: {}
    transport: stdio
`);

      const config = loadProjectConfig();
      expect(config).not.toBeNull();
      expect(config?.mcp.filesystem).toBeDefined();
    });

    it('should return null if file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const config = loadProjectConfig();
      expect(config).toBeNull();
    });

    it('should throw ConfigLoadError if file cannot be read', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => loadProjectConfig()).toThrow(ConfigLoadError);
    });

    it('should throw ConfigValidationError for invalid config', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
version: "invalid"
mcp:
  filesystem:
    command: npx
`);

      expect(() => loadProjectConfig()).toThrow(ConfigValidationError);
    });

    it('should accept project root parameter', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
version: "2.0"
mcp:
  filesystem:
    command: npx
    args: []
    env: {}
    transport: stdio
`);

      const config = loadProjectConfig('/custom/project');
      expect(config).not.toBeNull();
    });

    it('should throw helpful error for deprecated scope field', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
version: "2.0"
mcp:
  github:
    command: mcp-server-github
    args: []
    env: {}
    transport: stdio
    scope: global
`);

      expect(() => loadProjectConfig()).toThrow(ConfigValidationError);
      expect(() => loadProjectConfig()).toThrow(/Deprecated 'scope' field found/);

      try {
        loadProjectConfig();
        fail('Should have thrown ConfigValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        const validationError = error as ConfigValidationError;
        expect(validationError.validationErrors).toHaveLength(1);
        expect(validationError.validationErrors[0]).toMatchObject({
          code: 'deprecated_field',
          path: ['mcp', 'github', 'scope'],
          message: expect.stringContaining('removed in Overture v2.0'),
        });
      }
    });
  });

  describe('mergeConfigs', () => {
    it('should return user config if project config is null', () => {
      const merged = mergeConfigs(validUserConfig, null);
      expect(merged).toEqual(validUserConfig);
    });

    it('should merge MCP servers with project overriding user', () => {
      const merged = mergeConfigs(validUserConfig, validProjectConfig);

      // User MCP (github) should be overridden by project
      expect(merged.mcp.github.command).toBe('mcp-server-github-custom');
      expect(merged.mcp.github.transport).toBe('http');

      // Project-only MCP should be present
      expect(merged.mcp.filesystem).toBeDefined();
      expect(merged.mcp.filesystem.command).toBe('npx');
    });

    it('should preserve user MCPs not in project config', () => {
      const userWithExtra: OvertureConfig = {
        ...validUserConfig,
        mcp: {
          ...validUserConfig.mcp,
          ruff: {
            command: 'mcp-server-ruff',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const merged = mergeConfigs(userWithExtra, validProjectConfig);

      // User-only MCP should still be present
      expect(merged.mcp.ruff).toBeDefined();

      // Project MCPs should also be present
      expect(merged.mcp.filesystem).toBeDefined();
      expect(merged.mcp.github).toBeDefined();
    });

    it('should merge client settings with project overriding user', () => {
      const projectWithClients: OvertureConfig = {
        ...validProjectConfig,
        clients: {
          'claude-code': {
            enabled: false, // Override user setting
          },
          cursor: {
            enabled: true, // New client
          },
        },
      };

      const merged = mergeConfigs(validUserConfig, projectWithClients);

      expect(merged.clients?.['claude-code']?.enabled).toBe(false);
      expect(merged.clients?.cursor?.enabled).toBe(true);
    });

    it('should merge sync options with project overriding user', () => {
      const projectWithSync: OvertureConfig = {
        ...validProjectConfig,
        sync: {
          backup: false,
          backupDir: '/custom/backup',
          backupRetention: 5,
          mergeStrategy: 'replace',
          autoDetectClients: false,
        },
      };

      const merged = mergeConfigs(validUserConfig, projectWithSync);

      expect(merged.sync?.backup).toBe(false);
      expect(merged.sync?.backupDir).toBe('/custom/backup');
      expect(merged.sync?.mergeStrategy).toBe('replace');
    });

    it('should use project version if present', () => {
      const projectWithVersion: OvertureConfig = {
        ...validProjectConfig,
        version: '2.1',
      };

      const merged = mergeConfigs(validUserConfig, projectWithVersion);
      expect(merged.version).toBe('2.1');
    });

    it('should handle empty project config', () => {
      const emptyProject: OvertureConfig = {
        version: '2.0',
        mcp: {},
      };

      const merged = mergeConfigs(validUserConfig, emptyProject);

      // User config should be mostly preserved
      expect(merged.mcp.github).toBeDefined();
      expect(merged.clients?.['claude-code']).toBeDefined();
    });
  });

  describe('loadConfig', () => {
    it('should load and merge both configs', () => {
      // Mock project detection to return a project root
      mockFindProjectRoot.mockReturnValue('/mock/project');

      // Mock user config
      mockFs.existsSync.mockImplementation((path) => {
        return path.includes('overture.yml') || path.includes('config.yaml');
      });

      mockFs.readFileSync.mockImplementation((path) => {
        if (path.toString().includes('overture.yml')) {
          return `
version: "2.0"
mcp:
  github:
    command: mcp-server-github
    args: []
    env: {}
    transport: stdio
`;
        } else {
          return `
version: "2.0"
mcp:
  filesystem:
    command: npx
    args: []
    env: {}
    transport: stdio
`;
        }
      });

      const config = loadConfig();

      expect(config.mcp.github).toBeDefined();
      expect(config.mcp.filesystem).toBeDefined();
    });

    it('should work with only user config', () => {
      mockFs.existsSync.mockImplementation((path) => {
        return path.toString().includes('overture.yml');
      });

      mockFs.readFileSync.mockReturnValue(`
version: "2.0"
mcp:
  github:
    command: mcp-server-github
    args: []
    env: {}
    transport: stdio
`);

      const config = loadConfig();
      expect(config.mcp.github).toBeDefined();
    });

    it('should throw if user config is missing', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => loadConfig()).toThrow(ConfigLoadError);
    });
  });

  describe('hasUserConfig', () => {
    it('should return true if user config exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      expect(hasUserConfig()).toBe(true);
    });

    it('should return false if user config does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(hasUserConfig()).toBe(false);
    });
  });

  describe('hasProjectConfig', () => {
    it('should return true if project config exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      expect(hasProjectConfig()).toBe(true);
    });

    it('should return false if project config does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(hasProjectConfig()).toBe(false);
    });

    it('should accept project root parameter', () => {
      mockFs.existsSync.mockReturnValue(true);

      expect(hasProjectConfig('/custom/project')).toBe(true);
    });
  });
});
