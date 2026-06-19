// Tests for the per-agent MCP normalizers in `claude-code.ts` and
// `github-copilot-cli.ts`.
//
// Group order matches the plan's per-agent scenario list:
//   1. Claude Code
//      - happy path stdio + remote
//      - empty explicit fields preserved
//      - read-result guards (parseError, config null, mcpServers absent, non-object)
//      - per-server: non-object, both keys, neither key, empty command
//      - per-server: bad args, bad env, bad headers
//      - per-server: whitespace-only command is non-empty
//   2. GitHub Copilot CLI
//      - happy path local + http
//      - empty explicit fields preserved
//      - read-result guards (parseError, config null, mcpServers absent, non-object)
//      - per-server: non-object, bad args/env/headers
//      - per-server: empty command / empty url
//      - per-server: unsupported transport type (incl. missing)
import { describe, expect, it } from 'vitest';
import type { AgentMcpReadResult } from './types.js';
import {
  normalizeClaudeCodeMcpServers,
  type ClaudeCodeMcpConfig,
} from './claude-code.js';
import {
  normalizeGitHubCopilotCliMcpServers,
  type GitHubCopilotCliMcpConfig,
} from './github-copilot-cli.js';

type ClaudeInput = AgentMcpReadResult<ClaudeCodeMcpConfig>;
type CopilotInput = AgentMcpReadResult<GitHubCopilotCliMcpConfig>;

function ccInput(
  config: unknown,
  extras: { parseError?: string } = {},
): ClaudeInput {
  return {
    config: config as ClaudeCodeMcpConfig | null,
    nonEmpty: config !== null,
    ...extras,
  };
}

function copInput(
  config: unknown,
  extras: { parseError?: string } = {},
): CopilotInput {
  return {
    config: config as GitHubCopilotCliMcpConfig | null,
    nonEmpty: config !== null,
    ...extras,
  };
}

