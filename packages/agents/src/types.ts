// Public @overture/agents types.
// Domain types (the registry's vocabulary) live here. The CLI imports them
// from @overture/agents. The MCP config parser is internal (not exported from
// index.ts); per-agent readers use it via the internal mcp-config-parser.
import type { HostPlatform } from '@overture/os';
import type { OvertureMcpServer } from '@overture/config';
export type { HostPlatform };

export type PlatformId =
  | 'claude-code'
  | 'opencode'
  | 'github-copilot-cli'
  | 'openai-codex';

export type DetectionConfidence = 'high' | 'medium' | 'low' | 'unsupported';
export type MarkerKind = 'file' | 'directory' | 'file-or-directory';
export type PathBase = 'home' | 'config' | 'workspace' | 'absolute';
export type McpLocationScope =
  | 'project'
  | 'user'
  | 'profile'
  | 'repository'
  | 'managed';
export type McpLocationFormat =
  | 'json'
  | 'jsonc'
  | 'yaml'
  | 'toml'
  | 'web-settings';
export type DetectionStrategy = 'binary-first' | 'marker-only';
export type McpSupport = 'supported' | 'unsupported' | 'unknown';
export type ReasonCode =
  | 'binary-found'
  | 'marker-found'
  | 'mcp-configured'
  | 'orphaned-mcp-config'
  | 'unsupported-no-local-signal'
  | 'unsupported-no-mcp-client'
  | 'not-detected'
  | 'parse-error';

export interface InstallMarker {
  id: string;
  kind: MarkerKind;
  base: PathBase;
  relativePath: string;
  platforms?: HostPlatform[];
  confidence: DetectionConfidence;
  reason: string;
}

export interface McpLocation {
  scope: McpLocationScope;
  base: PathBase;
  relativePath: string;
  platforms?: HostPlatform[];
  format: McpLocationFormat;
  topLevelKey?: string;
  notes?: string;
}

export interface MatchedExecutable {
  name: string;
  resolvedPath: string;
  source: 'path' | 'wsl' | 'windows';
}

export interface MatchedMcpLocation {
  id: string;
  resolvedPath: string;
  format: McpLocationFormat;
  topLevelKey?: string;
  nonEmpty: boolean;
  parseError?: string;
  serverNames?: readonly string[];
}

export interface PlatformRegistryEntry {
  id: PlatformId;
  displayName: string;
  installMarkers: InstallMarker[];
  mcpLocations: McpLocation[];
  defaultConfidence: DetectionConfidence;
  detectionStrategy: DetectionStrategy;
  mcpSupport: McpSupport;
  executableNames: readonly string[];
  reason?: string;
}

export interface PathResolutionContext {
  homeDir: string;
  configDir: string;
  workspaceDir: string;
  platform: HostPlatform;
}

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

/**
 * Canonical reason a per-agent MCP server entry could not be normalized to
 * `OvertureMcpServer`. The union is the contract shared by every agent's
 * `normalize` handler; the `shape-conflict` arm of `AgentNormalizedMcpServer`
 * is restricted to one of these strings so downstream renderers can surface
 * a stable, human-readable message without inspecting the agent's native shape.
 * Task 2's `NORMALIZE_SHAPE_CONFLICT_REASONS` constant re-uses this union.
 */
export type AgentMcpNormalizeReason =
  | 'Expected server entry to be an object.'
  | 'Stdio command is missing or empty.'
  | 'Remote url is missing or empty.'
  | 'Server declares both stdio command and remote url.'
  | 'Server declares neither stdio command nor remote url.'
  | 'Expected string array for args.'
  | 'Expected string map for env.'
  | 'Expected string map for headers.'
  | 'Unsupported MCP server transport type.';

/**
 * Per-agent normalized server entry. The `normalized` arm carries a canonical
 * `OvertureMcpServer` that the scan matrix compares against the canonical intent;
 * the `shape-conflict` arm carries the human-readable reason the entry could not
 * be normalized. This is the agents-local output type consumed by the scan
 * matrix; the `state` discriminant aligns with the downstream consumer so
 * scan matrix can consume the agents output as-is once the `server` field is set.
 */
export type AgentNormalizedMcpServer =
  | {
      readonly state: 'normalized';
      readonly server: OvertureMcpServer;
    }
  | {
      readonly state: 'shape-conflict';
      readonly reason: AgentMcpNormalizeReason;
    };

/**
 * Per-agent typed normalize handler. The `TConfig` type parameter is the agent's
 * native MCP config shape (e.g. `ClaudeCodeMcpConfig`); the default of `unknown`
 * matches the registry's heterogeneous non-generic slot. Per-agent normalizers
 * expose a typed variant and adapt it to `unknown` via Task 2's
 * `asRegistryNormalizeHandler<TConfig>()` helper at the call site.
 */
