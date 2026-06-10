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
 * Order matters: the agent id order in the `agentRegistry` aggregate
 * below is the canonical positional order downstream consumers (CLI
 * JSON output, future tools) rely on. The legacy `platformRegistry`
 * shim in apps/cli re-exports this same array by reference.
 */
import type { AgentDefinition } from './types.js';
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
export { notImplementedMcpHandlers } from './types.js';

export {
  parseJsoncMcpServerMap,
  parseTomlMcpServerMap,
  parseYamlMcpServerList,
  type ParseServerMapOptions,
} from './parse-mcp-servers.js';

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

export { parseClaudeCodeMcpServers, readClaudeCodeMcpConfig } from './claude-code.js';
export type { ClaudeCodeMcpConfig } from './claude-code.js';

export { parseClaudeDesktopMcpServers, readClaudeDesktopMcpConfig } from './claude-desktop.js';
export type { ClaudeDesktopMcpConfig } from './claude-desktop.js';

export { parseOpenCodeMcpServers, readOpenCodeMcpConfig } from './opencode.js';
export type { OpenCodeMcpConfig } from './opencode.js';

export { parseGitHubCopilotVSCodeMcpServers, readGitHubCopilotVSCodeMcpConfig } from './github-copilot-vscode.js';
export type { GitHubCopilotVSCodeMcpConfig } from './github-copilot-vscode.js';

export { parseGitHubCopilotCliMcpServers, readGitHubCopilotCliMcpConfig } from './github-copilot-cli.js';
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

export { parseOpenAICodexMcpServers, readOpenAICodexMcpConfig } from './openai-codex.js';
export type { OpenAICodexMcpConfig } from './openai-codex.js';

export const agentRegistry: readonly AgentDefinition[] = [
  claudeCode,
  claudeDesktop,
  opencode,
  githubCopilotVscode,
  githubCopilotCli,
  githubCopilotCloudAgent,
  cursor,
  windsurf,
  cline,
  rooCode,
  continueAgent,
  zed,
  openaiCodex,
  aider,
] as const;
