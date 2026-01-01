/**
 * @overture/formatters
 *
 * RecommendationsHelper - Utility functions for generating installation recommendations
 *
 * Responsibilities:
 * - Provide installation recommendations for missing AI clients
 * - Provide installation recommendations for missing MCP commands
 * - Generate actionable guidance for users
 */

import type { ClientName } from '@overture/config-types';

/**
 * Installation recommendation with optional URL
 */
export interface InstallRecommendation {
  message: string;
  url?: string;
}

/**
 * Get installation recommendation for a client
 */
export function getInstallRecommendation(client: ClientName): string | null {
  const recommendations: Record<ClientName, string> = {
    'claude-code': 'Install Claude Code CLI: https://claude.com/claude-code',
    'copilot-cli': 'Install GitHub Copilot CLI: npm install -g @github/copilot',
    opencode: 'Install OpenCode: https://opencode.ai',
  };

  return Object.hasOwn(recommendations, client)
    ? // eslint-disable-next-line security/detect-object-injection
      recommendations[client]
    : null;
}

/**
 * Get installation recommendation for an MCP command
 */
export function getMcpInstallRecommendation(command: string): string | null {
  if (command === 'npx') {
    return 'Install Node.js: https://nodejs.org';
  }
  if (command === 'uvx') {
    return 'Install uv: https://docs.astral.sh/uv/';
  }
  if (command.startsWith('mcp-server-')) {
    return `Try: npx -y ${command}`;
  }

  return `Ensure ${command} is installed and available in PATH`;
}
