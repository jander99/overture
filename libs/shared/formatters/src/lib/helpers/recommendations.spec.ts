/**
 * @overture/formatters
 *
 * Tests for RecommendationsHelper
 */

import { describe, it, expect } from 'vitest';
import {
  getInstallRecommendation,
  getMcpInstallRecommendation,
} from './recommendations.js';
import type { ClientName } from '@overture/config-types';

describe('RecommendationsHelper', () => {
  describe('getInstallRecommendation', () => {
    it('should return recommendation for claude-code', () => {
      const result = getInstallRecommendation('claude-code');
      expect(result).toBe(
        'Install Claude Code CLI: https://claude.com/claude-code',
      );
    });

    it('should return recommendation for copilot-cli', () => {
      const result = getInstallRecommendation('copilot-cli');
      expect(result).toBe(
        'Install GitHub Copilot CLI: npm install -g @github/copilot',
      );
    });

    it('should return recommendation for opencode', () => {
      const result = getInstallRecommendation('opencode');
      expect(result).toBe('Install OpenCode: https://opencode.ai');
    });

    it('should return null for unknown client', () => {
      const result = getInstallRecommendation('unknown-client' as ClientName);
      expect(result).toBeNull();
    });
  });

  describe('getMcpInstallRecommendation', () => {
    it('should return Node.js recommendation for npx', () => {
      const result = getMcpInstallRecommendation('npx');
      expect(result).toBe('Install Node.js: https://nodejs.org');
    });

    it('should return uv recommendation for uvx', () => {
      const result = getMcpInstallRecommendation('uvx');
      expect(result).toBe('Install uv: https://docs.astral.sh/uv/');
    });

    it('should return npx command for mcp-server-* commands', () => {
      const result = getMcpInstallRecommendation('mcp-server-filesystem');
      expect(result).toBe('Try: npx -y mcp-server-filesystem');
    });

    it('should return generic PATH recommendation for other commands', () => {
      const result = getMcpInstallRecommendation('custom-command');
      expect(result).toBe(
        'Ensure custom-command is installed and available in PATH',
      );
    });

    it('should handle mcp-server prefix correctly', () => {
      const result = getMcpInstallRecommendation('mcp-server-memory');
      expect(result).toBe('Try: npx -y mcp-server-memory');
    });
  });
});
