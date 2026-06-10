// OpenAI Codex agent definition.
import { parseTomlMcpServerMap } from './parse-mcp-servers.js';
import { notImplementedMcpHandlers } from './types.js';
import type {
  AgentDefinition,
  AgentMcpParseServersHandler,
  AgentMcpReadResult,
  StringMap,
} from './types.js';
import { readAgentMcpConfig } from './read-mcp-config.js';
import type { PathResolutionContext } from './types.js';

export const parseOpenAICodexMcpServers: AgentMcpParseServersHandler = (
  resolvedPath,
) => parseTomlMcpServerMap(resolvedPath, 'mcp_servers');

export const openaiCodex: AgentDefinition = {
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
read: (ctx) => readAgentMcpConfig(openaiCodex, ctx),
    write: notImplementedMcpHandlers('openai-codex').write,
    parseServers: parseOpenAICodexMcpServers,
},
};

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
