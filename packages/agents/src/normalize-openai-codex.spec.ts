// Tests for the per-agent MCP normalizer in `openai-codex.ts`.
//
// Group order matches the plan's per-agent scenario list:
//   - happy path stdio + remote
//   - empty explicit fields preserved
//   - read-result guards (parseError, config null, mcp_servers absent, non-object)
//   - per-server: non-object, both keys, neither key, empty command
//   - per-server: bad args, bad env, bad http_headers
//   - per-server: whitespace-only command is non-empty
//   - ignored Codex extension fields (env_vars, cwd, timeouts, oauth, etc.)
import { describe, expect, it } from 'vitest';
import type { AgentMcpReadResult } from './types.js';
import {
  normalizeOpenAICodexMcpServers,
  type OpenAICodexMcpConfig,
} from './openai-codex.js';

type CodexInput = AgentMcpReadResult<OpenAICodexMcpConfig>;

function cxInput(
  config: unknown,
  extras: { parseError?: string } = {},
): CodexInput {
  return {
    config: config as OpenAICodexMcpConfig | null,
    nonEmpty: config !== null,
    ...extras,
  };
}

describe('normalizeOpenAICodexMcpServers', () => {
  it('happy path: stdio + remote entries with valid args/env/http_headers', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: {
          local_one: {
            command: 'npx',
            args: ['pkg', '--flag'],
            env: { NODE_ENV: 'production' },
          },
          remote_one: {
            url: 'https://mcp.example.com',
            http_headers: { Auth: 'Bearer x' },
          },
        },
      }),
    );
    expect(result).toEqual({
      local_one: {
        state: 'normalized',
        server: {
          type: 'stdio',
          command: 'npx',
          args: ['pkg', '--flag'],
          env: { NODE_ENV: 'production' },
        },
      },
      remote_one: {
        state: 'normalized',
        server: {
          type: 'remote',
          url: 'https://mcp.example.com',
          headers: { Auth: 'Bearer x' },
        },
      },
    });
  });

  it('preserves explicit empty args as []', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: { empty_args: { command: 'noop', args: [] } },
      }),
    );
    expect(result).toEqual({
      empty_args: {
        state: 'normalized',
        server: { type: 'stdio', command: 'noop', args: [] },
      },
    });
  });

  it('preserves explicit empty env as {}', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: { empty_env: { command: 'noop', env: {} } },
      }),
    );
    expect(result).toEqual({
      empty_env: {
        state: 'normalized',
        server: { type: 'stdio', command: 'noop', env: {} },
      },
    });
  });

  it('omits args/env keys when native fields are absent', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: { bare: { command: 'noop' } },
      }),
    );
    expect(result).toEqual({
      bare: {
        state: 'normalized',
        server: { type: 'stdio', command: 'noop' },
      },
    });
  });

  it('omits headers key when native http_headers is absent', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: { bare: { url: 'https://mcp.example.com' } },
      }),
    );
    expect(result).toEqual({
      bare: {
        state: 'normalized',
        server: { type: 'remote', url: 'https://mcp.example.com' },
      },
    });
  });

  it('returns {} when config is null', () => {
    expect(normalizeOpenAICodexMcpServers(cxInput(null))).toEqual({});
  });

  it('returns {} when parseError is set', () => {
    expect(
      normalizeOpenAICodexMcpServers(
        cxInput(
          { mcp_servers: { x: { command: 'a' } } },
          { parseError: 'parse failed' },
        ),
      ),
    ).toEqual({});
  });

  it('returns {} when mcp_servers is absent', () => {
    expect(normalizeOpenAICodexMcpServers(cxInput({}))).toEqual({});
  });

  it('returns {} when mcp_servers is an array', () => {
    expect(
      normalizeOpenAICodexMcpServers(
        cxInput({
          mcp_servers: [] as unknown as Record<string, unknown>,
        }),
      ),
    ).toEqual({});
  });

  it('returns {} when mcp_servers is a string', () => {
    expect(
      normalizeOpenAICodexMcpServers(
        cxInput({
          mcp_servers: 'not a map' as unknown as Record<string, unknown>,
        }),
      ),
    ).toEqual({});
  });

  it('per-server: non-object entry returns shape-conflict', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: {
          bad: 'not an object' as unknown as Record<string, unknown>,
        },
      }),
    );
    expect(result['bad']).toEqual({
      state: 'shape-conflict',
      reason: 'Expected server entry to be an object.',
    });
  });

  it('per-server: both command and url present returns both-keys reason', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: { conflict: { command: 'npx', url: 'https://x' } },
      }),
    );
    expect(result['conflict']).toEqual({
      state: 'shape-conflict',
      reason: 'Server declares both stdio command and remote url.',
    });
  });

  it('per-server: both command (empty) and url present still returns both-keys reason', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: { conflict: { command: '', url: 'https://x' } },
      }),
    );
    expect(result['conflict']).toEqual({
      state: 'shape-conflict',
      reason: 'Server declares both stdio command and remote url.',
    });
  });

  it('per-server: both url (empty) and command present still returns both-keys reason', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: { conflict: { url: '', command: 'noop' } },
      }),
    );
    expect(result['conflict']).toEqual({
      state: 'shape-conflict',
      reason: 'Server declares both stdio command and remote url.',
    });
  });

  it('per-server: neither command nor url present returns neither-keys reason', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: { empty: { args: ['a'] } },
      }),
    );
    expect(result['empty']).toEqual({
      state: 'shape-conflict',
      reason: 'Server declares neither stdio command nor remote url.',
    });
  });

  it('per-server: empty string command returns missing-or-empty reason', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: { empty_cmd: { command: '' } },
      }),
    );
    expect(result['empty_cmd']).toEqual({
      state: 'shape-conflict',
      reason: 'Stdio command is missing or empty.',
    });
  });

  it('per-server: empty string url returns missing-or-empty reason', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: { empty_url: { url: '' } },
      }),
    );
    expect(result['empty_url']).toEqual({
      state: 'shape-conflict',
      reason: 'Remote url is missing or empty.',
    });
  });

  it('per-server: whitespace-only command is non-empty and normalizes', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: { ws_cmd: { command: ' ' } },
      }),
    );
    expect(result['ws_cmd']).toEqual({
      state: 'normalized',
      server: { type: 'stdio', command: ' ' },
    });
  });

  it('per-server: bad args (non-array) returns args reason', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: {
          bad_args: { command: 'x', args: 42 as unknown as string[] },
        },
      }),
    );
    expect(result['bad_args']).toEqual({
      state: 'shape-conflict',
      reason: 'Expected string array for args.',
    });
  });

  it('per-server: bad env (non-string value) returns env reason', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: {
          bad_env: { command: 'x', env: { KEY: 42 as unknown as string } },
        },
      }),
    );
    expect(result['bad_env']).toEqual({
      state: 'shape-conflict',
      reason: 'Expected string map for env.',
    });
  });

  it('per-server: bad http_headers (non-string value) returns headers reason', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: {
          bad_headers: {
            url: 'https://x',
            http_headers: { K: 1 as unknown as string },
          },
        },
      }),
    );
    expect(result['bad_headers']).toEqual({
      state: 'shape-conflict',
      reason: 'Expected string map for headers.',
    });
  });

  it('ignores stdio extension field `enabled: false` (still normalizes)', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: { disabled: { command: 'noop', enabled: false } },
      }),
    );
    expect(result).toEqual({
      disabled: {
        state: 'normalized',
        server: { type: 'stdio', command: 'noop' },
      },
    });
  });

  it('ignores every Codex stdio extension field (timeouts, oauth, cwd, env_vars, tools, scopes, required)', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: {
          noisy: {
            command: 'noop',
            startup_timeout_sec: 30,
            tool_timeout_sec: 60,
            enabled_tools: ['x'],
            disabled_tools: ['y'],
            env_vars: ['FOO'],
            cwd: '/tmp',
            scopes: ['s'],
            oauth_resource: 'https://x',
            required: true,
          },
        },
      }),
    );
    expect(result).toEqual({
      noisy: {
        state: 'normalized',
        server: { type: 'stdio', command: 'noop' },
      },
    });
  });

  it('ignores remote extension fields bearer_token_env_var + env_http_headers (no canonical headers)', () => {
    const result = normalizeOpenAICodexMcpServers(
      cxInput({
        mcp_servers: {
          tokenized: {
            url: 'https://mcp.example.com',
            bearer_token_env_var: 'TOKEN',
            env_http_headers: { X: 'Y' },
          },
        },
      }),
    );
    expect(result).toEqual({
      tokenized: {
        state: 'normalized',
        server: { type: 'remote', url: 'https://mcp.example.com' },
      },
    });
  });
});
