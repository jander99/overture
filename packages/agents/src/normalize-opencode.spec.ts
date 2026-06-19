// Tests for the OpenCode per-agent MCP normalizer.
//
// OpenCode is the only supported agent whose native MCP config uses a
// top-level `mcp` map (not `mcpServers`) and where each entry is a
// discriminated union on `type: 'local' | 'remote'`. These tests pin
// the native -> canonical mapping for both arms plus every guarded
// failure mode enumerated in the B2 plan Task 4 (lines 412-417).
import { describe, expect, it } from 'vitest';
import type { OpenCodeMcpConfig } from './opencode.js';
import { normalizeOpenCodeMcpServers } from './opencode.js';
import type { AgentMcpReadResult } from './types.js';

function makeRead(
  config: OpenCodeMcpConfig | null,
  extras: { parseError?: string } = {},
): AgentMcpReadResult<OpenCodeMcpConfig> {
  return {
    config,
    nonEmpty: config !== null && config.mcp !== undefined,
    ...extras,
  };
}

describe('normalizeOpenCodeMcpServers() - read-result guards', () => {
  it('returns {} when input.parseError is set', () => {
    const input = makeRead(null, { parseError: 'bad json' });
    expect(normalizeOpenCodeMcpServers(input)).toEqual({});
  });

  it('returns {} when input.config is null', () => {
    expect(normalizeOpenCodeMcpServers(makeRead(null))).toEqual({});
  });

  it('returns {} when the top-level mcp key is absent', () => {
    const input = makeRead({});
    expect(normalizeOpenCodeMcpServers(input)).toEqual({});
  });

  it('returns {} when the top-level mcp value is not an object (array)', () => {
    const input = makeRead({
      mcp: [] as unknown as OpenCodeMcpConfig['mcp'],
    });
    expect(normalizeOpenCodeMcpServers(input)).toEqual({});
  });

  it('returns {} when the top-level mcp value is a primitive (string)', () => {
    const input = makeRead({
      mcp: 'nope' as unknown as OpenCodeMcpConfig['mcp'],
    });
    expect(normalizeOpenCodeMcpServers(input)).toEqual({});
  });

  it('returns {} when the top-level mcp value is null', () => {
    const input = makeRead({
      mcp: null as unknown as OpenCodeMcpConfig['mcp'],
    });
    expect(normalizeOpenCodeMcpServers(input)).toEqual({});
  });
});

describe('normalizeOpenCodeMcpServers() - per-server guards', () => {
  it('reports shape conflict for a per-server entry that is not an object (string)', () => {
    const input = makeRead({
      mcp: {
        bad: 'string',
      } as unknown as OpenCodeMcpConfig['mcp'],
    });
    const result = normalizeOpenCodeMcpServers(input);
    expect(result).toEqual({
      bad: {
        state: 'shape-conflict',
        reason: 'Expected server entry to be an object.',
      },
    });
  });

  it('reports shape conflict for a per-server entry that is an array', () => {
    const input = makeRead({
      mcp: { bad: [] } as unknown as OpenCodeMcpConfig['mcp'],
    });
    const result = normalizeOpenCodeMcpServers(input);
    expect(result.bad).toEqual({
      state: 'shape-conflict',
      reason: 'Expected server entry to be an object.',
    });
  });

  it("reports shape conflict for an unsupported discriminator value ('stdio')", () => {
    const input = makeRead({
      mcp: {
        bad: {
          type: 'stdio' as unknown as 'local',
          command: ['npx'],
        },
      } as unknown as OpenCodeMcpConfig['mcp'],
    });
    const result = normalizeOpenCodeMcpServers(input);
    expect(result.bad).toEqual({
      state: 'shape-conflict',
      reason: 'Unsupported MCP server transport type.',
    });
  });

  it('reports shape conflict when the discriminator is missing entirely', () => {
    const input = makeRead({
      mcp: {
        bad: {
          command: ['npx'],
        },
      } as unknown as OpenCodeMcpConfig['mcp'],
    });
    const result = normalizeOpenCodeMcpServers(input);
    expect(result.bad).toEqual({
      state: 'shape-conflict',
      reason: 'Unsupported MCP server transport type.',
    });
  });
});

