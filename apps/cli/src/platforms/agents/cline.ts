// Cline agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type { AgentDefinition, AgentMcpReadResult } from './types.js';
import type { McpServerMap, StringList, StringMap } from './types.js';

import { readAgentMcpConfig } from './read-mcp-config.js';
import type { PathResolutionContext } from '../types.js';
/**
 * Native Cline MCP server entry. Cline accepts either stdio-style servers
 * (with `command`/`args`/`env`) or remote servers (with `url`/`headers`)
 * and lets users pick the transport via the optional `transportType`
 * discriminator.
 */
export interface ClineMcpServer {
  command?: string;
  args?: StringList;
  env?: StringMap;
  url?: string;
  headers?: StringMap;
  disabled?: boolean;
  autoApprove?: StringList;
  transportType?: string;
}

/**
 * Native Cline MCP config shape. The top-level `mcpServers` key holds a
 * read-only map of server name to {@link ClineMcpServer} entries.
 */
export interface ClineMcpConfig {
  readonly mcpServers?: McpServerMap<ClineMcpServer>;
}

export const cline: AgentDefinition = {
  id: 'cline',
  displayName: 'Cline',
  installMarkers: [
    {
      id: 'cline-1-macos-global-storage',
      kind: 'file',
      base: 'home',
      relativePath:
        'Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json',
      platforms: ['darwin'],
      confidence: 'medium',
      reason: 'macOS VS Code extension global storage for Cline',
    },
    {
      id: 'cline-2-linux-global-storage',
      kind: 'file',
      base: 'config',
      relativePath:
        'Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json',
      platforms: ['linux'],
      confidence: 'medium',
      reason: 'Linux VS Code extension global storage for Cline',
    },
    {
      id: 'cline-3-windows-global-storage',
      kind: 'file',
      base: 'config',
      relativePath:
        'Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json',
      platforms: ['win32'],
      confidence: 'medium',
      reason: 'Windows VS Code extension global storage for Cline',
    },
  ],
  mcpLocations: [
    {
      scope: 'user',
      base: 'home',
      relativePath:
        'Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json',
      platforms: ['darwin'],
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'macOS user-global MCP servers',
    },
    {
      scope: 'user',
      base: 'config',
      relativePath:
        'Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json',
      platforms: ['linux'],
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'Linux user-global MCP servers',
    },
    {
      scope: 'user',
      base: 'config',
      relativePath:
        'Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json',
      platforms: ['win32'],
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'Windows user-global MCP servers',
    },
  ],
  defaultConfidence: 'medium',
  detectionStrategy: 'marker-only',
  mcpSupport: 'supported',
  executableNames: [],
  mcp: {
    read: (ctx) => readAgentMcpConfig(cline, ctx),
    write: notImplementedMcpHandlers('cline').write,
  },
};

/**
 * Read the agent's MCP config into the typed `ClineMcpConfig` shape.
 * Thin wrapper over `readAgentMcpConfig` that casts the unknown document
 * to the agent's typed config. Returns the same `AgentMcpReadResult` shape
 * as `cline.mcp.read`, but with the generic `config` field
 * narrowed to `ClineMcpConfig | null`.
 */
export async function readClineMcpConfig(
  ctx: PathResolutionContext,
): Promise<AgentMcpReadResult<ClineMcpConfig>> {
  return readAgentMcpConfig(cline, ctx) as Promise<
    AgentMcpReadResult<ClineMcpConfig>
  >;
}
