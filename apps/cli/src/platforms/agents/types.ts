import type {
  PathResolutionContext,
  PlatformId,
  PlatformRegistryEntry,
} from '../types.js';

/** Read result for a per-agent MCP read. Placeholder for now. */
export interface AgentMcpReadResult {
  servers: readonly unknown[];
}

/** Write input for a per-agent MCP write. Placeholder for now. */
export interface AgentMcpWriteInput {
  servers: readonly unknown[];
}

/** Write result. Placeholder for now. */
export interface AgentMcpWriteResult {
  written: number;
}

/** Read handler signature. */
export type AgentMcpReadHandler = (
  ctx: PathResolutionContext,
) => Promise<AgentMcpReadResult>;

/** Write handler signature. */
export type AgentMcpWriteHandler = (
  ctx: PathResolutionContext,
  input: AgentMcpWriteInput,
) => Promise<AgentMcpWriteResult>;

/** Bundled MCP handlers exposed by an agent. */
export interface AgentMcpHandlers {
  read: AgentMcpReadHandler;
  write: AgentMcpWriteHandler;
}

/**
 * Per-agent definition. Currently a structural extension of
 * `PlatformRegistryEntry` with a bundled `mcp` placeholder object that
 * will eventually carry the agent's MCP read/write implementation.
 */
export interface AgentDefinition extends PlatformRegistryEntry {
  readonly mcp: AgentMcpHandlers;
}

/**
 * Builds a paired set of placeholder MCP handlers that always reject
 * with an explicit "not implemented" error. Used by every migrated
 * agent in this PR; subsequent PRs will replace individual callsites
 * with real implementations.
 */
export function notImplementedMcpHandlers(
  agentId: PlatformId,
): AgentMcpHandlers {
  const message = (op: 'read' | 'write'): Error =>
    new Error(`MCP ${op} for agent '${agentId}' is not implemented yet`);
  return {
    read: () => Promise.reject(message('read')),
    write: () => Promise.reject(message('write')),
  };
}

/** JSON scalar value: string, number, boolean, or null. */
export type JsonPrimitive = string | number | boolean | null;

/** Any valid JSON value, recursively defined and readonly. */
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue | undefined };

/** Read-only string-to-string map (e.g. environment variables, HTTP headers). */
export type StringMap = Readonly<Record<string, string>>;

/** Read-only ordered list of strings (e.g. CLI argument vectors). */
export type StringList = readonly string[];

/** Read-only ordered list of tool names exposed by an MCP server. */
export type ToolList = readonly string[];

/**
 * Permissive object shape: a known set of native fields plus an open
 * string-keyed index signature of JSON values for forward compatibility
 * with undocumented or platform-specific extension fields.
 */
export type PermissiveConfigObject = Readonly<
  Record<string, JsonValue | undefined>
>;

/** Common fields shared by every stdio (subprocess) MCP server. */
export interface StdioServerBase {
  /** Absolute path or executable name resolvable via the user's PATH. */
  command: string;
  /** Command-line arguments passed to the server process. */
  args?: StringList;
  /** Environment variables injected into the server process. */
  env?: StringMap;
  /** Working directory for the server process. */
  cwd?: string;
}

/** Common fields shared by every remote (HTTP/SSE/WebSocket) MCP server. */
export interface RemoteServerBase {
  /** URL the MCP client connects to. */
  url: string;
  /** HTTP headers attached to requests made to the server. */
  headers?: StringMap;
}

/**
 * OAuth configuration: an object of arbitrary OAuth-related fields, or
 * `false` to explicitly disable OAuth for the server.
 */
export type OAuthConfig = PermissiveConfigObject | false;

/**
 * `fetch`-style request init shape, restricted to a known `headers`
 * override plus an open index signature for additional init fields.
 */
export type RequestInitConfig = PermissiveConfigObject & {
  readonly headers?: StringMap;
};

/** Read-only string-keyed map of named MCP servers. */
export type McpServerMap<TServer> = Readonly<Record<string, TServer>>;
