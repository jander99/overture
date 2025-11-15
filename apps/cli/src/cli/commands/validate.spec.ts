/**
 * Tests for validate command
 *
 * @module cli/commands/validate.spec
 */

// Mock chalk FIRST before any other imports
jest.mock('chalk', () => {
  const mockFn = (str: string) => str;
  // Make mockFn chainable and add all the methods - as actual functions
  mockFn.bold = mockFn;
  mockFn.blue = mockFn;
  mockFn.yellow = mockFn;
  mockFn.magenta = mockFn;
  mockFn.green = mockFn;
  mockFn.red = mockFn;
  mockFn.gray = mockFn;
  mockFn.cyan = mockFn;
  mockFn.dim = mockFn;
  return mockFn;
});

// Import error classes BEFORE mocking config-loader
import { ConfigLoadError, ConfigValidationError } from '../../core/config-loader';
import { createValidateCommand } from './validate';
import * as configLoader from '../../core/config-loader';
import * as transportValidator from '../../core/transport-validator';
import * as adapterRegistryModule from '../../adapters/adapter-registry';
import * as pathResolver from '../../core/path-resolver';
import * as errorHandlerModule from '../../core/error-handler';
import type { OvertureConfig, ClientName, Platform } from '../../domain/config.types';
import type { ClientAdapter } from '../../adapters/client-adapter.interface';

// Mock dependencies
jest.mock('../../core/config-loader', () => {
  const actual = jest.requireActual('../../core/config-loader');
  return {
    ...actual,
    loadConfig: jest.fn(),
  };
});
jest.mock('../../core/transport-validator');
jest.mock('../../adapters/adapter-registry');
jest.mock('../../core/path-resolver');
jest.mock('../../core/error-handler');

