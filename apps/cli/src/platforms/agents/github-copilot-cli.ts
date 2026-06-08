// GitHub Copilot CLI agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type { AgentDefinition } from './types.js';

export const githubCopilotCli: AgentDefinition = {
  id: 'github-copilot-cli',
  displayName: 'GitHub Copilot CLI',
  installMarkers: [
    {
      id: 'github-copilot-cli-1-hosts-json',
      kind: 'file',
      base: 'config',
      relativePath: 'github-copilot/hosts.json',
      confidence: 'medium',
      reason: 'GitHub Copilot CLI hosts configuration',
    },
    {
      id: 'github-copilot-cli-2-intellij-json',
      kind: 'file',
      base: 'config',
      relativePath: 'github-copilot/intellij.json',
      confidence: 'low',
      reason: 'GitHub Copilot IntelliJ configuration (weak proxy)',
    },
  ],
  mcpLocations: [
    {
      scope: 'user',
      base: 'config',
      relativePath: 'github-copilot/hosts.json',
      format: 'json',
      topLevelKey: 'servers',
      notes: 'User-global MCP servers under servers key',
    },
  ],
  defaultConfidence: 'medium',
  detectionStrategy: 'binary-first',
  mcpSupport: 'supported',
  executableNames: ['copilot'],
  mcp: notImplementedMcpHandlers('github-copilot-cli'),
};
