// GitHub Copilot Cloud Agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type { AgentDefinition } from './types.js';

export const githubCopilotCloudAgent: AgentDefinition = {
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
};
