// Roo Code agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type { AgentDefinition } from './types.js';
import type { McpServerMap, StringList, StringMap } from './types.js';

/**
 * Native Roo Code MCP server entry. Roo accepts either stdio-style servers
 * (with `command`/`args`/`env`) or remote servers (with `url`/`headers`)
 * and adds policy fields (`alwaysAllow`, `disabled`, `timeout`, `watchPaths`,
 * `disabledTools`) on top.
 */
export interface RooCodeMcpServer {
  command?: string;
  args?: StringList;
  env?: StringMap;
  url?: string;
  headers?: StringMap;
  alwaysAllow?: StringList;
  disabled?: boolean;
  timeout?: number;
  watchPaths?: StringList;
  disabledTools?: StringList;
}

/**
 * Native Roo Code MCP config shape. The top-level `mcpServers` key holds a
 * read-only map of server name to {@link RooCodeMcpServer} entries.
 */
export interface RooCodeMcpConfig {
  readonly mcpServers?: McpServerMap<RooCodeMcpServer>;
}

export const rooCode: AgentDefinition = {
  id: 'roo-code',
  displayName: 'Roo Code',
  installMarkers: [
    {
      id: 'roo-code-1-macos-global-storage',
      kind: 'file',
      base: 'home',
      relativePath:
        'Library/Application Support/Code/User/globalStorage/roo-cline.roo-cline/settings/mcp_settings.json',
      platforms: ['darwin'],
      confidence: 'medium',
      reason: 'macOS VS Code extension global storage for Roo Code',
    },
    {
      id: 'roo-code-2-linux-global-storage',
      kind: 'file',
      base: 'config',
      relativePath:
        'Code/User/globalStorage/roo-cline.roo-cline/settings/mcp_settings.json',
      platforms: ['linux'],
      confidence: 'medium',
      reason: 'Linux VS Code extension global storage for Roo Code',
    },
    {
      id: 'roo-code-3-windows-global-storage',
      kind: 'file',
      base: 'config',
      relativePath:
        'Code/User/globalStorage/roo-cline.roo-cline/settings/mcp_settings.json',
      platforms: ['win32'],
      confidence: 'medium',
      reason: 'Windows VS Code extension global storage for Roo Code',
    },
  ],
  mcpLocations: [
    {
      scope: 'user',
      base: 'home',
      relativePath:
        'Library/Application Support/Code/User/globalStorage/roo-cline.roo-cline/settings/mcp_settings.json',
      platforms: ['darwin'],
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'macOS user-global MCP servers',
    },
    {
      scope: 'user',
      base: 'config',
      relativePath:
        'Code/User/globalStorage/roo-cline.roo-cline/settings/mcp_settings.json',
      platforms: ['linux'],
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'Linux user-global MCP servers',
    },
    {
      scope: 'user',
      base: 'config',
      relativePath:
        'Code/User/globalStorage/roo-cline.roo-cline/settings/mcp_settings.json',
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
  mcp: notImplementedMcpHandlers('roo-code'),
};
