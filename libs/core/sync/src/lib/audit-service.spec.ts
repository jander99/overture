/**
 * Audit Service Tests
 *
 * Comprehensive tests for the audit service that detects unmanaged MCPs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditService } from './audit-service.js';
import type { ClientAdapter } from '@overture/client-adapters';
import type { OvertureConfig, ClientName } from '@overture/config-types';

// Helper to create a mock adapter
function createMockAdapter(
  name: ClientName,
  configPath:
    | string
    | { user: string; project: string }
    | null = '/config.json',
  mcpServers: Record<string, any> = {},
): ClientAdapter {
  return {
    name,
    schemaRootKey: 'mcpServers',
    detectConfigPath: vi.fn(() => configPath),
    readConfig: vi.fn().mockResolvedValue({ mcpServers }),
    writeConfig: vi.fn().mockResolvedValue(undefined),
    supportsTransport: vi.fn(() => true),
    needsEnvVarExpansion: vi.fn(() => false),
    convertFromOverture: vi.fn(() => ({ mcpServers: {} })),
    isInstalled: vi.fn(() => true),
    getBinaryNames: vi.fn(() => []),
    getAppBundlePaths: vi.fn(() => []),
    requiresBinary: vi.fn(() => false),
  };
}

// Helper to create Overture config
function createOvertureConfig(mcpNames: string[]): OvertureConfig {
  const mcp: OvertureConfig['mcp'] = {};
  for (const name of mcpNames) {
    mcp[name] = {
      command: `mcp-${name}`,
      args: [],
      env: {},
      transport: 'stdio',
    };
  }
  return { version: '1.0', mcp };
}

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(() => {
    service = new AuditService();
  });

  describe('auditClient()', () => {
    it('should return empty array when client not installed', async () => {
      const adapter = createMockAdapter('claude-code', null);
      const config = createOvertureConfig(['github']);

      const result = await service.auditClient(adapter, config, 'linux');

      expect(result).toEqual([]);
    });

    it('should return unmanaged MCPs from single config path', async () => {
      const adapter = createMockAdapter('claude-code', '/config.json', {
        github: { command: 'mcp-github' },
        slack: { command: 'mcp-slack' },
        custom: { command: 'my-mcp' },
      });
      const config = createOvertureConfig(['github']);

      const result = await service.auditClient(adapter, config, 'linux');

      expect(result.sort()).toEqual(['custom', 'slack']);
    });

    it('should return unmanaged MCPs from user/project config paths', async () => {
      const adapter = createMockAdapter('claude-code', {
        user: '/user/config.json',
        project: '/project/config.json',
      });

      // Mock different MCPs in user and project configs
      // Use 'as any' because audit service only uses Object.keys()
      vi.mocked(adapter.readConfig)
        .mockResolvedValueOnce({
          mcpServers: { github: {}, memory: {} },
        } as any)
        .mockResolvedValueOnce({
          mcpServers: { filesystem: {}, slack: {} },
        } as any);

      const config = createOvertureConfig(['github', 'filesystem']);

      const result = await service.auditClient(adapter, config, 'linux');

      expect(result.sort()).toEqual(['memory', 'slack']);
    });

    it('should return empty array when all MCPs are managed', async () => {
      const adapter = createMockAdapter('claude-code', '/config.json', {
        github: { command: 'mcp-github' },
        filesystem: { command: 'mcp-fs' },
      });
      const config = createOvertureConfig(['github', 'filesystem']);

      const result = await service.auditClient(adapter, config, 'linux');

      expect(result).toEqual([]);
    });

    it('should return empty array when client has no MCPs', async () => {
      const adapter = createMockAdapter('claude-code', '/config.json', {});
      const config = createOvertureConfig(['github']);

      const result = await service.auditClient(adapter, config, 'linux');

      expect(result).toEqual([]);
    });
  });

  describe('auditAllClients()', () => {
    it('should audit all clients and return unmanaged MCPs', async () => {
      const claudeAdapter = createMockAdapter('claude-code', '/claude.json', {
        github: {},
        slack: {},
      });
      const copilotAdapter = createMockAdapter('copilot-cli', '/copilot.json', {
        github: {},
        custom: {},
      });
      const config = createOvertureConfig(['github']);

      const result = await service.auditAllClients(
        [claudeAdapter, copilotAdapter],
        config,
        'linux',
      );

      expect(result['claude-code']).toEqual(['slack']);
      expect(result['copilot-cli']).toEqual(['custom']);
    });

    it('should skip clients with no unmanaged MCPs', async () => {
      const claudeAdapter = createMockAdapter('claude-code', '/claude.json', {
        github: {},
      });
      const copilotAdapter = createMockAdapter('copilot-cli', '/copilot.json', {
        github: {},
        custom: {},
      });
      const config = createOvertureConfig(['github']);

      const result = await service.auditAllClients(
        [claudeAdapter, copilotAdapter],
        config,
        'linux',
      );

      expect(result['claude-code']).toBeUndefined();
      expect(result['copilot-cli']).toEqual(['custom']);
    });

    it('should return empty object when all clients are fully managed', async () => {
      const claudeAdapter = createMockAdapter('claude-code', '/claude.json', {
        github: {},
      });
      const config = createOvertureConfig(['github']);

      const result = await service.auditAllClients(
        [claudeAdapter],
        config,
        'linux',
      );

      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('compareConfigs()', () => {
    it('should identify unmanaged MCPs', () => {
      const clientMcps = ['github', 'slack', 'custom', 'filesystem'];
      const overtureMcps = ['github', 'filesystem'];

      const result = service.compareConfigs(clientMcps, overtureMcps);

      expect(result.sort()).toEqual(['custom', 'slack']);
    });

    it('should return empty array when all MCPs managed', () => {
      const clientMcps = ['github', 'filesystem'];
      const overtureMcps = ['github', 'filesystem', 'memory'];

      const result = service.compareConfigs(clientMcps, overtureMcps);

      expect(result).toEqual([]);
    });

    it('should handle empty client MCPs', () => {
      const clientMcps: string[] = [];
      const overtureMcps = ['github'];

      const result = service.compareConfigs(clientMcps, overtureMcps);

      expect(result).toEqual([]);
    });

    it('should handle empty Overture MCPs', () => {
      const clientMcps = ['github', 'slack'];
      const overtureMcps: string[] = [];

      const result = service.compareConfigs(clientMcps, overtureMcps);

      expect(result.sort()).toEqual(['github', 'slack']);
    });
  });

  describe('generateSuggestions()', () => {
    it('should generate unique add commands', () => {
      const unmanagedByClient: Record<ClientName, string[]> = {
        'claude-code': ['slack', 'github'],
        'copilot-cli': ['github', 'custom'],
        opencode: [],
      };

      const result = service.generateSuggestions(unmanagedByClient);

      expect(result).toEqual([
        'overture user add mcp custom',
        'overture user add mcp github',
        'overture user add mcp slack',
      ]);
    });

    it('should return empty array when no unmanaged MCPs', () => {
      const unmanagedByClient: Record<ClientName, string[]> = {
        'claude-code': [],
        'copilot-cli': [],
        opencode: [],
      };

      const result = service.generateSuggestions(unmanagedByClient);

      expect(result).toEqual([]);
    });

    it('should deduplicate MCPs across clients', () => {
      const unmanagedByClient: Record<ClientName, string[]> = {
        'claude-code': ['slack', 'slack'],
        'copilot-cli': ['slack'],
        opencode: [],
      };

      const result = service.generateSuggestions(unmanagedByClient);

      expect(result).toEqual(['overture user add mcp slack']);
    });
  });
});
