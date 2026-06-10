// GitHub Copilot in VS Code agent definition.
import { parseJsoncMcpServerMap } from './parse-mcp-servers.js';
import { defineAgent } from './define-agent.js';
import type {
  AgentDefinition,
  AgentMcpParseServersHandler,
  AgentMcpReadResult,
  McpServerMap,
  OAuthConfig,
  PermissiveConfigObject,
  RequestInitConfig,
  StdioServerBase,
  StringMap,
} from './types.js';
import type { PathResolutionContext } from './types.js';

export const parseGitHubCopilotVSCodeMcpServers: AgentMcpParseServersHandler = (
  resolvedPath,
) => parseJsoncMcpServerMap(resolvedPath, 'servers');

export const githubCopilotVscode: AgentDefinition = defineAgent({
  id: 'github-copilot-vscode',
  displayName: 'GitHub Copilot in VS Code',
  installMarkers: [
    {
      id: 'github-copilot-vscode-1-workspace-mcp',
      kind: 'file',
      base: 'workspace',
      relativePath: '.vscode/mcp.json',
      confidence: 'medium',
      reason: 'Workspace-level VS Code MCP configuration',
    },
    {
      id: 'github-copilot-vscode-2-user-mcp',
      kind: 'file',
      base: 'home',
      relativePath: '.vscode/mcp.json',
      confidence: 'medium',
      reason: 'User-global VS Code MCP configuration',
    },
  ],
  mcpLocations: [
    {
      scope: 'project',
      base: 'workspace',
      relativePath: '.vscode/mcp.json',
      format: 'json',
      topLevelKey: 'servers',
      notes: 'Workspace-level MCP servers under servers key',
    },
    {
      scope: 'user',
      base: 'home',
      relativePath: '.vscode/mcp.json',
      format: 'json',
      topLevelKey: 'servers',
      notes: 'User-global MCP servers under servers key',
    },
  ],
  defaultConfidence: 'medium',
  detectionStrategy: 'marker-only',
  mcpSupport: 'supported',
  executableNames: [],
  mcp: {
    parseServers: parseGitHubCopilotVSCodeMcpServers,
  },
});

/**
 * VS Code input variable used by `inputs[]` in `.vscode/mcp.json`.
 * Mirrors VS Code's generic input variable shape (id/type plus metadata
 * for prompt, default, password, and options).
 */
export interface GitHubCopilotVSCodeInput {
  id: string;
  type: string;
  description?: string;
  default?: string;
  password?: boolean;
  options?: readonly string[];
}

/**
 * Discriminator for a VS Code MCP server entry. VS Code accepts the
 * literal values `'stdio' | 'http' | 'sse'`; the field is documented as
 * optional in real configs (it falls back to stdio when absent), and
 * unknown strings are tolerated for forward compatibility.
 */
export interface GitHubCopilotVSCodeServerBase extends PermissiveConfigObject {
  type?: 'stdio' | 'http' | 'sse' | (string & {});
}

/**
 * Local (stdio) VS Code MCP server. Inherits the standard
 * `command`/`args`/`env`/`cwd` shape and adds VS Code-specific
 * `envFile`, `dev`, and `sandboxEnabled` knobs.
 */
export interface GitHubCopilotVSCodeLocalServer extends StdioServerBase {
  type?: 'stdio' | (string & {});
  dev?: boolean;
  envFile?: string;
  sandboxEnabled?: boolean;
}

/**
 * Remote (http/sse) VS Code MCP server. Carries `url` and `headers`,
 * plus VS Code-specific `oauth` and `requestInit` overrides. Undocumented
 * extension fields are tolerated via the `extras` bag rather than a wide
 * index signature, so the typed `oauth`/`requestInit` shapes remain intact.
 */
export interface GitHubCopilotVSCodeRemoteServer {
  type?: 'http' | 'sse' | (string & {});
  url: string;
  headers?: StringMap;
  oauth?: OAuthConfig;
  requestInit?: RequestInitConfig;
  extras?: PermissiveConfigObject;
}

/**
 * Union of every supported VS Code MCP server variant. Local and remote
 * are merged via a permissive shared base plus per-variant fields.
 */
export type GitHubCopilotVSCodeServer =
  | GitHubCopilotVSCodeLocalServer
  | GitHubCopilotVSCodeRemoteServer;

/**
 * Native shape of `.vscode/mcp.json` (workspace and user-global
 * variants). The top-level key is `servers` (NOT `mcpServers`); an
 * optional `inputs` array declares prompt/input variables that may be
 * referenced from server entries.
 */
export interface GitHubCopilotVSCodeMcpConfig {
  servers?: McpServerMap<GitHubCopilotVSCodeServer>;
  inputs?: readonly GitHubCopilotVSCodeInput[];
}

/**
 * Read the agent's MCP config into the typed `GitHubCopilotVSCodeMcpConfig` shape.
 * Thin wrapper over `readAgentMcpConfig` that casts the unknown document
 * to the agent's typed config. Returns the same `AgentMcpReadResult` shape
 * as `githubCopilotVscode.mcp.read`, but with the generic `config` field
 * narrowed to `GitHubCopilotVSCodeMcpConfig | null`.
 */
export async function readGitHubCopilotVSCodeMcpConfig(
  ctx: PathResolutionContext,
): Promise<AgentMcpReadResult<GitHubCopilotVSCodeMcpConfig>> {
  return readAgentMcpConfig(githubCopilotVscode, ctx) as Promise<
    AgentMcpReadResult<GitHubCopilotVSCodeMcpConfig>
  >;
}
