// Zed agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type { AgentDefinition } from './types.js';

export const zed: AgentDefinition = {
  id: 'zed',
  displayName: 'Zed',
  installMarkers: [
    {
      id: 'zed-1-home-settings',
      kind: 'file',
      base: 'config',
      relativePath: 'zed/settings.json',
      confidence: 'medium',
      reason: 'User-global Zed settings file',
    },
  ],
  mcpLocations: [
    {
      scope: 'user',
      base: 'config',
      relativePath: 'zed/settings.json',
      format: 'json',
      topLevelKey: 'context_servers',
      notes:
        'User-global context servers (Zed refers to MCP as context servers)',
    },
  ],
  defaultConfidence: 'medium',
  detectionStrategy: 'marker-only',
  mcpSupport: 'supported',
  executableNames: ['zed'],
  mcp: notImplementedMcpHandlers('zed'),
};