export type AgentMcpNormalizeHandler<TConfig = unknown> = (
  input: AgentMcpReadResult<TConfig>,
) => Readonly<Record<string, AgentNormalizedMcpServer>>;

/**
 * Bundled MCP handlers exposed by an agent.
 *
 * `read` is always required. `write` is optional on the input shape
 * so `defineAgent()` can fill in the shared default; the exported
 * `AgentDefinition.mcp` always carries a complete (non-optional)
 * `write` handler (see `CompleteAgentMcpHandlers`).
 */
export interface AgentMcpHandlers {
  read: AgentMcpReadHandler;
  write?: AgentMcpWriteHandler;
  /**
   * Optional handler that parses an agent's MCP config file and returns a
   * list of structured server entries for human-readable rendering. Each
   * agent implements this when its config format is rich enough to
   * display transport and command/URL details (opencode is the first).
   * The CLI calls this generically — no per-id string dispatch.
   */
  parseServers?: AgentMcpParseServersHandler;
  /**
   * Optional handler that converts an agent's native MCP config into the
   * normalized `OvertureMcpServer` shape the scan matrix consumes. Agents
   * whose native schema is rich enough to express every canonical field wire a
   * typed normalizer; agents whose shape is too narrow omit it and rely on the
   * shared "no entry" behavior. The CLI invokes this through the registry's
   * non-generic `AgentMcpNormalizeHandler<unknown>` slot, so per-agent
   * normalizers expose a typed variant and adapt it at the call site (Task 2
   * introduces `asRegistryNormalizeHandler`).
   */
  normalize?: AgentMcpNormalizeHandler<unknown>;
}

/** Complete (non-optional) MCP handlers, as exposed on every exported `AgentDefinition`. */
export type CompleteAgentMcpHandlers = AgentMcpHandlers & {
  write: AgentMcpWriteHandler;
};

/**
 * Per-agent definition. Currently a structural extension of
 * `PlatformRegistryEntry` with a bundled `mcp` placeholder object that
 * will eventually carry the agent's MCP read/write implementation.
 */
export interface AgentDefinition extends PlatformRegistryEntry {
  readonly mcp: CompleteAgentMcpHandlers;
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

/**
 * Shared placeholder write handler that always rejects with the
 * canonical "not implemented" error. Mirrors the error text produced
 * by `notImplementedMcpHandlers(agentId).write` so consumers see the
 * same message regardless of which path built the agent definition.
 */
export function defaultMcpWriteHandler(
  agentId: PlatformId,
): AgentMcpWriteHandler {
  return () =>
    Promise.reject(
      new Error(`MCP write for agent '${agentId}' is not implemented yet`),
    );
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
 * Marker for "no extension fields" — the default for agents whose
 * servers carry no platform-specific fields beyond the standard
 * StdioServerBase + RemoteServerBase + PermissiveConfigObject union.
 * Use `NoMcpExtension` as the type argument when no extension applies.
 */
export type NoMcpExtension = Record<never, never>;

/**
 * Standard MCP server entry shape: a permissive union of stdio
 * (subprocess) and remote (URL-based) transports, plus an optional
 * `TExtension` of platform-specific server fields.
 *
 * Every supported local MCP-capable agent's per-server type is a
 * `StandardMcpServer<...>` with a tailored extension:
 * - `StandardMcpServer` (no args): plain stdio + remote + permissive
 * - `StandardMcpServer<{ envFile?: string; auth?: ... }>`: extension shape
 *
 * The `& PermissiveConfigObject` intersection preserves the open
 * string-keyed index signature so undocumented fields remain
 * type-accessible without explicit declarations.
 */
export type StandardMcpServer<TExtension extends object = NoMcpExtension> =
  Readonly<
    (StdioServerBase | RemoteServerBase) & PermissiveConfigObject & TExtension
  >;

/**
 * Standard MCP config shape: a top-level object carrying a single
 * MCP-server map (keyed by server name) at a configurable top-level
 * key, plus optional platform-specific top-level fields and
 * server-extension fields.
 *
 * Use this for agents whose config is a JSON/JSONC/TOML object of
 * the form:
 *   { <topLevelKey>: { <serverName>: <server> } }
 * with optional platform-specific top-level fields.
 *
 * Default `TTopLevelKey` is `'mcpServers'`, matching the dominant
 * MCP config convention. Agents that use a different top-level
 * Default `TTopLevelKey` is `'mcpServers'`, matching the dominant
 * MCP config convention. Agents that use a different top-level
 * (opencode: `'mcp'`, openai-codex: `'mcp_servers'`) pass it as the third
 * argument.
 */
export type StandardMcpConfig<
  TServerExtension extends object = NoMcpExtension,
  TTopLevelExtension extends object = NoMcpExtension,
  TTopLevelKey extends string = 'mcpServers',
> = Readonly<
  TTopLevelExtension & {
    readonly [K in TTopLevelKey]?: McpServerMap<
      StandardMcpServer<TServerExtension>
    >;
  }
>;

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
