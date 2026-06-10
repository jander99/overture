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
  AgentMcpParseServersHandler,
  AgentMcpReadHandler,
  AgentMcpReadHandlerTyped,
  AgentMcpReadResult,
  AgentMcpWriteHandler,
  AgentMcpWriteInput,
  AgentMcpWriteResult,
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
import { claudeDesktop } from './claude-desktop.js';
import { opencode } from './opencode.js';
import { githubCopilotVscode } from './github-copilot-vscode.js';
import { githubCopilotCli } from './github-copilot-cli.js';
import { githubCopilotCloudAgent } from './github-copilot-cloud-agent.js';
import { cursor } from './cursor.js';
import { windsurf } from './windsurf.js';
import { cline } from './cline.js';
import { rooCode } from './roo-code.js';
// `continue` is a JS reserved keyword. The per-agent file exports
// `continueDef`; rename on import to keep the canonical id usable in
// the aggregate below.
import { continueDef as continueAgent } from './continue.js';
import { zed } from './zed.js';
import { openaiCodex } from './openai-codex.js';
import { aider } from './aider.js';

export { readAgentMcpConfig } from './read-mcp-config.js';

export {
  parseClaudeCodeMcpServers,
  readClaudeCodeMcpConfig,
} from './claude-code.js';
export type { ClaudeCodeMcpConfig } from './claude-code.js';

export {
  parseClaudeDesktopMcpServers,
  readClaudeDesktopMcpConfig,
} from './claude-desktop.js';
export type { ClaudeDesktopMcpConfig } from './claude-desktop.js';

export { parseOpenCodeMcpServers, readOpenCodeMcpConfig } from './opencode.js';
export type { OpenCodeMcpConfig } from './opencode.js';

export {
  parseGitHubCopilotVSCodeMcpServers,
  readGitHubCopilotVSCodeMcpConfig,
} from './github-copilot-vscode.js';
export type { GitHubCopilotVSCodeMcpConfig } from './github-copilot-vscode.js';

export {
  parseGitHubCopilotCliMcpServers,
  readGitHubCopilotCliMcpConfig,
} from './github-copilot-cli.js';
export type { GitHubCopilotCliMcpConfig } from './github-copilot-cli.js';

export { parseCursorMcpServers, readCursorMcpConfig } from './cursor.js';
export type { CursorMcpConfig } from './cursor.js';

export { parseWindsurfMcpServers, readWindsurfMcpConfig } from './windsurf.js';
export type { WindsurfMcpConfig } from './windsurf.js';

export { parseClineMcpServers, readClineMcpConfig } from './cline.js';
export type { ClineMcpConfig } from './cline.js';

export { parseRooCodeMcpServers, readRooCodeMcpConfig } from './roo-code.js';
export type { RooCodeMcpConfig } from './roo-code.js';

export { parseContinueMcpServers, readContinueMcpConfig } from './continue.js';
export type {
  ContinueImportedJsonMcpConfig,
  ContinueMcpConfig,
  ContinueMcpServer,
  ContinueYamlMcpConfig,
} from './continue.js';

export { parseZedMcpServers, readZedMcpConfig } from './zed.js';
export type { ZedMcpConfig } from './zed.js';

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
  'claude-desktop',
  'opencode',
  'github-copilot-vscode',
  'github-copilot-cli',
  'github-copilot-cloud-agent',
  'cursor',
  'windsurf',
  'cline',
  'roo-code',
  'continue',
  'zed',
  'openai-codex',
  'aider',
] as const satisfies readonly PlatformId[];

/**
 * Static map of every supported agent, keyed by its canonical id.
 * The `satisfies Record<PlatformId, AgentDefinition>` clause forces
 * every PlatformId to have exactly one entry (missing keys become
 * compile errors; extra keys become compile errors).
 *
 * `continue` is a JS reserved keyword, so the per-agent file
 * exports `continueDef` — aliased to `continueAgent` on import.
 */
const agentsById = {
  'claude-code': claudeCode,
  'claude-desktop': claudeDesktop,
  opencode,
  'github-copilot-vscode': githubCopilotVscode,
  'github-copilot-cli': githubCopilotCli,
  'github-copilot-cloud-agent': githubCopilotCloudAgent,
  cursor,
  windsurf,
  cline,
  'roo-code': rooCode,
  continue: continueAgent,
  zed,
  'openai-codex': openaiCodex,
  aider,
} as const satisfies Record<PlatformId, AgentDefinition>;

/**
 * Ordered aggregate of every supported agent. Built from
 * `AGENT_REGISTRY_ORDER` and `agentsById` so the order is explicit
 * and type-checked (no risk of a typo in the id map silently
 * dropping an agent).
 */
export const agentRegistry: readonly AgentDefinition[] =
  AGENT_REGISTRY_ORDER.map((id) => agentsById[id]);
