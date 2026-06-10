// Claude Desktop agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type {
  AgentDefinition,
  McpServerMap,
  StdioServerBase,
  AgentMcpReadResult,
} from './types.js';

import { readAgentMcpConfig } from './read-mcp-config.js';
import type { PathResolutionContext } from './types.js';
export const claudeDesktop: AgentDefinition = {
  id: 'claude-desktop',
  displayName: 'Claude Desktop',
  installMarkers: [
    {
      id: 'claude-desktop-1-macos-config',
      kind: 'file',
      base: 'home',
      relativePath:
        'Library/Application Support/Claude/claude_desktop_config.json',
      platforms: ['darwin'],
      confidence: 'high',
      reason: 'macOS Claude Desktop configuration file',
    },
    {
      id: 'claude-desktop-2-linux-config',
      kind: 'file',
      base: 'config',
      relativePath: 'Claude/claude_desktop_config.json',
      platforms: ['linux'],
      confidence: 'high',
      reason: 'Linux Claude Desktop configuration file',
    },
    {
      id: 'claude-desktop-3-windows-config',
      kind: 'file',
      base: 'config',
      relativePath: 'Claude/claude_desktop_config.json',
      platforms: ['win32'],
      confidence: 'high',
      reason: 'Windows Claude Desktop configuration file',
    },
  ],
  mcpLocations: [
    {
      scope: 'user',
      base: 'home',
      relativePath:
        'Library/Application Support/Claude/claude_desktop_config.json',
      platforms: ['darwin'],
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'macOS user-global MCP servers',
    },
    {
      scope: 'user',
      base: 'config',
      relativePath: 'Claude/claude_desktop_config.json',
      platforms: ['linux'],
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'Linux user-global MCP servers',
    },
    {
      scope: 'user',
      base: 'config',
      relativePath: 'Claude/claude_desktop_config.json',
      platforms: ['win32'],
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'Windows user-global MCP servers',
    },
  ],
  defaultConfidence: 'high',
  detectionStrategy: 'marker-only',
  mcpSupport: 'supported',
  executableNames: [],
  mcp: {
    read: (ctx) => readAgentMcpConfig(claudeDesktop, ctx),
    write: notImplementedMcpHandlers('claude-desktop').write,
  },
};

/** Native Claude Desktop MCP config: `mcpServers` map; each server is stdio-only (no remote transport supported). */

export interface ClaudeDesktopMcpConfig {
  readonly mcpServers?: McpServerMap<ClaudeDesktopMcpServer>;
}

/** Claude Desktop server: local process invocation via stdio. */

export type ClaudeDesktopMcpServer = StdioServerBase;

/**
 * Read the agent's MCP config into the typed `ClaudeDesktopMcpConfig` shape.
 * Thin wrapper over `readAgentMcpConfig` that casts the unknown document
 * to the agent's typed config. Returns the same `AgentMcpReadResult` shape
 * as `claudeDesktop.mcp.read`, but with the generic `config` field
 * narrowed to `ClaudeDesktopMcpConfig | null`.
 */
export async function readClaudeDesktopMcpConfig(
  ctx: PathResolutionContext,
): Promise<AgentMcpReadResult<ClaudeDesktopMcpConfig>> {
  return readAgentMcpConfig(claudeDesktop, ctx) as Promise<
    AgentMcpReadResult<ClaudeDesktopMcpConfig>
  >;
}
