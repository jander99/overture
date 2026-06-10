// Per-agent MCP config type-contract tests.
//
// This suite is a compile-time + registry-absence contract; it does NOT read
// or write MCP files. Each supported agent exports a `*McpConfig` type that
// is consumed by at least one `satisfies` fixture below so the strict-mode
// `noUnusedLocals` rule does not flag the imports. Unsupported/no-local-read
// agents must NOT export a `*McpConfig` type; that absence is asserted at
// runtime by the file-content greps in the `unsupported-agent absence`
// describe block. Changed-file strictness (`@ts-expect-error`/`: any`)
// is asserted at runtime by the `strictness` describe block.
import { describe, it, expect, expectTypeOf } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ClaudeCodeMcpConfig } from './claude-code.js';
import type { ClaudeDesktopMcpConfig } from './claude-desktop.js';
import type { OpenCodeMcpConfig } from './opencode.js';
import type { GitHubCopilotVSCodeMcpConfig } from './github-copilot-vscode.js';
import type { GitHubCopilotCliMcpConfig } from './github-copilot-cli.js';
import type { CursorMcpConfig } from './cursor.js';
import type { WindsurfMcpConfig } from './windsurf.js';
import type { ClineMcpConfig } from './cline.js';
import type { RooCodeMcpConfig } from './roo-code.js';
import type { ContinueMcpConfig, ContinueYamlMcpConfig } from './continue.js';
import type { ZedMcpConfig } from './zed.js';
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

describe('ClaudeDesktopMcpConfig', () => {
  it('accepts a stdio-only server', () => {
    const fixture: ClaudeDesktopMcpConfig = {
      mcpServers: {
        memory: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-memory'],
          env: { LOG_LEVEL: 'info' },
        },
      },
    };
    expectTypeOf(fixture).toMatchTypeOf<ClaudeDesktopMcpConfig>();
  });
});

describe('CursorMcpConfig', () => {
  it('accepts a stdio server with envFile and static auth', () => {
    const fixture: CursorMcpConfig = {
      mcpServers: {
        'local-server': {
          command: 'node',
          args: ['server.js'],
          env: { NODE_ENV: 'production' },
          envFile: '/etc/cursor/mcp.env',
          auth: {
            CLIENT_ID: 'cursor-client',
            CLIENT_SECRET: 'cursor-secret',
            scopes: ['mcp:read', 'mcp:write'],
          },
        },
      },
    };
    expectTypeOf(fixture).toMatchTypeOf<CursorMcpConfig>();
  });
});

