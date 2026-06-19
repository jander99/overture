// Claude Code agent definition.
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
  NoMcpExtension,
  StandardMcpConfig,
  StandardMcpServer,
  StringMap,
} from './types.js';
import type { PathResolutionContext } from './types.js';

export const parseClaudeCodeMcpServers: AgentMcpParseServersHandler = (
  resolvedPath,
) => parseJsoncMcpServerMap(resolvedPath, 'mcpServers');

export function normalizeClaudeCodeMcpServers(
  input: AgentMcpReadResult<ClaudeCodeMcpConfig>,
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
    out[name] = normalizeClaudeServerEntry(mcpServers[name]);
  }
  return out;
}

function normalizeClaudeServerEntry(entry: unknown): AgentNormalizedMcpServer {
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

export const claudeCode: AgentDefinition = defineAgent({
  id: 'claude-code',
  displayName: 'Claude Code',
  installMarkers: [
    {
      id: 'claude-code-1-mcp-json',
      kind: 'file',
      base: 'home',
      relativePath: '.claude.json',
      confidence: 'high',
      reason: 'Primary user-global configuration file for Claude Code',
    },
    {
      id: 'claude-code-2-project-mcp-json',
      kind: 'file',
      base: 'workspace',
      relativePath: '.mcp.json',
      confidence: 'high',
      reason: 'Project-level MCP configuration file for Claude Code',
    },
  ],
  mcpLocations: [
    {
      scope: 'user',
      base: 'home',
      relativePath: '.claude.json',
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'User-global MCP servers',
    },
    {
      scope: 'project',
      base: 'workspace',
      relativePath: '.mcp.json',
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'Project-level MCP servers',
    },
  ],
  defaultConfidence: 'medium',
  detectionStrategy: 'binary-first',
  mcpSupport: 'supported',
  executableNames: ['claude'],
  mcp: {
    parseServers: parseClaudeCodeMcpServers,
    normalize: asRegistryNormalizeHandler(normalizeClaudeCodeMcpServers),
  },
});

export type ClaudeCodeMcpConfig = StandardMcpConfig<
  NoMcpExtension,
  Readonly<{ readonly imports?: StringMap }>
>;

export type ClaudeCodeMcpServer = StandardMcpServer<NoMcpExtension>;

export type ClaudeCodeStdioServer = StandardMcpServer<NoMcpExtension>;

export type ClaudeCodeRemoteServer = StandardMcpServer<NoMcpExtension>;

export async function readClaudeCodeMcpConfig(
  ctx: PathResolutionContext,
): Promise<AgentMcpReadResult<ClaudeCodeMcpConfig>> {
  return readAgentMcpConfig(claudeCode, ctx) as Promise<
    AgentMcpReadResult<ClaudeCodeMcpConfig>
  >;
}
