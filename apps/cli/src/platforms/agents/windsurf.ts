// Windsurf agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type { AgentDefinition } from './types.js';

export const windsurf: AgentDefinition = {
  id: 'windsurf',
  displayName: 'Windsurf',
  installMarkers: [],
  mcpLocations: [
    {
      scope: 'user',
      base: 'home',
      relativePath: '.codeium/windsurf/mcp_config.json',
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'User-global MCP servers',
    },
  ],
  defaultConfidence: 'high',
  detectionStrategy: 'binary-first',
  mcpSupport: 'supported',
  executableNames: ['windsurf'],
  mcp: notImplementedMcpHandlers('windsurf'),
};
