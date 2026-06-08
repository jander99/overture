// GitHub Copilot in VS Code agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type { AgentDefinition } from './types.js';

export const githubCopilotVscode: AgentDefinition = {
  id: 'github-copilot-vscode',
  displayName: 'GitHub Copilot in VS Code',
  installMarkers: [
    {
      id: 'github-copilot-vscode-1-workspace-mcp',
      kind: 'file',
      base: 'workspace',
      relativePath: '.vscode/mcp.json',
      confidence: 'medium',
      reason: 'Workspace-level VS Code MCP configuration',
    },
    {
      id: 'github-copilot-vscode-2-user-mcp',
      kind: 'file',
      base: 'home',
      relativePath: '.vscode/mcp.json',
      confidence: 'medium',
      reason: 'User-global VS Code MCP configuration',
    },
  ],
  mcpLocations: [
    {
      scope: 'project',
      base: 'workspace',
      relativePath: '.vscode/mcp.json',
      format: 'json',
      topLevelKey: 'servers',
      notes: 'Workspace-level MCP servers under servers key',
    },
    {
      scope: 'user',
      base: 'home',
      relativePath: '.vscode/mcp.json',
      format: 'json',
      topLevelKey: 'servers',
      notes: 'User-global MCP servers under servers key',
    },
  ],
  defaultConfidence: 'medium',
  detectionStrategy: 'marker-only',
  mcpSupport: 'supported',
  executableNames: [],
  mcp: notImplementedMcpHandlers('github-copilot-vscode'),
};
