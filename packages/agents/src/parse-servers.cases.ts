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
import { parseGitHubCopilotCliMcpServers } from './github-copilot-cli.js';
import { parseOpenAICodexMcpServers } from './openai-codex.js';
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
];
