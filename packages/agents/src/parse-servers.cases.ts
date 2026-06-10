/**
 * Typed fixture table for the per-agent `parse<Name>McpServers` test
 * suite. One row per (agent, scenario) pair. The consolidated spec
 * (`./parse-servers.spec.ts`) iterates this table with `it.each` to
 * drive real-filesystem tests via a single `mkdtempSync` / `writeFileSync`
 * scaffold.
 *
 * Adding a new per-agent parser: add a new entry here. No need to
 * create a separate `parse-servers.<id>.spec.ts` file.
 */
import { parseClaudeCodeMcpServers } from './claude-code.js';
import { parseClaudeDesktopMcpServers } from './claude-desktop.js';
import { parseClineMcpServers } from './cline.js';
import { parseContinueMcpServers } from './continue.js';
import { parseCursorMcpServers } from './cursor.js';
import { parseGitHubCopilotCliMcpServers } from './github-copilot-cli.js';
import { parseGitHubCopilotVSCodeMcpServers } from './github-copilot-vscode.js';
import { parseOpenAICodexMcpServers } from './openai-codex.js';
import { parseRooCodeMcpServers } from './roo-code.js';
import { parseWindsurfMcpServers } from './windsurf.js';
import { parseZedMcpServers } from './zed.js';
import type { AgentMcpParseServersHandler, McpServerEntry } from './types.js';

export interface ParseServersCase {
  readonly agentId: string;
  readonly description: string;
  readonly parser: AgentMcpParseServersHandler;
  readonly fileName: string;
  readonly contents: string;
  readonly expected: readonly McpServerEntry[];
}

/**
 * Per-agent parseServers test cases. Every test case from the
 * pre-consolidation `parse-servers.*.spec.ts` files is preserved
 * here. Order roughly follows `AGENT_REGISTRY_ORDER`.
 */
