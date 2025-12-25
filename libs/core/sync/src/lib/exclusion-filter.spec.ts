/**
 * Exclusion Filter Tests
 *
 * Comprehensive tests for MCP exclusion filtering utilities.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  filterMcpsForClient,
  shouldIncludeMcp,
  getExcludedMcps,
  getFilterSummary,
  validateRequiredMcps,
} from './exclusion-filter.js';
import type { ClientAdapter } from '@overture/client-adapters';
import type {
  OvertureConfig,
  Platform,
  TransportType,
  ClientName,
} from '@overture/config-types';

// Helper to create a mock adapter
function createMockAdapter(
  name: string,
  supportedTransports: TransportType[] = ['stdio'],
): ClientAdapter {
  return {
    name: name as ClientName,
    schemaRootKey: 'mcpServers',
    supportsTransport: vi.fn((transport: TransportType) =>
      supportedTransports.includes(transport),
    ),
    needsEnvVarExpansion: vi.fn(() => false),
    detectConfigPath: vi.fn(() => null),
    readConfig: vi.fn().mockResolvedValue({ mcpServers: {} }),
    writeConfig: vi.fn().mockResolvedValue(undefined),
    convertFromOverture: vi.fn(() => ({ mcpServers: {} })),
    isInstalled: vi.fn(() => true),
    getBinaryNames: vi.fn(() => []),
    getAppBundlePaths: vi.fn(() => []),
    requiresBinary: vi.fn(() => false),
  };
}

// Helper to create MCP config
function createMcpEntry(
  options: {
    transport?: TransportType;
    platforms?: { exclude?: Platform[] };
    clients?: { include?: ClientName[]; exclude?: ClientName[] };
  } = {},
): OvertureConfig['mcp'][string] {
  return {
    command: 'mcp-cmd',
    args: [],
    env: {},
    transport: options.transport ?? 'stdio',
    platforms: options.platforms,
    clients: options.clients,
  };
}

describe('shouldIncludeMcp', () => {
  it('should include MCP with no restrictions', () => {
    const adapter = createMockAdapter('claude-code');
    const mcpConfig = createMcpEntry();

    const result = shouldIncludeMcp(mcpConfig, adapter, 'linux');

    expect(result.included).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should exclude MCP when platform is in exclude list', () => {
    const adapter = createMockAdapter('claude-code');
    const mcpConfig = createMcpEntry({
      platforms: { exclude: ['linux', 'darwin'] },
    });

    const result = shouldIncludeMcp(mcpConfig, adapter, 'linux');

    expect(result.included).toBe(false);
    expect(result.reason).toContain('Platform linux is excluded');
  });

  it('should include MCP when platform is not in exclude list', () => {
    const adapter = createMockAdapter('claude-code');
    const mcpConfig = createMcpEntry({
      platforms: { exclude: ['win32'] },
    });

    const result = shouldIncludeMcp(mcpConfig, adapter, 'linux');

    expect(result.included).toBe(true);
  });

  it('should exclude MCP when client is in exclude list', () => {
    const adapter = createMockAdapter('claude-code');
    const mcpConfig = createMcpEntry({
      clients: { exclude: ['claude-code', 'copilot-cli'] },
    });

    const result = shouldIncludeMcp(mcpConfig, adapter, 'linux');

    expect(result.included).toBe(false);
    expect(result.reason).toContain('Client claude-code is excluded');
  });

  it('should include MCP when client is not in exclude list', () => {
    const adapter = createMockAdapter('claude-code');
    const mcpConfig = createMcpEntry({
      clients: { exclude: ['copilot-cli'] },
    });

    const result = shouldIncludeMcp(mcpConfig, adapter, 'linux');

    expect(result.included).toBe(true);
  });

  it('should include MCP when client is in include list', () => {
    const adapter = createMockAdapter('claude-code');
    const mcpConfig = createMcpEntry({
      clients: { include: ['claude-code', 'copilot-cli'] },
    });

    const result = shouldIncludeMcp(mcpConfig, adapter, 'linux');

    expect(result.included).toBe(true);
  });

  it('should exclude MCP when client is not in include list', () => {
    const adapter = createMockAdapter('claude-code');
    const mcpConfig = createMcpEntry({
      clients: { include: ['copilot-cli', 'opencode'] },
    });

    const result = shouldIncludeMcp(mcpConfig, adapter, 'linux');

    expect(result.included).toBe(false);
    expect(result.reason).toContain('not in include list');
  });

  it('should exclude MCP when transport is not supported', () => {
    const adapter = createMockAdapter('claude-code', ['stdio']);
    const mcpConfig = createMcpEntry({ transport: 'http' });

    const result = shouldIncludeMcp(mcpConfig, adapter, 'linux');

    expect(result.included).toBe(false);
    expect(result.reason).toContain('Transport http not supported');
  });
});

describe('filterMcpsForClient', () => {
  it('should filter MCPs based on all criteria', () => {
    const adapter = createMockAdapter('claude-code', ['stdio']);
    const mcps: OvertureConfig['mcp'] = {
      allowed: createMcpEntry(),
      excludedPlatform: createMcpEntry({ platforms: { exclude: ['linux'] } }),
      excludedClient: createMcpEntry({ clients: { exclude: ['claude-code'] } }),
      excludedTransport: createMcpEntry({ transport: 'http' }),
    };

    const filtered = filterMcpsForClient(mcps, adapter, 'linux');

    expect(Object.keys(filtered)).toEqual(['allowed']);
  });

  it('should return empty object when all MCPs filtered', () => {
    const adapter = createMockAdapter('claude-code', ['stdio']);
    const mcps: OvertureConfig['mcp'] = {
      http: createMcpEntry({ transport: 'http' }),
      sse: createMcpEntry({ transport: 'sse' }),
    };

    const filtered = filterMcpsForClient(mcps, adapter, 'linux');

    expect(Object.keys(filtered)).toHaveLength(0);
  });

  it('should return all MCPs when none filtered', () => {
    const adapter = createMockAdapter('claude-code', ['stdio', 'http']);
    const mcps: OvertureConfig['mcp'] = {
      github: createMcpEntry({ transport: 'stdio' }),
      api: createMcpEntry({ transport: 'http' }),
    };

    const filtered = filterMcpsForClient(mcps, adapter, 'linux');

    expect(Object.keys(filtered)).toEqual(['github', 'api']);
  });
});

describe('getExcludedMcps', () => {
  it('should return list of excluded MCPs with reasons', () => {
    const adapter = createMockAdapter('claude-code', ['stdio']);
    const mcps: OvertureConfig['mcp'] = {
      allowed: createMcpEntry(),
      excludedTransport: createMcpEntry({ transport: 'http' }),
      excludedClient: createMcpEntry({ clients: { exclude: ['claude-code'] } }),
    };

    const excluded = getExcludedMcps(mcps, adapter, 'linux');

    expect(excluded).toHaveLength(2);
    expect(excluded.map((e) => e.name).sort()).toEqual([
      'excludedClient',
      'excludedTransport',
    ]);
  });

  it('should return empty array when no exclusions', () => {
    const adapter = createMockAdapter('claude-code');
    const mcps: OvertureConfig['mcp'] = {
      mcp1: createMcpEntry(),
      mcp2: createMcpEntry(),
    };

    const excluded = getExcludedMcps(mcps, adapter, 'linux');

    expect(excluded).toEqual([]);
  });
});

describe('getFilterSummary', () => {
  it('should return complete summary', () => {
    const adapter = createMockAdapter('claude-code', ['stdio']);
    const mcps: OvertureConfig['mcp'] = {
      allowed: createMcpEntry(),
      excludedPlatform: createMcpEntry({ platforms: { exclude: ['linux'] } }),
      excludedClient: createMcpEntry({ clients: { exclude: ['claude-code'] } }),
      excludedTransport: createMcpEntry({ transport: 'http' }),
    };

    const summary = getFilterSummary(mcps, adapter, 'linux');

    expect(summary.total).toBe(4);
    expect(summary.included).toBe(1);
    expect(summary.excluded).toBe(3);
    expect(summary.excludedByPlatform).toBe(1);
    expect(summary.excludedByClient).toBe(1);
    expect(summary.excludedByTransport).toBe(1);
  });

  it('should return zero counts for empty MCPs', () => {
    const adapter = createMockAdapter('claude-code');
    const summary = getFilterSummary({}, adapter, 'linux');

    expect(summary.total).toBe(0);
    expect(summary.included).toBe(0);
    expect(summary.excluded).toBe(0);
  });
});

describe('validateRequiredMcps', () => {
  it('should validate when all required MCPs are available', () => {
    const adapter = createMockAdapter('claude-code');
    const mcps: OvertureConfig['mcp'] = {
      github: createMcpEntry(),
      filesystem: createMcpEntry(),
    };

    const result = validateRequiredMcps(
      ['github', 'filesystem'],
      mcps,
      adapter,
      'linux',
    );

    expect(result.valid).toBe(true);
    expect(result.missingMcps).toEqual([]);
    expect(result.excludedMcps).toEqual([]);
  });

  it('should report missing MCPs', () => {
    const adapter = createMockAdapter('claude-code');
    const mcps: OvertureConfig['mcp'] = {
      github: createMcpEntry(),
    };

    const result = validateRequiredMcps(
      ['github', 'missing'],
      mcps,
      adapter,
      'linux',
    );

    expect(result.valid).toBe(false);
    expect(result.missingMcps).toEqual(['missing']);
  });

  it('should report excluded required MCPs', () => {
    const adapter = createMockAdapter('claude-code', ['stdio']);
    const mcps: OvertureConfig['mcp'] = {
      github: createMcpEntry(),
      api: createMcpEntry({ transport: 'http' }),
    };

    const result = validateRequiredMcps(
      ['github', 'api'],
      mcps,
      adapter,
      'linux',
    );

    expect(result.valid).toBe(false);
    expect(result.excludedMcps).toHaveLength(1);
    expect(result.excludedMcps[0].name).toBe('api');
  });

  it('should return valid for empty required list', () => {
    const adapter = createMockAdapter('claude-code');
    const result = validateRequiredMcps([], {}, adapter, 'linux');

    expect(result.valid).toBe(true);
  });
});
