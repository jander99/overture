// Claude Code agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type { AgentDefinition } from './types.js';

export const claudeCode: AgentDefinition = {
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
  mcp: notImplementedMcpHandlers('claude-code'),
};
