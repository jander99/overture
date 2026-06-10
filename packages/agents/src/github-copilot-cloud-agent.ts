// GitHub Copilot Cloud Agent definition.
import type { AgentDefinition } from './types.js';
import { defineAgent, notImplementedMcpHandlers } from './define-agent.js';

export const githubCopilotCloudAgent: AgentDefinition = defineAgent({
  id: 'github-copilot-cloud-agent',
  displayName: 'GitHub Copilot Cloud Agent',
  installMarkers: [],
  mcpLocations: [],
  defaultConfidence: 'unsupported',
  detectionStrategy: 'marker-only',
  mcpSupport: 'unsupported',
  executableNames: [],
  reason:
    'v1 filesystem-only detection cannot confirm GitHub Copilot cloud agent presence; it is repository/settings-based.',
  mcp: notImplementedMcpHandlers('github-copilot-cloud-agent'),
});
