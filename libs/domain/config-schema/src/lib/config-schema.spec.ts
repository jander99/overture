/**
 * Zod Schema Tests for Overture v2.0 Configuration
 *
 * @module domain/config.schema.spec
 */

import {
  PlatformSchema,
  TransportTypeSchema,
  ScopeSchema,
  ClientNameSchema,
  MergeStrategySchema,
  McpServerConfigSchema,
  ClientConfigSchema,
  SyncOptionsSchema,
  OvertureConfigSchema,
  ClientMcpServerDefSchema,
  ClientSyncResultSchema,
  SyncResultSchema,
  ValidationResultSchema,
} from './config-schema';

describe('Zod Schema Validators', () => {
  describe('PlatformSchema', () => {
    it('should accept valid platforms', () => {
      expect(PlatformSchema.parse('darwin')).toBe('darwin');
      expect(PlatformSchema.parse('linux')).toBe('linux');
      expect(PlatformSchema.parse('win32')).toBe('win32');
    });

    it('should reject invalid platforms', () => {
      expect(() => PlatformSchema.parse('windows')).toThrow();
      expect(() => PlatformSchema.parse('mac')).toThrow();
      expect(() => PlatformSchema.parse('')).toThrow();
    });
  });

  describe('TransportTypeSchema', () => {
    it('should accept valid transport types', () => {
      expect(TransportTypeSchema.parse('stdio')).toBe('stdio');
      expect(TransportTypeSchema.parse('http')).toBe('http');
      expect(TransportTypeSchema.parse('sse')).toBe('sse');
    });

    it('should reject invalid transport types', () => {
      expect(() => TransportTypeSchema.parse('websocket')).toThrow();
      expect(() => TransportTypeSchema.parse('grpc')).toThrow();
      expect(() => TransportTypeSchema.parse('')).toThrow();
    });
  });

  describe('ScopeSchema', () => {
    it('should accept valid scopes', () => {
      expect(ScopeSchema.parse('global')).toBe('global');
      expect(ScopeSchema.parse('project')).toBe('project');
    });

    it('should reject invalid scopes', () => {
      expect(() => ScopeSchema.parse('local')).toThrow();
      expect(() => ScopeSchema.parse('user')).toThrow();
    });
  });

  describe('ClientNameSchema', () => {
    it('should accept all valid client names', () => {
      expect(ClientNameSchema.parse('claude-code')).toBe('claude-code');
      expect(ClientNameSchema.parse('claude-desktop')).toBe('claude-desktop');
      expect(ClientNameSchema.parse('vscode')).toBe('vscode');
      expect(ClientNameSchema.parse('cursor')).toBe('cursor');
      expect(ClientNameSchema.parse('windsurf')).toBe('windsurf');
      expect(ClientNameSchema.parse('copilot-cli')).toBe('copilot-cli');
      expect(ClientNameSchema.parse('jetbrains-copilot')).toBe('jetbrains-copilot');
    });

    it('should reject invalid client names', () => {
      expect(() => ClientNameSchema.parse('vim')).toThrow();
      expect(() => ClientNameSchema.parse('emacs')).toThrow();
    });
  });

  describe('MergeStrategySchema', () => {
    it('should accept valid merge strategies', () => {
      expect(MergeStrategySchema.parse('append')).toBe('append');
      expect(MergeStrategySchema.parse('replace')).toBe('replace');
    });

    it('should reject invalid merge strategies', () => {
      expect(() => MergeStrategySchema.parse('merge')).toThrow();
      expect(() => MergeStrategySchema.parse('override')).toThrow();
    });
  });

  describe('McpServerConfigSchema', () => {
    const validMcpConfig = {
      command: 'mcp-server-github',
      args: [],
      env: {},
      transport: 'stdio' as const,
    };

    it('should accept valid minimal MCP config', () => {
      const result = McpServerConfigSchema.parse(validMcpConfig);
      expect(result.command).toBe('mcp-server-github');
      expect(result.transport).toBe('stdio');
    });

    it('should require transport field', () => {
      const invalid = { ...validMcpConfig };
      delete (invalid as any).transport;

      expect(() => McpServerConfigSchema.parse(invalid)).toThrow();
    });

    it('should accept optional version field', () => {
      const withVersion = {
        ...validMcpConfig,
        version: '1.2.3',
      };

      const result = McpServerConfigSchema.parse(withVersion);
      expect(result.version).toBe('1.2.3');
    });

    it('should accept args array', () => {
      const withArgs = {
        ...validMcpConfig,
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
      };

      const result = McpServerConfigSchema.parse(withArgs);
      expect(result.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem']);
    });

    it('should accept env object with variable expansion syntax', () => {
      const withEnv = {
        ...validMcpConfig,
        env: {
          GITHUB_TOKEN: '${GITHUB_TOKEN}',
          API_URL: '${API_URL:-https://api.github.com}',
        },
      };

      const result = McpServerConfigSchema.parse(withEnv);
      expect(result.env.GITHUB_TOKEN).toBe('${GITHUB_TOKEN}');
      expect(result.env.API_URL).toBe('${API_URL:-https://api.github.com}');
    });

    it('should validate env var pattern', () => {
      const invalidEnv = {
        ...validMcpConfig,
        env: {
          TOKEN: '${invalid-name}', // Hyphens not allowed in var names
        },
      };

      expect(() => McpServerConfigSchema.parse(invalidEnv)).toThrow();
    });

    it('should accept client exclusions', () => {
      const withExclusions = {
        ...validMcpConfig,
        clients: {
          exclude: ['copilot-cli', 'windsurf'],
        },
      };

      const result = McpServerConfigSchema.parse(withExclusions);
      expect(result.clients?.exclude).toEqual(['copilot-cli', 'windsurf']);
    });

    it('should accept client inclusions', () => {
      const withInclusions = {
        ...validMcpConfig,
        clients: {
          include: ['claude-code', 'cursor'],
        },
      };

      const result = McpServerConfigSchema.parse(withInclusions);
      expect(result.clients?.include).toEqual(['claude-code', 'cursor']);
    });

    it('should reject both exclude and include', () => {
      const withBoth = {
        ...validMcpConfig,
        clients: {
          exclude: ['copilot-cli'],
          include: ['claude-code'],
        },
      };

      expect(() => McpServerConfigSchema.parse(withBoth)).toThrow();
    });

    it('should accept client overrides', () => {
      const withOverrides = {
        ...validMcpConfig,
        clients: {
          overrides: {
            'vscode': {
              transport: 'http' as const,
            },
            'cursor': {
              env: {
                CUSTOM_TOKEN: '${CURSOR_TOKEN}',
              },
            },
          },
        },
      };

      const result = McpServerConfigSchema.parse(withOverrides);
      expect(result.clients?.overrides?.vscode?.transport).toBe('http');
      expect(result.clients?.overrides?.cursor?.env?.CUSTOM_TOKEN).toBe('${CURSOR_TOKEN}');
    });

    it('should accept platform exclusions', () => {
      const withPlatformExclusions = {
        ...validMcpConfig,
        platforms: {
          exclude: ['win32'],
        },
      };

      const result = McpServerConfigSchema.parse(withPlatformExclusions);
      expect(result.platforms?.exclude).toEqual(['win32']);
    });

    it('should accept platform command overrides', () => {
      const withCommandOverrides = {
        ...validMcpConfig,
        platforms: {
          commandOverrides: {
            win32: 'python.exe',
            darwin: '/usr/local/bin/python3',
          },
        },
      };

      const result = McpServerConfigSchema.parse(withCommandOverrides);
      expect(result.platforms?.commandOverrides?.win32).toBe('python.exe');
    });

    it('should accept platform args overrides', () => {
      const withArgsOverrides = {
        ...validMcpConfig,
        platforms: {
          argsOverrides: {
            win32: ['-m', 'mcp_server'],
          },
        },
      };

      const result = McpServerConfigSchema.parse(withArgsOverrides);
      expect(result.platforms?.argsOverrides?.win32).toEqual(['-m', 'mcp_server']);
    });

    it('should accept metadata', () => {
      const withMetadata = {
        ...validMcpConfig,
        metadata: {
          description: 'GitHub MCP server',
          homepage: 'https://github.com/example/mcp-server-github',
          tags: ['git', 'github', 'vcs'],
        },
      };

      const result = McpServerConfigSchema.parse(withMetadata);
      expect(result.metadata?.description).toBe('GitHub MCP server');
      expect(result.metadata?.tags).toEqual(['git', 'github', 'vcs']);
    });

    it('should validate homepage URL in metadata', () => {
      const withInvalidUrl = {
        ...validMcpConfig,
        metadata: {
          homepage: 'not-a-url',
        },
      };

      expect(() => McpServerConfigSchema.parse(withInvalidUrl)).toThrow();
    });

    it('should apply default values', () => {
      const minimal = {
        command: 'test',
        transport: 'stdio' as const,
      };

      const result = McpServerConfigSchema.parse(minimal);
      expect(result.args).toEqual([]);
      expect(result.env).toEqual({});
    });

    it('should require command to be non-empty', () => {
      const emptyCommand = {
        ...validMcpConfig,
        command: '',
      };

      expect(() => McpServerConfigSchema.parse(emptyCommand)).toThrow();
    });
  });

  describe('ClientConfigSchema', () => {
    it('should accept minimal client config', () => {
      const result = ClientConfigSchema.parse({});
      expect(result.enabled).toBe(true); // Default value
    });

    it('should accept enabled field', () => {
      const config = { enabled: false };
      const result = ClientConfigSchema.parse(config);
      expect(result.enabled).toBe(false);
    });

    it('should accept configPath as string', () => {
      const config = {
        enabled: true,
        configPath: '~/.custom-claude/mcp.json',
      };

      const result = ClientConfigSchema.parse(config);
      expect(result.configPath).toBe('~/.custom-claude/mcp.json');
    });

    it('should accept configPath as platform record', () => {
      const config = {
        enabled: true,
        configPath: {
          darwin: '/Users/user/.claude.json',
          linux: '/home/user/.claude.json',
          win32: 'C:\\Users\\user\\AppData\\Roaming\\Claude\\mcp.json',
        },
      };

      const result = ClientConfigSchema.parse(config);
      expect(result.configPath).toHaveProperty('darwin');
      expect(result.configPath).toHaveProperty('linux');
    });

    it('should accept maxServers', () => {
      const config = {
        enabled: true,
        maxServers: 100,
      };

      const result = ClientConfigSchema.parse(config);
      expect(result.maxServers).toBe(100);
    });

    it('should reject negative maxServers', () => {
      const config = {
        enabled: true,
        maxServers: -1,
      };

      expect(() => ClientConfigSchema.parse(config)).toThrow();
    });

    it('should accept settings object', () => {
      const config = {
        enabled: true,
        settings: {
          theme: 'dark',
          fontSize: 14,
        },
      };

      const result = ClientConfigSchema.parse(config);
      expect(result.settings).toEqual({ theme: 'dark', fontSize: 14 });
    });
  });

  describe('SyncOptionsSchema', () => {
    it('should apply default values', () => {
      const result = SyncOptionsSchema.parse({});
      expect(result.backup).toBe(true);
      expect(result.backupDir).toBe('~/.config/overture/backups');
      expect(result.backupRetention).toBe(10);
      expect(result.mergeStrategy).toBe('append');
      expect(result.autoDetectClients).toBe(true);
    });

    it('should accept all options', () => {
      const options = {
        backup: false,
        backupDir: '/custom/backup',
        backupRetention: 5,
        mergeStrategy: 'replace' as const,
        autoDetectClients: false,
        enabledClients: ['claude-code', 'cursor'] as const,
      };

      const result = SyncOptionsSchema.parse(options);
      expect(result.backup).toBe(false);
      expect(result.backupDir).toBe('/custom/backup');
      expect(result.mergeStrategy).toBe('replace');
    });

    it('should reject negative backupRetention', () => {
      const options = {
        backupRetention: -1,
      };

      expect(() => SyncOptionsSchema.parse(options)).toThrow();
    });
  });

  describe('OvertureConfigSchema', () => {
    const validConfig = {
      version: '2.0',
      mcp: {
        github: {
          command: 'mcp-server-github',
          args: [],
          env: {},
          transport: 'stdio' as const,
        },
      },
    };

    it('should accept valid minimal config', () => {
      const result = OvertureConfigSchema.parse(validConfig);
      expect(result.version).toBe('2.0');
      expect(result.mcp.github).toBeDefined();
    });

    it('should require version field', () => {
      const invalid = { ...validConfig };
      delete (invalid as any).version;

      expect(() => OvertureConfigSchema.parse(invalid)).toThrow();
    });

    it('should validate version format', () => {
      const invalidVersion = {
        ...validConfig,
        version: 'v2.0',
      };

      expect(() => OvertureConfigSchema.parse(invalidVersion)).toThrow();
    });

    it('should accept valid version formats', () => {
      expect(OvertureConfigSchema.parse({ ...validConfig, version: '2.0' })).toBeDefined();
      expect(OvertureConfigSchema.parse({ ...validConfig, version: '10.99' })).toBeDefined();
    });

    it('should require mcp field', () => {
      const invalid = { version: '2.0' };

      expect(() => OvertureConfigSchema.parse(invalid)).toThrow();
    });

    it('should accept clients config', () => {
      const withClients = {
        ...validConfig,
        clients: {
          'claude-code': {
            enabled: true,
          },
          'vscode': {
            enabled: false,
          },
        },
      };

      const result = OvertureConfigSchema.parse(withClients);
      expect(result.clients?.['claude-code']?.enabled).toBe(true);
      expect(result.clients?.['vscode']?.enabled).toBe(false);
    });

    it('should accept sync options', () => {
      const withSync = {
        ...validConfig,
        sync: {
          backup: true,
          backupRetention: 5,
        },
      };

      const result = OvertureConfigSchema.parse(withSync);
      expect(result.sync?.backup).toBe(true);
      expect(result.sync?.backupRetention).toBe(5);
    });

    it('should validate complete real-world config', () => {
      const realWorldConfig = {
        version: '2.0',
        clients: {
          'claude-code': {
            enabled: true,
          },
          'claude-desktop': {
            enabled: true,
          },
          'vscode': {
            enabled: false,
          },
        },
        mcp: {
          github: {
            command: 'mcp-server-github',
            args: [],
            env: {
              GITHUB_TOKEN: '${GITHUB_TOKEN}',
            },
            transport: 'stdio' as const,
            version: '1.0.0',
            clients: {
              exclude: ['copilot-cli'],
            },
          },
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
            env: {},
            transport: 'stdio' as const,
          },
        },
        sync: {
          backup: true,
          backupDir: '~/.config/overture/backups',
          backupRetention: 10,
          mergeStrategy: 'append' as const,
          autoDetectClients: true,
        },
      };

      const result = OvertureConfigSchema.parse(realWorldConfig);
      expect(result.version).toBe('2.0');
      expect(result.mcp.github.clients?.exclude).toContain('copilot-cli');
      expect(result.sync?.backup).toBe(true);
    });
  });

  describe('ClientMcpServerDefSchema', () => {
    it('should accept minimal client MCP def', () => {
      const def = {
        command: 'mcp-server-github',
      };

      const result = ClientMcpServerDefSchema.parse(def);
      expect(result.command).toBe('mcp-server-github');
      expect(result.args).toEqual([]); // Default
    });

    it('should accept type field for VS Code', () => {
      const def = {
        command: 'mcp-server-github',
        args: [],
        type: 'stdio' as const,
      };

      const result = ClientMcpServerDefSchema.parse(def);
      expect(result.type).toBe('stdio');
    });

    it('should accept url field for HTTP transport', () => {
      const def = {
        command: 'mcp-server-github',
        args: [],
        type: 'http' as const,
        url: 'http://localhost:8080',
      };

      const result = ClientMcpServerDefSchema.parse(def);
      expect(result.url).toBe('http://localhost:8080');
    });

    it('should validate URL format', () => {
      const def = {
        command: 'mcp-server-github',
        args: [],
        url: 'not-a-url',
      };

      expect(() => ClientMcpServerDefSchema.parse(def)).toThrow();
    });
  });

  describe('ValidationResultSchema', () => {
    it('should accept valid validation result', () => {
      const result = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const parsed = ValidationResultSchema.parse(result);
      expect(parsed.valid).toBe(true);
    });

    it('should accept validation errors', () => {
      const result = {
        valid: false,
        errors: [
          {
            message: 'Transport is required',
            path: 'mcp.github.transport',
            code: 'REQUIRED',
          },
        ],
        warnings: [],
      };

      const parsed = ValidationResultSchema.parse(result);
      expect(parsed.errors).toHaveLength(1);
      expect(parsed.errors[0].code).toBe('REQUIRED');
    });

    it('should accept validation warnings', () => {
      const result = {
        valid: true,
        errors: [],
        warnings: [
          {
            message: 'Version field is optional but recommended',
            path: 'mcp.github.version',
            suggestion: 'Add version: "1.0.0"',
          },
        ],
      };

      const parsed = ValidationResultSchema.parse(result);
      expect(parsed.warnings).toHaveLength(1);
      expect(parsed.warnings[0].suggestion).toBeDefined();
    });
  });
});
