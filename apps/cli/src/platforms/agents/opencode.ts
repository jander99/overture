// OpenCode agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type { AgentDefinition } from './types.js';

export const opencode: AgentDefinition = {
  id: 'opencode',
  displayName: 'OpenCode',
  installMarkers: [
    {
      id: 'opencode-1-config-json',
      kind: 'file',
      base: 'config',
      relativePath: 'opencode/opencode.json',
      confidence: 'high',
      reason: 'Primary OpenCode configuration file under XDG config',
    },
    {
      id: 'opencode-2-home-json',
      kind: 'file',
      base: 'home',
      relativePath: '.opencode.json',
      confidence: 'high',
      reason: 'Alternative OpenCode configuration file in home directory',
    },
  ],
  mcpLocations: [
    {
      scope: 'user',
      base: 'config',
      relativePath: 'opencode/opencode.json',
      format: 'json',
      topLevelKey: 'mcp',
      notes: 'User-global MCP configuration under mcp key',
    },
    {
      scope: 'user',
      base: 'home',
      relativePath: '.opencode.json',
      format: 'json',
      topLevelKey: 'mcp',
      notes: 'Alternative user-global MCP configuration under mcp key',
    },
  ],
  defaultConfidence: 'high',
  detectionStrategy: 'binary-first',
  mcpSupport: 'supported',
  executableNames: ['opencode'],
  mcp: notImplementedMcpHandlers('opencode'),
};