describe('normalizeClaudeCodeMcpServers', () => {
  it('happy path: stdio + remote entries with valid args/env/headers', () => {
    const result = normalizeClaudeCodeMcpServers(
      ccInput({
        mcpServers: {
          local_one: {
            command: 'npx',
            args: ['-y', 'mcp-server'],
            env: { NODE_ENV: 'production' },
          },
          remote_one: {
            url: 'https://mcp.example.com',
            headers: { Authorization: 'Bearer token' },
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
          args: ['-y', 'mcp-server'],
          env: { NODE_ENV: 'production' },
        },
      },
      remote_one: {
        state: 'normalized',
        server: {
          type: 'remote',
          url: 'https://mcp.example.com',
          headers: { Authorization: 'Bearer token' },
        },
      },
    });
  });

  it('preserves explicit empty args as []', () => {
    const result = normalizeClaudeCodeMcpServers(
      ccInput({
        mcpServers: { empty_args: { command: 'noop', args: [] } },
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
    const result = normalizeClaudeCodeMcpServers(
      ccInput({
        mcpServers: { empty_env: { command: 'noop', env: {} } },
      }),
    );
    expect(result).toEqual({
      empty_env: {
        state: 'normalized',
        server: { type: 'stdio', command: 'noop', env: {} },
      },
    });
  });

  it('returns {} when config is null', () => {
    expect(normalizeClaudeCodeMcpServers(ccInput(null))).toEqual({});
  });

  it('returns {} when parseError is set', () => {
    expect(
      normalizeClaudeCodeMcpServers(
        ccInput(
          { mcpServers: { x: { command: 'a' } } },
          {
            parseError: 'parse failed',
          },
        ),
      ),
    ).toEqual({});
  });

  it('returns {} when mcpServers is absent', () => {
    expect(normalizeClaudeCodeMcpServers(ccInput({}))).toEqual({});
  });

  it('returns {} when mcpServers is an array', () => {
    expect(
      normalizeClaudeCodeMcpServers(
        ccInput({ mcpServers: [] as unknown as Record<string, unknown> }),
      ),
    ).toEqual({});
  });

  it('returns {} when mcpServers is a string', () => {
    expect(
      normalizeClaudeCodeMcpServers(
        ccInput({
          mcpServers: 'not a map' as unknown as Record<string, unknown>,
        }),
      ),
    ).toEqual({});
  });

  it('per-server: non-object entry returns shape-conflict', () => {
    const result = normalizeClaudeCodeMcpServers(
      ccInput({
        mcpServers: {
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
    const result = normalizeClaudeCodeMcpServers(
      ccInput({
        mcpServers: { conflict: { command: 'npx', url: 'https://x' } },
      }),
    );
    expect(result['conflict']).toEqual({
      state: 'shape-conflict',
      reason: 'Server declares both stdio command and remote url.',
    });
  });

  it('per-server: both command (empty) and url present still returns both-keys reason', () => {
    const result = normalizeClaudeCodeMcpServers(
      ccInput({
        mcpServers: { conflict: { command: '', url: 'https://x' } },
      }),
    );
    expect(result['conflict']).toEqual({
      state: 'shape-conflict',
      reason: 'Server declares both stdio command and remote url.',
    });
  });

  it('per-server: neither command nor url present returns neither-keys reason', () => {
    const result = normalizeClaudeCodeMcpServers(
      ccInput({
        mcpServers: { empty: { args: ['a'] } },
      }),
    );
    expect(result['empty']).toEqual({
      state: 'shape-conflict',
      reason: 'Server declares neither stdio command nor remote url.',
    });
  });

  it('per-server: empty string command returns missing-or-empty reason', () => {
    const result = normalizeClaudeCodeMcpServers(
      ccInput({
        mcpServers: { empty_cmd: { command: '' } },
      }),
    );
    expect(result['empty_cmd']).toEqual({
      state: 'shape-conflict',
      reason: 'Stdio command is missing or empty.',
    });
  });

  it('per-server: whitespace-only command is non-empty and normalizes', () => {
    const result = normalizeClaudeCodeMcpServers(
      ccInput({
        mcpServers: { ws_cmd: { command: ' ' } },
      }),
    );
    expect(result['ws_cmd']).toEqual({
      state: 'normalized',
      server: { type: 'stdio', command: ' ' },
    });
  });

  it('per-server: bad args (non-array) returns args reason', () => {
    const result = normalizeClaudeCodeMcpServers(
      ccInput({
        mcpServers: {
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
    const result = normalizeClaudeCodeMcpServers(
      ccInput({
        mcpServers: {
          bad_env: { command: 'x', env: { KEY: 42 as unknown as string } },
        },
      }),
    );
    expect(result['bad_env']).toEqual({
      state: 'shape-conflict',
      reason: 'Expected string map for env.',
    });
  });

  it('per-server: bad headers (non-string value) returns headers reason', () => {
    const result = normalizeClaudeCodeMcpServers(
      ccInput({
        mcpServers: {
          bad_headers: {
            url: 'https://x',
            headers: { K: 1 as unknown as string },
          },
        },
      }),
    );
    expect(result['bad_headers']).toEqual({
      state: 'shape-conflict',
      reason: 'Expected string map for headers.',
    });
  });

  it('ignores top-level imports extension (does not read it)', () => {
    const result = normalizeClaudeCodeMcpServers(
      ccInput({
        imports: { './other.json': './other.json' },
        mcpServers: { ok: { command: 'npx' } },
      }),
    );
    expect(result).toEqual({
      ok: {
        state: 'normalized',
        server: { type: 'stdio', command: 'npx' },
      },
    });
  });
});

describe('normalizeGitHubCopilotCliMcpServers', () => {
  it('happy path: local + http entries with valid args/env/headers', () => {
    const result = normalizeGitHubCopilotCliMcpServers(
      copInput({
        mcpServers: {
          local_one: {
            type: 'local',
            command: 'npx',
            args: ['-y', 'mcp-server'],
            env: { NODE_ENV: 'production' },
            tools: ['tool1', 'tool2'],
          },
          http_one: {
            type: 'http',
            url: 'https://mcp.example.com',
            headers: { Authorization: 'Bearer token' },
            tools: ['tool3'],
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
          args: ['-y', 'mcp-server'],
          env: { NODE_ENV: 'production' },
        },
      },
      http_one: {
        state: 'normalized',
        server: {
          type: 'remote',
          url: 'https://mcp.example.com',
          headers: { Authorization: 'Bearer token' },
        },
      },
    });
  });

  it('preserves explicit empty args as []', () => {
    const result = normalizeGitHubCopilotCliMcpServers(
      copInput({
        mcpServers: {
          empty_args: { type: 'local', command: 'noop', args: [] },
        },
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
    const result = normalizeGitHubCopilotCliMcpServers(
      copInput({
        mcpServers: {
          empty_env: { type: 'local', command: 'noop', env: {} },
        },
      }),
    );
    expect(result).toEqual({
      empty_env: {
        state: 'normalized',
        server: { type: 'stdio', command: 'noop', env: {} },
      },
    });
  });

  it('returns {} when config is null', () => {
    expect(normalizeGitHubCopilotCliMcpServers(copInput(null))).toEqual({});
  });

  it('returns {} when parseError is set', () => {
    expect(
      normalizeGitHubCopilotCliMcpServers(
        copInput(
          { mcpServers: { x: { type: 'local', command: 'a' } } },
          { parseError: 'parse failed' },
        ),
      ),
    ).toEqual({});
  });

  it('returns {} when mcpServers is absent', () => {
    expect(normalizeGitHubCopilotCliMcpServers(copInput({}))).toEqual({});
  });

  it('returns {} when mcpServers is an array', () => {
    expect(
      normalizeGitHubCopilotCliMcpServers(
        copInput({ mcpServers: [] as unknown as Record<string, unknown> }),
      ),
    ).toEqual({});
  });

  it('returns {} when mcpServers is a string', () => {
    expect(
      normalizeGitHubCopilotCliMcpServers(
        copInput({ mcpServers: 'nope' as unknown as Record<string, unknown> }),
      ),
    ).toEqual({});
  });

  it('per-server: non-object entry returns shape-conflict', () => {
    const result = normalizeGitHubCopilotCliMcpServers(
      copInput({
        mcpServers: { bad: 42 as unknown as Record<string, unknown> },
      }),
    );
    expect(result['bad']).toEqual({
      state: 'shape-conflict',
      reason: 'Expected server entry to be an object.',
    });
  });

  it('per-server: type stdio returns unsupported reason', () => {
    const result = normalizeGitHubCopilotCliMcpServers(
      copInput({
        mcpServers: { bad: { type: 'stdio', command: 'a' } },
      }),
    );
    expect(result['bad']).toEqual({
      state: 'shape-conflict',
      reason: 'Unsupported MCP server transport type.',
    });
  });

  it('per-server: missing type returns unsupported reason', () => {
    const result = normalizeGitHubCopilotCliMcpServers(
      copInput({
        mcpServers: { bad: { command: 'a' } },
      }),
    );
    expect(result['bad']).toEqual({
      state: 'shape-conflict',
      reason: 'Unsupported MCP server transport type.',
    });
  });

  it('per-server: empty local command returns missing-or-empty reason', () => {
    const result = normalizeGitHubCopilotCliMcpServers(
      copInput({
        mcpServers: { bad: { type: 'local', command: '' } },
      }),
    );
    expect(result['bad']).toEqual({
      state: 'shape-conflict',
      reason: 'Stdio command is missing or empty.',
    });
  });

  it('per-server: empty http url returns missing-or-empty reason', () => {
    const result = normalizeGitHubCopilotCliMcpServers(
      copInput({
        mcpServers: { bad: { type: 'http', url: '' } },
      }),
    );
    expect(result['bad']).toEqual({
      state: 'shape-conflict',
      reason: 'Remote url is missing or empty.',
    });
  });

  it('per-server: bad args (non-array) returns args reason', () => {
    const result = normalizeGitHubCopilotCliMcpServers(
      copInput({
        mcpServers: {
          bad_args: {
            type: 'local',
            command: 'x',
            args: 'nope' as unknown as string[],
          },
        },
      }),
    );
    expect(result['bad_args']).toEqual({
      state: 'shape-conflict',
      reason: 'Expected string array for args.',
    });
  });

  it('per-server: bad env returns env reason', () => {
    const result = normalizeGitHubCopilotCliMcpServers(
      copInput({
        mcpServers: {
          bad_env: {
            type: 'local',
            command: 'x',
            env: { K: 1 as unknown as string },
          },
        },
      }),
    );
    expect(result['bad_env']).toEqual({
      state: 'shape-conflict',
      reason: 'Expected string map for env.',
    });
  });

  it('per-server: bad headers returns headers reason', () => {
    const result = normalizeGitHubCopilotCliMcpServers(
      copInput({
        mcpServers: {
          bad_headers: {
            type: 'http',
            url: 'https://x',
            headers: { K: 1 as unknown as string },
          },
        },
      }),
    );
    expect(result['bad_headers']).toEqual({
      state: 'shape-conflict',
      reason: 'Expected string map for headers.',
    });
  });
});
