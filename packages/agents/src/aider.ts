// Aider agent definition.
import { notImplementedMcpHandlers } from './types.js';
import type { AgentDefinition } from './types.js';

export const aider: AgentDefinition = {
  id: 'aider',
  displayName: 'Aider',
  installMarkers: [
    {
      id: 'aider-1-project-config',
      kind: 'file',
      base: 'workspace',
      relativePath: '.aider.conf.yml',
      confidence: 'low',
      reason:
        'Project-level Aider configuration file (weak proxy for Aider presence, not MCP client support)',
    },
  ],
  mcpLocations: [],
  defaultConfidence: 'unsupported',
  detectionStrategy: 'binary-first',
  mcpSupport: 'unsupported',
  executableNames: ['aider'],
  reason:
    'aider detection in v1 is filesystem-only; a stable first-party MCP config surface is unconfirmed. Marker present (e.g., .aider.conf.yml) can be reported, but the registry must not claim install from PATH.',
  mcp: notImplementedMcpHandlers('aider'),
};
