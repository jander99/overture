// OpenAI Codex agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type { AgentDefinition } from './types.js';

export const openaiCodex: AgentDefinition = {
  id: 'openai-codex',
  displayName: 'OpenAI Codex',
  installMarkers: [
    {
      id: 'openai-codex-1-home-config',
      kind: 'file',
      base: 'home',
      relativePath: '.codex/config.toml',
      confidence: 'high',
      reason: 'User-global OpenAI Codex configuration file',
    },
    {
      id: 'openai-codex-2-project-config',
      kind: 'file',
      base: 'workspace',
      relativePath: '.codex/config.toml',
      confidence: 'high',
      reason: 'Project-level OpenAI Codex configuration file',
    },
  ],
  mcpLocations: [
    {
      scope: 'user',
      base: 'home',
      relativePath: '.codex/config.toml',
      format: 'toml',
      topLevelKey: 'mcp_servers',
      notes: 'User-global MCP servers as TOML tables',
    },
    {
      scope: 'project',
      base: 'workspace',
      relativePath: '.codex/config.toml',
      format: 'toml',
      topLevelKey: 'mcp_servers',
      notes: 'Project-level MCP servers as TOML tables',
    },
  ],
  defaultConfidence: 'high',
  detectionStrategy: 'binary-first',
  mcpSupport: 'supported',
  executableNames: ['codex'],
  mcp: notImplementedMcpHandlers('openai-codex'),
};
