// GitHub Copilot CLI agent definition.
import {
  asRegistryNormalizeHandler,
  isRecord,
  normalized,
  normalizeOptionalArgs,
  normalizeOptionalEnv,
  normalizeOptionalHeaders,
  shapeConflict,
} from './normalize-mcp-config.js';
import { parseJsoncMcpServerMap } from './parse-mcp-servers.js';
import { readAgentMcpConfig } from './read-mcp-config.js';
import { defineAgent } from './define-agent.js';
import type { OvertureMcpServer } from '@overture/config';
import type {
  AgentDefinition,
  AgentMcpParseServersHandler,
  AgentMcpReadResult,
  AgentNormalizedMcpServer,
  McpServerMap,
  PathResolutionContext,
  StringList,
  StringMap,
  ToolList,
} from './types.js';

export const parseGitHubCopilotCliMcpServers: AgentMcpParseServersHandler = (
  resolvedPath,
) => parseJsoncMcpServerMap(resolvedPath, 'mcpServers');

export function normalizeGitHubCopilotCliMcpServers(
  input: AgentMcpReadResult<GitHubCopilotCliMcpConfig>,
): Readonly<Record<string, AgentNormalizedMcpServer>> {
  if (input.parseError !== undefined) {
    return {};
  }
  if (input.config === null) {
    return {};
  }
  const mcpServers = input.config.mcpServers;
  if (mcpServers === undefined) {
    return {};
  }
  if (!isRecord(mcpServers)) {
    return {};
  }
  const out: Record<string, AgentNormalizedMcpServer> = {};
  for (const name of Object.keys(mcpServers)) {
    out[name] = normalizeCopilotServerEntry(mcpServers[name]);
  }
  return out;
}

function normalizeCopilotServerEntry(entry: unknown): AgentNormalizedMcpServer {
  if (!isRecord(entry)) {
    return shapeConflict('Expected server entry to be an object.');
  }
  if (entry['type'] === 'local') {
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
  if (entry['type'] === 'http') {
    const url = entry['url'];
    if (typeof url !== 'string' || url.length === 0) {
      return shapeConflict('Remote url is missing or empty.');
    }
    const headers = normalizeOptionalHeaders(entry['headers']);
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
  return shapeConflict('Unsupported MCP server transport type.');
}

export const githubCopilotCli: AgentDefinition = defineAgent({
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
    parseServers: parseGitHubCopilotCliMcpServers,
    normalize: asRegistryNormalizeHandler(normalizeGitHubCopilotCliMcpServers),
  },
});

export interface GitHubCopilotCliLocalServer {
  type: 'local';
  command: string;
  args?: StringList;
  env?: StringMap;
  tools?: ToolList;
}

export interface GitHubCopilotCliRemoteServer {
  type: 'http';
  url: string;
  headers?: StringMap;
  tools?: ToolList;
}

export type GitHubCopilotCliServer =
  | GitHubCopilotCliLocalServer
  | GitHubCopilotCliRemoteServer;

export interface GitHubCopilotCliMcpConfig {
  mcpServers?: McpServerMap<GitHubCopilotCliServer>;
}

export async function readGitHubCopilotCliMcpConfig(
  ctx: PathResolutionContext,
): Promise<AgentMcpReadResult<GitHubCopilotCliMcpConfig>> {
  return readAgentMcpConfig(githubCopilotCli, ctx) as Promise<
    AgentMcpReadResult<GitHubCopilotCliMcpConfig>
  >;
}

export async function pickGithubCopilotCliMcpConfigTarget(
  ctx: PathResolutionContext,
): Promise<{
  readonly target: 'workspace' | 'user' | 'none';
  readonly paths: readonly string[];
}> {
  const { access } = await import('node:fs/promises');
  const home = typeof ctx.homeDir === 'string' ? ctx.homeDir : '';
  const wsDir = typeof ctx.workspaceDir === 'string' ? ctx.workspaceDir : '';
  const workspacePath = wsDir.length > 0 ? `${wsDir}/.github/mcp.json` : '';
  const userPath = home.length > 0 ? `${home}/.copilot/mcp-config.json` : '';
  const paths: string[] = [];
  if (workspacePath.length > 0) paths.push(workspacePath);
  if (userPath.length > 0) paths.push(userPath);

  let workspaceExists = false;
  let userExists = false;
  if (workspacePath.length > 0) {
    try {
      await access(workspacePath);
      workspaceExists = true;
    } catch {
      workspaceExists = false;
    }
  }
  if (userPath.length > 0) {
    try {
      await access(userPath);
      userExists = true;
    } catch {
      userExists = false;
    }
  }

  if (workspaceExists) {
    return { target: 'workspace', paths };
  }
  if (userExists) {
    return { target: 'user', paths };
  }
  return { target: 'none', paths };
}
