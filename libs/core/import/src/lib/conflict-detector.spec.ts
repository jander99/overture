/**
 * MCP Conflict Detector Tests
 *
 * @module @overture/import-core/conflict-detector.spec
 */

import { describe, it, expect } from 'vitest';
import { detectConflicts, formatConflict } from './conflict-detector.js';
import type { DiscoveredMcp } from '@overture/config-types';

describe('conflict-detector', () => {
  describe('detectConflicts', () => {
    it('should detect no conflicts when MCPs are unique', () => {
      const discovered: DiscoveredMcp[] = [
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          transport: 'stdio',
          source: {
            client: 'claude-code',
            location: '~/.claude.json',
            locationType: 'global',
            filePath: '/home/user/.claude.json',
          },
          suggestedScope: 'global',
        },
        {
          name: 'memory',
          command: 'npx',
          args: ['-y', 'mcp-server-memory'],
          transport: 'stdio',
          source: {
            client: 'opencode',
            location: '~/opencode.json',
            locationType: 'global',
            filePath: '/home/user/.config/opencode/opencode.json',
          },
          suggestedScope: 'global',
        },
      ];

      const conflicts = detectConflicts(discovered);
      expect(conflicts).toHaveLength(0);
    });

    it('should NOT detect conflicts when same MCP has identical config', () => {
      const discovered: DiscoveredMcp[] = [
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/home'],
          transport: 'stdio',
          source: {
            client: 'claude-code',
            location: '~/.claude.json',
            locationType: 'global',
            filePath: '/home/user/.claude.json',
          },
          suggestedScope: 'global',
        },
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/home'],
          transport: 'stdio',
          source: {
            client: 'opencode',
            location: '~/opencode.json',
            locationType: 'global',
            filePath: '/home/user/.config/opencode/opencode.json',
          },
          suggestedScope: 'global',
        },
      ];

      const conflicts = detectConflicts(discovered);
      expect(conflicts).toHaveLength(0);
    });

    it('should detect conflicts with different commands', () => {
      const discovered: DiscoveredMcp[] = [
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          transport: 'stdio',
          source: {
            client: 'claude-code',
            location: '~/.claude.json',
            locationType: 'global',
            filePath: '/home/user/.claude.json',
          },
          suggestedScope: 'global',
        },
        {
          name: 'filesystem',
          command: 'node',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          transport: 'stdio',
          source: {
            client: 'opencode',
            location: '~/opencode.json',
            locationType: 'global',
            filePath: '/home/user/.config/opencode/opencode.json',
          },
          suggestedScope: 'global',
        },
      ];

      const conflicts = detectConflicts(discovered);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].name).toBe('filesystem');
      expect(conflicts[0].reason).toBe('different-command');
      expect(conflicts[0].sources).toHaveLength(2);
    });

    it('should detect conflicts with different args', () => {
      const discovered: DiscoveredMcp[] = [
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user'],
          transport: 'stdio',
          source: {
            client: 'claude-code',
            location: '~/.claude.json',
            locationType: 'global',
            filePath: '/home/user/.claude.json',
          },
          suggestedScope: 'global',
        },
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/different/path'],
          transport: 'stdio',
          source: {
            client: 'opencode',
            location: '~/opencode.json',
            locationType: 'global',
            filePath: '/home/user/.config/opencode/opencode.json',
          },
          suggestedScope: 'global',
        },
      ];

      const conflicts = detectConflicts(discovered);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].name).toBe('filesystem');
      expect(conflicts[0].reason).toBe('different-args');
    });

    it('should detect conflicts with different env vars', () => {
      const discovered: DiscoveredMcp[] = [
        {
          name: 'github',
          command: 'mcp-server-github',
          args: [],
          env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
          transport: 'stdio',
          source: {
            client: 'claude-code',
            location: '~/.claude.json',
            locationType: 'global',
            filePath: '/home/user/.claude.json',
          },
          suggestedScope: 'global',
        },
        {
          name: 'github',
          command: 'mcp-server-github',
          args: [],
          env: { GITHUB_TOKEN: '${DIFFERENT_TOKEN}' },
          transport: 'stdio',
          source: {
            client: 'opencode',
            location: '~/opencode.json',
            locationType: 'global',
            filePath: '/home/user/.config/opencode/opencode.json',
          },
          suggestedScope: 'global',
        },
      ];

      const conflicts = detectConflicts(discovered);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].name).toBe('github');
      expect(conflicts[0].reason).toBe('different-env');
    });

    it('should handle MCPs with no env vars', () => {
      const discovered: DiscoveredMcp[] = [
        {
          name: 'memory',
          command: 'npx',
          args: ['-y', 'mcp-server-memory'],
          transport: 'stdio',
          source: {
            client: 'claude-code',
            location: '~/.claude.json',
            locationType: 'global',
            filePath: '/home/user/.claude.json',
          },
          suggestedScope: 'global',
        },
        {
          name: 'memory',
          command: 'npx',
          args: ['-y', 'mcp-server-memory'],
          transport: 'stdio',
          source: {
            client: 'opencode',
            location: '~/opencode.json',
            locationType: 'global',
            filePath: '/home/user/.config/opencode/opencode.json',
          },
          suggestedScope: 'global',
        },
      ];

      const conflicts = detectConflicts(discovered);
      expect(conflicts).toHaveLength(0);
    });

    it('should detect multiple conflicts', () => {
      const discovered: DiscoveredMcp[] = [
        // Conflict 1: filesystem - different args
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/home'],
          transport: 'stdio',
          source: {
            client: 'claude-code',
            location: '~/.claude.json',
            locationType: 'global',
            filePath: '/home/user/.claude.json',
          },
          suggestedScope: 'global',
        },
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/root'],
          transport: 'stdio',
          source: {
            client: 'opencode',
            location: '~/opencode.json',
            locationType: 'global',
            filePath: '/home/user/.config/opencode/opencode.json',
          },
          suggestedScope: 'global',
        },
        // Conflict 2: github - different command
        {
          name: 'github',
          command: 'mcp-server-github',
          args: [],
          transport: 'stdio',
          source: {
            client: 'claude-code',
            location: '~/.claude.json',
            locationType: 'global',
            filePath: '/home/user/.claude.json',
          },
          suggestedScope: 'global',
        },
        {
          name: 'github',
          command: 'github-mcp-server',
          args: [],
          transport: 'stdio',
          source: {
            client: 'copilot-cli',
            location: '~/.config/github-copilot/mcp.json',
            locationType: 'global',
            filePath: '/home/user/.config/github-copilot/mcp.json',
          },
          suggestedScope: 'global',
        },
      ];

      const conflicts = detectConflicts(discovered);
      expect(conflicts).toHaveLength(2);
      expect(conflicts.map((c) => c.name)).toContain('filesystem');
      expect(conflicts.map((c) => c.name)).toContain('github');
    });

    it('should handle empty array', () => {
      const conflicts = detectConflicts([]);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('formatConflict', () => {
    it('should format conflict with different commands', () => {
      const conflict = {
        name: 'filesystem',
        sources: [
          {
            client: 'claude-code' as const,
            location: '~/.claude.json',
            locationType: 'global' as const,
            filePath: '/home/user/.claude.json',
          },
          {
            client: 'opencode' as const,
            location: '~/opencode.json',
            locationType: 'global' as const,
            filePath: '/home/user/.config/opencode/opencode.json',
          },
        ],
        configs: [
          {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
          },
          {
            command: 'node',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
          },
        ],
        reason: 'different-command' as const,
      };

      const formatted = formatConflict(conflict);

      expect(formatted).toContain('filesystem');
      expect(formatted).toContain('claude-code');
      expect(formatted).toContain('opencode');
      expect(formatted).toContain('Different commands');
      expect(formatted).toContain('npx');
      expect(formatted).toContain('node');
    });

    it('should format conflict with environment variables', () => {
      const conflict = {
        name: 'github',
        sources: [
          {
            client: 'claude-code' as const,
            location: '~/.claude.json',
            locationType: 'global' as const,
            filePath: '/home/user/.claude.json',
          },
        ],
        configs: [
          {
            command: 'mcp-server-github',
            args: [],
            env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
          },
        ],
        reason: 'different-env' as const,
      };

      const formatted = formatConflict(conflict);

      expect(formatted).toContain('github');
      expect(formatted).toContain('Different environment variables');
      expect(formatted).toContain('GITHUB_TOKEN');
    });

    it('should format conflict with different args', () => {
      const conflict = {
        name: 'filesystem',
        sources: [
          {
            client: 'claude-code' as const,
            location: '~/.claude.json',
            locationType: 'global' as const,
            filePath: '/home/user/.claude.json',
          },
        ],
        configs: [
          {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/home'],
          },
        ],
        reason: 'different-args' as const,
      };

      const formatted = formatConflict(conflict);

      expect(formatted).toContain('filesystem');
      expect(formatted).toContain('Different arguments');
      expect(formatted).toContain('["-y","@modelcontextprotocol/server-filesystem","/home"]');
    });
  });
});
