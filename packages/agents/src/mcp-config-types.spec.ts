// Per-agent MCP config type-contract tests.
//
// This suite is a compile-time + registry-absence contract; it does NOT read
// or write MCP files. Each supported agent exports a `*McpConfig` type that
// is consumed by at least one `satisfies` fixture below so the strict-mode
// `noUnusedLocals` rule does not flag the imports.
//
// Changed-file strictness (`@ts-expect-error`/`: any`) is asserted at
// runtime by the `strictness` describe block.
import { describe, it, expect, expectTypeOf } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ClaudeCodeMcpConfig } from './claude-code.js';
import type { OpenCodeMcpConfig } from './opencode.js';
import type { GitHubCopilotCliMcpConfig } from './github-copilot-cli.js';
import type { OpenAICodexMcpConfig } from './openai-codex.js';

describe('ClaudeCodeMcpConfig', () => {
  it('accepts a stdio server and an http server plus a local imports map', () => {
    const fixture: ClaudeCodeMcpConfig = {
      mcpServers: {
        'local-tools': {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-memory'],
          env: { LOG_LEVEL: 'info' },
        },
        'remote-tools': {
          type: 'http',
          url: 'https://mcp.example.com/mcp',
          headers: { Authorization: 'Bearer token' },
        },
      },
      imports: { './shared.json': '/absolute/path/to/shared.json' },
    };
    expectTypeOf(fixture).toMatchTypeOf<ClaudeCodeMcpConfig>();
  });
});

describe('OpenCodeMcpConfig', () => {
  it('accepts a local server (argv vector) and a remote server', () => {
    const fixture: OpenCodeMcpConfig = {
      mcp: {
        local: {
          type: 'local',
          command: ['node', 'server.js'],
          environment: { NODE_ENV: 'production' },
          enabled: true,
          timeout: 30,
        },
        remote: {
          type: 'remote',
          url: 'https://mcp.example.com/mcp',
          headers: { Authorization: 'Bearer token' },
          enabled: true,
        },
      },
    };
    expectTypeOf(fixture).toMatchTypeOf<OpenCodeMcpConfig>();
  });
});

describe('GitHubCopilotCliMcpConfig', () => {
  it('accepts a local and an http server keyed under mcpServers', () => {
    const fixture: GitHubCopilotCliMcpConfig = {
      mcpServers: {
        local: {
          type: 'local',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-memory'],
          env: {},
          tools: ['*'],
        },
        remote: {
          type: 'http',
          url: 'https://mcp.example.com/mcp',
          headers: { Authorization: 'Bearer ${MCP_TOKEN}' },
          tools: ['tool_a'],
        },
      },
    };
    expectTypeOf(fixture).toMatchTypeOf<GitHubCopilotCliMcpConfig>();
  });
});

describe('OpenAICodexMcpConfig', () => {
  it('accepts a stdio and a remote server with snake_case fields under mcp_servers', () => {
    const fixture: OpenAICodexMcpConfig = {
      mcp_servers: {
        local: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-memory'],
          env: { LOG_LEVEL: 'info' },
          env_vars: ['HOME', 'PATH'],
          startup_timeout_sec: 5,
          tool_timeout_sec: 30,
          enabled_tools: ['read_file'],
          disabled_tools: ['write_file'],
          scopes: ['mcp:read'],
          oauth_resource: 'https://mcp.example.com/oauth',
          required: false,
          enabled: true,
        },
        remote: {
          url: 'https://mcp.example.com/mcp',
          bearer_token_env_var: 'MCP_TOKEN',
          http_headers: { 'X-Codex': '1' },
          env_http_headers: { 'X-Env': '1' },
        },
      },
    };
    expectTypeOf(fixture).toMatchTypeOf<OpenAICodexMcpConfig>();
  });
});

describe('strictness', () => {
  // Strictness guard: changed TypeScript files in this PR must not contain
  // `@ts-expect-error`, `@ts-ignore`, `: any`, or `as any`. The list is
  // explicit so adding a new agent is an intentional change that must be
  // appended here.
  const strictPaths = [
    'claude-code.ts',
    'opencode.ts',
    'github-copilot-cli.ts',
    'openai-codex.ts',
  ];

  // Composed from fragments so the spec file itself does not contain the
  // forbidden patterns. The spec file is intentionally excluded from the
  // strictness list because it must reference the forbidden patterns to
  // test for them.
  const forbidden = /@ts-expect-error|@ts-ignore|:\s*any\b|\bas\s+any\b/;

  it.each(strictPaths)('%s contains no strictness violations', (rel) => {
    const src = readFileSync(join(__dirname, rel), 'utf8');
    expect(src).not.toMatch(forbidden);
  });
});