export const parseServersCases: readonly ParseServersCase[] = [
  // ── claude-code ──────────────────────────────────────────────────
  {
    agentId: 'claude-code',
    description: 'extracts a local stdio server',
    parser: parseClaudeCodeMcpServers,
    fileName: 'local.json',
    contents: JSON.stringify({
      mcpServers: { shared: { command: '/path/to/server', args: [], env: {} } },
    }),
    expected: [
      { name: 'shared', transport: 'local', command: ['/path/to/server'] },
    ],
  },
  {
    agentId: 'claude-code',
    description: 'extracts a remote HTTP server with headers',
    parser: parseClaudeCodeMcpServers,
    fileName: 'remote.json',
    contents: JSON.stringify({
      mcpServers: {
        remote: {
          type: 'http',
          url: 'https://mcp.example.com/mcp',
          headers: { Authorization: 'Bearer ${MCP_TOKEN}' },
        },
      },
    }),
    expected: [
      {
        name: 'remote',
        transport: 'remote',
        url: 'https://mcp.example.com/mcp',
      },
    ],
  },
  {
    agentId: 'claude-code',
    description: 'returns [] for a missing file',
    parser: parseClaudeCodeMcpServers,
    fileName: '/no/such/file',
    contents: '',
    expected: [],
  },
  {
    agentId: 'claude-code',
    description: 'returns [] for malformed JSON',
    parser: parseClaudeCodeMcpServers,
    fileName: 'bad.json',
    contents: '{ not valid',
    expected: [],
  },
  {
    agentId: 'claude-code',
    description: 'returns [] when the top-level key is absent',
    parser: parseClaudeCodeMcpServers,
    fileName: 'nokey.json',
    contents: JSON.stringify({ other: {} }),
    expected: [],
  },

  // ── claude-desktop ───────────────────────────────────────────────
  {
    agentId: 'claude-desktop',
    description: 'parses local-only npx servers',
    parser: parseClaudeDesktopMcpServers,
    fileName: 'claude_desktop_config.json',
    contents: JSON.stringify({
      mcpServers: {
        filesystem: { command: 'npx', args: ['-y', '@mcp/server-fs'] },
      },
    }),
    expected: [
      {
        name: 'filesystem',
        transport: 'local',
        command: ['npx', '-y', '@mcp/server-fs'],
      },
    ],
  },
  {
    agentId: 'claude-desktop',
    description: 'infers a remote server from a url field',
    parser: parseClaudeDesktopMcpServers,
    fileName: 'remote.json',
    contents: JSON.stringify({
      mcpServers: { remote: { url: 'https://mcp.example.com/mcp' } },
    }),
    expected: [
      {
        name: 'remote',
        transport: 'remote',
        url: 'https://mcp.example.com/mcp',
      },
    ],
  },
  {
    agentId: 'claude-desktop',
    description: 'returns [] for a missing file',
    parser: parseClaudeDesktopMcpServers,
    fileName: '/no/such/file',
    contents: '',
    expected: [],
  },
  {
    agentId: 'claude-desktop',
    description: 'returns [] for malformed JSON',
    parser: parseClaudeDesktopMcpServers,
    fileName: 'bad.json',
    contents: '{"mcpServers": {',
    expected: [],
  },
  {
    agentId: 'claude-desktop',
    description: 'returns [] when the top-level key is absent',
    parser: parseClaudeDesktopMcpServers,
    fileName: 'nokey.json',
    contents: JSON.stringify({ other: {} }),
    expected: [],
  },

  // ── cline ────────────────────────────────────────────────────────
  {
    agentId: 'cline',
    description: 'parses a local stdio server',
    parser: parseClineMcpServers,
    fileName: 'mcp.json',
    contents: JSON.stringify({
      mcpServers: { fs: { command: 'npx', args: ['-y', 'fs-server'] } },
    }),
    expected: [
      { name: 'fs', transport: 'local', command: ['npx', '-y', 'fs-server'] },
    ],
  },
  {
    agentId: 'cline',
    description: 'returns [] for a missing file',
    parser: parseClineMcpServers,
    fileName: '/no/such/file',
    contents: '',
    expected: [],
  },
  {
    agentId: 'cline',
    description: 'returns [] for malformed JSON',
    parser: parseClineMcpServers,
    fileName: 'bad.json',
    contents: '{ not valid',
    expected: [],
  },
  {
    agentId: 'cline',
    description: 'returns [] when the top-level key is absent',
    parser: parseClineMcpServers,
    fileName: 'nokey.json',
    contents: JSON.stringify({ other: {} }),
    expected: [],
  },

  {
    agentId: 'cline',
    description: 'extracts a remote server with explicit transportType',
    parser: parseClineMcpServers,
    fileName: 'remote.json',
    contents: JSON.stringify({
      mcpServers: {
        remote: { transportType: 'http', url: 'https://mcp.example.com/mcp' },
      },
    }),
    expected: [
      {
        name: 'remote',
        transport: 'remote',
        url: 'https://mcp.example.com/mcp',
      },
    ],
  },

  // ── continue (YAML/JSON dispatch by file extension) ──────────────
  {
    agentId: 'continue',
    description: 'parses a YAML list of local servers (.yaml standalone)',
    parser: parseContinueMcpServers,
    fileName: 'playwright.yaml',
    contents: `
name: playwright-mcp
version: 0.0.1
schema: v1
mcpServers:
  - name: playwright
    command: npx
    args:
      - -y
      - '@microsoft/mcp-server-playwright'
`,
    expected: [
      {
        name: 'playwright',
        transport: 'local',
        command: ['npx', '-y', '@microsoft/mcp-server-playwright'],
      },
    ],
  },
  {
    agentId: 'continue',
    description: 'parses a YAML list of remote servers (.yml)',
    parser: parseContinueMcpServers,
    fileName: 'remote.yml',
    contents: `
name: remote-mcp
schema: v1
mcpServers:
  - name: remote-server
    type: streamable-http
    url: https://mcp.example.com/mcp
`,
    expected: [
      {
        name: 'remote-server',
        transport: 'remote',
        url: 'https://mcp.example.com/mcp',
      },
    ],
  },
  {
    agentId: 'continue',
    description: 'parses a JSON file (JSON fallback by extension)',
    parser: parseContinueMcpServers,
    fileName: 'mcp.json',
    contents: JSON.stringify({
      mcpServers: { fs: { command: 'npx', args: ['-y', 'fs-server'] } },
    }),
    expected: [
      { name: 'fs', transport: 'local', command: ['npx', '-y', 'fs-server'] },
    ],
  },
  {
    agentId: 'continue',
    description: 'returns [] for malformed YAML',
    parser: parseContinueMcpServers,
    fileName: 'bad.yaml',
    contents: 'name: [unterminated: : :',
    expected: [],
  },
  {
    agentId: 'continue',
    description: 'returns [] for malformed JSON',
    parser: parseContinueMcpServers,
    fileName: 'mcp.json',
    contents: '{ not valid',
    expected: [],
  },
  {
    agentId: 'continue',
    description: 'returns [] for a missing file',
    parser: parseContinueMcpServers,
    fileName: '/no/such/file',
    contents: '',
    expected: [],
  },

  // ── cursor ───────────────────────────────────────────────────────
  {
    agentId: 'cursor',
    description: 'returns local-only servers',
    parser: parseCursorMcpServers,
    fileName: 'local.json',
    contents: JSON.stringify({
      mcpServers: { fs: { command: 'npx', args: ['-y', 'server-fs'] } },
    }),
    expected: [
      { name: 'fs', transport: 'local', command: ['npx', '-y', 'server-fs'] },
    ],
  },
  {
    agentId: 'cursor',
    description: 'returns remote-only servers inferred from url',
    parser: parseCursorMcpServers,
    fileName: 'remote.json',
    contents: JSON.stringify({
      mcpServers: { gh: { url: 'https://api.githubcopilot.com/mcp' } },
    }),
    expected: [
      {
        name: 'gh',
        transport: 'remote',
        url: 'https://api.githubcopilot.com/mcp',
      },
    ],
  },
  {
    agentId: 'cursor',
    description: 'returns [] for a missing file',
    parser: parseCursorMcpServers,
    fileName: '/no/such/file',
    contents: '',
    expected: [],
  },
  {
    agentId: 'cursor',
    description: 'returns [] for malformed JSON',
    parser: parseCursorMcpServers,
    fileName: 'bad.json',
    contents: '{ not valid',
    expected: [],
  },
  {
    agentId: 'cursor',
    description: 'returns [] when the top-level key is absent',
    parser: parseCursorMcpServers,
    fileName: 'nokey.json',
    contents: JSON.stringify({ other: {} }),
    expected: [],
  },

  // ── github-copilot-cli ───────────────────────────────────────────
  {
    agentId: 'github-copilot-cli',
    description: 'parses a local stdio server with command + args',
    parser: parseGitHubCopilotCliMcpServers,
    fileName: 'mcp-config.json',
    contents: JSON.stringify({
      mcpServers: { fs: { command: 'npx', args: ['-y', 'fs-server'] } },
    }),
    expected: [
      { name: 'fs', transport: 'local', command: ['npx', '-y', 'fs-server'] },
    ],
  },
  {
    agentId: 'github-copilot-cli',
    description: 'infers remote from url',
    parser: parseGitHubCopilotCliMcpServers,
    fileName: 'remote.json',
    contents: JSON.stringify({
      mcpServers: { gh: { url: 'https://api.githubcopilot.com/mcp' } },
    }),
    expected: [
      {
        name: 'gh',
        transport: 'remote',
        url: 'https://api.githubcopilot.com/mcp',
      },
    ],
  },
  {
    agentId: 'github-copilot-cli',
    description: 'returns [] for a missing file',
    parser: parseGitHubCopilotCliMcpServers,
    fileName: '/no/such/file',
    contents: '',
    expected: [],
  },
  {
    agentId: 'github-copilot-cli',
    description: 'returns [] for malformed JSON',
    parser: parseGitHubCopilotCliMcpServers,
    fileName: 'bad.json',
    contents: '{ not valid',
    expected: [],
  },
  {
    agentId: 'github-copilot-cli',
    description: 'returns [] when the top-level key is absent',
    parser: parseGitHubCopilotCliMcpServers,
    fileName: 'nokey.json',
    contents: JSON.stringify({ other: {} }),
    expected: [],
  },

  {
    agentId: 'github-copilot-cli',
    description: 'extracts a remote server with type=http',
    parser: parseGitHubCopilotCliMcpServers,
    fileName: 'remote.json',
    contents: JSON.stringify({
      mcpServers: {
        remote: { type: 'http', url: 'https://mcp.example.com/mcp' },
      },
    }),
    expected: [
      {
        name: 'remote',
        transport: 'remote',
        url: 'https://mcp.example.com/mcp',
      },
    ],
  },
  {
    agentId: 'github-copilot-cli',
    description: 'extracts a mixed local+remote config',
    parser: parseGitHubCopilotCliMcpServers,
    fileName: 'mixed.json',
    contents: JSON.stringify({
      mcpServers: {
        fs: { type: 'local', command: 'npx', args: ['-y', 'fs-server'] },
        gh: { type: 'http', url: 'https://api.githubcopilot.com/mcp' },
      },
    }),
    expected: [
      { name: 'fs', transport: 'local', command: ['npx', '-y', 'fs-server'] },
      {
        name: 'gh',
        transport: 'remote',
        url: 'https://api.githubcopilot.com/mcp',
      },
    ],
  },

  // ── github-copilot-vscode (top-level key is 'servers', not 'mcpServers') ─
  {
    agentId: 'github-copilot-vscode',
    description: 'parses a local stdio server (top-level key: servers)',
    parser: parseGitHubCopilotVSCodeMcpServers,
    fileName: 'mcp.json',
    contents: JSON.stringify({
      servers: { fs: { command: 'npx', args: ['-y', 'fs-server'] } },
    }),
    expected: [
      { name: 'fs', transport: 'local', command: ['npx', '-y', 'fs-server'] },
    ],
  },
  {
    agentId: 'github-copilot-vscode',
    description: 'returns [] for a missing file',
    parser: parseGitHubCopilotVSCodeMcpServers,
    fileName: '/no/such/file',
    contents: '',
    expected: [],
  },
  {
    agentId: 'github-copilot-vscode',
    description: 'returns [] for malformed JSON',
    parser: parseGitHubCopilotVSCodeMcpServers,
    fileName: 'bad.json',
    contents: '{ not valid',
    expected: [],
  },
  {
    agentId: 'github-copilot-vscode',
    description: 'returns [] when the top-level key is absent',
    parser: parseGitHubCopilotVSCodeMcpServers,
    fileName: 'nokey.json',
    contents: JSON.stringify({ other: {} }),
    expected: [],
  },

  {
    agentId: 'github-copilot-vscode',
    description:
      'extracts a remote HTTP server from the `servers` top-level key',
    parser: parseGitHubCopilotVSCodeMcpServers,
    fileName: 'remote.json',
    contents: JSON.stringify({
      servers: { remote: { type: 'http', url: 'https://mcp.example.com/mcp' } },
    }),
    expected: [
      {
        name: 'remote',
        transport: 'remote',
        url: 'https://mcp.example.com/mcp',
      },
    ],
  },
  {
    agentId: 'github-copilot-vscode',
    description: 'returns [] when the file has mcpServers instead of servers',
    parser: parseGitHubCopilotVSCodeMcpServers,
    fileName: 'wrongkey.json',
    contents: JSON.stringify({
      mcpServers: { fs: { command: 'npx', args: ['-y', 'fs-server'] } },
    }),
    expected: [],
  },

  // ── openai-codex (TOML, top-level key: mcp_servers) ──────────────
  {
    agentId: 'openai-codex',
    description: 'parses a TOML config (top-level key: mcp_servers)',
    parser: parseOpenAICodexMcpServers,
    fileName: 'config.toml',
    contents: `
[mcp_servers.fs]
command = "npx"
args = ["-y", "fs-server"]
`,
    expected: [
      { name: 'fs', transport: 'local', command: ['npx', '-y', 'fs-server'] },
    ],
  },
  {
    agentId: 'openai-codex',
    description: 'returns [] for a missing file',
    parser: parseOpenAICodexMcpServers,
    fileName: '/no/such/file',
    contents: '',
    expected: [],
  },
  {
    agentId: 'openai-codex',
    description: 'returns [] for malformed TOML',
    parser: parseOpenAICodexMcpServers,
    fileName: 'bad.toml',
    contents: '[mcp_servers\ncommand = ',
    expected: [],
  },
  {
    agentId: 'openai-codex',
    description: 'returns [] when the top-level key is absent',
    parser: parseOpenAICodexMcpServers,
    fileName: 'nokey.toml',
    contents: '',
    expected: [],
  },

  {
    agentId: 'openai-codex',
    description: 'extracts a remote server from a TOML table',
    parser: parseOpenAICodexMcpServers,
    fileName: 'remote.toml',
    contents: `
[mcp_servers.remote]
url = "https://mcp.example.com/mcp"
`,
    expected: [
      {
        name: 'remote',
        transport: 'remote',
        url: 'https://mcp.example.com/mcp',
      },
    ],
  },
  {
    agentId: 'openai-codex',
    description: 'returns [] when the [mcp_servers] table is absent',
    parser: parseOpenAICodexMcpServers,
    fileName: 'nokey.toml',
    contents: '',
    expected: [],
  },

  // ── opencode (uses shared parseOpenCodeMcpServerMap directly) ─────
  // The per-agent opencode spec still exists separately because
  // opencode uses the shared helper directly (no parse<Name> wrapper).

  // ── roo-code ─────────────────────────────────────────────────────
  {
    agentId: 'roo-code',
    description: 'parses a local stdio server',
    parser: parseRooCodeMcpServers,
    fileName: 'mcp.json',
    contents: JSON.stringify({
      mcpServers: { fs: { command: 'npx', args: ['-y', 'fs-server'] } },
    }),
    expected: [
      { name: 'fs', transport: 'local', command: ['npx', '-y', 'fs-server'] },
    ],
  },
  {
    agentId: 'roo-code',
    description: 'returns [] for a missing file',
    parser: parseRooCodeMcpServers,
    fileName: '/no/such/file',
    contents: '',
    expected: [],
  },
  {
    agentId: 'roo-code',
    description: 'returns [] for malformed JSON',
    parser: parseRooCodeMcpServers,
    fileName: 'bad.json',
    contents: '{ not valid',
    expected: [],
  },
  {
    agentId: 'roo-code',
    description: 'returns [] when the top-level key is absent',
    parser: parseRooCodeMcpServers,
    fileName: 'nokey.json',
    contents: JSON.stringify({ other: {} }),
    expected: [],
  },

  {
    agentId: 'roo-code',
    description: 'extracts a local stdio server (ignores the policy extras)',
    parser: parseRooCodeMcpServers,
    fileName: 'local.json',
    contents: JSON.stringify({
      mcpServers: {
        fs: {
          command: 'npx',
          args: ['-y', 'fs-server'],
          alwaysAllow: ['read_file'],
          watchPaths: ['/tmp'],
          disabledTools: ['write_file'],
          timeout: 30,
        },
      },
    }),
    expected: [
      { name: 'fs', transport: 'local', command: ['npx', '-y', 'fs-server'] },
    ],
  },
  {
    agentId: 'roo-code',
    description: 'extracts a remote streamable-http server',
    parser: parseRooCodeMcpServers,
    fileName: 'remote.json',
    contents: JSON.stringify({
      mcpServers: {
        remote: {
          type: 'streamable-http',
          url: 'https://mcp.example.com/mcp',
        },
      },
    }),
    expected: [
      {
        name: 'remote',
        transport: 'remote',
        url: 'https://mcp.example.com/mcp',
      },
    ],
  },

  // ── windsurf (serverUrl alias for remote) ────────────────────────
  {
    agentId: 'windsurf',
    description: 'parses a local stdio server',
    parser: parseWindsurfMcpServers,
    fileName: 'mcp_config.json',
    contents: JSON.stringify({
      mcpServers: { fs: { command: 'npx', args: ['-y', 'fs-server'] } },
    }),
    expected: [
      { name: 'fs', transport: 'local', command: ['npx', '-y', 'fs-server'] },
    ],
  },
  {
    agentId: 'windsurf',
    description: 'accepts serverUrl as a remote alias for url',
    parser: parseWindsurfMcpServers,
    fileName: 'remote.json',
    contents: JSON.stringify({
      mcpServers: { gh: { serverUrl: 'https://api.githubcopilot.com/mcp' } },
    }),
    expected: [
      {
        name: 'gh',
        transport: 'remote',
        url: 'https://api.githubcopilot.com/mcp',
      },
    ],
  },
  {
    agentId: 'windsurf',
    description: 'returns [] for a missing file',
    parser: parseWindsurfMcpServers,
    fileName: '/no/such/file',
    contents: '',
    expected: [],
  },
  {
    agentId: 'windsurf',
    description: 'returns [] for malformed JSON',
    parser: parseWindsurfMcpServers,
    fileName: 'bad.json',
    contents: '{ not valid',
    expected: [],
  },
  {
    agentId: 'windsurf',
    description: 'returns [] when the top-level key is absent',
    parser: parseWindsurfMcpServers,
    fileName: 'nokey.json',
    contents: JSON.stringify({ other: {} }),
    expected: [],
  },

  {
    agentId: 'windsurf',
    description: 'extracts local stdio servers (filesystem + memory)',
    parser: parseWindsurfMcpServers,
    fileName: 'multi.json',
    contents: JSON.stringify({
      mcpServers: {
        filesystem: { command: 'npx', args: ['-y', '@mcp/server-fs'] },
        memory: { command: 'npx', args: ['-y', '@mcp/server-memory'] },
      },
    }),
    expected: [
      {
        name: 'filesystem',
        transport: 'local',
        command: ['npx', '-y', '@mcp/server-fs'],
      },
      {
        name: 'memory',
        transport: 'local',
        command: ['npx', '-y', '@mcp/server-memory'],
      },
    ],
  },

  // ── zed (top-level key: context_servers) ─────────────────────────
  {
    agentId: 'zed',
    description: 'parses a local stdio server (top-level key: context_servers)',
    parser: parseZedMcpServers,
    fileName: 'settings.json',
    contents: JSON.stringify({
      context_servers: { fs: { command: 'npx', args: ['-y', 'fs-server'] } },
    }),
    expected: [
      { name: 'fs', transport: 'local', command: ['npx', '-y', 'fs-server'] },
    ],
  },
  {
    agentId: 'zed',
    description: 'returns [] for a missing file',
    parser: parseZedMcpServers,
    fileName: '/no/such/file',
    contents: '',
    expected: [],
  },
  {
    agentId: 'zed',
    description: 'returns [] for malformed JSON',
    parser: parseZedMcpServers,
    fileName: 'bad.json',
    contents: '{ not valid',
    expected: [],
  },
  {
    agentId: 'zed',
    description: 'returns [] when the top-level key is absent',
    parser: parseZedMcpServers,
    fileName: 'nokey.json',
    contents: JSON.stringify({ other: {} }),
    expected: [],
  },

  {
    agentId: 'zed',
    description:
      'extracts a remote server (inferred from url since Zed has no type field)',
    parser: parseZedMcpServers,
    fileName: 'remote.json',
    contents: JSON.stringify({
      context_servers: { remote: { url: 'https://mcp.example.com/mcp' } },
    }),
    expected: [
      {
        name: 'remote',
        transport: 'remote',
        url: 'https://mcp.example.com/mcp',
      },
    ],
  },
  {
    agentId: 'zed',
    description:
      'returns [] when the top-level key is mcpServers instead of context_servers',
    parser: parseZedMcpServers,
    fileName: 'wrongkey.json',
    contents: JSON.stringify({
      mcpServers: { fs: { command: 'npx', args: ['-y', 'fs-server'] } },
    }),
    expected: [],
  },
];
