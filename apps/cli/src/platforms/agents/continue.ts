// Continue agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type { AgentDefinition } from './types.js';

export const continueDef: AgentDefinition = {
  id: 'continue',
  displayName: 'Continue',
  installMarkers: [
    {
      id: 'continue-1-home-config',
      kind: 'file',
      base: 'home',
      relativePath: '.continue/config.json',
      confidence: 'medium',
      reason: 'User-global Continue configuration file',
    },
  ],
  mcpLocations: [
    {
      scope: 'user',
      base: 'home',
      relativePath: '.continue/config.json',
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'User-global MCP servers',
    },
  ],
  defaultConfidence: 'medium',
  detectionStrategy: 'marker-only',
  mcpSupport: 'supported',
  executableNames: [],
  mcp: notImplementedMcpHandlers('continue'),
};
