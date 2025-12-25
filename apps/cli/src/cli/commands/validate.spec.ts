/**
 * Validate Command Tests
 *
 * Comprehensive tests for `overture validate` command.
 * Tests configuration validation, schema checks, transport compatibility,
 * platform/client validation, env var syntax, and error cases.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createValidateCommand } from './validate';
import { createMockAppDependencies } from '../../test-utils/app-dependencies.mock';
import type { AppDependencies } from '../../composition-root';
import { ConfigError, ValidationError } from '@overture/errors';
import type {
  OvertureConfig,
  Platform,
  ClientName,
} from '@overture/config-types';

// Mock chalk to avoid ANSI codes in test assertions
vi.mock('chalk', () => ({
  default: {
    bold: { cyan: (s: string) => s },
    gray: (s: string) => s,
    dim: (s: string) => s,
    cyan: (s: string) => s,
    yellow: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
  },
}));

// Mock ErrorHandler and Prompts modules
vi.mock('@overture/utils', async () => {
  const actual = await vi.importActual('@overture/utils');
  return {
    ...actual,
    ErrorHandler: {
      handleCommandError: vi.fn((error, _context, _verbose) => {
        // Re-throw errors during tests so we can see what's failing
        if (error && typeof error === 'object' && 'exitCode' in error) {
          // Don't throw for expected errors with exitCode
          return;
        }
        if (error instanceof Error) {
          throw error;
        }
      }),
    },
  };
});

// Mock transport validation functions
vi.mock('@overture/sync-core', async () => {
  const actual = await vi.importActual('@overture/sync-core');
  return {
    ...actual,
    getTransportWarnings: vi.fn(() => []),
    getTransportValidationSummary: vi.fn(() => ({
      total: 5,
      supported: 4,
      unsupported: 1,
    })),
  };
});

describe('validate command', () => {
  let deps: AppDependencies;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    deps = createMockAppDependencies();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      if (code && code !== 0) {
        throw new Error(`Process exit: ${code}`);
      }
      return undefined as never;
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('should create validate command', () => {
    const command = createValidateCommand(deps);
    expect(command.name()).toBe('validate');
  });

  describe('successful validation', () => {
    it('should validate a valid minimal configuration', async () => {
      const validConfig: OvertureConfig = {
        version: '1.0',
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(validConfig);

      const command = createValidateCommand(deps);
      await command.parseAsync(['node', 'validate']);

      expect(deps.configLoader.loadConfig).toHaveBeenCalledWith(process.cwd());
      expect(deps.output.success).toHaveBeenCalledWith(
        'Configuration is valid',
      );
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should validate configuration with platform overrides', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
            platforms: {
              exclude: ['win32'],
              commandOverrides: {
                linux: 'linux-command',
                darwin: 'mac-command',
              },
              argsOverrides: {
                linux: ['--linux-arg'],
              },
            },
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);

      const command = createValidateCommand(deps);
      await command.parseAsync(['node', 'validate']);

      expect(deps.output.success).toHaveBeenCalledWith(
        'Configuration is valid',
      );
    });

    it('should validate configuration with client overrides', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
            clients: {
              include: ['claude-code'],
              exclude: ['vscode'],
              overrides: {
                'claude-desktop': {
                  command: 'desktop-command',
                  env: {
                    TOKEN: '${API_TOKEN}',
                  },
                },
              },
            },
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);

      const command = createValidateCommand(deps);
      await command.parseAsync(['node', 'validate']);

      expect(deps.output.success).toHaveBeenCalledWith(
        'Configuration is valid',
      );
    });

    it('should validate configuration with environment variables', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
            env: {
              TOKEN: '${API_TOKEN}',
              URL: '${BASE_URL:-https://example.com}',
            },
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);

      const command = createValidateCommand(deps);
      await command.parseAsync(['node', 'validate']);

      expect(deps.output.success).toHaveBeenCalledWith(
        'Configuration is valid',
      );
    });
  });

  describe('required field validation', () => {
    it('should error when command is missing', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          'test-mcp': {
            command: '',
            transport: 'stdio',
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);

      const command = createValidateCommand(deps);

      await expect(command.parseAsync(['node', 'validate'])).rejects.toThrow(
        'Process exit: 3',
      );

      expect(deps.output.error).toHaveBeenCalledWith('Validation errors:');
      expect(deps.output.error).toHaveBeenCalledWith(
        '  - MCP "test-mcp": command is required and cannot be empty',
      );
      expect(exitSpy).toHaveBeenCalledWith(3);
    });

    it('should error when transport is missing', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          'test-mcp': {
            command: 'test-command',
            // Intentionally invalid to test validation
            transport: undefined as unknown as 'stdio' | 'http' | 'sse',
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);

      const command = createValidateCommand(deps);

      await expect(command.parseAsync(['node', 'validate'])).rejects.toThrow(
        'Process exit: 3',
      );

      expect(deps.output.error).toHaveBeenCalledWith(
        '  - MCP "test-mcp": transport is required',
      );
      expect(exitSpy).toHaveBeenCalledWith(3);
    });
  });

  describe('platform validation', () => {
    it('should error on invalid platform in exclusion list', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
            platforms: {
              // Intentionally invalid platform to test validation
              exclude: ['invalid-platform'] as unknown as Platform[],
            },
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);

      const command = createValidateCommand(deps);

      await expect(command.parseAsync(['node', 'validate'])).rejects.toThrow(
        'Process exit: 3',
      );

      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'invalid platform in exclusion list: "invalid-platform"',
        ),
      );
    });

    it('should error on invalid platform in commandOverrides', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
            platforms: {
              commandOverrides: {
                // Intentionally invalid platform to test validation
                'invalid-os': 'some-command',
              } as unknown as Record<Platform, string>,
            },
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);

      const command = createValidateCommand(deps);

      await expect(command.parseAsync(['node', 'validate'])).rejects.toThrow(
        'Process exit: 3',
      );

      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'invalid platform in commandOverrides: "invalid-os"',
        ),
      );
    });

    it('should error on invalid platform in argsOverrides', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
            platforms: {
              argsOverrides: {
                // Intentionally invalid platform to test validation
                freebsd: ['--arg'],
              } as unknown as Record<Platform, string[]>,
            },
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);

      const command = createValidateCommand(deps);

      await expect(command.parseAsync(['node', 'validate'])).rejects.toThrow(
        'Process exit: 3',
      );

      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('invalid platform in argsOverrides: "freebsd"'),
      );
    });
  });

  describe('client validation', () => {
    it('should error on invalid client in exclusion list', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
            clients: {
              exclude: ['invalid-client'] as unknown as ClientName[],
            },
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);

      const command = createValidateCommand(deps);

      await expect(command.parseAsync(['node', 'validate'])).rejects.toThrow(
        'Process exit: 3',
      );

      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'invalid client in exclusion list: "invalid-client"',
        ),
      );
    });

    it('should error on invalid client in include list', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
            clients: {
              include: ['unknown-client'] as unknown as ClientName[],
            },
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);

      const command = createValidateCommand(deps);

      await expect(command.parseAsync(['node', 'validate'])).rejects.toThrow(
        'Process exit: 3',
      );

      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'invalid client in include list: "unknown-client"',
        ),
      );
    });

    it('should error on invalid client in overrides', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
            clients: {
              overrides: {
                // Intentionally invalid client name to test validation
                'bad-client': {
                  command: 'override-command',
                },
              } as unknown as Record<
                ClientName,
                Partial<{ command: string; args: string[] }>
              >,
            },
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);

      const command = createValidateCommand(deps);

      await expect(command.parseAsync(['node', 'validate'])).rejects.toThrow(
        'Process exit: 3',
      );

      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('invalid client in overrides: "bad-client"'),
      );
    });
  });

  describe('environment variable validation', () => {
    it('should error on invalid env var syntax', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        sync: {
          enabledClients: ['claude-code'],
        },
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
            env: {
              BAD_VAR: '${123_INVALID}', // Can't start with number
            },
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue({
        name: 'claude-code',
        needsEnvVarExpansion: () => false,
        supportsTransport: () => true,
      } as unknown as OvertureConfig);

      const command = createValidateCommand(deps);

      await expect(command.parseAsync(['node', 'validate'])).rejects.toThrow(
        'Process exit: 3',
      );

      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Environment variable validation errors'),
      );
      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid variable name'),
      );
    });

    it('should error on unclosed env var syntax', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        sync: {
          enabledClients: ['claude-code'],
        },
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
            env: {
              UNCLOSED: '${VAR_NAME',
            },
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue({
        name: 'claude-code',
        needsEnvVarExpansion: () => false,
        supportsTransport: () => true,
      } as unknown as OvertureConfig);

      const command = createValidateCommand(deps);

      await expect(command.parseAsync(['node', 'validate'])).rejects.toThrow(
        'Process exit: 3',
      );

      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Environment variable validation errors'),
      );
      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Unclosed'),
      );
    });

    it('should error on invalid env var in client overrides', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        sync: {
          enabledClients: ['claude-code'],
        },
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
            clients: {
              overrides: {
                'claude-code': {
                  env: {
                    BAD: '${invalid-name}', // Hyphens not allowed
                  },
                },
              },
            },
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue({
        name: 'claude-code',
        needsEnvVarExpansion: () => false,
        supportsTransport: () => true,
      } as unknown as OvertureConfig);

      const command = createValidateCommand(deps);

      await expect(command.parseAsync(['node', 'validate'])).rejects.toThrow(
        'Process exit: 3',
      );

      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Environment variable validation errors'),
      );
      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid variable name'),
      );
    });
  });

  describe('duplicate MCP name detection', () => {
    it('should error on duplicate MCP names (case-insensitive)', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
          },
          'TEST-MCP': {
            command: 'another-command',
            transport: 'stdio',
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);

      const command = createValidateCommand(deps);

      await expect(command.parseAsync(['node', 'validate'])).rejects.toThrow(
        'Process exit: 3',
      );

      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Duplicate MCP name (case-insensitive)'),
      );
    });
  });

  describe('sync.enabledClients validation', () => {
    it('should error on invalid client in sync.enabledClients', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        sync: {
          enabledClients: ['invalid-client'] as unknown as ClientName[],
        },
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);

      const command = createValidateCommand(deps);

      await expect(command.parseAsync(['node', 'validate'])).rejects.toThrow(
        'Process exit: 3',
      );

      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid client in sync.enabledClients: "invalid-client"',
        ),
      );
    });
  });

  describe('--client option', () => {
    it('should validate specific client when --client provided', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue({
        name: 'claude-code',
        detectConfigPath: vi.fn(),
        readConfig: vi.fn(),
        writeConfig: vi.fn(),
        validateTransport: vi.fn().mockReturnValue(true),
      } as unknown as OvertureConfig);

      const command = createValidateCommand(deps);
      await command.parseAsync(['node', 'validate', '--client', 'claude-code']);

      expect(deps.adapterRegistry.get).toHaveBeenCalledWith('claude-code');
      expect(deps.output.success).toHaveBeenCalledWith(
        'Configuration is valid',
      );
    });

    it('should error on invalid --client option', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);

      const command = createValidateCommand(deps);

      await expect(
        command.parseAsync(['node', 'validate', '--client', 'invalid-client']),
      ).rejects.toThrow('Process exit: 3');

      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid --client option: "invalid-client"'),
      );
    });

    it('should error when client adapter not registered', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue(null);

      const command = createValidateCommand(deps);

      await expect(
        command.parseAsync(['node', 'validate', '--client', 'claude-code']),
      ).rejects.toThrow('Process exit: 3');

      expect(deps.output.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'No adapter registered for client: "claude-code"',
        ),
      );
    });
  });

  describe('transport validation', () => {
    it('should show transport warnings when present', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        sync: {
          enabledClients: ['claude-code'],
        },
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'sse',
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue({
        name: 'claude-code',
        validateTransport: vi.fn().mockReturnValue(false),
      } as unknown as OvertureConfig);

      const { getTransportWarnings } = await import('@overture/sync-core');
      vi.mocked(getTransportWarnings).mockReturnValue([
        {
          mcpName: 'test-mcp',
          transport: 'sse',
          clientName: 'claude-code',
          message: 'Transport "sse" may not be supported by claude-code',
        },
      ]);

      const command = createValidateCommand(deps);
      await command.parseAsync(['node', 'validate']);

      expect(deps.output.warn).toHaveBeenCalledWith(
        'Transport compatibility warnings:',
      );
      expect(deps.output.warn).toHaveBeenCalledWith(
        expect.stringContaining('Transport "sse" may not be supported'),
      );
    });

    it('should show verbose transport summary when --verbose and --client', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        mcp: {
          'test-mcp': {
            command: 'test-command',
            transport: 'stdio',
          },
        },
      };

      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(config);
      vi.mocked(deps.adapterRegistry.get).mockReturnValue({
        name: 'claude-code',
        validateTransport: vi.fn().mockReturnValue(true),
      } as unknown as OvertureConfig);

      const { getTransportValidationSummary } =
        await import('@overture/sync-core');
      vi.mocked(getTransportValidationSummary).mockReturnValue({
        total: 5,
        supported: 4,
        unsupported: 1,
      });

      const command = createValidateCommand(deps);
      await command.parseAsync([
        'node',
        'validate',
        '--client',
        'claude-code',
        '--verbose',
      ]);

      expect(deps.output.info).toHaveBeenCalledWith(
        '\nTransport validation summary:',
      );
      expect(deps.output.info).toHaveBeenCalledWith('  Total MCPs: 5');
      expect(deps.output.info).toHaveBeenCalledWith('  Supported: 4');
      expect(deps.output.info).toHaveBeenCalledWith('  Unsupported: 1');
    });
  });

  describe('error handling', () => {
    it('should error when no configuration found', async () => {
      vi.mocked(deps.configLoader.loadConfig).mockResolvedValue(
        null as unknown as OvertureConfig,
      );

      const command = createValidateCommand(deps);

      await expect(command.parseAsync(['node', 'validate'])).rejects.toThrow(
        'Process exit: 2',
      );

      expect(deps.output.error).toHaveBeenCalledWith('No configuration found');
      expect(exitSpy).toHaveBeenCalledWith(2);
    });

    it('should handle ConfigError', async () => {
      const error = new ConfigError(
        'Invalid YAML syntax',
        '/path/to/config.yaml',
      );
      vi.mocked(deps.configLoader.loadConfig).mockRejectedValue(error);

      const command = createValidateCommand(deps);
      await command.parseAsync(['node', 'validate']);

      const { ErrorHandler } = await import('@overture/utils');
      expect(ErrorHandler.handleCommandError).toHaveBeenCalledWith(
        error,
        'validate',
        undefined,
      );
    });

    it('should handle ValidationError', async () => {
      const error = new ValidationError('Schema validation failed', [
        'field is required',
      ]);
      vi.mocked(deps.configLoader.loadConfig).mockRejectedValue(error);

      const command = createValidateCommand(deps);
      await command.parseAsync(['node', 'validate']);

      const { ErrorHandler } = await import('@overture/utils');
      expect(ErrorHandler.handleCommandError).toHaveBeenCalledWith(
        error,
        'validate',
        undefined,
      );
    });
  });
});
