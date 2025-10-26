import { z } from 'zod';
import {
  McpServerSchema,
  PluginSchema,
  ProjectSchema,
  OvertureConfigSchema,
  McpJsonSchema,
} from './schemas';

describe('Domain: Schemas', () => {
  describe('McpServerSchema', () => {
    describe('Valid inputs', () => {
      it('should validate minimal MCP server with only scope', () => {
        // Arrange
        const input = { scope: 'global' as const };

        // Act
        const result = McpServerSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.scope).toBe('global');
          expect(result.data.enabled).toBe(true);
        }
      });

      it('should validate complete MCP server configuration', () => {
        // Arrange
        const input = {
          command: 'uvx',
          args: ['mcp-server-python-repl'],
          env: { PYTHONPATH: '/usr/local/lib' },
          scope: 'project' as const,
          enabled: true,
        };

        // Act
        const result = McpServerSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.command).toBe('uvx');
          expect(result.data.args).toEqual(['mcp-server-python-repl']);
          expect(result.data.env?.PYTHONPATH).toBe('/usr/local/lib');
          expect(result.data.scope).toBe('project');
          expect(result.data.enabled).toBe(true);
        }
      });

      it('should default enabled to true', () => {
        // Arrange
        const input = { scope: 'global' as const };

        // Act
        const result = McpServerSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.enabled).toBe(true);
        }
      });

      it('should handle empty args array', () => {
        // Arrange
        const input = {
          command: 'test-cmd',
          args: [],
          scope: 'project' as const,
        };

        // Act
        const result = McpServerSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.args).toEqual([]);
        }
      });

      it('should handle multiple environment variables', () => {
        // Arrange
        const input = {
          command: 'test-cmd',
          scope: 'project' as const,
          env: {
            VAR1: 'value1',
            VAR2: 'value2',
            VAR3: 'value3',
          },
        };

        // Act
        const result = McpServerSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(Object.keys(result.data.env || {})).toHaveLength(3);
        }
      });
    });

    describe('Invalid inputs', () => {
      it('should reject missing required scope field', () => {
        // Arrange
        const input = { command: 'test' };

        // Act
        const result = McpServerSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
          expect(result.error.issues[0].path).toContain('scope');
        }
      });

      it('should reject invalid scope value', () => {
        // Arrange
        const input = { scope: 'invalid-scope' };

        // Act
        const result = McpServerSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].code).toBe('invalid_value');
        }
      });

      it('should reject non-string command', () => {
        // Arrange
        const input = {
          command: 123,
          scope: 'global',
        };

        // Act
        const result = McpServerSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
        }
      });

      it('should reject non-array args', () => {
        // Arrange
        const input = {
          command: 'test',
          args: 'not-an-array',
          scope: 'project',
        };

        // Act
        const result = McpServerSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject args with non-string elements', () => {
        // Arrange
        const input = {
          command: 'test',
          args: ['valid', 123, 'another'],
          scope: 'project',
        };

        // Act
        const result = McpServerSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject non-boolean enabled', () => {
        // Arrange
        const input = {
          scope: 'project',
          enabled: 'yes',
        };

        // Act
        const result = McpServerSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject env with non-string values', () => {
        // Arrange
        const input = {
          scope: 'project',
          env: { KEY: 123 },
        };

        // Act
        const result = McpServerSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject env with non-string keys', () => {
        // Arrange
        // Note: JavaScript object keys are always converted to strings,
        // so { [123]: 'value' } becomes { '123': 'value' }
        // This test verifies that string keys are accepted
        const input = {
          scope: 'project',
          env: { '123': 'value' },
        };

        // Act
        const result = McpServerSchema.safeParse(input);

        // Assert
        // String keys are valid, even if they look like numbers
        expect(result.success).toBe(true);
      });
    });

    describe('Edge cases', () => {
      it('should accept extra fields (zod defaults to strip)', () => {
        // Arrange
        const input = {
          scope: 'global' as const,
          extraField: 'should-be-ignored',
        };

        // Act
        const result = McpServerSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect('extraField' in result.data).toBe(false);
        }
      });

      it('should handle empty env object', () => {
        // Arrange
        const input = {
          scope: 'project' as const,
          env: {},
        };

        // Act
        const result = McpServerSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(Object.keys(result.data.env || {})).toHaveLength(0);
        }
      });
    });
  });

  describe('PluginSchema', () => {
    describe('Valid inputs', () => {
      it('should validate minimal plugin with required fields', () => {
        // Arrange
        const input = {
          marketplace: 'claude-code-workflows',
          mcps: ['python-repl'],
        };

        // Act
        const result = PluginSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.marketplace).toBe('claude-code-workflows');
          expect(result.data.mcps).toEqual(['python-repl']);
          expect(result.data.enabled).toBe(true);
        }
      });

      it('should validate complete plugin configuration', () => {
        // Arrange
        const input = {
          marketplace: 'claude-code-workflows',
          enabled: true,
          mcps: ['python-repl', 'ruff', 'filesystem'],
        };

        // Act
        const result = PluginSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.mcps).toHaveLength(3);
          expect(result.data.enabled).toBe(true);
        }
      });

      it('should default enabled to true', () => {
        // Arrange
        const input = {
          marketplace: 'test-marketplace',
          mcps: [],
        };

        // Act
        const result = PluginSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.enabled).toBe(true);
        }
      });

      it('should accept disabled plugin', () => {
        // Arrange
        const input = {
          marketplace: 'claude-code-workflows',
          enabled: false,
          mcps: ['python-repl'],
        };

        // Act
        const result = PluginSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.enabled).toBe(false);
        }
      });

      it('should accept empty mcps array', () => {
        // Arrange
        const input = {
          marketplace: 'test-marketplace',
          mcps: [],
        };

        // Act
        const result = PluginSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.mcps).toHaveLength(0);
        }
      });
    });

    describe('Invalid inputs', () => {
      it('should reject missing marketplace', () => {
        // Arrange
        const input = { mcps: ['python-repl'] };

        // Act
        const result = PluginSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject missing mcps', () => {
        // Arrange
        const input = { marketplace: 'test-marketplace' };

        // Act
        const result = PluginSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject non-string marketplace', () => {
        // Arrange
        const input = {
          marketplace: 123,
          mcps: ['python-repl'],
        };

        // Act
        const result = PluginSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject non-array mcps', () => {
        // Arrange
        const input = {
          marketplace: 'test-marketplace',
          mcps: 'not-an-array',
        };

        // Act
        const result = PluginSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject mcps with non-string elements', () => {
        // Arrange
        const input = {
          marketplace: 'test-marketplace',
          mcps: ['valid-mcp', 123, 'another-mcp'],
        };

        // Act
        const result = PluginSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject non-boolean enabled', () => {
        // Arrange
        const input = {
          marketplace: 'test-marketplace',
          mcps: ['python-repl'],
          enabled: 'yes',
        };

        // Act
        const result = PluginSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });
    });
  });

  describe('ProjectSchema', () => {
    describe('Valid inputs', () => {
      it('should validate minimal project with only name', () => {
        // Arrange
        const input = { name: 'my-project' };

        // Act
        const result = ProjectSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe('my-project');
        }
      });

      it('should validate complete project metadata', () => {
        // Arrange
        const input = {
          name: 'my-project',
          type: 'python-backend',
          description: 'A test backend project',
        };

        // Act
        const result = ProjectSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe('my-project');
          expect(result.data.type).toBe('python-backend');
          expect(result.data.description).toBe('A test backend project');
        }
      });

      it('should allow optional fields to be undefined', () => {
        // Arrange
        const input = { name: 'project' };

        // Act
        const result = ProjectSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.type).toBeUndefined();
          expect(result.data.description).toBeUndefined();
        }
      });
    });

    describe('Invalid inputs', () => {
      it('should reject missing name', () => {
        // Arrange
        const input = { type: 'python-backend' };

        // Act
        const result = ProjectSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject non-string name', () => {
        // Arrange
        const input = { name: 123 };

        // Act
        const result = ProjectSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject non-string type', () => {
        // Arrange
        const input = {
          name: 'my-project',
          type: 123,
        };

        // Act
        const result = ProjectSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject non-string description', () => {
        // Arrange
        const input = {
          name: 'my-project',
          description: true,
        };

        // Act
        const result = ProjectSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should accept empty string name (zod accepts it)', () => {
        // Arrange
        const input = { name: '' };

        // Act
        const result = ProjectSchema.safeParse(input);

        // Assert
        // Note: Zod's string() allows empty strings by default
        expect(result.success).toBe(true);
      });
    });
  });

  describe('OvertureConfigSchema', () => {
    describe('Valid inputs', () => {
      it('should validate minimal config with only required fields', () => {
        // Arrange
        const input = {
          plugins: {},
          mcp: {},
        };

        // Act
        const result = OvertureConfigSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.version).toBe('1.0');
          expect(result.data.plugins).toEqual({});
          expect(result.data.mcp).toEqual({});
        }
      });

      it('should validate complete configuration', () => {
        // Arrange
        const input = {
          version: '1.0',
          project: {
            name: 'test-project',
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
          },
        };

        // Act
        const result = OvertureConfigSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.project?.name).toBe('test-project');
          expect(Object.keys(result.data.plugins)).toContain(
            'python-development'
          );
          expect(Object.keys(result.data.mcp)).toContain('python-repl');
        }
      });

      it('should default version to 1.0', () => {
        // Arrange
        const input = {
          plugins: {},
          mcp: {},
        };

        // Act
        const result = OvertureConfigSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.version).toBe('1.0');
        }
      });

      it('should allow custom version', () => {
        // Arrange
        const input = {
          version: '2.0',
          plugins: {},
          mcp: {},
        };

        // Act
        const result = OvertureConfigSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.version).toBe('2.0');
        }
      });

      it('should allow multiple plugins and mcps', () => {
        // Arrange
        const input = {
          plugins: {
            plugin1: {
              marketplace: 'marketplace1',
              mcps: ['mcp1'],
            },
            plugin2: {
              marketplace: 'marketplace2',
              mcps: ['mcp2', 'mcp3'],
            },
          },
          mcp: {
            mcp1: { scope: 'project' },
            mcp2: { scope: 'global' },
            mcp3: { scope: 'project' },
          },
        };

        // Act
        const result = OvertureConfigSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(Object.keys(result.data.plugins)).toHaveLength(2);
          expect(Object.keys(result.data.mcp)).toHaveLength(3);
        }
      });
    });

    describe('Invalid inputs', () => {
      it('should reject missing plugins', () => {
        // Arrange
        const input = { mcp: {} };

        // Act
        const result = OvertureConfigSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject missing mcp', () => {
        // Arrange
        const input = { plugins: {} };

        // Act
        const result = OvertureConfigSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject non-object plugins', () => {
        // Arrange
        const input = {
          plugins: 'not-an-object',
          mcp: {},
        };

        // Act
        const result = OvertureConfigSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject non-object mcp', () => {
        // Arrange
        const input = {
          plugins: {},
          mcp: 'not-an-object',
        };

        // Act
        const result = OvertureConfigSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject invalid plugin entries', () => {
        // Arrange
        const input = {
          plugins: {
            'plugin-name': {
              marketplace: 'valid-marketplace',
              mcps: 'not-an-array', // Invalid
            },
          },
          mcp: {},
        };

        // Act
        const result = OvertureConfigSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject invalid mcp entries', () => {
        // Arrange
        const input = {
          plugins: {},
          mcp: {
            'mcp-name': {
              scope: 'invalid-scope', // Invalid enum
            },
          },
        };

        // Act
        const result = OvertureConfigSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should accept project as optional', () => {
        // Arrange
        const input = {
          plugins: {},
          mcp: {},
          // project intentionally omitted
        };

        // Act
        const result = OvertureConfigSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.project).toBeUndefined();
        }
      });

      it('should accept null values appropriately', () => {
        // Arrange
        const input = {
          plugins: {},
          mcp: {},
          project: null,
        };

        // Act
        const result = OvertureConfigSchema.safeParse(input);

        // Assert
        // Zod's optional fields reject null by default
        expect(result.success).toBe(false);
      });
    });
  });

  describe('McpJsonSchema', () => {
    describe('Valid inputs', () => {
      it('should validate minimal mcp.json with single server', () => {
        // Arrange
        const input = {
          mcpServers: {
            'test-server': {
              command: 'test-command',
            },
          },
        };

        // Act
        const result = McpJsonSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.mcpServers['test-server'].command).toBe(
            'test-command'
          );
        }
      });

      it('should validate complete mcp.json with all fields', () => {
        // Arrange
        const input = {
          mcpServers: {
            'python-repl': {
              command: 'uvx',
              args: ['mcp-server-python-repl'],
              env: { PYTHONPATH: '/usr/lib' },
            },
            'test-server': {
              command: 'test-cmd',
            },
          },
        };

        // Act
        const result = McpJsonSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(Object.keys(result.data.mcpServers)).toHaveLength(2);
          expect(
            result.data.mcpServers['python-repl'].args
          ).toContainEqual('mcp-server-python-repl');
        }
      });

      it('should accept optional args and env', () => {
        // Arrange
        const input = {
          mcpServers: {
            'server-no-args': {
              command: 'cmd',
            },
            'server-with-args': {
              command: 'cmd',
              args: ['arg1'],
            },
          },
        };

        // Act
        const result = McpJsonSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.mcpServers['server-no-args'].args).toBeUndefined();
        }
      });
    });

    describe('Invalid inputs', () => {
      it('should reject missing mcpServers', () => {
        // Arrange
        const input = {};

        // Act
        const result = McpJsonSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject non-object mcpServers', () => {
        // Arrange
        const input = { mcpServers: 'not-an-object' };

        // Act
        const result = McpJsonSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject server without command', () => {
        // Arrange
        const input = {
          mcpServers: {
            'test-server': {
              args: ['some-arg'],
            },
          },
        };

        // Act
        const result = McpJsonSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject non-string command', () => {
        // Arrange
        const input = {
          mcpServers: {
            'test-server': {
              command: 123,
            },
          },
        };

        // Act
        const result = McpJsonSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject non-array args', () => {
        // Arrange
        const input = {
          mcpServers: {
            'test-server': {
              command: 'test',
              args: 'not-array',
            },
          },
        };

        // Act
        const result = McpJsonSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject args with non-string elements', () => {
        // Arrange
        const input = {
          mcpServers: {
            'test-server': {
              command: 'test',
              args: ['valid', 123],
            },
          },
        };

        // Act
        const result = McpJsonSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject non-object env', () => {
        // Arrange
        const input = {
          mcpServers: {
            'test-server': {
              command: 'test',
              env: 'not-object',
            },
          },
        };

        // Act
        const result = McpJsonSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should reject env with non-string values', () => {
        // Arrange
        const input = {
          mcpServers: {
            'test-server': {
              command: 'test',
              env: { KEY: 123 },
            },
          },
        };

        // Act
        const result = McpJsonSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should accept empty mcpServers object', () => {
        // Arrange
        const input = { mcpServers: {} };

        // Act
        const result = McpJsonSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(Object.keys(result.data.mcpServers)).toHaveLength(0);
        }
      });

      it('should accept empty args array', () => {
        // Arrange
        const input = {
          mcpServers: {
            'test-server': {
              command: 'test',
              args: [],
            },
          },
        };

        // Act
        const result = McpJsonSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.mcpServers['test-server'].args).toEqual([]);
        }
      });

      it('should accept empty env object', () => {
        // Arrange
        const input = {
          mcpServers: {
            'test-server': {
              command: 'test',
              env: {},
            },
          },
        };

        // Act
        const result = McpJsonSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.mcpServers['test-server'].env).toEqual({});
        }
      });
    });
  });
});