describe('normalizeOpenCodeMcpServers() - local arm', () => {
  it('happy path: command vector splits into command + args, no env', () => {
    const input = makeRead({
      mcp: {
        pkg: {
          type: 'local',
          command: ['npx', 'pkg', '--flag'],
        },
      },
    });
    const result = normalizeOpenCodeMcpServers(input);
    expect(result.pkg).toEqual({
      state: 'normalized',
      server: { type: 'stdio', command: 'npx', args: ['pkg', '--flag'] },
    });
  });

  it('happy path with env: environment maps to canonical env', () => {
    const input = makeRead({
      mcp: {
        server: {
          type: 'local',
          command: ['node', 'server.js'],
          environment: { NODE_ENV: 'production' },
        },
      },
    });
    const result = normalizeOpenCodeMcpServers(input);
    expect(result.server).toEqual({
      state: 'normalized',
      server: {
        type: 'stdio',
        command: 'node',
        args: ['server.js'],
        env: { NODE_ENV: 'production' },
      },
    });
  });

  it('single-element command vector produces canonical stdio with no args', () => {
    const input = makeRead({
      mcp: {
        only: {
          type: 'local',
          command: ['only'],
        },
      },
    });
    const result = normalizeOpenCodeMcpServers(input);
    expect(result.only).toEqual({
      state: 'normalized',
      server: { type: 'stdio', command: 'only' },
    });
    const server =
      result.only?.state === 'normalized' ? result.only.server : null;
    expect(server).not.toBeNull();
    if (server !== null) {
      expect('args' in server).toBe(false);
    }
  });

  it('empty command array produces a shape conflict', () => {
    const input = makeRead({
      mcp: {
        bad: { type: 'local', command: [] },
      },
    });
    const result = normalizeOpenCodeMcpServers(input);
    expect(result.bad).toEqual({
      state: 'shape-conflict',
      reason: 'Stdio command is missing or empty.',
    });
  });

  it('non-array command produces a shape conflict', () => {
    const input = makeRead({
      mcp: {
        bad: {
          type: 'local',
          command: 'npx' as unknown as readonly string[],
        },
      },
    });
    const result = normalizeOpenCodeMcpServers(input);
    expect(result.bad).toEqual({
      state: 'shape-conflict',
      reason: 'Stdio command is missing or empty.',
    });
  });

  it('non-string environment map produces the env reason', () => {
    const input = makeRead({
      mcp: {
        bad: {
          type: 'local',
          command: ['npx'],
          environment: { KEY: 42 } as unknown as Record<string, string>,
        },
      },
    });
    const result = normalizeOpenCodeMcpServers(input);
    expect(result.bad).toEqual({
      state: 'shape-conflict',
      reason: 'Expected string map for env.',
    });
  });

  it('omits env when environment is undefined', () => {
    const input = makeRead({
      mcp: {
        pkg: {
          type: 'local',
          command: ['npx', 'pkg'],
        },
      },
    });
    const result = normalizeOpenCodeMcpServers(input);
    const server =
      result.pkg?.state === 'normalized' ? result.pkg.server : null;
    expect(server).not.toBeNull();
    if (server !== null) {
      expect('env' in server).toBe(false);
    }
  });

  it('ignores enabled: false (not a shape conflict; field is dropped)', () => {
    const input = makeRead({
      mcp: {
        pkg: {
          type: 'local',
          command: ['npx', 'pkg'],
          enabled: false,
        },
      },
    });
    const result = normalizeOpenCodeMcpServers(input);
    expect(result.pkg).toEqual({
      state: 'normalized',
      server: { type: 'stdio', command: 'npx', args: ['pkg'] },
    });
  });

  it('ignores timeout and oauth (fields are dropped from the canonical output)', () => {
    const input = makeRead({
      mcp: {
        pkg: {
          type: 'local',
          command: ['npx', 'pkg'],
          timeout: 5000,
          oauth: { clientId: 'x' },
        },
      },
    });
    const result = normalizeOpenCodeMcpServers(input);
    const server =
      result.pkg?.state === 'normalized' ? result.pkg.server : null;
    expect(server).not.toBeNull();
    if (server !== null) {
      expect('timeout' in server).toBe(false);
      expect('oauth' in server).toBe(false);
      expect('enabled' in server).toBe(false);
    }
  });
});

