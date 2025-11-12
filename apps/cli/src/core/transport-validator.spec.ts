/**
 * Transport Validation Tests
 *
 * @module core/transport-validator.spec
 */

import {
  validateMcpTransport,
  validateAllTransports,
  getTransportWarnings,
  filterByTransport,
  getTransportValidationSummary,
  hasTransportIssues,
  formatTransportWarnings,
} from './transport-validator';
import type { OvertureConfigV2 } from '../domain/config-v2.types';
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

describe('Transport Validator', () => {
  describe('validateMcpTransport', () => {
    it('should validate supported transport', () => {
      const adapter = createMockAdapter('claude-code', ['stdio', 'http']);

      const result = validateMcpTransport('github', 'stdio', adapter);

      expect(result).toEqual({
        mcpName: 'github',
        transport: 'stdio',
        supported: true,
        clientName: 'claude-code',
      });
    });

    it('should detect unsupported transport', () => {
      const adapter = createMockAdapter('claude-code', ['stdio']);

      const result = validateMcpTransport('github', 'http', adapter);

      expect(result).toEqual({
        mcpName: 'github',
        transport: 'http',
        supported: false,
        clientName: 'claude-code',
      });
    });

    it('should handle sse transport', () => {
      const adapter = createMockAdapter('claude-desktop', ['stdio', 'sse']);

      const result = validateMcpTransport('mcp-server', 'sse', adapter);

      expect(result.supported).toBe(true);
    });
  });

  describe('validateAllTransports', () => {
    it('should validate all MCPs', () => {
      const adapter = createMockAdapter('claude-code', ['stdio', 'http']);

      const mcps: OvertureConfigV2['mcp'] = {
        github: {
          command: 'gh',
          args: [],
          env: {},
          transport: 'stdio',
          scope: 'global',
        },
        'http-server': {
          command: 'server',
          args: [],
          env: {},
          transport: 'http',
          scope: 'global',
        },
        'sse-server': {
          command: 'sse',
          args: [],
          env: {},
          transport: 'sse',
          scope: 'global',
        },
      };

      const results = validateAllTransports(mcps, adapter);

      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({ mcpName: 'github', supported: true });
      expect(results[1]).toMatchObject({ mcpName: 'http-server', supported: true });
      expect(results[2]).toMatchObject({ mcpName: 'sse-server', supported: false });
    });

    it('should handle empty MCP config', () => {
      const adapter = createMockAdapter('claude-code');
      const results = validateAllTransports({}, adapter);

      expect(results).toEqual([]);
    });
  });

  describe('getTransportWarnings', () => {
    it('should return warnings for unsupported transports', () => {
      const adapter = createMockAdapter('claude-code', ['stdio']);

      const mcps: OvertureConfigV2['mcp'] = {
        github: {
          command: 'gh',
          args: [],
          env: {},
          transport: 'stdio',
          scope: 'global',
        },
        'http-server': {
          command: 'server',
          args: [],
          env: {},
          transport: 'http',
          scope: 'global',
        },
        'sse-server': {
          command: 'sse',
          args: [],
          env: {},
          transport: 'sse',
          scope: 'global',
        },
      };

      const warnings = getTransportWarnings(mcps, adapter);

      expect(warnings).toHaveLength(2);
      expect(warnings[0]).toMatchObject({
        mcpName: 'http-server',
        transport: 'http',
        clientName: 'claude-code',
      });
      expect(warnings[0].message).toContain('not supported');
      expect(warnings[1]).toMatchObject({
        mcpName: 'sse-server',
        transport: 'sse',
      });
    });

    it('should return empty array if all transports supported', () => {
      const adapter = createMockAdapter('claude-code', ['stdio', 'http', 'sse']);

      const mcps: OvertureConfigV2['mcp'] = {
        github: {
          command: 'gh',
          args: [],
          env: {},
          transport: 'stdio',
          scope: 'global',
        },
      };

      const warnings = getTransportWarnings(mcps, adapter);

      expect(warnings).toEqual([]);
    });
  });

  describe('filterByTransport', () => {
    it('should filter out unsupported transports', () => {
      const adapter = createMockAdapter('claude-code', ['stdio', 'http']);

      const mcps: OvertureConfigV2['mcp'] = {
        github: {
          command: 'gh',
          args: [],
          env: {},
          transport: 'stdio',
          scope: 'global',
        },
        'http-server': {
          command: 'server',
          args: [],
          env: {},
          transport: 'http',
          scope: 'global',
        },
        'sse-server': {
          command: 'sse',
          args: [],
          env: {},
          transport: 'sse',
          scope: 'global',
        },
      };

      const filtered = filterByTransport(mcps, adapter);

      expect(Object.keys(filtered)).toEqual(['github', 'http-server']);
      expect(filtered['sse-server']).toBeUndefined();
    });

    it('should return empty object if no supported transports', () => {
      const adapter = createMockAdapter('claude-code', ['stdio']);

      const mcps: OvertureConfigV2['mcp'] = {
        'http-server': {
          command: 'server',
          args: [],
          env: {},
          transport: 'http',
          scope: 'global',
        },
      };

      const filtered = filterByTransport(mcps, adapter);

      expect(Object.keys(filtered)).toEqual([]);
    });

    it('should return all MCPs if all transports supported', () => {
      const adapter = createMockAdapter('claude-desktop', ['stdio', 'http', 'sse']);

      const mcps: OvertureConfigV2['mcp'] = {
        stdio: {
          command: 'cmd1',
          args: [],
          env: {},
          transport: 'stdio',
          scope: 'global',
        },
        http: {
          command: 'cmd2',
          args: [],
          env: {},
          transport: 'http',
          scope: 'global',
        },
        sse: {
          command: 'cmd3',
          args: [],
          env: {},
          transport: 'sse',
          scope: 'global',
        },
      };

      const filtered = filterByTransport(mcps, adapter);

      expect(Object.keys(filtered)).toHaveLength(3);
    });
  });

  describe('getTransportValidationSummary', () => {
    it('should provide accurate summary', () => {
      const adapter = createMockAdapter('claude-code', ['stdio', 'http']);

      const mcps: OvertureConfigV2['mcp'] = {
        stdio1: {
          command: 'cmd1',
          args: [],
          env: {},
          transport: 'stdio',
          scope: 'global',
        },
        stdio2: {
          command: 'cmd2',
          args: [],
          env: {},
          transport: 'stdio',
          scope: 'global',
        },
        http1: {
          command: 'cmd3',
          args: [],
          env: {},
          transport: 'http',
          scope: 'global',
        },
        sse1: {
          command: 'cmd4',
          args: [],
          env: {},
          transport: 'sse',
          scope: 'global',
        },
        sse2: {
          command: 'cmd5',
          args: [],
          env: {},
          transport: 'sse',
          scope: 'global',
        },
      };

      const summary = getTransportValidationSummary(mcps, adapter);

      expect(summary.total).toBe(5);
      expect(summary.supported).toBe(3);
      expect(summary.unsupported).toBe(2);
      expect(summary.warnings).toHaveLength(2);
    });

    it('should handle no MCPs', () => {
      const adapter = createMockAdapter('claude-code');
      const summary = getTransportValidationSummary({}, adapter);

      expect(summary).toEqual({
        total: 0,
        supported: 0,
        unsupported: 0,
        warnings: [],
      });
    });
  });

  describe('hasTransportIssues', () => {
    it('should return true if unsupported transports exist', () => {
      const adapter = createMockAdapter('claude-code', ['stdio']);

      const mcps: OvertureConfigV2['mcp'] = {
        http: {
          command: 'cmd',
          args: [],
          env: {},
          transport: 'http',
          scope: 'global',
        },
      };

      expect(hasTransportIssues(mcps, adapter)).toBe(true);
    });

    it('should return false if all transports supported', () => {
      const adapter = createMockAdapter('claude-code', ['stdio', 'http']);

      const mcps: OvertureConfigV2['mcp'] = {
        stdio: {
          command: 'cmd1',
          args: [],
          env: {},
          transport: 'stdio',
          scope: 'global',
        },
        http: {
          command: 'cmd2',
          args: [],
          env: {},
          transport: 'http',
          scope: 'global',
        },
      };

      expect(hasTransportIssues(mcps, adapter)).toBe(false);
    });
  });

  describe('formatTransportWarnings', () => {
    it('should format warnings as human-readable text', () => {
      const warnings = [
        {
          mcpName: 'http-server',
          transport: 'http' as const,
          clientName: 'claude-code',
          message: 'MCP "http-server" uses transport "http" which is not supported by claude-code',
        },
        {
          mcpName: 'sse-server',
          transport: 'sse' as const,
          clientName: 'claude-code',
          message: 'MCP "sse-server" uses transport "sse" which is not supported by claude-code',
        },
      ];

      const formatted = formatTransportWarnings(warnings);

      expect(formatted).toContain('Transport Warnings (2)');
      expect(formatted).toContain('⚠ MCP "http-server"');
      expect(formatted).toContain('⚠ MCP "sse-server"');
    });

    it('should handle no warnings', () => {
      const formatted = formatTransportWarnings([]);

      expect(formatted).toBe('No transport issues detected.');
    });
  });

  describe('Client-specific transport support', () => {
    it('should validate Claude Code (stdio + http)', () => {
      const adapter = createMockAdapter('claude-code', ['stdio', 'http']);

      expect(adapter.supportsTransport('stdio')).toBe(true);
      expect(adapter.supportsTransport('http')).toBe(true);
      expect(adapter.supportsTransport('sse')).toBe(false);
    });

    it('should validate Claude Desktop (stdio + sse)', () => {
      const adapter = createMockAdapter('claude-desktop', ['stdio', 'sse']);

      expect(adapter.supportsTransport('stdio')).toBe(true);
      expect(adapter.supportsTransport('sse')).toBe(true);
      expect(adapter.supportsTransport('http')).toBe(false);
    });

    it('should validate VS Code (stdio only)', () => {
      const adapter = createMockAdapter('vscode', ['stdio']);

      expect(adapter.supportsTransport('stdio')).toBe(true);
      expect(adapter.supportsTransport('http')).toBe(false);
      expect(adapter.supportsTransport('sse')).toBe(false);
    });
  });
});
