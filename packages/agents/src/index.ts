/**
 * Public @overture/agents surface.
 *
 * Exports the static registry of every supported MCP-capable agent, the
 * `AgentDefinition` contract, the shared MCP config primitives used by
 * per-agent readers (McpServerEntry, StdioServerBase, etc.), the
 * `notImplementedMcpHandlers` helper for new agents, every per-agent
 * `read<Agent>McpConfig` typed helper, and every per-agent
 * `parse<Agent>McpServers` handler.
 *
 * Order matters: the agent id order in `AGENT_REGISTRY_ORDER` is the
 * canonical positional order downstream consumers (CLI JSON output,
 * future tools) rely on. The `agentRegistry` aggregate is built from
 * this constant and the `agentsById` map.
 */
import type { AgentDefinition, PlatformId } from './types.js';
export type {
  AgentDefinition,
  AgentMcpHandlers,
  AgentMcpNormalizeHandler,
  AgentMcpNormalizeReason,
  AgentMcpParseServersHandler,
  AgentMcpReadHandler,
  AgentMcpReadHandlerTyped,
  AgentMcpReadResult,
  AgentMcpWriteHandler,
  AgentMcpWriteInput,
  AgentMcpWriteResult,
  AgentNormalizedMcpServer,
  JsonPrimitive,
  JsonValue,
  StringList,
  StringMap,
  ToolList,
  PermissiveConfigObject,
  StdioServerBase,
  RemoteServerBase,
  OAuthConfig,
  RequestInitConfig,
  McpServerMap,
  McpServerEntry,
  NoMcpExtension,
  StandardMcpServer,
  StandardMcpConfig,
  PlatformId,
  DetectionConfidence,
  MarkerKind,
  PathBase,
  McpLocationScope,
  McpLocationFormat,
  DetectionStrategy,
  McpSupport,
  ReasonCode,
  InstallMarker,
  McpLocation,
  MatchedExecutable,
  MatchedMcpLocation,
  PlatformRegistryEntry,
  PathResolutionContext,
  HostPlatform,
} from './types.js';

export {
  parseJsoncMcpServerMap,
  parseTomlMcpServerMap,
  parseYamlMcpServerList,
  parseOpenCodeMcpServerMap,
  type ParseServerMapOptions,
} from './parse-mcp-servers.js';

export {
  defineAgent,
  notImplementedMcpHandlers,
  type DefineAgentInput,
} from './define-agent.js';

import { claudeCode } from './claude-code.js';
import { opencode } from './opencode.js';
import { githubCopilotCli } from './github-copilot-cli.js';
import { openaiCodex } from './openai-codex.js';

export { readAgentMcpConfig } from './read-mcp-config.js';

export {
  parseClaudeCodeMcpServers,
  readClaudeCodeMcpConfig,
} from './claude-code.js';
export type { ClaudeCodeMcpConfig } from './claude-code.js';

export { parseOpenCodeMcpServers, readOpenCodeMcpConfig } from './opencode.js';
export type { OpenCodeMcpConfig } from './opencode.js';

export {
  parseGitHubCopilotCliMcpServers,
  readGitHubCopilotCliMcpConfig,
} from './github-copilot-cli.js';
export type { GitHubCopilotCliMcpConfig } from './github-copilot-cli.js';

export {
  parseOpenAICodexMcpServers,
  readOpenAICodexMcpConfig,
} from './openai-codex.js';
export type { OpenAICodexMcpConfig } from './openai-codex.js';

/**
 * Canonical agent id order for the public `agentRegistry`. Order is
 * load-bearing: downstream consumers (CLI JSON output, future tools)
 * rely on positional indices, and the legacy
 * `apps/cli/src/platforms/registry.spec.ts` expectedIds assertion
 * pins this exact sequence. Reordering is a breaking change.
 *
 * The `satisfies readonly PlatformId[]` clause forces every entry to
 * be a valid PlatformId (typos become compile errors).
 */
export const AGENT_REGISTRY_ORDER = [
  'claude-code',
  'opencode',
  'github-copilot-cli',
  'openai-codex',
] as const satisfies readonly PlatformId[];

/**
 * Static map of every supported agent, keyed by its canonical id.
 * The `satisfies Record<PlatformId, AgentDefinition>` clause forces
 * every PlatformId to have exactly one entry (missing keys become
 * compile errors; extra keys become compile errors).
 */
const agentsById = {
  'claude-code': claudeCode,
  opencode,
  'github-copilot-cli': githubCopilotCli,
  'openai-codex': openaiCodex,
} as const satisfies Record<PlatformId, AgentDefinition>;

/**
 * Ordered aggregate of every supported agent. Built from
 * `AGENT_REGISTRY_ORDER` and `agentsById` so the order is explicit
 * and type-checked (no risk of a typo in the id map silently
 * dropping an agent).
 */
export const agentRegistry: readonly AgentDefinition[] =
  AGENT_REGISTRY_ORDER.map((id) => agentsById[id]);
