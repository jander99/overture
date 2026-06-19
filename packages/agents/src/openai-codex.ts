// OpenAI Codex agent definition.
import {
  asRegistryNormalizeHandler,
  isRecord,
  normalized,
  normalizeOptionalArgs,
  normalizeOptionalEnv,
  normalizeOptionalHeaders,
  shapeConflict,
} from './normalize-mcp-config.js';
import { parseTomlMcpServerMap } from './parse-mcp-servers.js';
import { readAgentMcpConfig } from './read-mcp-config.js';
import { defineAgent } from './define-agent.js';
import type { OvertureMcpServer } from '@overture/config';
import type {
  AgentDefinition,
  AgentMcpParseServersHandler,
  AgentMcpReadResult,
  AgentNormalizedMcpServer,
  StringMap,
} from './types.js';
import type { PathResolutionContext } from './types.js';

export const parseOpenAICodexMcpServers: AgentMcpParseServersHandler = (
  resolvedPath,
) => parseTomlMcpServerMap(resolvedPath, 'mcp_servers');

/**
 * Normalize an OpenAI Codex MCP config read result into the canonical
 * `OvertureMcpServer` shape the scan matrix consumes.
 *
 * Codex has no explicit `type` discriminator: the transport is inferred
 * from key presence on the per-server entry. `'command' in entry` means
 * stdio; `'url' in entry` means remote. When both or neither key is
 * present the entry is a shape conflict. Codex-specific extension fields
 * (`env_vars`, `cwd`, `startup_timeout_sec`, `tool_timeout_sec`,
 * `enabled_tools`, `disabled_tools`, `scopes`, `oauth_resource`,
 * `required`, `enabled`, `bearer_token_env_var`, `env_http_headers`) are
 * intentionally dropped: the canonical `OvertureMcpServer` union has no
 * slot for them and the B1 scan matrix compares only canonical fields.
 *
 * Returns `{}` when the read result is `null`, has a `parseError`, is
 * missing the top-level `mcp_servers` map, or has a non-object
 * `mcp_servers` value (the registry uses the empty object to mean "no
 * normalized entries to surface").
 */
export function normalizeOpenAICodexMcpServers(
  input: AgentMcpReadResult<OpenAICodexMcpConfig>,
): Readonly<Record<string, AgentNormalizedMcpServer>> {
  if (input.parseError !== undefined) {
    return {};
  }
  if (input.config === null) {
    return {};
  }
  const mcpServers = input.config.mcp_servers;
  if (mcpServers === undefined) {
    return {};
  }
  if (!isRecord(mcpServers)) {
    return {};
  }
  const out: Record<string, AgentNormalizedMcpServer> = {};
  for (const name of Object.keys(mcpServers)) {
    out[name] = normalizeOpenAICodexServerEntry(mcpServers[name]);
  }
  return out;
}

function normalizeOpenAICodexServerEntry(
  entry: unknown,
): AgentNormalizedMcpServer {
  if (!isRecord(entry)) {
    return shapeConflict('Expected server entry to be an object.');
  }
  const hasCommand = 'command' in entry;
  const hasUrl = 'url' in entry;
  if (hasCommand && hasUrl) {
    return shapeConflict('Server declares both stdio command and remote url.');
  }
  if (!hasCommand && !hasUrl) {
    return shapeConflict(
      'Server declares neither stdio command nor remote url.',
    );
  }
  if (hasCommand) {
    const command = entry['command'];
    if (typeof command !== 'string' || command.length === 0) {
      return shapeConflict('Stdio command is missing or empty.');
    }
    const args = normalizeOptionalArgs(entry['args']);
    if (typeof args === 'string') {
      return shapeConflict(args);
    }
    const env = normalizeOptionalEnv(entry['env']);
    if (typeof env === 'string') {
      return shapeConflict(env);
    }
    const server: OvertureMcpServer = {
      type: 'stdio',
      command,
      ...(args !== undefined ? { args } : {}),
      ...(env !== undefined ? { env } : {}),
    };
    return normalized(server);
  }
  const url = entry['url'];
  if (typeof url !== 'string' || url.length === 0) {
    return shapeConflict('Remote url is missing or empty.');
  }
  const headers = normalizeOptionalHeaders(entry['http_headers']);
  if (typeof headers === 'string') {
    return shapeConflict(headers);
  }
  const server: OvertureMcpServer = {
    type: 'remote',
    url,
    ...(headers !== undefined ? { headers } : {}),
  };
  return normalized(server);
}