describe('normalizeOpenCodeMcpServers() - remote arm', () => {
  it('happy path: url and headers preserved', () => {
    const input = makeRead({
      mcp: {
        upstream: {
          type: 'remote',
          url: 'https://mcp.example.com',
          headers: { Auth: 'Bearer x' },
        },
      },
    });
    const result = normalizeOpenCodeMcpServers(input);
    expect(result.upstream).toEqual({
      state: 'normalized',
      server: {
        type: 'remote',
        url: 'https://mcp.example.com',
        headers: { Auth: 'Bearer x' },
      },
    });
  });

  it('happy path without headers: no headers key in canonical output', () => {
    const input = makeRead({
      mcp: {
        upstream: {
          type: 'remote',
          url: 'https://mcp.example.com',
        },
      },
    });
    const result = normalizeOpenCodeMcpServers(input);
    const server =
      result.upstream?.state === 'normalized' ? result.upstream.server : null;
    expect(server).not.toBeNull();
    if (server !== null) {
      expect('headers' in server).toBe(false);
    }
  });

  it('empty url produces a shape conflict', () => {
    const input = makeRead({
      mcp: {
        bad: {
          type: 'remote',
          url: '',
        },
      },
    });
    const result = normalizeOpenCodeMcpServers(input);
    expect(result.bad).toEqual({
      state: 'shape-conflict',
      reason: 'Remote url is missing or empty.',
    });
  });

  it('missing url key produces a shape conflict', () => {
    const input = makeRead({
      mcp: {
        bad: {
          type: 'remote',
        },
      } as unknown as OpenCodeMcpConfig['mcp'],
    });
    const result = normalizeOpenCodeMcpServers(input);
    expect(result.bad).toEqual({
      state: 'shape-conflict',
      reason: 'Remote url is missing or empty.',
    });
  });

  it('non-string headers map produces the headers reason', () => {
    const input = makeRead({
      mcp: {
        bad: {
          type: 'remote',
          url: 'https://mcp.example.com',
          headers: { K: 1 } as unknown as Record<string, string>,
        },
      },
    });
    const result = normalizeOpenCodeMcpServers(input);
    expect(result.bad).toEqual({
      state: 'shape-conflict',
      reason: 'Expected string map for headers.',
    });
  });

  it('ignores enabled, timeout, and oauth on remote entries', () => {
    const input = makeRead({
      mcp: {
        upstream: {
          type: 'remote',
          url: 'https://mcp.example.com',
          enabled: true,
          timeout: 1000,
          oauth: { clientId: 'y' },
        },
      },
    });
    const result = normalizeOpenCodeMcpServers(input);
    const server =
      result.upstream?.state === 'normalized' ? result.upstream.server : null;
    expect(server).not.toBeNull();
    if (server !== null) {
      expect('enabled' in server).toBe(false);
      expect('timeout' in server).toBe(false);
      expect('oauth' in server).toBe(false);
    }
  });
});

describe('normalizeOpenCodeMcpServers() - multi-entry mixes', () => {
  it('processes a config with both local and remote entries independently', () => {
    const input = makeRead({
      mcp: {
        alpha: { type: 'local', command: ['npx', 'a'] },
        beta: { type: 'remote', url: 'https://b.example.com' },
        gamma: { type: 'local', command: [] },
      },
    });
    const result = normalizeOpenCodeMcpServers(input);
    expect(result.alpha).toEqual({
      state: 'normalized',
      server: { type: 'stdio', command: 'npx', args: ['a'] },
    });
    expect(result.beta).toEqual({
      state: 'normalized',
      server: { type: 'remote', url: 'https://b.example.com' },
    });
    expect(result.gamma).toEqual({
      state: 'shape-conflict',
      reason: 'Stdio command is missing or empty.',
    });
  });

  it('returns an empty object for an empty mcp map', () => {
    const input = makeRead({ mcp: {} });
    expect(normalizeOpenCodeMcpServers(input)).toEqual({});
  });
});