describe('validate command', () => {
  let mockLoadConfig: jest.SpyInstance;
  let mockGetTransportWarnings: jest.SpyInstance;
  let mockGetTransportValidationSummary: jest.SpyInstance;
  let mockAdapterRegistry: { get: jest.Mock; getInstalledAdapters: jest.Mock };
  let mockGetPlatform: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;

  // Mock client adapter
  const mockClientAdapter: ClientAdapter = {
    name: 'claude-code' as ClientName,
    schemaRootKey: 'mcpServers',
    detectConfigPath: jest.fn(),
    readConfig: jest.fn(),
    writeConfig: jest.fn(),
    convertFromOverture: jest.fn(),
    supportsTransport: jest.fn().mockReturnValue(true),
    needsEnvVarExpansion: jest.fn().mockReturnValue(false),
    isInstalled: jest.fn().mockReturnValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock process.exit FIRST before any other setup
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`Process exit: ${code}`);
    });

    // Mock ErrorHandler to call process.exit with appropriate codes based on error type
    (errorHandlerModule.ErrorHandler.handleCommandError as jest.Mock).mockImplementation((error, cmd, verbose) => {
      let exitCode = 1;

      // Determine exit code based on error type
      if (error instanceof ConfigValidationError) {
        exitCode = 3;
      } else if (error instanceof ConfigLoadError) {
        exitCode = 2;
      } else {
        exitCode = 1;
      }

      throw new Error(`Process exit: ${exitCode}`);
    });

    // Mock config loader
    mockLoadConfig = jest.spyOn(configLoader, 'loadConfig');

    // Mock transport validator
    mockGetTransportWarnings = jest.spyOn(transportValidator, 'getTransportWarnings').mockReturnValue([]);
    mockGetTransportValidationSummary = jest.spyOn(transportValidator, 'getTransportValidationSummary').mockReturnValue({
      total: 0,
      supported: 0,
      unsupported: 0,
      warnings: [],
    });

    // Mock adapter registry
    mockAdapterRegistry = {
      get: jest.fn(),
      getInstalledAdapters: jest.fn().mockReturnValue([]),
    };
    (adapterRegistryModule.adapterRegistry as any) = mockAdapterRegistry;

    // Mock path resolver
    mockGetPlatform = jest.spyOn(pathResolver, 'getPlatform').mockReturnValue('linux');
  });

  afterEach(() => {
    if (exitSpy) {
      exitSpy.mockRestore();
    }
  });

  describe('command creation', () => {
    it('should create validate command with correct name', () => {
      const command = createValidateCommand();
      expect(command.name()).toBe('validate');
    });

    it('should have description', () => {
      const command = createValidateCommand();
      expect(command.description()).toContain('Validate');
    });

    it('should have platform option', () => {
      const command = createValidateCommand();
      const options = command.options;
      const platformOption = options.find((opt) => opt.long === '--platform');
      expect(platformOption).toBeDefined();
    });

    it('should have client option', () => {
      const command = createValidateCommand();
      const options = command.options;
      const clientOption = options.find((opt) => opt.long === '--client');
      expect(clientOption).toBeDefined();
    });

    it('should have verbose option', () => {
      const command = createValidateCommand();
      const options = command.options;
      const verboseOption = options.find((opt) => opt.long === '--verbose');
      expect(verboseOption).toBeDefined();
    });
  });

  describe('valid configuration', () => {
    it('should validate a correct v2.0 config', async () => {
      const validConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            env: {},
            transport: 'stdio',
          },
        },
      };

      mockLoadConfig.mockReturnValue(validConfig);
      mockAdapterRegistry.getInstalledAdapters.mockReturnValue([mockClientAdapter]);
      mockGetTransportWarnings.mockReturnValue([]);
      mockGetTransportValidationSummary.mockReturnValue({
        total: 1,
        supported: 1,
        unsupported: 0,
        warnings: [],
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 0');
    });

    it('should validate config with multiple MCPs', async () => {
      const validConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            env: {},
            transport: 'stdio',
          },
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            env: {},
            transport: 'stdio',
          },
        },
      };

      mockLoadConfig.mockReturnValue(validConfig);
      mockAdapterRegistry.getInstalledAdapters.mockReturnValue([mockClientAdapter]);
      mockGetTransportWarnings.mockReturnValue([]);
      mockGetTransportValidationSummary.mockReturnValue({
        total: 2,
        supported: 2,
        unsupported: 0,
        warnings: [],
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 0');
    });
  });

  describe('transport compatibility validation', () => {
    it('should warn about unsupported transports', async () => {
      const config: OvertureConfig = {
        version: '2.0',
        sync: {
          enabledClients: ['claude-code'],
        },
        mcp: {
          'http-server': {
            command: 'npx',
            args: ['-y', 'http-mcp-server'],
            env: {},
            transport: 'http',
          },
        },
      };

      mockLoadConfig.mockReturnValue(config);
      mockAdapterRegistry.getInstalledAdapters.mockReturnValue([mockClientAdapter]);
      mockAdapterRegistry.get.mockReturnValue(mockClientAdapter);
      mockGetTransportWarnings.mockReturnValue([
        {
          mcpName: 'http-server',
          transport: 'http',
          clientName: 'claude-code',
          message: 'MCP "http-server" uses transport "http" which is not supported by claude-code',
        },
      ]);
      mockGetTransportValidationSummary.mockReturnValue({
        total: 1,
        supported: 0,
        unsupported: 1,
        warnings: [
          {
            mcpName: 'http-server',
            transport: 'http',
            clientName: 'claude-code',
            message: 'MCP "http-server" uses transport "http" which is not supported by claude-code',
          },
        ],
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 0');

      // Should have warnings but still pass
      expect(mockGetTransportWarnings).toHaveBeenCalled();
    });

    it('should validate for specific client', async () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            env: {},
            transport: 'stdio',
          },
        },
      };

      mockLoadConfig.mockReturnValue(config);
      mockAdapterRegistry.get.mockReturnValue(mockClientAdapter);
      mockGetTransportWarnings.mockReturnValue([]);
      mockGetTransportValidationSummary.mockReturnValue({
        total: 1,
        supported: 1,
        unsupported: 0,
        warnings: [],
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test', '--client', 'claude-code'])
      ).rejects.toThrow('Process exit: 0');

      expect(mockAdapterRegistry.get).toHaveBeenCalledWith('claude-code');
    });
  });

  describe('platform validation', () => {
    it('should reject invalid platform in exclusion list', async () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            env: {},
            transport: 'stdio',
            platforms: {
              exclude: ['invalid-platform' as Platform],
            },
          },
        },
      };

      mockLoadConfig.mockReturnValue(config);
      mockAdapterRegistry.getInstalledAdapters.mockReturnValue([mockClientAdapter]);
      mockGetTransportWarnings.mockReturnValue([]);
      mockGetTransportValidationSummary.mockReturnValue({
        total: 1,
        supported: 1,
        unsupported: 0,
        warnings: [],
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 3');
    });

    it('should accept valid platform values', async () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            env: {},
            transport: 'stdio',
            platforms: {
              exclude: ['win32'],
            },
          },
        },
      };

      mockLoadConfig.mockReturnValue(config);
      mockAdapterRegistry.getInstalledAdapters.mockReturnValue([mockClientAdapter]);
      mockGetTransportWarnings.mockReturnValue([]);
      mockGetTransportValidationSummary.mockReturnValue({
        total: 1,
        supported: 1,
        unsupported: 0,
        warnings: [],
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 0');
    });

    it('should validate platform commandOverrides', async () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: [],
            env: {},
            transport: 'stdio',
            platforms: {
              commandOverrides: {
                'invalid-platform': 'some-command',
              },
            },
          },
        },
      };

      mockLoadConfig.mockReturnValue(config);
      mockAdapterRegistry.getInstalledAdapters.mockReturnValue([mockClientAdapter]);
      mockGetTransportWarnings.mockReturnValue([]);
      mockGetTransportValidationSummary.mockReturnValue({
        total: 1,
        supported: 1,
        unsupported: 0,
        warnings: [],
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 3');
    });
  });

  describe('client name validation', () => {
    it('should reject invalid client in exclusion list', async () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            env: {},
            transport: 'stdio',
            clients: {
              exclude: ['invalid-client' as ClientName],
            },
          },
        },
      };

      mockLoadConfig.mockReturnValue(config);
      mockAdapterRegistry.getInstalledAdapters.mockReturnValue([mockClientAdapter]);
      mockGetTransportWarnings.mockReturnValue([]);
      mockGetTransportValidationSummary.mockReturnValue({
        total: 1,
        supported: 1,
        unsupported: 0,
        warnings: [],
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 3');
    });

    it('should accept valid client names', async () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            env: {},
            transport: 'stdio',
            clients: {
              exclude: ['vscode', 'cursor'],
            },
          },
        },
      };

      mockLoadConfig.mockReturnValue(config);
      mockAdapterRegistry.getInstalledAdapters.mockReturnValue([mockClientAdapter]);
      mockGetTransportWarnings.mockReturnValue([]);
      mockGetTransportValidationSummary.mockReturnValue({
        total: 1,
        supported: 1,
        unsupported: 0,
        warnings: [],
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 0');
    });

    it('should validate client names in overrides', async () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: [],
            env: {},
            transport: 'stdio',
            clients: {
              overrides: {
                'invalid-client': {
                  command: 'different-command',
                },
              },
            },
          },
        },
      };

      mockLoadConfig.mockReturnValue(config);
      mockAdapterRegistry.getInstalledAdapters.mockReturnValue([mockClientAdapter]);
      mockGetTransportWarnings.mockReturnValue([]);
      mockGetTransportValidationSummary.mockReturnValue({
        total: 1,
        supported: 1,
        unsupported: 0,
        warnings: [],
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 3');
    });
  });

  describe('environment variable syntax validation', () => {
    it('should accept valid env var syntax', async () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          github: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: {
              GITHUB_TOKEN: '${GITHUB_TOKEN}',
              API_KEY: '${API_KEY:-default_value}',
            },
            transport: 'stdio',
          },
        },
      };

      mockLoadConfig.mockReturnValue(config);
      mockAdapterRegistry.getInstalledAdapters.mockReturnValue([mockClientAdapter]);
      mockGetTransportWarnings.mockReturnValue([]);
      mockGetTransportValidationSummary.mockReturnValue({
        total: 1,
        supported: 1,
        unsupported: 0,
        warnings: [],
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 0');
    });

    it('should reject invalid env var syntax', async () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          github: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: {
              GITHUB_TOKEN: '${GITHUB_TOKEN',
            },
            transport: 'stdio',
          },
        },
      };

      mockLoadConfig.mockReturnValue(config);
      mockAdapterRegistry.getInstalledAdapters.mockReturnValue([mockClientAdapter]);
      mockGetTransportWarnings.mockReturnValue([]);
      mockGetTransportValidationSummary.mockReturnValue({
        total: 1,
        supported: 1,
        unsupported: 0,
        warnings: [],
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 3');
    });

    it('should validate env vars in client overrides', async () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          github: {
            command: 'npx',
            args: [],
            env: {},
            transport: 'stdio',
            clients: {
              overrides: {
                'claude-code': {
                  env: {
                    INVALID_VAR: '${INVALID',
                  },
                },
              },
            },
          },
        },
      };

      mockLoadConfig.mockReturnValue(config);
      mockAdapterRegistry.getInstalledAdapters.mockReturnValue([mockClientAdapter]);
      mockGetTransportWarnings.mockReturnValue([]);
      mockGetTransportValidationSummary.mockReturnValue({
        total: 1,
        supported: 1,
        unsupported: 0,
        warnings: [],
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 3');
    });
  });

  describe('required fields validation', () => {
    it('should reject missing command', async () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: '',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
      };

      mockLoadConfig.mockReturnValue(config);
      mockAdapterRegistry.getInstalledAdapters.mockReturnValue([mockClientAdapter]);
      mockGetTransportWarnings.mockReturnValue([]);
      mockGetTransportValidationSummary.mockReturnValue({
        total: 1,
        supported: 1,
        unsupported: 0,
        warnings: [],
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 3');
    });

    it('should reject missing transport', async () => {
      const config: any = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: [],
            env: {},
            // transport missing
          },
        },
      };

      mockLoadConfig.mockReturnValue(config);
      mockAdapterRegistry.getInstalledAdapters.mockReturnValue([mockClientAdapter]);
      mockGetTransportWarnings.mockReturnValue([]);
      mockGetTransportValidationSummary.mockReturnValue({
        total: 1,
        supported: 1,
        unsupported: 0,
        warnings: [],
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 3');
    });
  });

  describe('duplicate MCP names', () => {
    it('should detect duplicate MCP names (case-insensitive)', async () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: [],
            env: {},
            transport: 'stdio',
          },
          FileSystem: {
            command: 'npx',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
      };

      mockLoadConfig.mockReturnValue(config);
      mockAdapterRegistry.getInstalledAdapters.mockReturnValue([mockClientAdapter]);
      mockGetTransportWarnings.mockReturnValue([]);
      mockGetTransportValidationSummary.mockReturnValue({
        total: 2,
        supported: 2,
        unsupported: 0,
        warnings: [],
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 3');
    });
  });

  describe('config load errors', () => {
    it('should handle ConfigLoadError', async () => {
      const error = new configLoader.ConfigLoadError(
        'File not found',
        '/path/to/config.yaml'
      );
      mockLoadConfig.mockImplementation(() => {
        throw error;
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 2');
    });

    it('should handle ConfigValidationError', async () => {
      const error = new configLoader.ConfigValidationError(
        'Invalid schema',
        '/path/to/config.yaml',
        [{ message: 'Invalid field', path: ['mcp', 'test'], code: 'invalid_type' }]
      );
      mockLoadConfig.mockImplementation(() => {
        throw error;
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 3');
    });
  });

  describe('sync options validation', () => {
    it('should validate enabledClients in sync options', async () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
        sync: {
          enabledClients: ['invalid-client' as ClientName],
        },
      };

      mockLoadConfig.mockReturnValue(config);
      mockAdapterRegistry.getInstalledAdapters.mockReturnValue([mockClientAdapter]);
      mockGetTransportWarnings.mockReturnValue([]);
      mockGetTransportValidationSummary.mockReturnValue({
        total: 1,
        supported: 1,
        unsupported: 0,
        warnings: [],
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 3');
    });

    it('should accept valid enabledClients', async () => {
      const config: OvertureConfig = {
        version: '2.0',
        mcp: {
          filesystem: {
            command: 'npx',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
        sync: {
          enabledClients: ['claude-code', 'vscode'],
        },
      };

      mockLoadConfig.mockReturnValue(config);
      mockAdapterRegistry.getInstalledAdapters.mockReturnValue([mockClientAdapter]);
      mockGetTransportWarnings.mockReturnValue([]);
      mockGetTransportValidationSummary.mockReturnValue({
        total: 1,
        supported: 1,
        unsupported: 0,
        warnings: [],
      });

      const command = createValidateCommand();

      await expect(
        command.parseAsync(['node', 'test'])
      ).rejects.toThrow('Process exit: 0');
    });
  });
});