export const openaiCodex: AgentDefinition = defineAgent({
  id: 'openai-codex',
  displayName: 'OpenAI Codex',
  installMarkers: [
    {
      id: 'openai-codex-1-home-config',
      kind: 'file',
      base: 'home',
      relativePath: '.codex/config.toml',
      confidence: 'high',
      reason: 'User-global OpenAI Codex configuration file',
    },
    {
      id: 'openai-codex-2-project-config',
      kind: 'file',
      base: 'workspace',
      relativePath: '.codex/config.toml',
      confidence: 'high',
      reason: 'Project-level OpenAI Codex configuration file',
    },
  ],
  mcpLocations: [
    {
      scope: 'user',
      base: 'home',
      relativePath: '.codex/config.toml',
      format: 'toml',
      topLevelKey: 'mcp_servers',
      notes: 'User-global MCP servers as TOML tables',
    },
    {
      scope: 'project',
      base: 'workspace',
      relativePath: '.codex/config.toml',
      format: 'toml',
      topLevelKey: 'mcp_servers',
      notes: 'Project-level MCP servers as TOML tables',
    },
  ],
  defaultConfidence: 'high',
  detectionStrategy: 'binary-first',
  mcpSupport: 'supported',
  executableNames: ['codex'],
  mcp: {
    parseServers: parseOpenAICodexMcpServers,
    normalize: asRegistryNormalizeHandler(normalizeOpenAICodexMcpServers),
  },
});

/**
 * Native OpenAI Codex MCP config shape. Codex stores MCP servers
 * under the top-level `mcp_servers` table in TOML
 * (`~/.codex/config.toml` and trusted project `.codex/config.toml`).
 * Field names are preserved as snake_case to mirror the source TOML
 * format; this type is a design contract for the parsed shape, not a
 * normalized camelCase view.
 */
export interface OpenAICodexMcpConfig {
  readonly mcp_servers?: Readonly<Record<string, OpenAICodexMcpServer>>;
}

/**
 * OpenAI Codex MCP server entry. All fields are optional; the
 * transport is implied by the presence of either `command` (stdio)
 * or `url` (remote). Field names mirror the documented TOML keys
 * (`env_vars`, `startup_timeout_sec`, `tool_timeout_sec`,
 * `enabled_tools`, `disabled_tools`, `oauth_resource`,
 * `bearer_token_env_var`, `http_headers`, `env_http_headers`).
 */
export interface OpenAICodexMcpServer {
  /** Stdio: command to spawn. Remote servers omit this. */
  command?: string;
  /** Stdio: command-line arguments. */
  args?: readonly string[];
  /** Stdio: inline environment variables as a string map. */
  env?: StringMap;
  /** Stdio: names of environment variables to forward from the parent process. */
  env_vars?: readonly string[];
  /** Stdio: working directory for the server process. */
  cwd?: string;
  /** Stdio: startup timeout in seconds. */
  startup_timeout_sec?: number;
  /** Per-tool invocation timeout in seconds. */
  tool_timeout_sec?: number;
  /** Allowlist of tool names this server exposes. */
  enabled_tools?: readonly string[];
  /** Blocklist of tool names this server exposes. */
  disabled_tools?: readonly string[];
  /** OAuth scopes to request for this server. */
  scopes?: readonly string[];
  /** OAuth resource URL the client should target. */
  oauth_resource?: string;
  /** Whether this server is required by the agent. */
  required?: boolean;
  /** Whether this server is enabled. */
  enabled?: boolean;
  /** Remote: URL the MCP client connects to. */
  url?: string;
  /** Remote: environment variable name holding the bearer token. */
  bearer_token_env_var?: string;
  /** Remote: static HTTP headers attached to requests. */
  http_headers?: StringMap;
  /** Remote: HTTP headers sourced from environment variables. */
  env_http_headers?: StringMap;
}

/**
 * Read the agent's MCP config into the typed `OpenAICodexMcpConfig` shape.
 * Thin wrapper over `readAgentMcpConfig` that casts the unknown document
 * to the agent's typed config. Returns the same `AgentMcpReadResult` shape
 * as `openaiCodex.mcp.read`, but with the generic `config` field
 * narrowed to `OpenAICodexMcpConfig | null`.
 */
export async function readOpenAICodexMcpConfig(
  ctx: PathResolutionContext,
): Promise<AgentMcpReadResult<OpenAICodexMcpConfig>> {
  return readAgentMcpConfig(openaiCodex, ctx) as Promise<
    AgentMcpReadResult<OpenAICodexMcpConfig>
  >;
}
