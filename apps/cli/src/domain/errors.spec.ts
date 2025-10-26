import {
  OvertureError,
  ConfigError,
  ValidationError,
  PluginError,
  McpError,
} from './errors';

describe('Domain: Error Classes', () => {
  describe('OvertureError', () => {
    describe('Instantiation', () => {
      it('should create an OvertureError with message and code', () => {
        // Arrange
        const message = 'Something went wrong';
        const code = 'TEST_ERROR';

        // Act
        const error = new OvertureError(message, code);

        // Assert
        expect(error.message).toBe(message);
        expect(error.code).toBe(code);
        expect(error.name).toBe('OvertureError');
      });

      it('should create an OvertureError with custom exitCode', () => {
        // Arrange
        const message = 'Something went wrong';
        const code = 'TEST_ERROR';
        const exitCode = 42;

        // Act
        const error = new OvertureError(message, code, exitCode);

        // Assert
        expect(error.message).toBe(message);
        expect(error.code).toBe(code);
        expect(error.exitCode).toBe(exitCode);
      });

      it('should default exitCode to 1', () => {
        // Arrange
        const message = 'Something went wrong';
        const code = 'TEST_ERROR';

        // Act
        const error = new OvertureError(message, code);

        // Assert
        expect(error.exitCode).toBe(1);
      });

      it('should extend Error class properly', () => {
        // Arrange
        const error = new OvertureError('test', 'TEST');

        // Act
        const isError = error instanceof Error;

        // Assert
        expect(isError).toBe(true);
        expect(error.stack).toBeDefined();
      });

      it('should have proper stack trace', () => {
        // Arrange
        // Act
        const error = new OvertureError('test error', 'TEST_CODE');

        // Assert
        expect(error.stack).toContain('OvertureError');
        expect(error.stack).toContain('test error');
      });
    });

    describe('Properties', () => {
      it('should provide access to message property', () => {
        // Arrange
        const message = 'Error message';
        const error = new OvertureError(message, 'CODE');

        // Act
        const retrieved = error.message;

        // Assert
        expect(retrieved).toBe(message);
      });

      it('should provide access to code property', () => {
        // Arrange
        const code = 'CUSTOM_CODE';
        const error = new OvertureError('message', code);

        // Act
        const retrieved = error.code;

        // Assert
        expect(retrieved).toBe(code);
      });

      it('should provide access to exitCode property', () => {
        // Arrange
        const exitCode = 99;
        const error = new OvertureError('message', 'CODE', exitCode);

        // Act
        const retrieved = error.exitCode;

        // Assert
        expect(retrieved).toBe(exitCode);
      });

      it('should be throwable and catchable', () => {
        // Arrange
        const error = new OvertureError('test message', 'TEST_CODE');

        // Act & Assert
        expect(() => {
          throw error;
        }).toThrow('test message');
      });
    });

    describe('Error messages', () => {
      it('should preserve message with special characters', () => {
        // Arrange
        const message =
          'Error: Config not found at /path/to/.overture/config.yaml!';
        const error = new OvertureError(message, 'CODE');

        // Act
        const retrieved = error.message;

        // Assert
        expect(retrieved).toBe(message);
      });

      it('should handle empty message', () => {
        // Arrange
        const error = new OvertureError('', 'EMPTY_MESSAGE');

        // Act
        const retrieved = error.message;

        // Assert
        expect(retrieved).toBe('');
      });

      it('should handle multiline messages', () => {
        // Arrange
        const message = 'Line 1\nLine 2\nLine 3';
        const error = new OvertureError(message, 'MULTILINE');

        // Act
        const retrieved = error.message;

        // Assert
        expect(retrieved).toBe(message);
      });
    });
  });

  describe('ConfigError', () => {
    describe('Instantiation', () => {
      it('should create ConfigError with message', () => {
        // Arrange
        const message = 'Invalid configuration';

        // Act
        const error = new ConfigError(message);

        // Assert
        expect(error.message).toBe(message);
        expect(error.code).toBe('CONFIG_ERROR');
        expect(error.exitCode).toBe(2);
        expect(error.name).toBe('ConfigError');
      });

      it('should create ConfigError with message and filePath', () => {
        // Arrange
        const message = 'Invalid configuration';
        const filePath = '/path/to/.overture/config.yaml';

        // Act
        const error = new ConfigError(message, filePath);

        // Assert
        expect(error.message).toBe(message);
        expect(error.filePath).toBe(filePath);
      });

      it('should have ConfigError-specific exitCode', () => {
        // Arrange
        // Act
        const error = new ConfigError('test');

        // Assert
        expect(error.exitCode).toBe(2);
      });

      it('should have CONFIG_ERROR code', () => {
        // Arrange
        // Act
        const error = new ConfigError('test');

        // Assert
        expect(error.code).toBe('CONFIG_ERROR');
      });

      it('should extend OvertureError', () => {
        // Arrange
        const error = new ConfigError('test');

        // Act
        const isOvertureError = error instanceof OvertureError;

        // Assert
        expect(isOvertureError).toBe(true);
      });
    });

    describe('Properties', () => {
      it('should provide filePath property', () => {
        // Arrange
        const filePath = '/home/user/.overture/config.yaml';
        const error = new ConfigError('test', filePath);

        // Act
        const retrieved = error.filePath;

        // Assert
        expect(retrieved).toBe(filePath);
      });

      it('should have undefined filePath when not provided', () => {
        // Arrange
        const error = new ConfigError('test');

        // Act
        const filePath = error.filePath;

        // Assert
        expect(filePath).toBeUndefined();
      });

      it('should be catchable as OvertureError', () => {
        // Arrange
        const error = new ConfigError('Config file missing');

        // Act & Assert
        expect(() => {
          throw error;
        }).toThrow('Config file missing');
      });
    });

    describe('Use cases', () => {
      it('should handle YAML parse errors', () => {
        // Arrange
        const filePath = '.overture/config.yaml';
        const message = 'Failed to parse YAML: invalid mapping';

        // Act
        const error = new ConfigError(message, filePath);

        // Assert
        expect(error.message).toContain('YAML');
        expect(error.filePath).toBe(filePath);
        expect(error.exitCode).toBe(2);
      });

      it('should handle missing config file errors', () => {
        // Arrange
        const filePath = '.overture/config.yaml';
        const message = `Config file not found at ${filePath}`;

        // Act
        const error = new ConfigError(message, filePath);

        // Assert
        expect(error.message).toContain('not found');
        expect(error.filePath).toBe(filePath);
      });
    });
  });

  describe('ValidationError', () => {
    describe('Instantiation', () => {
      it('should create ValidationError with message', () => {
        // Arrange
        const message = 'Validation failed';

        // Act
        const error = new ValidationError(message);

        // Assert
        expect(error.message).toBe(message);
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.exitCode).toBe(3);
        expect(error.name).toBe('ValidationError');
      });

      it('should create ValidationError with issues array', () => {
        // Arrange
        const message = 'Validation failed';
        const issues = ['Field A is required', 'Field B must be a string'];

        // Act
        const error = new ValidationError(message, issues);

        // Assert
        expect(error.message).toBe(message);
        expect(error.issues).toEqual(issues);
      });

      it('should default issues to empty array', () => {
        // Arrange
        const error = new ValidationError('test');

        // Act
        const issues = error.issues;

        // Assert
        expect(issues).toEqual([]);
        expect(Array.isArray(issues)).toBe(true);
      });

      it('should have VALIDATION_ERROR code', () => {
        // Arrange
        // Act
        const error = new ValidationError('test');

        // Assert
        expect(error.code).toBe('VALIDATION_ERROR');
      });

      it('should have ValidationError-specific exitCode', () => {
        // Arrange
        // Act
        const error = new ValidationError('test');

        // Assert
        expect(error.exitCode).toBe(3);
      });

      it('should extend OvertureError', () => {
        // Arrange
        const error = new ValidationError('test');

        // Act
        const isOvertureError = error instanceof OvertureError;

        // Assert
        expect(isOvertureError).toBe(true);
      });
    });

    describe('Properties', () => {
      it('should provide issues property as array', () => {
        // Arrange
        const issues = ['Issue 1', 'Issue 2', 'Issue 3'];
        const error = new ValidationError('test', issues);

        // Act
        const retrieved = error.issues;

        // Assert
        expect(Array.isArray(retrieved)).toBe(true);
        expect(retrieved).toEqual(issues);
      });

      it('should allow modifying issues array', () => {
        // Arrange
        const issues = ['Initial issue'];
        const error = new ValidationError('test', issues);

        // Act
        error.issues.push('Another issue');

        // Assert
        expect(error.issues).toHaveLength(2);
        expect(error.issues).toContain('Another issue');
      });

      it('should be catchable as OvertureError', () => {
        // Arrange
        const error = new ValidationError('Validation failed', ['Issue 1']);

        // Act & Assert
        expect(() => {
          throw error;
        }).toThrow('Validation failed');
      });
    });

    describe('Use cases', () => {
      it('should handle schema validation errors', () => {
        // Arrange
        const issues = [
          'plugins: required',
          'mcp: required',
          'project.type: expected string',
        ];
        const message = 'Configuration validation failed';

        // Act
        const error = new ValidationError(message, issues);

        // Assert
        expect(error.issues).toHaveLength(3);
        expect(error.issues).toContain('plugins: required');
      });

      it('should handle multiple validation issues', () => {
        // Arrange
        const issues = Array.from({ length: 5 }, (_, i) =>
          `Field ${i + 1} is invalid`
        );

        // Act
        const error = new ValidationError('Validation failed', issues);

        // Assert
        expect(error.issues).toHaveLength(5);
      });

      it('should have empty issues for generic validation errors', () => {
        // Arrange
        const error = new ValidationError('Config failed validation');

        // Act
        const issues = error.issues;

        // Assert
        expect(issues).toEqual([]);
      });
    });
  });

  describe('PluginError', () => {
    describe('Instantiation', () => {
      it('should create PluginError with message', () => {
        // Arrange
        const message = 'Failed to install plugin';

        // Act
        const error = new PluginError(message);

        // Assert
        expect(error.message).toBe(message);
        expect(error.code).toBe('PLUGIN_ERROR');
        expect(error.exitCode).toBe(4);
        expect(error.name).toBe('PluginError');
      });

      it('should create PluginError with message and pluginName', () => {
        // Arrange
        const message = 'Failed to install plugin';
        const pluginName = 'python-development';

        // Act
        const error = new PluginError(message, pluginName);

        // Assert
        expect(error.message).toBe(message);
        expect(error.pluginName).toBe(pluginName);
      });

      it('should have PLUGIN_ERROR code', () => {
        // Arrange
        // Act
        const error = new PluginError('test');

        // Assert
        expect(error.code).toBe('PLUGIN_ERROR');
      });

      it('should have PluginError-specific exitCode', () => {
        // Arrange
        // Act
        const error = new PluginError('test');

        // Assert
        expect(error.exitCode).toBe(4);
      });

      it('should extend OvertureError', () => {
        // Arrange
        const error = new PluginError('test');

        // Act
        const isOvertureError = error instanceof OvertureError;

        // Assert
        expect(isOvertureError).toBe(true);
      });
    });

    describe('Properties', () => {
      it('should provide pluginName property', () => {
        // Arrange
        const pluginName = 'typescript-development';
        const error = new PluginError('test', pluginName);

        // Act
        const retrieved = error.pluginName;

        // Assert
        expect(retrieved).toBe(pluginName);
      });

      it('should have undefined pluginName when not provided', () => {
        // Arrange
        const error = new PluginError('test');

        // Act
        const pluginName = error.pluginName;

        // Assert
        expect(pluginName).toBeUndefined();
      });

      it('should be catchable as OvertureError', () => {
        // Arrange
        const error = new PluginError('Installation failed');

        // Act & Assert
        expect(() => {
          throw error;
        }).toThrow('Installation failed');
      });
    });

    describe('Use cases', () => {
      it('should handle plugin installation failures', () => {
        // Arrange
        const pluginName = 'python-development';
        const message = `Failed to install plugin ${pluginName}`;

        // Act
        const error = new PluginError(message, pluginName);

        // Assert
        expect(error.message).toContain('Failed to install');
        expect(error.pluginName).toBe(pluginName);
        expect(error.exitCode).toBe(4);
      });

      it('should handle plugin not found errors', () => {
        // Arrange
        const pluginName = 'unknown-plugin';
        const message = `Plugin not found: ${pluginName}`;

        // Act
        const error = new PluginError(message, pluginName);

        // Assert
        expect(error.message).toContain('not found');
        expect(error.pluginName).toBe(pluginName);
      });
    });
  });

  describe('McpError', () => {
    describe('Instantiation', () => {
      it('should create McpError with message', () => {
        // Arrange
        const message = 'Failed to start MCP server';

        // Act
        const error = new McpError(message);

        // Assert
        expect(error.message).toBe(message);
        expect(error.code).toBe('MCP_ERROR');
        expect(error.exitCode).toBe(5);
        expect(error.name).toBe('McpError');
      });

      it('should create McpError with message and mcpName', () => {
        // Arrange
        const message = 'Failed to start MCP server';
        const mcpName = 'python-repl';

        // Act
        const error = new McpError(message, mcpName);

        // Assert
        expect(error.message).toBe(message);
        expect(error.mcpName).toBe(mcpName);
      });

      it('should have MCP_ERROR code', () => {
        // Arrange
        // Act
        const error = new McpError('test');

        // Assert
        expect(error.code).toBe('MCP_ERROR');
      });

      it('should have McpError-specific exitCode', () => {
        // Arrange
        // Act
        const error = new McpError('test');

        // Assert
        expect(error.exitCode).toBe(5);
      });

      it('should extend OvertureError', () => {
        // Arrange
        const error = new McpError('test');

        // Act
        const isOvertureError = error instanceof OvertureError;

        // Assert
        expect(isOvertureError).toBe(true);
      });
    });

    describe('Properties', () => {
      it('should provide mcpName property', () => {
        // Arrange
        const mcpName = 'ruff';
        const error = new McpError('test', mcpName);

        // Act
        const retrieved = error.mcpName;

        // Assert
        expect(retrieved).toBe(mcpName);
      });

      it('should have undefined mcpName when not provided', () => {
        // Arrange
        const error = new McpError('test');

        // Act
        const mcpName = error.mcpName;

        // Assert
        expect(mcpName).toBeUndefined();
      });

      it('should be catchable as OvertureError', () => {
        // Arrange
        const error = new McpError('Server startup failed');

        // Act & Assert
        expect(() => {
          throw error;
        }).toThrow('Server startup failed');
      });
    });

    describe('Use cases', () => {
      it('should handle MCP server command not found', () => {
        // Arrange
        const mcpName = 'python-repl';
        const message = `Command for MCP server not found: ${mcpName}`;

        // Act
        const error = new McpError(message, mcpName);

        // Assert
        expect(error.message).toContain('not found');
        expect(error.mcpName).toBe(mcpName);
        expect(error.exitCode).toBe(5);
      });

      it('should handle MCP server startup failures', () => {
        // Arrange
        const mcpName = 'ruff';
        const message = `Failed to start MCP server: ${mcpName}`;

        // Act
        const error = new McpError(message, mcpName);

        // Assert
        expect(error.message).toContain('Failed to start');
        expect(error.mcpName).toBe(mcpName);
      });
    });
  });

  describe('Error Inheritance Chain', () => {
    describe('Inheritance verification', () => {
      it('should verify ConfigError extends OvertureError', () => {
        // Arrange
        const error = new ConfigError('test');

        // Act & Assert
        expect(error instanceof OvertureError).toBe(true);
        expect(error instanceof Error).toBe(true);
      });

      it('should verify ValidationError extends OvertureError', () => {
        // Arrange
        const error = new ValidationError('test');

        // Act & Assert
        expect(error instanceof OvertureError).toBe(true);
        expect(error instanceof Error).toBe(true);
      });

      it('should verify PluginError extends OvertureError', () => {
        // Arrange
        const error = new PluginError('test');

        // Act & Assert
        expect(error instanceof OvertureError).toBe(true);
        expect(error instanceof Error).toBe(true);
      });

      it('should verify McpError extends OvertureError', () => {
        // Arrange
        const error = new McpError('test');

        // Act & Assert
        expect(error instanceof OvertureError).toBe(true);
        expect(error instanceof Error).toBe(true);
      });
    });

    describe('Polymorphism', () => {
      it('should catch specific errors as OvertureError', () => {
        // Arrange
        const errors: OvertureError[] = [
          new ConfigError('config error'),
          new ValidationError('validation error'),
          new PluginError('plugin error'),
          new McpError('mcp error'),
        ];

        // Act & Assert
        errors.forEach((error) => {
          expect(error instanceof OvertureError).toBe(true);
          expect(error.code).toBeDefined();
          expect(error.exitCode).toBeGreaterThanOrEqual(1);
        });
      });

      it('should distinguish errors by type', () => {
        // Arrange
        const configErr = new ConfigError('test');
        const validErr = new ValidationError('test');
        const plugErr = new PluginError('test');
        const mcpErr = new McpError('test');

        // Act & Assert
        expect(configErr.code).toBe('CONFIG_ERROR');
        expect(validErr.code).toBe('VALIDATION_ERROR');
        expect(plugErr.code).toBe('PLUGIN_ERROR');
        expect(mcpErr.code).toBe('MCP_ERROR');
      });

      it('should have unique exit codes', () => {
        // Arrange
        const errors = [
          new OvertureError('test', 'TEST', 1),
          new ConfigError('test'),
          new ValidationError('test'),
          new PluginError('test'),
          new McpError('test'),
        ];

        // Act
        const exitCodes = errors.map((e) => e.exitCode);

        // Assert
        const uniqueCodes = new Set(exitCodes);
        expect(uniqueCodes.size).toBe(exitCodes.length);
      });
    });
  });

  describe('Error Messages and Properties', () => {
    describe('Message clarity', () => {
      it('should provide helpful error messages for config errors', () => {
        // Arrange
        const message = 'Invalid schema: "plugins" field is missing';

        // Act
        const error = new ConfigError(message);

        // Assert
        expect(error.message).toContain('Invalid schema');
        expect(error.message).toContain('plugins');
      });

      it('should provide helpful error messages for validation errors', () => {
        // Arrange
        const issues = ['Field A must be a string', 'Field B must be >= 0'];
        const error = new ValidationError(
          'Configuration validation failed',
          issues
        );

        // Act & Assert
        expect(error.message).toContain('validation failed');
        expect(error.issues).toHaveLength(2);
      });
    });

    describe('Error names', () => {
      it('should have descriptive error names', () => {
        // Arrange
        const errors = [
          new OvertureError('test', 'CODE'),
          new ConfigError('test'),
          new ValidationError('test'),
          new PluginError('test'),
          new McpError('test'),
        ];

        // Act & Assert
        expect(errors[0].name).toBe('OvertureError');
        expect(errors[1].name).toBe('ConfigError');
        expect(errors[2].name).toBe('ValidationError');
        expect(errors[3].name).toBe('PluginError');
        expect(errors[4].name).toBe('McpError');
      });
    });
  });
});
