/**
 * Audit Service Tests
 *
 * Tests for detecting unmanaged MCPs in client configurations.
 *
 * @module core/audit-service.spec
 */

import { AuditService } from './audit-service';
import type { ClientAdapter } from '../adapters/client-adapter.interface';
import type { OvertureConfig, ClientName, Platform } from '../domain/config.types';

describe('AuditService', () => {
  let auditService: AuditService;

  beforeEach(() => {
    auditService = new AuditService();
  });

  describe('auditClient', () => {
    it('should return empty array when client has no MCPs', () => {
      const mockAdapter: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: jest.fn().mockReturnValue({ user: '/path/to/config' }),
        readConfig: jest.fn().mockReturnValue({ mcpServers: {} }),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
      };

      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {},
      };

      const result = auditService.auditClient(mockAdapter, overtureConfig, 'linux');

      expect(result).toEqual([]);
    });

    it('should return empty array when all client MCPs are managed', () => {
      const mockAdapter: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: jest.fn().mockReturnValue({ user: '/path/to/config' }),
        readConfig: jest.fn().mockReturnValue({
          mcpServers: {
            github: { command: 'mcp-server-github', args: [] },
            filesystem: { command: 'npx', args: ['@modelcontextprotocol/server-filesystem'] },
          },
        }),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
      };

      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          github: {
            command: 'mcp-server-github',
            args: [],
            env: {},
            transport: 'stdio',
          },
          filesystem: {
            command: 'npx',
            args: ['@modelcontextprotocol/server-filesystem'],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const result = auditService.auditClient(mockAdapter, overtureConfig, 'linux');

      expect(result).toEqual([]);
    });

    it('should detect unmanaged MCPs in client config', () => {
      const mockAdapter: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: jest.fn().mockReturnValue({ user: '/path/to/config' }),
        readConfig: jest.fn().mockReturnValue({
          mcpServers: {
            github: { command: 'mcp-server-github', args: [] },
            filesystem: { command: 'npx', args: ['@modelcontextprotocol/server-filesystem'] },
            slack: { command: 'mcp-server-slack', args: [] },
          },
        }),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
      };

      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          github: {
            command: 'mcp-server-github',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const result = auditService.auditClient(mockAdapter, overtureConfig, 'linux');

      expect(result).toEqual(['filesystem', 'slack']);
    });

    it('should handle user config path (string)', () => {
      const mockAdapter: ClientAdapter = {
        name: 'claude-desktop',
        schemaRootKey: 'mcpServers',
        detectConfigPath: jest.fn().mockReturnValue('/path/to/user/config'),
        readConfig: jest.fn().mockReturnValue({
          mcpServers: {
            unmanaged: { command: 'some-mcp', args: [] },
          },
        }),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
      };

      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {},
      };

      const result = auditService.auditClient(mockAdapter, overtureConfig, 'linux');

      expect(result).toEqual(['unmanaged']);
      expect(mockAdapter.readConfig).toHaveBeenCalledWith('/path/to/user/config');
    });

    it('should handle user + project config paths (object)', () => {
      const mockAdapter: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: jest.fn().mockReturnValue({
          user: '/path/to/user/config',
          project: '/path/to/project/config',
        }),
        readConfig: jest
          .fn()
          .mockReturnValueOnce({
            mcpServers: {
              userMcp: { command: 'user-mcp', args: [] },
            },
          })
          .mockReturnValueOnce({
            mcpServers: {
              projectMcp: { command: 'project-mcp', args: [] },
            },
          }),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
      };

      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {},
      };

      const result = auditService.auditClient(mockAdapter, overtureConfig, 'linux');

      expect(result).toEqual(['userMcp', 'projectMcp']);
      expect(mockAdapter.readConfig).toHaveBeenCalledWith('/path/to/user/config');
      expect(mockAdapter.readConfig).toHaveBeenCalledWith('/path/to/project/config');
    });

    it('should return empty array when config path is null', () => {
      const mockAdapter: ClientAdapter = {
        name: 'vscode',
        schemaRootKey: 'servers',
        detectConfigPath: jest.fn().mockReturnValue(null),
        readConfig: jest.fn(),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
      };

      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {},
      };

      const result = auditService.auditClient(mockAdapter, overtureConfig, 'linux');

      expect(result).toEqual([]);
      expect(mockAdapter.readConfig).not.toHaveBeenCalled();
    });

    it('should handle different schema root keys', () => {
      const mockAdapter: ClientAdapter = {
        name: 'vscode',
        schemaRootKey: 'servers', // VS Code uses "servers" instead of "mcpServers"
        detectConfigPath: jest.fn().mockReturnValue('/path/to/vscode/config'),
        readConfig: jest.fn().mockReturnValue({
          servers: {
            unmanagedServer: { command: 'some-server', args: [], type: 'stdio' },
          },
        }),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
      };

      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {},
      };

      const result = auditService.auditClient(mockAdapter, overtureConfig, 'linux');

      expect(result).toEqual(['unmanagedServer']);
    });

    it('should deduplicate MCPs found in both user and project configs', () => {
      const mockAdapter: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: jest.fn().mockReturnValue({
          user: '/path/to/user/config',
          project: '/path/to/project/config',
        }),
        readConfig: jest
          .fn()
          .mockReturnValueOnce({
            mcpServers: {
              duplicateMcp: { command: 'dup-mcp', args: [] },
            },
          })
          .mockReturnValueOnce({
            mcpServers: {
              duplicateMcp: { command: 'dup-mcp', args: [] },
            },
          }),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
      };

      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {},
      };

      const result = auditService.auditClient(mockAdapter, overtureConfig, 'linux');

      expect(result).toEqual(['duplicateMcp']);
    });
  });

  describe('auditAllClients', () => {
    it('should audit all adapters', () => {
      const mockAdapter1: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: jest.fn().mockReturnValue({ user: '/path1' }),
        readConfig: jest.fn().mockReturnValue({
          mcpServers: {
            unmanaged1: { command: 'mcp1', args: [] },
          },
        }),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
      };

      const mockAdapter2: ClientAdapter = {
        name: 'vscode',
        schemaRootKey: 'servers',
        detectConfigPath: jest.fn().mockReturnValue('/path2'),
        readConfig: jest.fn().mockReturnValue({
          servers: {
            unmanaged2: { command: 'mcp2', args: [], type: 'stdio' },
          },
        }),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
      };

      const adapters = [mockAdapter1, mockAdapter2];
      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {},
      };

      const result = auditService.auditAllClients(adapters, overtureConfig, 'linux');

      expect(result).toEqual({
        'claude-code': ['unmanaged1'],
        vscode: ['unmanaged2'],
      });
    });

    it('should skip clients with no unmanaged MCPs', () => {
      const mockAdapter1: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: jest.fn().mockReturnValue({ user: '/path1' }),
        readConfig: jest.fn().mockReturnValue({
          mcpServers: {
            managed: { command: 'mcp1', args: [] },
          },
        }),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
      };

      const mockAdapter2: ClientAdapter = {
        name: 'vscode',
        schemaRootKey: 'servers',
        detectConfigPath: jest.fn().mockReturnValue('/path2'),
        readConfig: jest.fn().mockReturnValue({
          servers: {
            unmanaged2: { command: 'mcp2', args: [], type: 'stdio' },
          },
        }),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
      };

      const adapters = [mockAdapter1, mockAdapter2];
      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {
          managed: {
            command: 'mcp1',
            args: [],
            env: {},
            transport: 'stdio',
          },
        },
      };

      const result = auditService.auditAllClients(adapters, overtureConfig, 'linux');

      expect(result).toEqual({
        vscode: ['unmanaged2'],
      });
    });

    it('should return empty object when no unmanaged MCPs found', () => {
      const mockAdapter: ClientAdapter = {
        name: 'claude-code',
        schemaRootKey: 'mcpServers',
        detectConfigPath: jest.fn().mockReturnValue({ user: '/path' }),
        readConfig: jest.fn().mockReturnValue({
          mcpServers: {},
        }),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
        isInstalled: jest.fn(),
      };

      const adapters = [mockAdapter];
      const overtureConfig: OvertureConfig = {
        version: '2.0',
        mcp: {},
      };

      const result = auditService.auditAllClients(adapters, overtureConfig, 'linux');

      expect(result).toEqual({});
    });
  });

  describe('compareConfigs', () => {
    it('should identify MCPs in client but not in Overture', () => {
      const clientMcps = ['github', 'filesystem', 'slack'];
      const overtureMcps = ['github'];

      const result = auditService.compareConfigs(clientMcps, overtureMcps);

      expect(result).toEqual(['filesystem', 'slack']);
    });

    it('should return empty array when all client MCPs are managed', () => {
      const clientMcps = ['github', 'filesystem'];
      const overtureMcps = ['github', 'filesystem', 'slack'];

      const result = auditService.compareConfigs(clientMcps, overtureMcps);

      expect(result).toEqual([]);
    });

    it('should return empty array when client has no MCPs', () => {
      const clientMcps: string[] = [];
      const overtureMcps = ['github', 'filesystem'];

      const result = auditService.compareConfigs(clientMcps, overtureMcps);

      expect(result).toEqual([]);
    });

    it('should handle case when Overture has no MCPs', () => {
      const clientMcps = ['github', 'filesystem'];
      const overtureMcps: string[] = [];

      const result = auditService.compareConfigs(clientMcps, overtureMcps);

      expect(result).toEqual(['github', 'filesystem']);
    });
  });

  describe('generateSuggestions', () => {
    it('should generate suggestions for unmanaged MCPs', () => {
      const unmanagedByClient = {
        'claude-code': ['filesystem', 'slack'],
        vscode: ['github'],
      };

      const result = auditService.generateSuggestions(unmanagedByClient);

      expect(result).toContain('overture user add mcp filesystem');
      expect(result).toContain('overture user add mcp slack');
      expect(result).toContain('overture user add mcp github');
      expect(result).toHaveLength(3);
    });

    it('should deduplicate suggestions across clients', () => {
      const unmanagedByClient = {
        'claude-code': ['filesystem', 'github'],
        vscode: ['filesystem', 'slack'],
      };

      const result = auditService.generateSuggestions(unmanagedByClient);

      expect(result).toContain('overture user add mcp filesystem');
      expect(result).toContain('overture user add mcp github');
      expect(result).toContain('overture user add mcp slack');
      expect(result).toHaveLength(3);
    });

    it('should return empty array when no unmanaged MCPs', () => {
      const unmanagedByClient = {};

      const result = auditService.generateSuggestions(unmanagedByClient);

      expect(result).toEqual([]);
    });

    it('should sort suggestions alphabetically', () => {
      const unmanagedByClient = {
        'claude-code': ['slack', 'github', 'filesystem'],
      };

      const result = auditService.generateSuggestions(unmanagedByClient);

      expect(result).toEqual([
        'overture user add mcp filesystem',
        'overture user add mcp github',
        'overture user add mcp slack',
      ]);
    });
  });
});
