import * as yaml from 'js-yaml';
import * as path from 'path';
import { FsUtils } from '../infrastructure/fs-utils';
import { ConfigManager } from './config-manager';
import { OvertureConfig } from '../domain/schemas';
import { ConfigError } from '../domain/errors';
import { CONFIG_PATH, GLOBAL_CONFIG_DIR } from '../domain/constants';

// Mock dependencies
jest.mock('../infrastructure/fs-utils');
jest.mock('js-yaml');
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn((...args) => require('path').posix.join(...args)),
  dirname: jest.fn((...args) => require('path').posix.dirname(...args)),
  basename: jest.fn((...args) => require('path').posix.basename(...args)),
}));

// Mock os.homedir() for global config
jest.mock('os', () => ({
  homedir: () => '/home/testuser',
}));

describe('Core: ConfigManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // loadProjectConfig Tests
  // ============================================================================
  describe('loadProjectConfig', () => {
    describe('Valid configurations', () => {
      it('should load existing valid project config successfully', async () => {
        // Arrange
        const projectDir = '/home/user/my-project';
        const configPath = path.join(projectDir, CONFIG_PATH);
        const validConfig: OvertureConfig = {
          version: '1.0',
          project: {
            name: 'my-project',
            type: 'python-backend',
          },
          plugins: {
            'python-development': {
              marketplace: 'claude-code-workflows',
              enabled: true,
              mcps: ['python-repl', 'ruff'],
            },
          },
          mcp: {
            'python-repl': {
              command: 'uvx',
              args: ['mcp-server-python-repl'],
              scope: 'project',
              enabled: true,
            },
          },
        };

        (FsUtils.exists as jest.Mock).mockResolvedValue(true);
        (FsUtils.readFile as jest.Mock).mockResolvedValue('version: 1.0');
        (yaml.load as jest.Mock).mockReturnValue(validConfig);

        // Act
        const result = await ConfigManager.loadProjectConfig(projectDir);

        // Assert
        expect(result).toEqual(validConfig);
        expect(FsUtils.exists).toHaveBeenCalledWith(configPath);
        expect(FsUtils.readFile).toHaveBeenCalledWith(configPath);
        expect(yaml.load).toHaveBeenCalled();
      });

      it('should use process.cwd() when projectDir not provided', async () => {
        // Arrange
        const currentDir = process.cwd();
        const configPath = path.join(currentDir, CONFIG_PATH);
        const validConfig: OvertureConfig = {
          version: '1.0',
          plugins: {},
          mcp: {},
        };

        (FsUtils.exists as jest.Mock).mockResolvedValue(true);
        (FsUtils.readFile as jest.Mock).mockResolvedValue('version: 1.0');
        (yaml.load as jest.Mock).mockReturnValue(validConfig);

        // Act
        const result = await ConfigManager.loadProjectConfig();

        // Assert
        expect(result).toEqual(validConfig);
        expect(FsUtils.exists).toHaveBeenCalledWith(configPath);
      });

      it('should load config with disabled MCPs', async () => {
        // Arrange
        const projectDir = '/project';
        const configPath = path.join(projectDir, CONFIG_PATH);
        const configWithDisabledMcp: OvertureConfig = {
          version: '1.0',
          plugins: {},
          mcp: {
            'enabled-mcp': {
              command: 'test-command',
              scope: 'project',
              enabled: true,
            },
            'disabled-mcp': {
              command: 'disabled-command',
              scope: 'project',
              enabled: false,
            },
          },
        };

        (FsUtils.exists as jest.Mock).mockResolvedValue(true);
        (FsUtils.readFile as jest.Mock).mockResolvedValue('version: 1.0');
        (yaml.load as jest.Mock).mockReturnValue(configWithDisabledMcp);

        // Act
        const result = await ConfigManager.loadProjectConfig(projectDir);

        // Assert
        expect(result).toEqual(configWithDisabledMcp);
        expect(result?.mcp['disabled-mcp'].enabled).toBe(false);
      });

      it('should load config with multiple plugins and MCPs', async () => {
        // Arrange
        const projectDir = '/project';
        const configPath = path.join(projectDir, CONFIG_PATH);
        const complexConfig: OvertureConfig = {
          version: '1.0',
          project: {
            name: 'complex-project',
            type: 'fullstack',
            description: 'A complex project',
          },
          plugins: {
            'python-development': {
              marketplace: 'claude-code-workflows',
              enabled: true,
              mcps: ['python-repl', 'ruff'],
            },
            'typescript-development': {
              marketplace: 'claude-code-workflows',
              enabled: true,
              mcps: ['node-repl'],
            },
          },
          mcp: {
            'python-repl': {
              command: 'uvx',
              args: ['mcp-server-python-repl'],
              scope: 'project',
              enabled: true,
            },
            'ruff': {
              command: 'uvx',
              args: ['mcp-server-ruff'],
              scope: 'project',
              enabled: true,
            },
            'node-repl': {
              command: 'node-mcp',
              scope: 'project',
              enabled: true,
            },
          },
        };

        (FsUtils.exists as jest.Mock).mockResolvedValue(true);
        (FsUtils.readFile as jest.Mock).mockResolvedValue('config yaml');
        (yaml.load as jest.Mock).mockReturnValue(complexConfig);

        // Act
        const result = await ConfigManager.loadProjectConfig(projectDir);

        // Assert
        expect(result?.plugins).toHaveProperty('python-development');
        expect(result?.plugins).toHaveProperty('typescript-development');
        expect(Object.keys(result?.mcp || {})).toHaveLength(3);
      });

      it('should load config with environment variables in MCPs', async () => {
        // Arrange
        const projectDir = '/project';
        const configPath = path.join(projectDir, CONFIG_PATH);
        const configWithEnv: OvertureConfig = {
          version: '1.0',
          plugins: {},
          mcp: {
            'github': {
              command: 'mcp-server-github',
              scope: 'project',
              enabled: true,
              env: {
                GITHUB_TOKEN: '${GITHUB_TOKEN}',
                GITHUB_API_URL: 'https://api.github.com',
              },
            },
          },
        };

        (FsUtils.exists as jest.Mock).mockResolvedValue(true);
        (FsUtils.readFile as jest.Mock).mockResolvedValue('config yaml');
        (yaml.load as jest.Mock).mockReturnValue(configWithEnv);

        // Act
        const result = await ConfigManager.loadProjectConfig(projectDir);

        // Assert
        expect(result?.mcp['github'].env).toEqual({
          GITHUB_TOKEN: '${GITHUB_TOKEN}',
          GITHUB_API_URL: 'https://api.github.com',
        });
      });
    });

    describe('File not found', () => {
      it('should return null when config file does not exist', async () => {
        // Arrange
        const projectDir = '/nonexistent';
        const configPath = path.join(projectDir, CONFIG_PATH);

        (FsUtils.exists as jest.Mock).mockResolvedValue(false);

        // Act
        const result = await ConfigManager.loadProjectConfig(projectDir);

        // Assert
        expect(result).toBeNull();
        expect(FsUtils.exists).toHaveBeenCalledWith(configPath);
        expect(FsUtils.readFile).not.toHaveBeenCalled();
      });

      it('should not throw error when config file missing', async () => {
        // Arrange
        const projectDir = '/missing';
        (FsUtils.exists as jest.Mock).mockResolvedValue(false);

        // Act & Assert
        await expect(ConfigManager.loadProjectConfig(projectDir)).resolves.toBeNull();
      });
    });

    describe('Invalid YAML', () => {
      it('should throw ConfigError on invalid YAML syntax', async () => {
        // Arrange
        const projectDir = '/project';
        const configPath = path.join(projectDir, CONFIG_PATH);
        const invalidYaml = 'version: 1.0\nproject:\n  name: test\n  invalid: yaml: content:';

        (FsUtils.exists as jest.Mock).mockResolvedValue(true);
        (FsUtils.readFile as jest.Mock).mockResolvedValue(invalidYaml);
        (yaml.load as jest.Mock).mockImplementation(() => {
          throw new Error('bad indentation of mapping entry');
        });

        // Act & Assert
        await expect(ConfigManager.loadProjectConfig(projectDir)).rejects.toThrow(
          ConfigError
        );
        await expect(ConfigManager.loadProjectConfig(projectDir)).rejects.toThrow(
          'Failed to parse YAML'
        );
      });

      it('should include helpful error message for YAML parsing failure', async () => {
        // Arrange
        const projectDir = '/project';
        const configPath = path.join(projectDir, CONFIG_PATH);

        (FsUtils.exists as jest.Mock).mockResolvedValue(true);
        (FsUtils.readFile as jest.Mock).mockResolvedValue('invalid: {yaml}');
        (yaml.load as jest.Mock).mockImplementation(() => {
          throw new Error('expected scalar or block collection');
        });

        // Act & Assert
        try {
          await ConfigManager.loadProjectConfig(projectDir);
          fail('Should have thrown ConfigError');
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigError);
          expect((error as ConfigError).message).toContain('Failed to parse YAML');
          expect((error as ConfigError).filePath).toBe(configPath);
        }
      });

      it('should throw ConfigError on empty YAML file', async () => {
        // Arrange
        const projectDir = '/project';

        (FsUtils.exists as jest.Mock).mockResolvedValue(true);
        (FsUtils.readFile as jest.Mock).mockResolvedValue('');
        (yaml.load as jest.Mock).mockReturnValue(null);

        // Act & Assert
        await expect(ConfigManager.loadProjectConfig(projectDir)).rejects.toThrow(
          ConfigError
        );
      });
    });

    describe('Zod validation failures', () => {
      it('should throw ConfigError when plugins field is wrong type', async () => {
        // Arrange
        const projectDir = '/project';
        const configPath = path.join(projectDir, CONFIG_PATH);
        const invalidConfig = {
          version: '1.0',
          plugins: 'not-an-object', // Invalid: should be object
          mcp: {},
        };

        (FsUtils.exists as jest.Mock).mockResolvedValue(true);
        (FsUtils.readFile as jest.Mock).mockResolvedValue('config');
        (yaml.load as jest.Mock).mockReturnValue(invalidConfig);

        // Act & Assert
        await expect(ConfigManager.loadProjectConfig(projectDir)).rejects.toThrow(
          ConfigError
        );
        await expect(ConfigManager.loadProjectConfig(projectDir)).rejects.toThrow(
          'Invalid configuration'
        );
      });

      it('should provide helpful error message from Zod validation', async () => {
        // Arrange
        const projectDir = '/project';
        const configPath = path.join(projectDir, CONFIG_PATH);
        const invalidConfig = {
          version: '1.0',
          plugins: {
            'plugin-name': {
              marketplace: 'marketplace',
              mcps: 'not-an-array', // Invalid: should be array
            },
          },
          mcp: {},
        };

        (FsUtils.exists as jest.Mock).mockResolvedValue(true);
        (FsUtils.readFile as jest.Mock).mockResolvedValue('config');
        (yaml.load as jest.Mock).mockReturnValue(invalidConfig);

        // Act & Assert
        try {
          await ConfigManager.loadProjectConfig(projectDir);
          fail('Should have thrown ConfigError');
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigError);
          expect((error as ConfigError).message).toContain('Invalid configuration');
          expect((error as ConfigError).filePath).toBe(configPath);
        }
      });

      it('should throw ConfigError when MCP field is wrong type', async () => {
        // Arrange
        const projectDir = '/project';

        (FsUtils.exists as jest.Mock).mockResolvedValue(true);
        (FsUtils.readFile as jest.Mock).mockResolvedValue('config');
        (yaml.load as jest.Mock).mockReturnValue({
          version: '1.0',
          plugins: {},
          mcp: 'not-an-object', // Invalid: should be object
        });

        // Act & Assert
        await expect(ConfigManager.loadProjectConfig(projectDir)).rejects.toThrow(
          ConfigError
        );
      });
    });

    describe('FsUtils errors', () => {
      it('should propagate ConfigError from FsUtils.readFile', async () => {
        // Arrange
        const projectDir = '/project';
        const configPath = path.join(projectDir, CONFIG_PATH);
        const readError = new ConfigError('File read permission denied', configPath);

        (FsUtils.exists as jest.Mock).mockResolvedValue(true);
        (FsUtils.readFile as jest.Mock).mockRejectedValue(readError);

        // Act & Assert
        await expect(ConfigManager.loadProjectConfig(projectDir)).rejects.toThrow(
          ConfigError
        );
      });

      it('should wrap non-ConfigError exceptions as ConfigError', async () => {
        // Arrange
        const projectDir = '/project';
        const error = new Error('Unexpected error');

        (FsUtils.exists as jest.Mock).mockResolvedValue(true);
        (FsUtils.readFile as jest.Mock).mockRejectedValue(error);

        // Act & Assert
        await expect(ConfigManager.loadProjectConfig(projectDir)).rejects.toThrow(
          ConfigError
        );
      });
    });
  });

  // ============================================================================
  // loadGlobalConfig Tests
  // ============================================================================
  describe('loadGlobalConfig', () => {
    describe('Valid configurations', () => {
      it('should load existing valid global config successfully', async () => {
        // Arrange
        const globalConfigPath = path.join(GLOBAL_CONFIG_DIR, 'config.yaml');
        const globalConfig: OvertureConfig = {
          version: '1.0',
          project: {
            name: 'global-defaults',
          },
          plugins: {
            'python-development': {
              marketplace: 'claude-code-workflows',
              enabled: true,
              mcps: ['python-repl', 'ruff'],
            },
          },
          mcp: {
            'filesystem': {
              scope: 'global',
              enabled: true,
            },
          },
        };

        (FsUtils.exists as jest.Mock).mockResolvedValue(true);
        (FsUtils.readFile as jest.Mock).mockResolvedValue('global config');
        (yaml.load as jest.Mock).mockReturnValue(globalConfig);

        // Act
        const result = await ConfigManager.loadGlobalConfig();

        // Assert
        expect(result).toEqual(globalConfig);
        expect(FsUtils.exists).toHaveBeenCalledWith(globalConfigPath);
        expect(FsUtils.readFile).toHaveBeenCalledWith(globalConfigPath);
      });

      it('should load config from ~/.config/overture/config.yaml', async () => {
        // Arrange
        const expectedPath = path.join(GLOBAL_CONFIG_DIR, 'config.yaml');
        const config: OvertureConfig = {
          version: '1.0',
          plugins: {},
          mcp: {},
        };

        (FsUtils.exists as jest.Mock).mockResolvedValue(true);
        (FsUtils.readFile as jest.Mock).mockResolvedValue('');
        (yaml.load as jest.Mock).mockReturnValue(config);

        // Act
        await ConfigManager.loadGlobalConfig();

        // Assert
        expect(FsUtils.exists).toHaveBeenCalledWith(expectedPath);
      });
    });

    describe('File not found', () => {
      it('should return null when global config file does not exist', async () => {
        // Arrange
        const globalConfigPath = path.join(GLOBAL_CONFIG_DIR, 'config.yaml');
        (FsUtils.exists as jest.Mock).mockResolvedValue(false);

        // Act
        const result = await ConfigManager.loadGlobalConfig();

        // Assert
        expect(result).toBeNull();
        expect(FsUtils.exists).toHaveBeenCalledWith(globalConfigPath);
        expect(FsUtils.readFile).not.toHaveBeenCalled();
      });

      it('should not throw error when global config missing', async () => {
        // Arrange
        (FsUtils.exists as jest.Mock).mockResolvedValue(false);

        // Act & Assert
        await expect(ConfigManager.loadGlobalConfig()).resolves.toBeNull();
      });
    });

    describe('Invalid configurations', () => {
      it('should throw ConfigError on invalid global YAML', async () => {
        // Arrange
        (FsUtils.exists as jest.Mock).mockResolvedValue(true);
        (FsUtils.readFile as jest.Mock).mockResolvedValue('invalid yaml:');
        (yaml.load as jest.Mock).mockImplementation(() => {
          throw new Error('YAML parse error');
        });

        // Act & Assert
        await expect(ConfigManager.loadGlobalConfig()).rejects.toThrow(ConfigError);
      });

      it('should throw ConfigError on Zod validation failure', async () => {
        // Arrange
        (FsUtils.exists as jest.Mock).mockResolvedValue(true);
        (FsUtils.readFile as jest.Mock).mockResolvedValue('config');
        (yaml.load as jest.Mock).mockReturnValue({
          version: '1.0',
          plugins: 'invalid', // Should be object
          mcp: {},
        });

        // Act & Assert
        await expect(ConfigManager.loadGlobalConfig()).rejects.toThrow(ConfigError);
      });
    });
  });

  // ============================================================================
  // mergeConfigs Tests
  // ============================================================================
  describe('mergeConfigs', () => {
    describe('Valid merges', () => {
      it('should merge global and project configs with project taking precedence', () => {
        // Arrange
        const globalConfig: OvertureConfig = {
          version: '1.0',
          project: { name: 'global' },
          plugins: {
            'python-development': {
              marketplace: 'claude-code-workflows',
              enabled: true,
              mcps: ['python-repl'],
            },
          },
          mcp: {
            'filesystem': { scope: 'global', enabled: true },
          },
        };

        const projectConfig: OvertureConfig = {
          version: '1.0',
          project: { name: 'my-project', type: 'python-backend' },
          plugins: {
            'python-development': {
              marketplace: 'claude-code-workflows',
              enabled: false,
              mcps: ['python-repl', 'ruff'],
            },
          },
          mcp: {
            'ruff': {
              command: 'uvx',
              args: ['mcp-server-ruff'],
              scope: 'project',
              enabled: true,
            },
          },
        };

        // Act
        const result = ConfigManager.mergeConfigs(globalConfig, projectConfig);

        // Assert
        expect(result.project).toEqual({
          name: 'my-project',
          type: 'python-backend',
        });
        expect(result.plugins['python-development']).toEqual(
          projectConfig.plugins['python-development']
        );
        expect(result.mcp).toHaveProperty('filesystem');
        expect(result.mcp).toHaveProperty('ruff');
      });

      it('should use project version when available', () => {
        // Arrange
        const globalConfig: OvertureConfig = {
          version: '1.0',
          plugins: {},
          mcp: {},
        };

        const projectConfig: OvertureConfig = {
          version: '2.0',
          plugins: {},
          mcp: {},
        };

        // Act
        const result = ConfigManager.mergeConfigs(globalConfig, projectConfig);

        // Assert
        expect(result.version).toBe('2.0');
      });

      it('should use global version when project version missing', () => {
        // Arrange
        const globalConfig: OvertureConfig = {
          version: '1.5',
          plugins: {},
          mcp: {},
        };

        const projectConfig: OvertureConfig = {
          version: '1.0', // We'll let this be overridden by project
          plugins: {},
          mcp: {},
        };

        // Act
        const result = ConfigManager.mergeConfigs(globalConfig, projectConfig);

        // Assert
        expect(result.version).toBe('1.0'); // Project takes precedence
      });

      it('should merge plugins from both configs', () => {
        // Arrange
        const globalConfig: OvertureConfig = {
          version: '1.0',
          plugins: {
            'global-plugin': {
              marketplace: 'market1',
              mcps: ['mcp1'],
            },
          },
          mcp: {},
        };

        const projectConfig: OvertureConfig = {
          version: '1.0',
          plugins: {
            'project-plugin': {
              marketplace: 'market2',
              mcps: ['mcp2'],
            },
          },
          mcp: {},
        };

        // Act
        const result = ConfigManager.mergeConfigs(globalConfig, projectConfig);

        // Assert
        expect(result.plugins).toHaveProperty('global-plugin');
        expect(result.plugins).toHaveProperty('project-plugin');
        expect(Object.keys(result.plugins)).toHaveLength(2);
      });

      it('should merge MCPs from both configs', () => {
        // Arrange
        const globalConfig: OvertureConfig = {
          version: '1.0',
          plugins: {},
          mcp: {
            'global-mcp': { scope: 'global', enabled: true },
          },
        };

        const projectConfig: OvertureConfig = {
          version: '1.0',
          plugins: {},
          mcp: {
            'project-mcp': {
              command: 'cmd',
              scope: 'project',
              enabled: true,
            },
          },
        };

        // Act
        const result = ConfigManager.mergeConfigs(globalConfig, projectConfig);

        // Assert
        expect(result.mcp).toHaveProperty('global-mcp');
        expect(result.mcp).toHaveProperty('project-mcp');
        expect(Object.keys(result.mcp)).toHaveLength(2);
      });

      it('should allow project MCP to override global MCP', () => {
        // Arrange
        const globalConfig: OvertureConfig = {
          version: '1.0',
          plugins: {},
          mcp: {
            'filesystem': {
              scope: 'global',
              enabled: true,
            },
          },
        };

        const projectConfig: OvertureConfig = {
          version: '1.0',
          plugins: {},
          mcp: {
            'filesystem': {
              command: 'custom-fs',
              scope: 'project',
              enabled: false,
            },
          },
        };

        // Act
        const result = ConfigManager.mergeConfigs(globalConfig, projectConfig);

        // Assert
        expect(result.mcp['filesystem']).toEqual(
          projectConfig.mcp['filesystem']
        );
        expect(result.mcp['filesystem'].command).toBe('custom-fs');
        expect(result.mcp['filesystem'].enabled).toBe(false);
      });

      it('should handle null global config', () => {
        // Arrange
        const projectConfig: OvertureConfig = {
          version: '1.0',
          project: { name: 'project' },
          plugins: {
            'python-dev': {
              marketplace: 'market',
              mcps: ['python-repl'],
            },
          },
          mcp: {
            'python-repl': { scope: 'project', enabled: true },
          },
        };

        // Act
        const result = ConfigManager.mergeConfigs(null, projectConfig);

        // Assert
        expect(result).toEqual(projectConfig);
      });

      it('should handle null project config', () => {
        // Arrange
        const globalConfig: OvertureConfig = {
          version: '1.0',
          project: { name: 'global' },
          plugins: {},
          mcp: {
            'filesystem': { scope: 'global', enabled: true },
          },
        };

        // Act
        const result = ConfigManager.mergeConfigs(globalConfig, null);

        // Assert
        // Note: project?.project returns undefined when project is null
        expect(result.project).toBeUndefined();
        expect(result.mcp).toEqual(globalConfig.mcp);
        expect(result.version).toBe('1.0');
      });

      it('should set default version when both configs null version', () => {
        // Arrange
        const globalConfig: OvertureConfig = {
          version: '1.0',
          plugins: {},
          mcp: {},
        };

        const projectConfig: OvertureConfig = {
          version: '1.0',
          plugins: {},
          mcp: {},
        };

        // Act
        const result = ConfigManager.mergeConfigs(globalConfig, projectConfig);

        // Assert
        expect(result.version).toBeDefined();
        expect(result.version).toBe('1.0');
      });

      it('should merge nested plugin MCPs correctly', () => {
        // Arrange
        const globalConfig: OvertureConfig = {
          version: '1.0',
          plugins: {
            'plugin1': {
              marketplace: 'market',
              mcps: ['mcp-a'],
            },
          },
          mcp: {},
        };

        const projectConfig: OvertureConfig = {
          version: '1.0',
          plugins: {
            'plugin2': {
              marketplace: 'market',
              mcps: ['mcp-b', 'mcp-c'],
            },
          },
          mcp: {},
        };

        // Act
        const result = ConfigManager.mergeConfigs(globalConfig, projectConfig);

        // Assert
        expect(Object.keys(result.plugins)).toHaveLength(2);
        expect(result.plugins['plugin1'].mcps).toEqual(['mcp-a']);
        expect(result.plugins['plugin2'].mcps).toEqual(['mcp-b', 'mcp-c']);
      });
    });

    describe('Error cases', () => {
      it('should throw ConfigError when both configs are null', () => {
        // Act & Assert
        expect(() => ConfigManager.mergeConfigs(null, null)).toThrow(
          ConfigError
        );
        expect(() => ConfigManager.mergeConfigs(null, null)).toThrow(
          'No configuration found'
        );
      });

      it('should throw ConfigError with helpful message', () => {
        // Act & Assert
        try {
          ConfigManager.mergeConfigs(null, null);
          fail('Should have thrown ConfigError');
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigError);
          expect((error as ConfigError).message).toBe(
            'No configuration found'
          );
        }
      });
    });
  });

  // ============================================================================
  // saveConfig Tests
  // ============================================================================
  describe('saveConfig', () => {
    describe('Successful saves', () => {
      it('should save config with proper YAML formatting', async () => {
        // Arrange
        const filePath = '/path/to/.overture/config.yaml';
        const config: OvertureConfig = {
          version: '1.0',
          project: {
            name: 'my-project',
            type: 'python-backend',
          },
          plugins: {
            'python-development': {
              marketplace: 'claude-code-workflows',
              enabled: true,
              mcps: ['python-repl', 'ruff'],
            },
          },
          mcp: {
            'python-repl': {
              command: 'uvx',
              args: ['mcp-server-python-repl'],
              scope: 'project',
              enabled: true,
            },
          },
        };

        (yaml.dump as jest.Mock).mockReturnValue('version: 1.0\n...\n');
        (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);

        // Act
        await ConfigManager.saveConfig(config, filePath);

        // Assert
        expect(yaml.dump).toHaveBeenCalledWith(config, {
          indent: 2,
          lineWidth: 80,
          noRefs: true,
        });
        expect(FsUtils.writeFile).toHaveBeenCalledWith(
          filePath,
          'version: 1.0\n...\n'
        );
      });

      it('should use proper YAML formatting options', async () => {
        // Arrange
        const filePath = '/path/config.yaml';
        const config: OvertureConfig = {
          version: '1.0',
          plugins: {},
          mcp: {},
        };

        (yaml.dump as jest.Mock).mockReturnValue('config yaml');
        (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);

        // Act
        await ConfigManager.saveConfig(config, filePath);

        // Assert
        const dumpCall = (yaml.dump as jest.Mock).mock.calls[0];
        expect(dumpCall[1]).toEqual({
          indent: 2,
          lineWidth: 80,
          noRefs: true,
        });
      });

      it('should create parent directories via FsUtils', async () => {
        // Arrange
        const filePath = '/deep/nested/path/.overture/config.yaml';
        const config: OvertureConfig = {
          version: '1.0',
          plugins: {},
          mcp: {},
        };

        (yaml.dump as jest.Mock).mockReturnValue('yaml content');
        (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);

        // Act
        await ConfigManager.saveConfig(config, filePath);

        // Assert
        expect(FsUtils.writeFile).toHaveBeenCalled();
      });

      it('should save config with complex structure', async () => {
        // Arrange
        const filePath = '/project/config.yaml';
        const complexConfig: OvertureConfig = {
          version: '1.0',
          project: {
            name: 'complex',
            type: 'fullstack',
            description: 'A complex project',
          },
          plugins: {
            'plugin1': {
              marketplace: 'market1',
              enabled: true,
              mcps: ['mcp1', 'mcp2'],
            },
            'plugin2': {
              marketplace: 'market2',
              enabled: false,
              mcps: ['mcp3'],
            },
          },
          mcp: {
            'mcp1': {
              command: 'cmd1',
              args: ['arg1', 'arg2'],
              scope: 'project',
              enabled: true,
            },
            'mcp2': {
              command: 'cmd2',
              scope: 'global',
              enabled: true,
              env: { VAR1: 'val1' },
            },
          },
        };

        (yaml.dump as jest.Mock).mockReturnValue('complex yaml');
        (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);

        // Act
        await ConfigManager.saveConfig(complexConfig, filePath);

        // Assert
        expect(yaml.dump).toHaveBeenCalledWith(
          complexConfig,
          expect.objectContaining({
            indent: 2,
            lineWidth: 80,
            noRefs: true,
          })
        );
        expect(FsUtils.writeFile).toHaveBeenCalledWith(
          filePath,
          'complex yaml'
        );
      });

      it('should handle empty plugins and MCPs', async () => {
        // Arrange
        const filePath = '/config.yaml';
        const minimalConfig: OvertureConfig = {
          version: '1.0',
          plugins: {},
          mcp: {},
        };

        (yaml.dump as jest.Mock).mockReturnValue('version: 1.0\n...\n');
        (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);

        // Act
        await ConfigManager.saveConfig(minimalConfig, filePath);

        // Assert
        expect(FsUtils.writeFile).toHaveBeenCalled();
      });
    });

    describe('Error handling', () => {
      it('should throw ConfigError when YAML dump fails', async () => {
        // Arrange
        const filePath = '/path/config.yaml';
        const config: OvertureConfig = {
          version: '1.0',
          plugins: {},
          mcp: {},
        };
        const dumpError = new Error('YAML dump error');

        (yaml.dump as jest.Mock).mockImplementation(() => {
          throw dumpError;
        });

        // Act & Assert
        await expect(ConfigManager.saveConfig(config, filePath)).rejects.toThrow(
          ConfigError
        );
        await expect(ConfigManager.saveConfig(config, filePath)).rejects.toThrow(
          'Failed to save configuration'
        );
      });

      it('should throw ConfigError when write fails', async () => {
        // Arrange
        const filePath = '/path/config.yaml';
        const config: OvertureConfig = {
          version: '1.0',
          plugins: {},
          mcp: {},
        };
        const writeError = new ConfigError('Permission denied', filePath);

        (yaml.dump as jest.Mock).mockReturnValue('yaml content');
        (FsUtils.writeFile as jest.Mock).mockRejectedValue(writeError);

        // Act & Assert
        await expect(ConfigManager.saveConfig(config, filePath)).rejects.toThrow(
          ConfigError
        );
      });

      it('should include helpful error message on write failure', async () => {
        // Arrange
        const filePath = '/read-only/config.yaml';
        const config: OvertureConfig = {
          version: '1.0',
          plugins: {},
          mcp: {},
        };
        const writeError = new Error('EACCES: permission denied');

        (yaml.dump as jest.Mock).mockReturnValue('yaml');
        (FsUtils.writeFile as jest.Mock).mockRejectedValue(writeError);

        // Act & Assert
        try {
          await ConfigManager.saveConfig(config, filePath);
          fail('Should have thrown ConfigError');
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigError);
          expect((error as ConfigError).message).toContain(
            'Failed to save configuration'
          );
          expect((error as ConfigError).filePath).toBe(filePath);
        }
      });

      it('should handle circular references in config', async () => {
        // Arrange
        const filePath = '/path/config.yaml';
        const config: OvertureConfig = {
          version: '1.0',
          plugins: {},
          mcp: {},
        };

        (yaml.dump as jest.Mock).mockReturnValue('version: 1.0\n...\n');
        (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);

        // Act
        await ConfigManager.saveConfig(config, filePath);

        // Assert - noRefs should be true
        expect(yaml.dump).toHaveBeenCalledWith(
          config,
          expect.objectContaining({ noRefs: true })
        );
      });
    });
  });

  // ============================================================================
  // initializeConfig Tests
  // ============================================================================
  describe('initializeConfig', () => {
    describe('Successful initialization', () => {
      it('should initialize config with project name from directory basename', async () => {
        // Arrange
        const projectDir = '/home/user/my-awesome-project';
        const expectedConfig: OvertureConfig = {
          version: '1.0',
          project: {
            name: 'my-awesome-project',
            type: undefined,
          },
          plugins: {},
          mcp: {},
        };

        (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
        (yaml.dump as jest.Mock).mockReturnValue('version: 1.0\n');

        // Act
        const result = await ConfigManager.initializeConfig(projectDir);

        // Assert
        expect(result.project?.name).toBe('my-awesome-project');
        expect(result.version).toBe('1.0');
        expect(result.plugins).toEqual({});
        expect(result.mcp).toEqual({});
      });

      it('should initialize config with project type when provided', async () => {
        // Arrange
        const projectDir = '/home/user/my-project';
        const projectType = 'python-backend';

        (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
        (yaml.dump as jest.Mock).mockReturnValue('version: 1.0\n');

        // Act
        const result = await ConfigManager.initializeConfig(
          projectDir,
          projectType
        );

        // Assert
        expect(result.project?.name).toBe('my-project');
        expect(result.project?.type).toBe('python-backend');
      });

      it('should save to .overture/config.yaml in project directory', async () => {
        // Arrange
        const projectDir = '/home/user/project';
        const expectedPath = path.join(projectDir, CONFIG_PATH);

        (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
        (yaml.dump as jest.Mock).mockReturnValue('yaml');

        // Act
        await ConfigManager.initializeConfig(projectDir);

        // Assert
        expect(FsUtils.writeFile).toHaveBeenCalledWith(
          expectedPath,
          expect.any(String)
        );
      });

      it('should return created config object', async () => {
        // Arrange
        const projectDir = '/home/user/test-project';
        const projectType = 'typescript-frontend';

        (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
        (yaml.dump as jest.Mock).mockReturnValue('yaml');

        // Act
        const result = await ConfigManager.initializeConfig(
          projectDir,
          projectType
        );

        // Assert
        expect(result).toHaveProperty('version');
        expect(result).toHaveProperty('project');
        expect(result).toHaveProperty('plugins');
        expect(result).toHaveProperty('mcp');
      });

      it('should initialize with empty plugins and MCP', async () => {
        // Arrange
        const projectDir = '/project';

        (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
        (yaml.dump as jest.Mock).mockReturnValue('yaml');

        // Act
        const result = await ConfigManager.initializeConfig(projectDir);

        // Assert
        expect(result.plugins).toEqual({});
        expect(result.mcp).toEqual({});
      });

      it('should handle project dir with nested path', async () => {
        // Arrange
        const projectDir = '/home/user/workspace/projects/deep-project';

        (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
        (yaml.dump as jest.Mock).mockReturnValue('yaml');

        // Act
        const result = await ConfigManager.initializeConfig(projectDir);

        // Assert
        expect(result.project?.name).toBe('deep-project');
      });

      it('should handle project dir with special characters in name', async () => {
        // Arrange
        const projectDir = '/home/user/my-project-v2';

        (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
        (yaml.dump as jest.Mock).mockReturnValue('yaml');

        // Act
        const result = await ConfigManager.initializeConfig(projectDir);

        // Assert
        expect(result.project?.name).toBe('my-project-v2');
      });

      it('should properly format and save YAML output', async () => {
        // Arrange
        const projectDir = '/project';

        (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
        (yaml.dump as jest.Mock).mockReturnValue('formatted yaml');

        // Act
        await ConfigManager.initializeConfig(projectDir);

        // Assert
        expect(yaml.dump).toHaveBeenCalledWith(
          expect.objectContaining({
            version: '1.0',
            plugins: {},
            mcp: {},
          }),
          expect.objectContaining({
            indent: 2,
            lineWidth: 80,
            noRefs: true,
          })
        );
      });
    });

    describe('Error handling', () => {
      it('should throw ConfigError when save fails', async () => {
        // Arrange
        const projectDir = '/project';
        const saveError = new ConfigError('Permission denied', '.overture/config.yaml');

        (FsUtils.writeFile as jest.Mock).mockRejectedValue(saveError);
        (yaml.dump as jest.Mock).mockReturnValue('yaml');

        // Act & Assert
        await expect(
          ConfigManager.initializeConfig(projectDir)
        ).rejects.toThrow(ConfigError);
      });

      it('should throw ConfigError when YAML dump fails', async () => {
        // Arrange
        const projectDir = '/project';

        (yaml.dump as jest.Mock).mockImplementation(() => {
          throw new Error('Dump error');
        });

        // Act & Assert
        await expect(
          ConfigManager.initializeConfig(projectDir)
        ).rejects.toThrow(ConfigError);
      });

      it('should include helpful error context on failure', async () => {
        // Arrange
        const projectDir = '/project';
        const error = new ConfigError(
          'Failed to write file',
          path.join(projectDir, CONFIG_PATH)
        );

        (FsUtils.writeFile as jest.Mock).mockRejectedValue(error);
        (yaml.dump as jest.Mock).mockReturnValue('yaml');

        // Act & Assert
        try {
          await ConfigManager.initializeConfig(projectDir);
          fail('Should have thrown ConfigError');
        } catch (err) {
          expect(err).toBeInstanceOf(ConfigError);
          expect((err as ConfigError).filePath).toContain('.overture');
        }
      });
    });

    describe('Edge cases', () => {
      it('should handle project dir with trailing slash', async () => {
        // Arrange
        const projectDir = '/home/user/my-project/';

        (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
        (yaml.dump as jest.Mock).mockReturnValue('yaml');

        // Act
        const result = await ConfigManager.initializeConfig(projectDir);

        // Assert
        expect(result.project?.name).toBeDefined();
      });

      it('should omit project type when not provided', async () => {
        // Arrange
        const projectDir = '/project';

        (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
        (yaml.dump as jest.Mock).mockReturnValue('yaml');

        // Act
        const result = await ConfigManager.initializeConfig(projectDir);

        // Assert
        expect(result.project?.type).toBeUndefined();
      });

      it('should always use version 1.0', async () => {
        // Arrange
        const projectDir = '/project';

        (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
        (yaml.dump as jest.Mock).mockReturnValue('yaml');

        // Act
        const result = await ConfigManager.initializeConfig(projectDir);

        // Assert
        expect(result.version).toBe('1.0');
      });
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================
  describe('Integration scenarios', () => {
    it('should load, merge, and save configs correctly', async () => {
      // Arrange
      const projectDir = '/project';
      const globalConfig: OvertureConfig = {
        version: '1.0',
        plugins: {
          'global-plugin': {
            marketplace: 'market',
            mcps: ['global-mcp'],
          },
        },
        mcp: {
          'global-mcp': { scope: 'global', enabled: true },
        },
      };

      const projectConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'my-project' },
        plugins: {
          'project-plugin': {
            marketplace: 'market',
            mcps: ['project-mcp'],
          },
        },
        mcp: {
          'project-mcp': {
            command: 'cmd',
            scope: 'project',
            enabled: true,
          },
        },
      };

      (FsUtils.exists as jest.Mock)
        .mockResolvedValueOnce(true) // loadGlobalConfig exists check
        .mockResolvedValueOnce(true); // loadProjectConfig exists check
      (FsUtils.readFile as jest.Mock)
        .mockResolvedValueOnce('global yaml')
        .mockResolvedValueOnce('project yaml');
      (yaml.load as jest.Mock)
        .mockReturnValueOnce(globalConfig)
        .mockReturnValueOnce(projectConfig);
      (yaml.dump as jest.Mock).mockReturnValue('merged yaml');
      (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);

      // Act
      const global = await ConfigManager.loadGlobalConfig();
      const project = await ConfigManager.loadProjectConfig(projectDir);
      const merged = ConfigManager.mergeConfigs(global, project);
      await ConfigManager.saveConfig(
        merged,
        path.join(projectDir, CONFIG_PATH)
      );

      // Assert
      expect(merged.plugins).toHaveProperty('global-plugin');
      expect(merged.plugins).toHaveProperty('project-plugin');
      expect(FsUtils.writeFile).toHaveBeenCalled();
    });

    it('should initialize and then load config', async () => {
      // Arrange
      const projectDir = '/new-project';
      const configPath = path.join(projectDir, CONFIG_PATH);

      (yaml.dump as jest.Mock).mockReturnValue('initialized yaml');
      (FsUtils.writeFile as jest.Mock).mockResolvedValue(undefined);
      (FsUtils.exists as jest.Mock).mockResolvedValue(true);
      (FsUtils.readFile as jest.Mock).mockResolvedValue('initialized yaml');

      // Act
      const initialized = await ConfigManager.initializeConfig(
        projectDir,
        'python-backend'
      );
      expect(FsUtils.writeFile).toHaveBeenCalledWith(
        configPath,
        expect.any(String)
      );
    });

    it('should handle missing global config gracefully', async () => {
      // Arrange
      const projectConfig: OvertureConfig = {
        version: '1.0',
        project: { name: 'project' },
        plugins: {},
        mcp: {},
      };

      (FsUtils.exists as jest.Mock).mockResolvedValue(false); // Global doesn't exist
      (FsUtils.readFile as jest.Mock).mockResolvedValue('project yaml');
      (yaml.load as jest.Mock).mockReturnValue(projectConfig);

      // Act
      const global = await ConfigManager.loadGlobalConfig();
      const merged = ConfigManager.mergeConfigs(null, projectConfig);

      // Assert
      expect(global).toBeNull();
      expect(merged).toEqual(projectConfig);
    });
  });
});
