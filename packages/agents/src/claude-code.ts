// Claude Code agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type {
  AgentDefinition,
  McpServerMap,
  PermissiveConfigObject,
  RemoteServerBase,
  StdioServerBase,
  StringMap,
  AgentMcpReadResult,
} from './types.js';

import { readAgentMcpConfig } from './read-mcp-config.js';
import type { PathResolutionContext } from './types.js';
export const claudeCode: AgentDefinition = {
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
    read: (ctx) => readAgentMcpConfig(claudeCode, ctx),
    write: notImplementedMcpHandlers('claude-code').write,
  },
};

/** Native Claude Code MCP config: `mcpServers` map; each server is either a stdio transport or a remote transport (HTTP / streamable-http / SSE / WebSocket). The top level may also carry a local `imports` map (Claude Code's local-imports feature). */

export interface ClaudeCodeMcpConfig {
  readonly mcpServers?: McpServerMap<ClaudeCodeMcpServer>;

  /** Local-imports map: imports named JSON files (e.g. Claude Desktop) into the active config. */

  readonly imports?: StringMap;
}

/** Discriminated by `type`; defaults to `stdio` when omitted. Carries a permissive index signature for forward-compatible extension fields. */

export type ClaudeCodeMcpServer = (
  | ClaudeCodeStdioServer
  | ClaudeCodeRemoteServer
) &
  PermissiveConfigObject;

/** Stdio transport: local process invocation. */

export interface ClaudeCodeStdioServer extends StdioServerBase {
  /** Transport discriminator. Omitted for stdio in practice; kept open to permit future variants. */
  readonly type?: string;
}

/** Remote transport: HTTP / streamable-http / SSE / WebSocket. */

export interface ClaudeCodeRemoteServer extends RemoteServerBase {
  /** Transport discriminator. Literal values include 'http', 'streamable-http', 'sse', 'ws'; unknown strings are tolerated for forward compatibility. */
  readonly type?: string;
}

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
