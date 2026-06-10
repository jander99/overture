// Zed agent definition.
import { parseJsoncMcpServerMap } from './parse-mcp-servers.js';
import { defaultMcpWriteHandler, notImplementedMcpHandlers } from './types.js';
import type {
  AgentDefinition,
  AgentMcpParseServersHandler,
  AgentMcpReadResult,
  McpServerMap,
  StringMap,
} from './types.js';
import { readAgentMcpConfig } from './read-mcp-config.js';
import type { PathResolutionContext } from './types.js';

export const parseZedMcpServers: AgentMcpParseServersHandler = (resolvedPath) =>
  parseJsoncMcpServerMap(resolvedPath, 'context_servers');

export const zed: AgentDefinition = {
  id: 'zed',
  displayName: 'Zed',
  installMarkers: [
    {
      id: 'zed-1-home-settings',
      kind: 'file',
      base: 'config',
      relativePath: 'zed/settings.json',
      confidence: 'medium',
      reason: 'User-global Zed settings file',
    },
  ],
  mcpLocations: [
    {
      scope: 'user',
      base: 'config',
      relativePath: 'zed/settings.json',
      format: 'json',
      topLevelKey: 'context_servers',
      notes:
        'User-global context servers (Zed refers to MCP as context servers)',
    },
    {
      scope: 'project',
      base: 'workspace',
      relativePath: '.zed/settings.json',
      format: 'json',
      topLevelKey: 'context_servers',
      notes: 'Zed folder settings (project-local)',
    },
  ],
  defaultConfidence: 'medium',
  detectionStrategy: 'marker-only',
  mcpSupport: 'supported',
  executableNames: ['zed'],
  mcp: {
    read: (ctx) => readAgentMcpConfig(zed, ctx),
    write: defaultMcpWriteHandler('zed'),
    parseServers: parseZedMcpServers,
  },
};

/**
 * Native Zed MCP config shape. Zed refers to MCP servers as
 * "context servers" and stores them under the top-level
 * `context_servers` map. Server entries are a discriminated union
 * on the presence of `command` (stdio) vs `url` (remote) - the
 * documented Zed format does not include an explicit `type` field.
 */
export interface ZedMcpConfig {
  readonly context_servers?: McpServerMap<ZedMcpServer>;
}

/** Zed server entry: union of stdio and remote transports. */
export type ZedMcpServer = ZedStdioServer | ZedRemoteServer;

/**
 * Stdio transport: a local subprocess. `command` is required; `args`
 * and `env` are optional and follow standard MCP server conventions.
 */
export interface ZedStdioServer {
  /** Absolute path or executable name resolvable via the user's PATH. */
  command: string;
  /** Command-line arguments passed to the server process. */
  args?: readonly string[];
  /** Environment variables injected into the server process. */
  env?: StringMap;
}

/**
 * Remote transport: a URL-based server (HTTP/SSE/etc). `url` is
 * required; `headers` are optional HTTP headers.
 */
export interface ZedRemoteServer {
  /** URL the MCP client connects to. */
  url: string;
  /** HTTP headers attached to requests made to the server. */
  headers?: StringMap;
}

/**
 * Read the agent's MCP config into the typed `ZedMcpConfig` shape.
 * Thin wrapper over `readAgentMcpConfig` that casts the unknown document
 * to the agent's typed config. Returns the same `AgentMcpReadResult` shape
 * as `zed.mcp.read`, but with the generic `config` field
 * narrowed to `ZedMcpConfig | null`.
 */
export async function readZedMcpConfig(
  ctx: PathResolutionContext,
): Promise<AgentMcpReadResult<ZedMcpConfig>> {
  return readAgentMcpConfig(zed, ctx) as Promise<
    AgentMcpReadResult<ZedMcpConfig>
  >;
}
