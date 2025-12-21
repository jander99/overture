/**
 * MCP Detector Tests
 *
 * Comprehensive tests for MCP detection and comparison utilities.
 */

import { describe, it, expect } from 'vitest';
import { compareMcpConfigs, getUnmanagedMcps } from './mcp-detector.js';
import type { McpServerConfig } from '@overture/config-types';

describe('compareMcpConfigs', () => {
  it('should categorize Overture-managed MCPs', () => {
    const overtureMcps: Record<string, McpServerConfig> = {
      github: { command: 'mcp-github', args: [], env: {}, transport: 'stdio' },
      filesystem: {
        command: 'mcp-fs',
        args: ['/home'],
        env: {},
        transport: 'stdio',
      },
    };
    const clientMcps = {};

    const result = compareMcpConfigs(overtureMcps, clientMcps);

    expect(result.managed).toHaveLength(2);
    expect(result.unmanaged).toHaveLength(0);
    expect(result.all).toHaveLength(2);
    expect(result.managed.map((m) => m.name).sort()).toEqual([
      'filesystem',
      'github',
    ]);
  });

  it('should categorize unmanaged MCPs from client', () => {
    const overtureMcps: Record<string, McpServerConfig> = {};
    const clientMcps = {
      slack: { command: 'mcp-slack', args: [] },
      custom: { command: 'custom-mcp' },
    };

    const result = compareMcpConfigs(overtureMcps, clientMcps);

    expect(result.managed).toHaveLength(0);
    expect(result.unmanaged).toHaveLength(2);
    expect(result.all).toHaveLength(2);
    expect(result.unmanaged.map((m) => m.name).sort()).toEqual([
      'custom',
      'slack',
    ]);
  });

  it('should handle mixed managed and unmanaged MCPs', () => {
    const overtureMcps: Record<string, McpServerConfig> = {
      github: { command: 'mcp-github', args: [], env: {}, transport: 'stdio' },
    };
    const clientMcps = {
      github: { command: 'mcp-github' }, // Same as Overture - should be managed
      slack: { command: 'mcp-slack' }, // Only in client - unmanaged
    };

    const result = compareMcpConfigs(overtureMcps, clientMcps);

    expect(result.managed).toHaveLength(1);
    expect(result.managed[0].name).toBe('github');
    expect(result.unmanaged).toHaveLength(1);
    expect(result.unmanaged[0].name).toBe('slack');
    expect(result.all).toHaveLength(2);
  });

  it('should set correct source for managed MCPs', () => {
    const overtureMcps: Record<string, McpServerConfig> = {
      github: { command: 'mcp-github', args: [], env: {}, transport: 'stdio' },
    };

    const result = compareMcpConfigs(overtureMcps, {});

    expect(result.managed[0].source).toBe('overture');
    expect(result.managed[0].detectedFrom).toBe('overture-config');
  });

  it('should set correct source for unmanaged MCPs', () => {
    const clientMcps = {
      slack: { command: 'mcp-slack' },
    };

    const result = compareMcpConfigs({}, clientMcps);

    expect(result.unmanaged[0].source).toBe('manual');
    expect(result.unmanaged[0].detectedFrom).toBe('client-config');
  });

  it('should extract MCP properties correctly', () => {
    const overtureMcps: Record<string, McpServerConfig> = {
      github: {
        command: 'mcp-github',
        args: ['--token', '${TOKEN}'],
        env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
        transport: 'stdio',
      },
    };

    const result = compareMcpConfigs(overtureMcps, {});
    const mcp = result.managed[0];

    expect(mcp.command).toBe('mcp-github');
    expect(mcp.args).toEqual(['--token', '${TOKEN}']);
    expect(mcp.env).toEqual({ GITHUB_TOKEN: '${GITHUB_TOKEN}' });
    expect(mcp.transport).toBe('stdio');
  });

  it('should handle empty inputs', () => {
    const result = compareMcpConfigs({}, {});

    expect(result.all).toEqual([]);
    expect(result.managed).toEqual([]);
    expect(result.unmanaged).toEqual([]);
  });

  it('should use default transport for client MCPs using "type" field', () => {
    const clientMcps = {
      api: { command: 'mcp-api', type: 'http' },
    };

    const result = compareMcpConfigs({}, clientMcps);

    expect(result.unmanaged[0].transport).toBe('http');
  });

  it('should default to stdio transport for client MCPs without type', () => {
    const clientMcps = {
      simple: { command: 'mcp-simple' },
    };

    const result = compareMcpConfigs({}, clientMcps);

    expect(result.unmanaged[0].transport).toBe('stdio');
  });

  it('should default to empty args array for client MCPs without args', () => {
    const clientMcps = {
      noargs: { command: 'mcp-noargs' },
    };

    const result = compareMcpConfigs({}, clientMcps);

    expect(result.unmanaged[0].args).toEqual([]);
  });
});

describe('getUnmanagedMcps', () => {
  it('should return MCPs in client but not in Overture', () => {
    const clientConfig = {
      github: { command: 'mcp-github' },
      slack: { command: 'mcp-slack' },
      custom: { command: 'custom-mcp' },
    };
    const overtureMcps: Record<string, McpServerConfig> = {
      github: { command: 'mcp-github', args: [], env: {}, transport: 'stdio' },
    };

    const result = getUnmanagedMcps(clientConfig, overtureMcps);

    expect(Object.keys(result).sort()).toEqual(['custom', 'slack']);
    expect(result['github']).toBeUndefined();
  });

  it('should return empty object when all MCPs are managed', () => {
    const clientConfig = {
      github: { command: 'mcp-github' },
    };
    const overtureMcps: Record<string, McpServerConfig> = {
      github: { command: 'mcp-github', args: [], env: {}, transport: 'stdio' },
    };

    const result = getUnmanagedMcps(clientConfig, overtureMcps);

    expect(Object.keys(result)).toHaveLength(0);
  });

  it('should return all client MCPs when none are managed', () => {
    const clientConfig = {
      slack: { command: 'mcp-slack' },
      custom: { command: 'custom-mcp' },
    };

    const result = getUnmanagedMcps(clientConfig, {});

    expect(Object.keys(result).sort()).toEqual(['custom', 'slack']);
  });

  it('should preserve original client config for unmanaged MCPs', () => {
    const clientConfig = {
      slack: {
        command: 'mcp-slack',
        args: ['--workspace', 'myteam'],
        env: { SLACK_TOKEN: 'token123' },
      },
    };

    const result = getUnmanagedMcps(clientConfig, {});

    expect(result['slack']).toEqual(clientConfig['slack']);
  });

  it('should handle empty client config', () => {
    const overtureMcps: Record<string, McpServerConfig> = {
      github: { command: 'mcp-github', args: [], env: {}, transport: 'stdio' },
    };

    const result = getUnmanagedMcps({}, overtureMcps);

    expect(Object.keys(result)).toHaveLength(0);
  });
});
