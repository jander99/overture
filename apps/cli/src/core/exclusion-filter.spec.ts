/**
 * Exclusion Filter Tests
 *
 * @module core/exclusion-filter.spec
 */

import {
  filterMcpsForClient,
  shouldIncludeMcp,
  getExcludedMcps,
  getFilterSummary,
  validateRequiredMcps,
} from './exclusion-filter';
import type { OvertureConfig, Platform } from '../domain/config.types';
import type { ClientAdapter } from '../adapters/client-adapter.interface';

// Mock client adapter
const createMockAdapter = (
  name: string,
  supportedTransports: string[] = ['stdio']
): ClientAdapter => ({
  name: name as any,
  schemaRootKey: 'mcpServers',
  detectConfigPath: jest.fn(),
  readConfig: jest.fn(),
  writeConfig: jest.fn(),
  convertFromOverture: jest.fn(),
  supportsTransport: jest.fn((t) => supportedTransports.includes(t)),
  needsEnvVarExpansion: jest.fn(() => false),
  isInstalled: jest.fn(() => true),
});

describe('Exclusion Filter', () => {
  const platform: Platform = 'linux';

  describe('shouldIncludeMcp', () => {
    const adapter = createMockAdapter('claude-code');

    it('should include MCP with no restrictions', () => {
      const mcpConfig: OvertureConfig['mcp']['test'] = {
        command: 'test',
        args: [],
        env: {},
        transport: 'stdio',
      };

      const result = shouldIncludeMcp(mcpConfig, adapter, platform);

      expect(result.included).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should exclude MCP for excluded platform', () => {
      const mcpConfig: OvertureConfig['mcp']['test'] = {
        command: 'test',
        args: [],
        env: {},
        transport: 'stdio',
        platforms: {
          exclude: ['linux'],
        },
      };

      const result = shouldIncludeMcp(mcpConfig, adapter, platform);

      expect(result.included).toBe(false);
      expect(result.reason).toContain('Platform linux is excluded');
    });

    it('should exclude MCP for excluded client', () => {
      const mcpConfig: OvertureConfig['mcp']['test'] = {
        command: 'test',
        args: [],
        env: {},
        transport: 'stdio',
        clients: {
          exclude: ['claude-code'],
        },
      };

      const result = shouldIncludeMcp(mcpConfig, adapter, platform);

      expect(result.included).toBe(false);
      expect(result.reason).toContain('Client claude-code is excluded');
    });

    it('should include MCP if client is in include list', () => {
      const mcpConfig: OvertureConfig['mcp']['test'] = {
        command: 'test',
        args: [],
        env: {},
        transport: 'stdio',
        clients: {
          include: ['claude-code', 'vscode'],
        },
      };

      const result = shouldIncludeMcp(mcpConfig, adapter, platform);

      expect(result.included).toBe(true);
    });

    it('should exclude MCP if client not in include list', () => {
      const mcpConfig: OvertureConfig['mcp']['test'] = {
        command: 'test',
        args: [],
        env: {},
        transport: 'stdio',
        clients: {
          include: ['vscode', 'cursor'],
        },
      };

      const result = shouldIncludeMcp(mcpConfig, adapter, platform);

      expect(result.included).toBe(false);
      expect(result.reason).toContain('not in include list');
    });

    it('should exclude MCP if transport not supported', () => {
      const mcpConfig: OvertureConfig['mcp']['test'] = {
        command: 'test',
        args: [],
        env: {},
        transport: 'http',
      };

      const result = shouldIncludeMcp(mcpConfig, adapter, platform);

      expect(result.included).toBe(false);
      expect(result.reason).toContain('Transport http not supported');
    });
  });

  describe('filterMcpsForClient', () => {
    const adapter = createMockAdapter('claude-code', ['stdio', 'http']);

    it('should filter MCPs correctly', () => {
      const mcps: OvertureConfig['mcp'] = {
        included1: {
          command: 'test1',
          args: [],
          env: {},
          transport: 'stdio',
        },
        included2: {
          command: 'test2',
          args: [],
          env: {},
          transport: 'http',
        },
        excluded: {
          command: 'test3',
          args: [],
          env: {},
          transport: 'stdio',
          clients: {
            exclude: ['claude-code'],
          },
        },
      };

      const filtered = filterMcpsForClient(mcps, adapter, platform);

      expect(Object.keys(filtered)).toEqual(['included1', 'included2']);
    });

    it('should return empty object if all MCPs excluded', () => {
      const mcps: OvertureConfig['mcp'] = {
        excluded1: {
          command: 'test1',
          args: [],
          env: {},
          transport: 'sse',
        },
        excluded2: {
          command: 'test2',
          args: [],
          env: {},
          transport: 'stdio',
          clients: {
            exclude: ['claude-code'],
          },
        },
      };

      const filtered = filterMcpsForClient(mcps, adapter, platform);

      expect(Object.keys(filtered)).toEqual([]);
    });
  });

  describe('getExcludedMcps', () => {
    const adapter = createMockAdapter('claude-code');

    it('should return excluded MCPs with reasons', () => {
      const mcps: OvertureConfig['mcp'] = {
        platformExcluded: {
          command: 'test1',
          args: [],
          env: {},
          transport: 'stdio',
          platforms: {
            exclude: ['linux'],
          },
        },
        clientExcluded: {
          command: 'test2',
          args: [],
          env: {},
          transport: 'stdio',
          clients: {
            exclude: ['claude-code'],
          },
        },
        included: {
          command: 'test3',
          args: [],
          env: {},
          transport: 'stdio',
        },
      };

      const excluded = getExcludedMcps(mcps, adapter, platform);

      expect(excluded).toHaveLength(2);
      expect(excluded).toContainEqual({
        name: 'platformExcluded',
        reason: expect.stringContaining('Platform linux is excluded'),
      });
      expect(excluded).toContainEqual({
        name: 'clientExcluded',
        reason: expect.stringContaining('Client claude-code is excluded'),
      });
    });

    it('should return empty array if no exclusions', () => {
      const mcps: OvertureConfig['mcp'] = {
        included: {
          command: 'test',
          args: [],
          env: {},
          transport: 'stdio',
        },
      };

      const excluded = getExcludedMcps(mcps, adapter, platform);

      expect(excluded).toEqual([]);
    });
  });

  describe('getFilterSummary', () => {
    const adapter = createMockAdapter('claude-code');

    it('should provide accurate summary', () => {
      const mcps: OvertureConfig['mcp'] = {
        included1: {
          command: 'test1',
          args: [],
          env: {},
          transport: 'stdio',
        },
        included2: {
          command: 'test2',
          args: [],
          env: {},
          transport: 'stdio',
        },
        platformExcluded: {
          command: 'test3',
          args: [],
          env: {},
          transport: 'stdio',
          platforms: {
            exclude: ['linux'],
          },
        },
        clientExcluded: {
          command: 'test4',
          args: [],
          env: {},
          transport: 'stdio',
          clients: {
            exclude: ['claude-code'],
          },
        },
        transportExcluded: {
          command: 'test5',
          args: [],
          env: {},
          transport: 'http',
        },
      };

      const summary = getFilterSummary(mcps, adapter, platform);

      expect(summary.total).toBe(5);
      expect(summary.included).toBe(2);
      expect(summary.excluded).toBe(3);
      expect(summary.excludedByPlatform).toBe(1);
      expect(summary.excludedByClient).toBe(1);
      expect(summary.excludedByTransport).toBe(1);
    });
  });

  describe('validateRequiredMcps', () => {
    const adapter = createMockAdapter('claude-code');

    it('should validate all required MCPs are available', () => {
      const availableMcps: OvertureConfig['mcp'] = {
        github: {
          command: 'gh',
          args: [],
          env: {},
          transport: 'stdio',
        },
        filesystem: {
          command: 'fs',
          args: [],
          env: {},
          transport: 'stdio',
        },
      };

      const result = validateRequiredMcps(
        ['github', 'filesystem'],
        availableMcps,
        adapter,
        platform
      );

      expect(result.valid).toBe(true);
      expect(result.missingMcps).toEqual([]);
      expect(result.excludedMcps).toEqual([]);
    });

    it('should detect missing MCPs', () => {
      const availableMcps: OvertureConfig['mcp'] = {
        github: {
          command: 'gh',
          args: [],
          env: {},
          transport: 'stdio',
        },
      };

      const result = validateRequiredMcps(
        ['github', 'filesystem'],
        availableMcps,
        adapter,
        platform
      );

      expect(result.valid).toBe(false);
      expect(result.missingMcps).toEqual(['filesystem']);
    });

    it('should detect excluded MCPs', () => {
      const availableMcps: OvertureConfig['mcp'] = {
        github: {
          command: 'gh',
          args: [],
          env: {},
          transport: 'stdio',
          clients: {
            exclude: ['claude-code'],
          },
        },
      };

      const result = validateRequiredMcps(
        ['github'],
        availableMcps,
        adapter,
        platform
      );

      expect(result.valid).toBe(false);
      expect(result.missingMcps).toEqual([]);
      expect(result.excludedMcps).toHaveLength(1);
      expect(result.excludedMcps[0].name).toBe('github');
      expect(result.excludedMcps[0].reason).toContain('excluded');
    });
  });
});
