// GitHub Copilot CLI agent definition.
import { parseJsoncMcpServerMap } from './parse-mcp-servers.js';
import { readAgentMcpConfig } from './read-mcp-config.js';
import { notImplementedMcpHandlers } from './types.js';
import type {
  AgentDefinition,
  AgentMcpParseServersHandler,
  AgentMcpReadResult,
  McpServerMap,
  PathResolutionContext,
  StringList,
  StringMap,
  ToolList,
} from './types.js';

export const parseGitHubCopilotCliMcpServers: AgentMcpParseServersHandler = (
  resolvedPath,
) => parseJsoncMcpServerMap(resolvedPath, 'mcpServers');

export const githubCopilotCli: AgentDefinition = {
  id: 'github-copilot-cli',
  displayName: 'GitHub Copilot CLI',
  installMarkers: [
    {
      id: 'github-copilot-cli-1-hosts-json',
      kind: 'file',
      base: 'config',
      relativePath: 'github-copilot/hosts.json',
      confidence: 'medium',
      reason: 'GitHub Copilot CLI hosts configuration',
    },
    {
      id: 'github-copilot-cli-2-intellij-json',
      kind: 'file',
      base: 'config',
      relativePath: 'github-copilot/intellij.json',
      confidence: 'low',
      reason: 'GitHub Copilot IntelliJ configuration (weak proxy)',
    },
  ],
  mcpLocations: [
    {
      scope: 'user',
      base: 'home',
      relativePath: '.copilot/mcp-config.json',
      format: 'json',
      topLevelKey: 'mcpServers',
      notes:
        'User-global MCP server list. The location is relocatable with $COPILOT_HOME (not yet supported by overture).',
    },
  ],

  defaultConfidence: 'medium',
  detectionStrategy: 'binary-first',
  mcpSupport: 'supported',
  executableNames: ['copilot'],
  mcp: {
    read: (ctx) => readAgentMcpConfig(githubCopilotCli, ctx),
    write: notImplementedMcpHandlers('github-copilot-cli').write,
    parseServers: parseGitHubCopilotCliMcpServers,
  },
};

/**
 * Local (subprocess) Copilot CLI MCP server. `type` is the literal
 * `'local'` and the entry is keyed on it for a discriminated union.
 */
export interface GitHubCopilotCliLocalServer {
  type: 'local';
  command: string;
  args?: StringList;
  env?: StringMap;
  tools?: ToolList;
}

/**
 * Remote (HTTP) Copilot CLI MCP server. `type` is the literal `'http'`.
 */
export interface GitHubCopilotCliRemoteServer {
  type: 'http';
  url: string;
  headers?: StringMap;
  tools?: ToolList;
}

/**
 * Union of every supported Copilot CLI MCP server variant. Discriminated
 * on the `type` field.
 */
export type GitHubCopilotCliServer =
  | GitHubCopilotCliLocalServer
  | GitHubCopilotCliRemoteServer;

/**
 * Native shape of `~/.copilot/mcp-config.json` (user-global; relocatable
 * via `COPILOT_HOME`). The top-level key is `mcpServers` (per the current
 * official Copilot CLI docs), NOT the legacy `servers` key referenced by
 * the stale registry metadata.
 */
export interface GitHubCopilotCliMcpConfig {
  mcpServers?: McpServerMap<GitHubCopilotCliServer>;
}

/**
 * Read the agent's MCP config into the typed `GitHubCopilotCliMcpConfig` shape.
 * Thin wrapper over `readAgentMcpConfig` that casts the unknown document
 * to the agent's typed config. Returns the same `AgentMcpReadResult` shape
 * as `githubCopilotCli.mcp.read`, but with the generic `config` field
 * narrowed to `GitHubCopilotCliMcpConfig | null`.
 */
export async function readGitHubCopilotCliMcpConfig(
  ctx: PathResolutionContext,
): Promise<AgentMcpReadResult<GitHubCopilotCliMcpConfig>> {
  return readAgentMcpConfig(githubCopilotCli, ctx) as Promise<
    AgentMcpReadResult<GitHubCopilotCliMcpConfig>
  >;
}
