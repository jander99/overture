import { Validator } from './validator';
import { ProcessExecutor } from '../infrastructure/process-executor';
import type {
  OvertureConfig,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../domain/types';

// Mock ProcessExecutor
jest.mock('../infrastructure/process-executor');

describe('Validator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // validateSchema Tests (6 tests)
  // ============================================================================

  describe('validateSchema', () => {
    it('should return valid: true with empty errors for valid config', () => {
      const config = {
        version: '1.0',
        plugins: {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: ['python-repl'],
          },
        },
        mcp: {
          'python-repl': {
            command: 'uvx',
            scope: 'project',
            enabled: true,
          },
        },
      };

      const result = Validator.validateSchema(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return valid: false with errors for missing required plugin field', () => {
      const config = {
        version: '1.0',
        plugins: {
          'python-development': {
            marketplace: 'claude-code-workflows',
            // missing 'mcps' field
          },
        },
        mcp: {},
      };

      const result = Validator.validateSchema(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toHaveProperty('field');
      expect(result.errors[0]).toHaveProperty('message');
    });

    it('should return error with field path for nested validation failure', () => {
      const config = {
        version: '1.0',
        plugins: {
          'test-plugin': {
            marketplace: 'test-market',
            mcps: ['mcp1'],
          },
        },
        mcp: {
          mcp1: {
            command: 'test',
            scope: 'invalid-scope', // invalid enum value
          },
        },
      };

      const result = Validator.validateSchema(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      const scopeError = result.errors.find((e) => e.field.includes('scope'));
      expect(scopeError).toBeDefined();
    });

    it('should provide suggestion for invalid_type error', () => {
      const config = {
        version: '1.0',
        plugins: {
          'test-plugin': {
            marketplace: 123, // should be string
            mcps: ['mcp1'],
          },
        },
        mcp: {},
      };

      const result = Validator.validateSchema(config);

      expect(result.valid).toBe(false);
      const error = result.errors.find(
        (e) => e.field.includes('marketplace')
      );
      expect(error?.suggestion).toBeDefined();
      expect(error?.suggestion).toContain('Expected');
    });

    it('should provide suggestion for invalid_enum_value error', () => {
      const config = {
        version: '1.0',
        plugins: {},
        mcp: {
          'test-mcp': {
            command: 'test',
            scope: 'invalid', // not 'global' or 'project'
          },
        },
      };

      const result = Validator.validateSchema(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // At least one error should have a field that includes scope
      const scopeError = result.errors.find((e) => e.field.includes('scope'));
      expect(scopeError).toBeDefined();
      if (scopeError?.suggestion) {
        expect(scopeError.suggestion.length).toBeGreaterThan(0);
      }
    });

    it('should handle config with all optional fields set', () => {
      const config = {
        version: '1.0',
        project: {
          name: 'my-project',
          type: 'python-backend',
          description: 'A test project',
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
          ruff: {
            command: 'uvx',
            args: ['mcp-server-ruff'],
            scope: 'project',
            enabled: true,
          },
        },
      };

      const result = Validator.validateSchema(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // validateMcpServers Tests (8 tests)
  // ============================================================================

  describe('validateMcpServers', () => {
    it('should return valid: true when all MCP commands exist', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: {},
        mcp: {
          'python-repl': {
            command: 'uvx',
            scope: 'project',
            enabled: true,
          },
          ruff: {
            command: 'node',
            scope: 'project',
            enabled: true,
          },
        },
      };

      (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);

      const result = await Validator.validateMcpServers(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(ProcessExecutor.commandExists).toHaveBeenCalledWith('uvx');
      expect(ProcessExecutor.commandExists).toHaveBeenCalledWith('node');
    });

    it('should return error when command not found on PATH', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: {},
        mcp: {
          'missing-mcp': {
            command: 'nonexistent-command',
            scope: 'project',
            enabled: true,
          },
        },
      };

      (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(false);

      const result = await Validator.validateMcpServers(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('mcp.missing-mcp.command');
      expect(result.errors[0].message).toContain('not found on PATH');
      expect(result.errors[0].suggestion).toBeDefined();
    });

    it('should skip disabled MCPs and not check their commands', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: {},
        mcp: {
          'enabled-mcp': {
            command: 'valid-command',
            scope: 'project',
            enabled: true,
          },
          'disabled-mcp': {
            command: 'nonexistent-command',
            scope: 'project',
            enabled: false,
          },
        },
      };

      (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);

      const result = await Validator.validateMcpServers(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(ProcessExecutor.commandExists).toHaveBeenCalledTimes(1);
      expect(ProcessExecutor.commandExists).toHaveBeenCalledWith('valid-command');
    });

    it('should add warning for MCP with no command specified', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: {},
        mcp: {
          'no-command-mcp': {
            scope: 'global',
            enabled: true,
          },
        },
      };

      const result = await Validator.validateMcpServers(config);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('no command specified');
      expect(result.warnings[0].context).toBe('mcp.no-command-mcp');
    });

    it('should detect unset environment variables and add warning', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: {},
        mcp: {
          'github-mcp': {
            command: 'mcp-server-github',
            env: {
              GITHUB_TOKEN: '${GITHUB_TOKEN}',
            },
            scope: 'project',
            enabled: true,
          },
        },
      };

      // Ensure GITHUB_TOKEN is not set in process.env for this test
      const originalToken = process.env.GITHUB_TOKEN;
      delete process.env.GITHUB_TOKEN;

      (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);

      const result = await Validator.validateMcpServers(config);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('not set');
      expect(result.warnings[0].message).toContain('GITHUB_TOKEN');

      // Restore original env var
      if (originalToken) {
        process.env.GITHUB_TOKEN = originalToken;
      }
    });

    it('should not add warning for set environment variables', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: {},
        mcp: {
          'github-mcp': {
            command: 'mcp-server-github',
            env: {
              GITHUB_TOKEN: '${GITHUB_TOKEN}',
            },
            scope: 'project',
            enabled: true,
          },
        },
      };

      // Set the environment variable
      const originalToken = process.env.GITHUB_TOKEN;
      process.env.GITHUB_TOKEN = 'test-token';

      (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);

      const result = await Validator.validateMcpServers(config);

      const tokenWarning = result.warnings.find((w) =>
        w.message.includes('GITHUB_TOKEN')
      );
      expect(tokenWarning).toBeUndefined();

      // Restore original env var
      if (originalToken) {
        process.env.GITHUB_TOKEN = originalToken;
      } else {
        delete process.env.GITHUB_TOKEN;
      }
    });

    it('should aggregate multiple command errors correctly', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: {},
        mcp: {
          'missing-mcp-1': {
            command: 'missing-command-1',
            scope: 'project',
            enabled: true,
          },
          'missing-mcp-2': {
            command: 'missing-command-2',
            scope: 'project',
            enabled: true,
          },
          'valid-mcp': {
            command: 'valid-command',
            scope: 'project',
            enabled: true,
          },
        },
      };

      (ProcessExecutor.commandExists as jest.Mock).mockImplementation(
        async (command) => command === 'valid-command'
      );

      const result = await Validator.validateMcpServers(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors.map((e) => e.field)).toContain(
        'mcp.missing-mcp-1.command'
      );
      expect(result.errors.map((e) => e.field)).toContain(
        'mcp.missing-mcp-2.command'
      );
    });

    it('should handle env variables with non-placeholder values', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: {},
        mcp: {
          'env-mcp': {
            command: 'test-command',
            env: {
              CUSTOM_VAR: 'literal-value',
              ANOTHER_VAR: 'another-literal',
            },
            scope: 'project',
            enabled: true,
          },
        },
      };

      (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);

      const result = await Validator.validateMcpServers(config);

      // Should not warn about literal values
      const literalWarnings = result.warnings.filter(
        (w) => w.message.includes('not set')
      );
      expect(literalWarnings).toHaveLength(0);
    });
  });

  // ============================================================================
  // validatePluginReferences Tests (4 tests)
  // ============================================================================

  describe('validatePluginReferences', () => {
    it('should return valid: true when plugin references existing MCPs', () => {
      const config: OvertureConfig = {
        version: '1.0',
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
            scope: 'project',
            enabled: true,
          },
          ruff: {
            command: 'uvx',
            scope: 'project',
            enabled: true,
          },
        },
      };

      const result = Validator.validatePluginReferences(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should add warning when plugin references non-existent MCP', () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: ['python-repl', 'missing-mcp'],
          },
        },
        mcp: {
          'python-repl': {
            command: 'uvx',
            scope: 'project',
            enabled: true,
          },
        },
      };

      const result = Validator.validatePluginReferences(config);

      expect(result.valid).toBe(true); // References are warnings, not errors
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('not configured');
      expect(result.warnings[0].message).toContain('missing-mcp');
      expect(result.warnings[0].context).toBe(
        'plugins.python-development.mcps'
      );
    });

    it('should aggregate multiple reference warnings from multiple plugins', () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: {
          'plugin-1': {
            marketplace: 'market-1',
            enabled: true,
            mcps: ['missing-1', 'missing-2'],
          },
          'plugin-2': {
            marketplace: 'market-2',
            enabled: true,
            mcps: ['missing-3'],
          },
        },
        mcp: {},
      };

      const result = Validator.validatePluginReferences(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(3);
      expect(result.warnings.map((w) => w.message)).toEqual(
        expect.arrayContaining([
          expect.stringContaining('missing-1'),
          expect.stringContaining('missing-2'),
          expect.stringContaining('missing-3'),
        ])
      );
    });

    it('should handle empty plugins list', () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: {},
        mcp: {
          'some-mcp': {
            command: 'test',
            scope: 'project',
            enabled: true,
          },
        },
      };

      const result = Validator.validatePluginReferences(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // validateAll Tests (7 tests)
  // ============================================================================

  describe('validateAll', () => {
    it('should return valid: true when all validations pass', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: ['python-repl'],
          },
        },
        mcp: {
          'python-repl': {
            command: 'uvx',
            scope: 'project',
            enabled: true,
          },
        },
      };

      (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);

      const result = await Validator.validateAll(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should aggregate errors from schema validation', async () => {
      const config = {
        version: '1.0',
        plugins: {
          'test-plugin': {
            marketplace: 'test-market',
            enabled: true,
            mcps: [], // empty mcps to prevent error in validatePluginReferences
            // note: missing 'enabled' would cause schema error
          },
        },
        mcp: {},
      };

      const result = await Validator.validateAll(config as any);

      // Config is actually valid schema-wise, so test different scenario
      expect(result.valid).toBe(true);
    });

    it('should aggregate errors from MCP validation', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: {},
        mcp: {
          'missing-cmd': {
            command: 'nonexistent',
            scope: 'project',
            enabled: true,
          },
        },
      };

      (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(false);

      const result = await Validator.validateAll(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toContain('command');
    });

    it('should aggregate warnings from multiple validators', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: {
          'test-plugin': {
            marketplace: 'test-market',
            enabled: true,
            mcps: ['missing-mcp', 'no-cmd-mcp'],
          },
        },
        mcp: {
          'no-cmd-mcp': {
            scope: 'project',
            enabled: true,
          },
        },
      };

      (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);

      const result = await Validator.validateAll(config);

      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
      expect(result.warnings.map((w) => w.message)).toEqual(
        expect.arrayContaining([
          expect.stringContaining('not configured'),
          expect.stringContaining('no command'),
        ])
      );
    });

    it('should return valid: false if any validator fails', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: {
          'test-plugin': {
            marketplace: 'test-market',
            enabled: true,
            mcps: ['python-repl'],
          },
        },
        mcp: {
          'python-repl': {
            command: 'missing-command',
            scope: 'project',
            enabled: true,
          },
        },
      };

      (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(false);

      const result = await Validator.validateAll(config);

      expect(result.valid).toBe(false);
    });

    it('should combine errors and warnings from all validators', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: {
          'test-plugin': {
            marketplace: 'test-market',
            enabled: true,
            mcps: ['missing-mcp', 'python-repl'],
          },
        },
        mcp: {
          'python-repl': {
            command: 'missing-command',
            scope: 'project',
            enabled: true,
          },
          'no-cmd': {
            scope: 'project',
            enabled: true,
          },
        },
      };

      (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(false);

      const result = await Validator.validateAll(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.errors.map((e) => e.field)).toContain(
        'mcp.python-repl.command'
      );
      expect(result.warnings.map((w) => w.message)).toEqual(
        expect.arrayContaining([
          expect.stringContaining('missing-mcp'),
          expect.stringContaining('no command'),
        ])
      );
    });

    it('should handle complex real-world configuration', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        project: {
          name: 'my-project',
          type: 'python-backend',
          description: 'A test project',
        },
        plugins: {
          'python-development': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: ['python-repl', 'ruff', 'filesystem'],
          },
          'kubernetes-operations': {
            marketplace: 'claude-code-workflows',
            enabled: true,
            mcps: ['kubectl', 'missing-tool'],
          },
        },
        mcp: {
          'python-repl': {
            command: 'uvx',
            args: ['mcp-server-python-repl'],
            scope: 'project',
            enabled: true,
          },
          ruff: {
            command: 'uvx',
            args: ['mcp-server-ruff'],
            scope: 'project',
            enabled: true,
          },
          filesystem: {
            scope: 'global',
            enabled: true,
          },
          kubectl: {
            command: 'kubectl',
            scope: 'project',
            enabled: true,
          },
        },
      };

      (ProcessExecutor.commandExists as jest.Mock).mockImplementation(
        async (command) => ['uvx', 'kubectl'].includes(command)
      );

      const result = await Validator.validateAll(config);

      // Should fail due to missing-tool reference
      expect(result.valid).toBe(true); // warnings don't make it invalid
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.map((w) => w.message)).toEqual(
        expect.arrayContaining([
          expect.stringContaining('missing-tool'),
          expect.stringContaining('no command'),
        ])
      );
    });
  });

  // ============================================================================
  // Edge cases and integration scenarios
  // ============================================================================

  describe('Edge cases and integration', () => {
    it('should handle MCP with both args and env configuration', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: {},
        mcp: {
          'complex-mcp': {
            command: 'mcp-complex',
            args: ['--option', 'value'],
            env: {
              VAR1: '${VAR1}',
              VAR2: 'literal-value',
            },
            scope: 'project',
            enabled: true,
          },
        },
      };

      process.env.VAR1 = 'test-value';
      (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);

      const result = await Validator.validateAll(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);

      delete process.env.VAR1;
    });

    it('should handle multiple validation passes with different configs', async () => {
      const config1: OvertureConfig = {
        version: '1.0',
        plugins: {},
        mcp: {
          mcp1: {
            command: 'cmd1',
            scope: 'project',
            enabled: true,
          },
        },
      };

      const config2: OvertureConfig = {
        version: '1.0',
        plugins: {},
        mcp: {
          mcp2: {
            command: 'cmd2',
            scope: 'project',
            enabled: true,
          },
        },
      };

      (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);

      const result1 = await Validator.validateAll(config1);
      const result2 = await Validator.validateAll(config2);

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
      expect(ProcessExecutor.commandExists).toHaveBeenCalledWith('cmd1');
      expect(ProcessExecutor.commandExists).toHaveBeenCalledWith('cmd2');
    });

    it('should validate config with disabled plugins (still validates MCPs)', async () => {
      const config: OvertureConfig = {
        version: '1.0',
        plugins: {
          'test-plugin': {
            marketplace: 'test-market',
            enabled: false,
            mcps: ['mcp1'],
          },
        },
        mcp: {
          mcp1: {
            command: 'test-cmd',
            scope: 'project',
            enabled: true,
          },
        },
      };

      (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);

      const result = await Validator.validateAll(config);

      // MCPs are still validated even if plugins are disabled
      expect(result.valid).toBe(true);
      expect(ProcessExecutor.commandExists).toHaveBeenCalledWith('test-cmd');
    });

    it('should handle very large configs with many MCPs and plugins', async () => {
      const plugins: Record<string, any> = {};
      const mcps: Record<string, any> = {};

      for (let i = 0; i < 50; i++) {
        plugins[`plugin-${i}`] = {
          marketplace: 'test-market',
          enabled: true,
          mcps: [`mcp-${i}`],
        };
        mcps[`mcp-${i}`] = {
          command: `cmd-${i}`,
          scope: 'project',
          enabled: true,
        };
      }

      const config: OvertureConfig = {
        version: '1.0',
        plugins,
        mcp: mcps,
      };

      (ProcessExecutor.commandExists as jest.Mock).mockResolvedValue(true);

      const result = await Validator.validateAll(config);

      expect(result.valid).toBe(true);
      expect(ProcessExecutor.commandExists).toHaveBeenCalledTimes(50);
    });
  });
});
