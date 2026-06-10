import type {
  PathResolutionContext,
  PlatformId,
  PlatformRegistryEntry,
} from '../types.js';
import type { McpLocationFormat } from '../types.js';

/**
 * Read result for a per-agent MCP read.
 * - `config` is the typed shape (`TConfig`) when at least one applicable
 *   mcp location was found, parsed, and contained a non-empty top-level
 *   key. `null` indicates "not configured" (file missing, empty, or only
 *   parse errors).
 * - `nonEmpty` is `true` when the chosen mcp location had at least one entry
 *   under the top-level key.
 * - `parseError` is set when a file was read but unparseable.
 * - `location` records the resolved mcp location that produced the result.
 */
export interface AgentMcpReadResult<TConfig = unknown> {
  readonly config: TConfig | null;
  readonly nonEmpty: boolean;
  readonly parseError?: string;
  readonly location?: Readonly<{
    readonly resolvedPath: string;
    readonly format: McpLocationFormat;
    readonly topLevelKey?: string;
  }>;
}

/** Write input for a per-agent MCP write. Placeholder for now. */
export interface AgentMcpWriteInput {
  servers: readonly unknown[];
}

/** Write result. Placeholder for now. */
export interface AgentMcpWriteResult {
  written: number;
}

/**
 * Per-agent typed read handler. Each per-agent file can also export a
 * `read<AgentName>McpConfig(ctx: PathResolutionContext):
 * Promise<AgentMcpReadResult<<AgentName>McpConfig>>` so callers can opt
 * into the per-agent typed shape without going through the registry.
 */
export type AgentMcpReadHandlerTyped<TConfig> = (
  ctx: PathResolutionContext,
) => Promise<AgentMcpReadResult<TConfig>>;

/** Read handler signature. */
export type AgentMcpReadHandler = (
  ctx: PathResolutionContext,
) => Promise<AgentMcpReadResult<unknown>>;

/** Write handler signature. */
export type AgentMcpWriteHandler = (
  ctx: PathResolutionContext,
  input: AgentMcpWriteInput,
) => Promise<AgentMcpWriteResult>;

/** Bundled MCP handlers exposed by an agent. */
export interface AgentMcpHandlers {
  read: AgentMcpReadHandler;
  write: AgentMcpWriteHandler;
  /**
   * Optional handler that parses an agent's MCP config file and returns a
   * list of structured server entries for human-readable rendering. Each
   * agent implements this when its config format is rich enough to
   * display transport and command/URL details (opencode is the first).
   * The CLI calls this generically — no per-id string dispatch.
   */
  parseServers?: AgentMcpParseServersHandler;
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
 * Structured MCP server entry returned by an agent's `parseServers`
 * handler. The shape is intentionally transport-agnostic: `command` is
 * the argv vector for local servers; `url` is the endpoint for remote
 * servers. The CLI renders these under the `mcp:` path line in human
 * output.
 */
export interface McpServerEntry {
  readonly name: string;
  readonly transport: 'local' | 'remote';
  readonly command?: readonly string[];
  readonly url?: string;
}

/**
 * Handler signature for `AgentMcpHandlers.parseServers`. Receives the
 * resolved config file path; the agent is responsible for reading and
 * parsing the file (it knows the format and top-level key). Returns an
 * empty array on any read or parse failure (silent degradation — the
 * CLI just omits the server list).
 */
export type AgentMcpParseServersHandler = (
  resolvedPath: string,
) => readonly McpServerEntry[];

/**
 * `fetch`-style request init shape, restricted to a known `headers`
 * override plus an open index signature for additional init fields.
 */
export type RequestInitConfig = PermissiveConfigObject & {
  readonly headers?: StringMap;
};

/** Read-only string-keyed map of named MCP servers. */
export type McpServerMap<TServer> = Readonly<Record<string, TServer>>;
