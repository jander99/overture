// Windsurf agent definition.
import { parseJsoncMcpServerMap } from './parse-mcp-servers.js';
import { defaultMcpWriteHandler, notImplementedMcpHandlers } from './types.js';
import type {
  AgentDefinition,
  AgentMcpParseServersHandler,
  AgentMcpReadResult,
  McpServerMap,
  PermissiveConfigObject,
  RemoteServerBase,
  StdioServerBase,
} from './types.js';
import { readAgentMcpConfig } from './read-mcp-config.js';
import type { PathResolutionContext } from './types.js';

export const parseWindsurfMcpServers: AgentMcpParseServersHandler = (
  resolvedPath,
) =>
  parseJsoncMcpServerMap(resolvedPath, 'mcpServers', {
    urlFields: ['url', 'serverUrl'],
  });

export const windsurf: AgentDefinition = {
  id: 'windsurf',
  displayName: 'Windsurf',
  installMarkers: [],
  mcpLocations: [
    {
      scope: 'user',
      base: 'home',
      relativePath: '.codeium/windsurf/mcp_config.json',
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'User-global MCP servers',
    },
  ],
  defaultConfidence: 'high',
  detectionStrategy: 'binary-first',
  mcpSupport: 'supported',
  executableNames: ['windsurf'],
  mcp: {
    read: (ctx) => readAgentMcpConfig(windsurf, ctx),
    write: defaultMcpWriteHandler('windsurf'),
    parseServers: parseWindsurfMcpServers,
  },
};

/** Native Windsurf MCP config: `mcpServers` map; servers may be stdio (`command`/`args`/`env`) or remote. Per docs the remote URL may appear as either `url` or `serverUrl` depending on doc version. */

export interface WindsurfMcpConfig {
  readonly mcpServers?: McpServerMap<WindsurfMcpServer>;
}

/** Windsurf server: union of stdio and remote transports with permissive extension fields. */

export type WindsurfMcpServer = (WindsurfStdioServer | WindsurfRemoteServer) &
  PermissiveConfigObject;

/** Stdio transport: local process invocation. */

export type WindsurfStdioServer = StdioServerBase;

/** Remote transport. Windsurf docs note the URL may surface as `url` or `serverUrl`; both are accepted. */

export interface WindsurfRemoteServer extends RemoteServerBase {
  /** Alias for `url`; present in some Windsurf doc versions. */

  readonly serverUrl?: string;
}

/**
 * Read the agent's MCP config into the typed `WindsurfMcpConfig` shape.
 * Thin wrapper over `readAgentMcpConfig` that casts the unknown document
 * to the agent's typed config. Returns the same `AgentMcpReadResult` shape
 * as `windsurf.mcp.read`, but with the generic `config` field
 * narrowed to `WindsurfMcpConfig | null`.
 */
export async function readWindsurfMcpConfig(
  ctx: PathResolutionContext,
): Promise<AgentMcpReadResult<WindsurfMcpConfig>> {
  return readAgentMcpConfig(windsurf, ctx) as Promise<
    AgentMcpReadResult<WindsurfMcpConfig>
  >;
}
