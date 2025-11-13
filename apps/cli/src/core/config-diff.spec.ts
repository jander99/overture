/**
 * Configuration Diff Tests
 *
 * @module core/config-diff.spec
 */

import { generateDiff, formatDiff, formatDiffSummary } from './config-diff';
import type { ClientMcpConfig } from '../adapters/client-adapter.interface';

describe('Config Diff', () => {
  describe('generateDiff', () => {
    it('should detect added MCPs', () => {
      const oldConfig: ClientMcpConfig = {
        mcpServers: {},
      };

      const newConfig: ClientMcpConfig = {
        mcpServers: {
          github: { command: 'gh', args: [] },
          filesystem: { command: 'fs', args: [] },
        },
      };

      const diff = generateDiff(oldConfig, newConfig);

      expect(diff.added).toEqual(['filesystem', 'github']);
      expect(diff.modified).toEqual([]);
      expect(diff.removed).toEqual([]);
      expect(diff.unchanged).toEqual([]);
      expect(diff.hasChanges).toBe(true);
    });

    it('should detect removed MCPs', () => {
      const oldConfig: ClientMcpConfig = {
        mcpServers: {
          github: { command: 'gh', args: [] },
          filesystem: { command: 'fs', args: [] },
        },
      };

      const newConfig: ClientMcpConfig = {
        mcpServers: {},
      };

      const diff = generateDiff(oldConfig, newConfig);

      expect(diff.added).toEqual([]);
      expect(diff.modified).toEqual([]);
      expect(diff.removed).toEqual(['filesystem', 'github']);
      expect(diff.unchanged).toEqual([]);
      expect(diff.hasChanges).toBe(true);
    });

    it('should detect modified MCPs with field-level changes', () => {
      const oldConfig: ClientMcpConfig = {
        mcpServers: {
          github: { command: 'old-gh', args: ['--old'] },
        },
      };

      const newConfig: ClientMcpConfig = {
        mcpServers: {
          github: { command: 'new-gh', args: ['--new'] },
        },
      };

      const diff = generateDiff(oldConfig, newConfig);

      expect(diff.added).toEqual([]);
      expect(diff.removed).toEqual([]);
      expect(diff.unchanged).toEqual([]);
      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].name).toBe('github');
      expect(diff.modified[0].fieldChanges).toHaveLength(2);
      expect(diff.modified[0].fieldChanges).toContainEqual({
        field: 'command',
        oldValue: 'old-gh',
        newValue: 'new-gh',
      });
      expect(diff.modified[0].fieldChanges).toContainEqual({
        field: 'args',
        oldValue: ['--old'],
        newValue: ['--new'],
      });
      expect(diff.hasChanges).toBe(true);
    });

    it('should detect unchanged MCPs', () => {
      const config: ClientMcpConfig = {
        mcpServers: {
          github: { command: 'gh', args: [] },
        },
      };

      const diff = generateDiff(config, config);

      expect(diff.added).toEqual([]);
      expect(diff.modified).toEqual([]);
      expect(diff.removed).toEqual([]);
      expect(diff.unchanged).toEqual(['github']);
      expect(diff.hasChanges).toBe(false);
    });

    it('should handle complex changes with multiple types', () => {
      const oldConfig: ClientMcpConfig = {
        mcpServers: {
          github: { command: 'gh', args: [] },
          filesystem: { command: 'fs', args: ['--old'] },
          removed: { command: 'rm', args: [] },
        },
      };

      const newConfig: ClientMcpConfig = {
        mcpServers: {
          github: { command: 'gh', args: [] }, // Unchanged
          filesystem: { command: 'fs', args: ['--new'] }, // Modified
          added: { command: 'add', args: [] }, // Added
        },
      };

      const diff = generateDiff(oldConfig, newConfig);

      expect(diff.added).toEqual(['added']);
      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].name).toBe('filesystem');
      expect(diff.removed).toEqual(['removed']);
      expect(diff.unchanged).toEqual(['github']);
      expect(diff.hasChanges).toBe(true);
    });

    it('should handle env variable changes', () => {
      const oldConfig: ClientMcpConfig = {
        mcpServers: {
          github: {
            command: 'gh',
            args: [],
            env: { TOKEN: 'old-token' }
          },
        },
      };

      const newConfig: ClientMcpConfig = {
        mcpServers: {
          github: {
            command: 'gh',
            args: [],
            env: { TOKEN: 'new-token' }
          },
        },
      };

      const diff = generateDiff(oldConfig, newConfig);

      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].fieldChanges).toContainEqual({
        field: 'env',
        oldValue: { TOKEN: 'old-token' },
        newValue: { TOKEN: 'new-token' },
      });
    });

    it('should work with "servers" root key (VS Code)', () => {
      const oldConfig: ClientMcpConfig = {
        servers: {
          github: { command: 'gh', args: [], type: 'stdio' },
        },
      };

      const newConfig: ClientMcpConfig = {
        servers: {
          github: { command: 'gh-new', args: [], type: 'stdio' },
        },
      };

      const diff = generateDiff(oldConfig, newConfig, 'servers');

      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].fieldChanges).toContainEqual({
        field: 'command',
        oldValue: 'gh',
        newValue: 'gh-new',
      });
    });

    it('should handle empty configs', () => {
      const emptyConfig: ClientMcpConfig = { mcpServers: {} };

      const diff = generateDiff(emptyConfig, emptyConfig);

      expect(diff.added).toEqual([]);
      expect(diff.modified).toEqual([]);
      expect(diff.removed).toEqual([]);
      expect(diff.unchanged).toEqual([]);
      expect(diff.hasChanges).toBe(false);
    });

    it('should sort results alphabetically', () => {
      const oldConfig: ClientMcpConfig = { mcpServers: {} };
      const newConfig: ClientMcpConfig = {
        mcpServers: {
          zebra: { command: 'z', args: [] },
          alpha: { command: 'a', args: [] },
          bravo: { command: 'b', args: [] },
        },
      };

      const diff = generateDiff(oldConfig, newConfig);

      expect(diff.added).toEqual(['alpha', 'bravo', 'zebra']);
    });
  });

  describe('formatDiff', () => {
    it('should format diff with no changes', () => {
      const diff = {
        added: [],
        modified: [],
        removed: [],
        unchanged: ['github'],
        hasChanges: false,
      };

      const formatted = formatDiff(diff, 'claude-code');

      expect(formatted).toContain('Configuration changes for claude-code');
      expect(formatted).toContain('No changes detected');
    });

    it('should format diff with added MCPs', () => {
      const diff = {
        added: ['filesystem', 'github'],
        modified: [],
        removed: [],
        unchanged: [],
        hasChanges: true,
      };

      const formatted = formatDiff(diff);

      expect(formatted).toContain('Added (2):');
      expect(formatted).toContain('+ filesystem');
      expect(formatted).toContain('+ github');
      expect(formatted).toContain('Total changes: 2 (2 added, 0 modified, 0 removed)');
    });

    it('should format diff with modified MCPs and field changes', () => {
      const diff = {
        added: [],
        modified: [{
          name: 'github',
          type: 'modified' as const,
          oldValue: { command: 'old' },
          newValue: { command: 'new' },
          fieldChanges: [
            { field: 'command', oldValue: 'old', newValue: 'new' },
          ],
        }],
        removed: [],
        unchanged: [],
        hasChanges: true,
      };

      const formatted = formatDiff(diff);

      expect(formatted).toContain('Modified (1):');
      expect(formatted).toContain('~ github');
      expect(formatted).toContain('- command:');
      expect(formatted).toContain('old: "old"');
      expect(formatted).toContain('new: "new"');
    });

    it('should format diff with removed MCPs', () => {
      const diff = {
        added: [],
        modified: [],
        removed: ['old-server'],
        unchanged: [],
        hasChanges: true,
      };

      const formatted = formatDiff(diff);

      expect(formatted).toContain('Removed (1):');
      expect(formatted).toContain('- old-server');
    });

    it('should format diff with all types of changes', () => {
      const diff = {
        added: ['new-mcp'],
        modified: [{
          name: 'modified-mcp',
          type: 'modified' as const,
          oldValue: {},
          newValue: {},
          fieldChanges: [],
        }],
        removed: ['removed-mcp'],
        unchanged: ['unchanged-mcp'],
        hasChanges: true,
      };

      const formatted = formatDiff(diff);

      expect(formatted).toContain('Added (1):');
      expect(formatted).toContain('Modified (1):');
      expect(formatted).toContain('Removed (1):');
      expect(formatted).toContain('Total changes: 3');
      expect(formatted).toContain('Unchanged: 1');
    });
  });

  describe('formatDiffSummary', () => {
    it('should format summary with no changes', () => {
      const diff = {
        added: [],
        modified: [],
        removed: [],
        unchanged: ['github'],
        hasChanges: false,
      };

      expect(formatDiffSummary(diff)).toBe('No changes');
    });

    it('should format summary with added only', () => {
      const diff = {
        added: ['a', 'b'],
        modified: [],
        removed: [],
        unchanged: [],
        hasChanges: true,
      };

      expect(formatDiffSummary(diff)).toBe('+2');
    });

    it('should format summary with modified only', () => {
      const diff = {
        added: [],
        modified: [{} as any, {} as any, {} as any],
        removed: [],
        unchanged: [],
        hasChanges: true,
      };

      expect(formatDiffSummary(diff)).toBe('~3');
    });

    it('should format summary with removed only', () => {
      const diff = {
        added: [],
        modified: [],
        removed: ['x'],
        unchanged: [],
        hasChanges: true,
      };

      expect(formatDiffSummary(diff)).toBe('-1');
    });

    it('should format summary with all types', () => {
      const diff = {
        added: ['a', 'b'],
        modified: [{} as any],
        removed: ['x', 'y', 'z'],
        unchanged: [],
        hasChanges: true,
      };

      expect(formatDiffSummary(diff)).toBe('+2, ~1, -3');
    });
  });
});
