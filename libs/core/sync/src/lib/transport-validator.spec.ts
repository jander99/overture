/**
 * Transport Validator Tests
 *
 * Comprehensive tests for MCP transport validation utilities.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  validateMcpTransport,
  validateAllTransports,
  getTransportWarnings,
  filterByTransport,
  getTransportValidationSummary,
  hasTransportIssues,
  formatTransportWarnings,
} from './transport-validator.js';
import type { ClientAdapter } from '@overture/client-adapters';
import type { OvertureConfig, TransportType } from '@overture/config-types';

// Helper to create a mock adapter
function createMockAdapter(
  name: string,
  supportedTransports: TransportType[],
): ClientAdapter {
  return {
    name: name as any,
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

// Helper to create MCP configs
function createMcpConfig(
  mcps: Record<string, { transport: TransportType }>,
): OvertureConfig['mcp'] {
  const result: OvertureConfig['mcp'] = {};
  for (const [name, config] of Object.entries(mcps)) {
    result[name] = {
      command: `mcp-${name}`,
      args: [],
      env: {},
      transport: config.transport,
    };
  }
  return result;
}

describe('validateMcpTransport', () => {
  it('should return supported=true for supported transport', () => {
    const adapter = createMockAdapter('claude-code', ['stdio', 'sse']);
    const result = validateMcpTransport('github', 'stdio', adapter);

    expect(result).toEqual({
      mcpName: 'github',
      transport: 'stdio',
      supported: true,
      clientName: 'claude-code',
    });
  });

  it('should return supported=false for unsupported transport', () => {
    const adapter = createMockAdapter('claude-code', ['stdio']);
    const result = validateMcpTransport('api-server', 'http', adapter);

    expect(result).toEqual({
      mcpName: 'api-server',
      transport: 'http',
      supported: false,
      clientName: 'claude-code',
    });
  });
});

describe('validateAllTransports', () => {
  it('should validate all MCPs against client', () => {
    const adapter = createMockAdapter('claude-code', ['stdio']);
    const mcps = createMcpConfig({
      github: { transport: 'stdio' },
      api: { transport: 'http' },
    });

    const results = validateAllTransports(mcps, adapter);

    expect(results).toHaveLength(2);
    expect(results.find((r) => r.mcpName === 'github')?.supported).toBe(true);
    expect(results.find((r) => r.mcpName === 'api')?.supported).toBe(false);
  });

  it('should return empty array for empty MCPs', () => {
    const adapter = createMockAdapter('claude-code', ['stdio']);
    const results = validateAllTransports({}, adapter);

    expect(results).toEqual([]);
  });
});

describe('getTransportWarnings', () => {
  it('should return warnings for unsupported transports', () => {
    const adapter = createMockAdapter('claude-code', ['stdio']);
    const mcps = createMcpConfig({
      github: { transport: 'stdio' },
      api: { transport: 'http' },
    });

    const warnings = getTransportWarnings(mcps, adapter);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].mcpName).toBe('api');
    expect(warnings[0].transport).toBe('http');
    expect(warnings[0].clientName).toBe('claude-code');
    expect(warnings[0].message).toContain('not supported');
  });

  it('should return empty array when all transports supported', () => {
    const adapter = createMockAdapter('claude-code', ['stdio', 'http']);
    const mcps = createMcpConfig({
      github: { transport: 'stdio' },
      api: { transport: 'http' },
    });

    const warnings = getTransportWarnings(mcps, adapter);

    expect(warnings).toEqual([]);
  });

  it('should return empty array for empty MCPs', () => {
    const adapter = createMockAdapter('claude-code', ['stdio']);
    const warnings = getTransportWarnings({}, adapter);

    expect(warnings).toEqual([]);
  });
});

describe('filterByTransport', () => {
  it('should filter to only supported transports', () => {
    const adapter = createMockAdapter('claude-code', ['stdio']);
    const mcps = createMcpConfig({
      github: { transport: 'stdio' },
      memory: { transport: 'stdio' },
      api: { transport: 'http' },
    });

    const filtered = filterByTransport(mcps, adapter);

    expect(Object.keys(filtered)).toEqual(['github', 'memory']);
    expect(filtered['api']).toBeUndefined();
  });

  it('should return empty object when none supported', () => {
    const adapter = createMockAdapter('claude-code', ['stdio']);
    const mcps = createMcpConfig({
      api: { transport: 'http' },
      sse: { transport: 'sse' },
    });

    const filtered = filterByTransport(mcps, adapter);

    expect(Object.keys(filtered)).toHaveLength(0);
  });

  it('should return all when all supported', () => {
    const adapter = createMockAdapter('claude-code', ['stdio', 'http', 'sse']);
    const mcps = createMcpConfig({
      github: { transport: 'stdio' },
      api: { transport: 'http' },
    });

    const filtered = filterByTransport(mcps, adapter);

    expect(Object.keys(filtered)).toEqual(['github', 'api']);
  });
});

describe('getTransportValidationSummary', () => {
  it('should return complete summary', () => {
    const adapter = createMockAdapter('claude-code', ['stdio']);
    const mcps = createMcpConfig({
      github: { transport: 'stdio' },
      memory: { transport: 'stdio' },
      api: { transport: 'http' },
    });

    const summary = getTransportValidationSummary(mcps, adapter);

    expect(summary.total).toBe(3);
    expect(summary.supported).toBe(2);
    expect(summary.unsupported).toBe(1);
    expect(summary.warnings).toHaveLength(1);
  });

  it('should return zero counts for empty MCPs', () => {
    const adapter = createMockAdapter('claude-code', ['stdio']);
    const summary = getTransportValidationSummary({}, adapter);

    expect(summary.total).toBe(0);
    expect(summary.supported).toBe(0);
    expect(summary.unsupported).toBe(0);
    expect(summary.warnings).toEqual([]);
  });
});

describe('hasTransportIssues', () => {
  it('should return true when unsupported transports exist', () => {
    const adapter = createMockAdapter('claude-code', ['stdio']);
    const mcps = createMcpConfig({
      api: { transport: 'http' },
    });

    expect(hasTransportIssues(mcps, adapter)).toBe(true);
  });

  it('should return false when all transports supported', () => {
    const adapter = createMockAdapter('claude-code', ['stdio']);
    const mcps = createMcpConfig({
      github: { transport: 'stdio' },
    });

    expect(hasTransportIssues(mcps, adapter)).toBe(false);
  });

  it('should return false for empty MCPs', () => {
    const adapter = createMockAdapter('claude-code', ['stdio']);
    expect(hasTransportIssues({}, adapter)).toBe(false);
  });
});

describe('formatTransportWarnings', () => {
  it('should format no warnings message', () => {
    const result = formatTransportWarnings([]);
    expect(result).toBe('No transport issues detected.');
  });

  it('should format single warning', () => {
    const warnings = [
      {
        mcpName: 'api',
        transport: 'http' as TransportType,
        clientName: 'claude-code',
        message:
          'MCP "api" uses transport "http" which is not supported by claude-code',
      },
    ];

    const result = formatTransportWarnings(warnings);

    expect(result).toContain('Transport Warnings (1)');
    expect(result).toContain('MCP "api"');
  });

  it('should format multiple warnings', () => {
    const warnings = [
      {
        mcpName: 'api',
        transport: 'http' as TransportType,
        clientName: 'claude-code',
        message: 'MCP "api" uses http',
      },
      {
        mcpName: 'streaming',
        transport: 'sse' as TransportType,
        clientName: 'claude-code',
        message: 'MCP "streaming" uses sse',
      },
    ];

    const result = formatTransportWarnings(warnings);

    expect(result).toContain('Transport Warnings (2)');
    expect(result).toContain('MCP "api"');
    expect(result).toContain('MCP "streaming"');
  });
});
