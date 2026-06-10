// Claude Code agent definition.
import { parseJsoncMcpServerMap } from './parse-mcp-servers.js';
import { readAgentMcpConfig } from './read-mcp-config.js';
import { defineAgent } from './define-agent.js';
import type {
  AgentDefinition,
  AgentMcpParseServersHandler,
  AgentMcpReadResult,
  NoMcpExtension,
  StandardMcpConfig,
  StandardMcpServer,
  StringMap,
} from './types.js';
import type { PathResolutionContext } from './types.js';

export const parseClaudeCodeMcpServers: AgentMcpParseServersHandler = (
  resolvedPath,
) => parseJsoncMcpServerMap(resolvedPath, 'mcpServers');

export const claudeCode: AgentDefinition = defineAgent({
  id: 'claude-code',
  displayName: 'Claude Code',
  installMarkers: [
    {
      id: 'claude-code-1-mcp-json',
      kind: 'file',
      base: 'home',
      relativePath: '.claude.json',
      confidence: 'high',
      reason: 'Primary user-global configuration file for Claude Code',
    },
    {
      id: 'claude-code-2-project-mcp-json',
      kind: 'file',
      base: 'workspace',
      relativePath: '.mcp.json',
      confidence: 'high',
      reason: 'Project-level MCP configuration file for Claude Code',
    },
  ],
  mcpLocations: [
    {
      scope: 'user',
      base: 'home',
      relativePath: '.claude.json',
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'User-global MCP servers',
    },
    {
      scope: 'project',
      base: 'workspace',
      relativePath: '.mcp.json',
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'Project-level MCP servers',
    },
  ],
  defaultConfidence: 'medium',
  detectionStrategy: 'binary-first',
  mcpSupport: 'supported',
  executableNames: ['claude'],
  mcp: {
    parseServers: parseClaudeCodeMcpServers,
  },
});

/**
 * Native Claude Code MCP config: `mcpServers` map; the top level may
 * also carry a local `imports` map (Claude Code's local-imports
 * feature). The per-server shape is the standard stdio/remote
 * union — no Claude-specific server fields beyond the imports slot.
 */
export type ClaudeCodeMcpConfig = StandardMcpConfig<
  NoMcpExtension,
  Readonly<{ readonly imports?: StringMap }>
>;

/** Per-server type — re-exported under the historical name for downstream imports. */
export type ClaudeCodeMcpServer = StandardMcpServer<NoMcpExtension>;

/** Stdio transport: local process invocation. */
export type ClaudeCodeStdioServer = StandardMcpServer<NoMcpExtension>;

/** Remote transport: HTTP / streamable-http / SSE / WebSocket. */
export type ClaudeCodeRemoteServer = StandardMcpServer<NoMcpExtension>;

/** Remote transport: HTTP / streamable-http / SSE / WebSocket. */

/**
 * Read the agent's MCP config into the typed `ClaudeCodeMcpConfig` shape.
 * Thin wrapper over `readAgentMcpConfig` that casts the unknown document
 * to the agent's typed config. Returns the same `AgentMcpReadResult` shape
 * as `claudeCode.mcp.read`, but with the generic `config` field
 * narrowed to `ClaudeCodeMcpConfig | null`.
 */
export async function readClaudeCodeMcpConfig(
  ctx: PathResolutionContext,
): Promise<AgentMcpReadResult<ClaudeCodeMcpConfig>> {
  return readAgentMcpConfig(claudeCode, ctx) as Promise<
    AgentMcpReadResult<ClaudeCodeMcpConfig>
  >;
}