describe('WindsurfMcpConfig', () => {
  it('accepts a stdio server and a remote server with both url and serverUrl', () => {
    const fixture: WindsurfMcpConfig = {
      mcpServers: {
        local: { command: 'npx', args: ['-y', 'mcp-server-fetch'] },
        remote: {
          url: 'https://mcp.example.com/mcp',
          serverUrl: 'https://mcp.example.com/mcp',
          headers: { 'X-Windsurf': '1' },
        },
      },
    };
    expectTypeOf(fixture).toMatchTypeOf<WindsurfMcpConfig>();
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

describe('GitHubCopilotVSCodeMcpConfig', () => {
  it('accepts inputs plus a remote server with oauth and requestInit', () => {
    const fixture: GitHubCopilotVSCodeMcpConfig = {
      inputs: [
        {
          id: 'github-token',
          type: 'promptString',
          description: 'GitHub PAT',
          password: true,
        },
      ],
      servers: {
        github: {
          type: 'http',
          url: 'https://api.githubcopilot.com/mcp/',
          headers: { Authorization: 'Bearer ${input:github-token}' },
          oauth: false,
          requestInit: { headers: { 'X-Test': '1' } },
        },
      },
    };
    expectTypeOf(fixture).toMatchTypeOf<GitHubCopilotVSCodeMcpConfig>();
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

describe('ClineMcpConfig', () => {
  it('accepts a server with autoApprove and streamableHttp transport', () => {
    const fixture: ClineMcpConfig = {
      mcpServers: {
        fetch: {
          command: 'npx',
          args: ['-y', 'mcp-server-fetch'],
          env: { DEBUG: '1' },
          transportType: 'streamableHttp',
          url: 'https://example.com/sse',
          autoApprove: ['fetch'],
        },
      },
    };
    expectTypeOf(fixture).toMatchTypeOf<ClineMcpConfig>();
  });
});

describe('RooCodeMcpConfig', () => {
  it('accepts a server with alwaysAllow, watchPaths, and disabledTools', () => {
    const fixture: RooCodeMcpConfig = {
      mcpServers: {
        playwright: {
          command: 'npx',
          args: ['-y', '@microsoft/mcp-server-playwright'],
          env: { DEBUG: '0' },
          alwaysAllow: ['browser_navigate'],
          timeout: 60,
          watchPaths: ['/tmp/playwright'],
          disabledTools: ['browser_screenshot'],
        },
      },
    };
    expectTypeOf(fixture).toMatchTypeOf<RooCodeMcpConfig>();
  });
});

describe('ContinueMcpConfig', () => {
  it('accepts a standalone YAML-style config', () => {
    const yamlFixture: ContinueYamlMcpConfig = {
      name: 'playwright-mcp',
      version: '0.0.1',
      schema: 'v1',
      mcpServers: [
        {
          name: 'playwright',
          command: 'npx',
          args: ['-y', '@microsoft/mcp-server-playwright'],
        },
      ],
    };
    const asUnion: ContinueMcpConfig = yamlFixture;
    expectTypeOf(asUnion).toMatchTypeOf<ContinueMcpConfig>();
  });

  it('accepts an imported-JSON-style config (ClaudeCodeMcpConfig shape)', () => {
    const jsonFixture = {
      mcpServers: {
        'imported-server': {
          command: 'npx',
          args: ['-y', 'mcp-server'],
        },
      },
    };
    const asUnion: ContinueMcpConfig = jsonFixture;
    expectTypeOf(asUnion).toMatchTypeOf<ContinueMcpConfig>();
  });
});

describe('ZedMcpConfig', () => {
  it('accepts a stdio and a remote server under context_servers', () => {
    const fixture: ZedMcpConfig = {
      context_servers: {
        local: {
          command: 'npx',
          args: ['-y', 'mcp-server-fetch'],
          env: { DEBUG: '1' },
        },
        remote: {
          url: 'https://mcp.example.com/mcp',
          headers: { 'X-Zed': '1' },
        },
      },
    };
    expectTypeOf(fixture).toMatchTypeOf<ZedMcpConfig>();
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

describe('unsupported-agent absence', () => {
  // The two agents that should NOT have an `*McpConfig` export are read
  // as plain text; any future addition of `AiderMcpConfig` or
  // `GitHubCopilotCloudAgentMcpConfig` will surface here.
  const agentsDir = join(__dirname);

  it('aider.ts does not export AiderMcpConfig', () => {
    const src = readFileSync(join(agentsDir, 'aider.ts'), 'utf8');
    expect(src).not.toMatch(/AiderMcpConfig/);
  });

  it('github-copilot-cloud-agent.ts does not export GitHubCopilotCloudAgentMcpConfig', () => {
    const src = readFileSync(
      join(agentsDir, 'github-copilot-cloud-agent.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/GitHubCopilotCloudAgentMcpConfig/);
  });
});

describe('strictness', () => {
  // Strictness guard: changed TypeScript files in this PR must not contain
  // `@ts-expect-error`, `@ts-ignore`, `: any`, or `as any`. The list is

  // change must be appended here intentionally.
  const strictPaths = [
    'claude-code.ts',
    'claude-desktop.ts',
    'opencode.ts',
    'github-copilot-vscode.ts',
    'github-copilot-cli.ts',
    'cursor.ts',
    'windsurf.ts',
    'cline.ts',
    'roo-code.ts',
    'continue.ts',
    'zed.ts',
    'openai-codex.ts',
  ];

  // Composed from fragments so the spec file itself does not contain the
  // The spec file itself is intentionally excluded from the strictness
  // list because it must reference the forbidden patterns to test for them.
  const forbidden = /@ts-expect-error|@ts-ignore|:\s*any\b|\bas\s+any\b/;

  it.each(strictPaths)('%s contains no strictness violations', (rel) => {
    const src = readFileSync(join(__dirname, rel), 'utf8');
    expect(src).not.toMatch(forbidden);
  });
});
