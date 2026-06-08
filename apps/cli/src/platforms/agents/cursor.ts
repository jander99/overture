// Cursor agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type { AgentDefinition } from './types.js';

export const cursor: AgentDefinition = {
  id: 'cursor',
  displayName: 'Cursor',
  installMarkers: [
    {
      id: 'cursor-1-home-mcp',
      kind: 'file',
      base: 'home',
      relativePath: '.cursor/mcp.json',
      confidence: 'high',
      reason: 'User-global Cursor MCP configuration',
    },
    {
      id: 'cursor-2-project-mcp',
      kind: 'file',
      base: 'workspace',
      relativePath: '.cursor/mcp.json',
      confidence: 'high',
      reason: 'Project-level Cursor MCP configuration',
    },
  ],
  mcpLocations: [
    {
      scope: 'user',
      base: 'home',
      relativePath: '.cursor/mcp.json',
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'User-global MCP servers',
    },
    {
      scope: 'project',
      base: 'workspace',
      relativePath: '.cursor/mcp.json',
      format: 'json',
      topLevelKey: 'mcpServers',
      notes: 'Project-level MCP servers',
    },
  ],
  defaultConfidence: 'high',
  detectionStrategy: 'marker-only',
  mcpSupport: 'supported',
  executableNames: ['cursor'],
  mcp: notImplementedMcpHandlers('cursor'),
};
