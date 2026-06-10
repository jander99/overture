// Cursor agent definition.
import { parseJsoncMcpServerMap } from './parse-mcp-servers.js';
import { defaultMcpWriteHandler, notImplementedMcpHandlers } from './types.js';
import type {
  AgentDefinition,
  AgentMcpParseServersHandler,
  McpServerMap,
  PermissiveConfigObject,
  StandardMcpConfig,
  StandardMcpServer,
  AgentMcpReadResult,
} from './types.js';

import { readAgentMcpConfig } from './read-mcp-config.js';
import type { PathResolutionContext } from './types.js';
export const parseCursorMcpServers: AgentMcpParseServersHandler = (
  resolvedPath,
) => parseJsoncMcpServerMap(resolvedPath, 'mcpServers');

export const cursor: AgentDefinition = {
  id: 'cursor',
  displayName: 'Cursor',
  installMarkers: [
    {
      id: 'cursor-1-home-mcp',
      kind: 'file',
      base: 'home',
      relativePath: '.cursor/mcp.json',
      confidence: 'high',
      reason: 'User-global Cursor MCP configuration',
    },
    {
      id: 'cursor-2-project-mcp',
      kind: 'file',
      base: 'workspace',
      relativePath: '.cursor/mcp.json',
      confidence: 'high',
      reason: 'Project-level Cursor MCP configuration',
    },
  ],
  mcpLocations: [
    {
      scope: 'user',
      base: 'home',
      relativePath: '.cursor/mcp.json',
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'User-global MCP servers',
    },
    {
      scope: 'project',
      base: 'workspace',
      relativePath: '.cursor/mcp.json',
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'Project-level MCP servers',
    },
  ],
  defaultConfidence: 'high',
  detectionStrategy: 'marker-only',
  mcpSupport: 'supported',
  executableNames: ['cursor'],
  mcp: {
    read: (ctx) => readAgentMcpConfig(cursor, ctx),
    write: defaultMcpWriteHandler('cursor'),
    parseServers: parseCursorMcpServers,
  },
};

/**
 * Cursor-specific server extension. Both stdio and remote servers may
 * carry static OAuth-like credentials under `auth`; stdio servers may
 * also point at a dotenv-style `envFile` whose entries are merged into
 * `env`. Built on top of `StandardMcpServer` so the stdio/remote
 * union and permissive index signature are inherited.
 */
export type CursorServerExtension = Readonly<{
  /** Path to a dotenv-style env file whose entries are merged into `env` (stdio only). */
  readonly envFile?: string;
  /** Static OAuth-like credentials: `CLIENT_ID`, `CLIENT_SECRET`, optional `scopes`, plus an open index signature. */
  readonly auth?: CursorAuth;
}>;

/** Permissive object that exposes the documented Cursor auth keys and permits arbitrary additional fields. */
export type CursorAuth = PermissiveConfigObject & {
  readonly CLIENT_ID?: string;
  readonly CLIENT_SECRET?: string;
  readonly scopes?: readonly string[];
};

/** Native Cursor MCP config: `mcpServers` map; servers may be stdio (with `command`/`args`/`env`) or remote (with `url`/`headers`). */
export type CursorMcpConfig = StandardMcpConfig<CursorServerExtension>;

/** Re-export of the per-server type (preserves the old `CursorMcpServer` name for downstream imports). */
export type CursorMcpServer = StandardMcpServer<CursorServerExtension>;

/** Re-export of the stdio server shape. */
export type CursorStdioServer = StandardMcpServer<CursorServerExtension>;

/** Re-export of the remote server shape. */
export type CursorRemoteServer = StandardMcpServer<CursorServerExtension>;

/**
 * Read the agent's MCP config into the typed `CursorMcpConfig` shape.
 * Thin wrapper over `readAgentMcpConfig` that casts the unknown document
 * to the agent's typed config. Returns the same `AgentMcpReadResult` shape
 * as `cursor.mcp.read`, but with the generic `config` field
 * narrowed to `CursorMcpConfig | null`.
 */
export async function readCursorMcpConfig(
  ctx: PathResolutionContext,
): Promise<AgentMcpReadResult<CursorMcpConfig>> {
  return readAgentMcpConfig(cursor, ctx) as Promise<
    AgentMcpReadResult<CursorMcpConfig>
  >;
}
