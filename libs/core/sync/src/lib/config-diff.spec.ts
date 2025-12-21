/**
 * Configuration Diff Tests
 *
 * Comprehensive tests for config diff generation utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  generateDiff,
  formatDiff,
  formatDiffSummary,
  type ConfigDiff,
} from './config-diff.js';
import type { ClientMcpConfig } from '@overture/client-adapters';

// Helper to create valid client MCP configs for testing
function createConfig(
  servers: Record<
    string,
    { command: string; args?: string[]; env?: Record<string, string> }
  >,
): ClientMcpConfig {
  const mcpServers: Record<string, any> = {};
  for (const [name, config] of Object.entries(servers)) {
    mcpServers[name] = {
      command: config.command,
      args: config.args ?? [],
      env: config.env,
    };
  }
  return { mcpServers };
}

describe('generateDiff', () => {
  it('should detect added MCPs', () => {
    const oldConfig = createConfig({});
    const newConfig = createConfig({ github: { command: 'mcp-github' } });

    const result = generateDiff(oldConfig, newConfig);

    expect(result.added).toEqual(['github']);
    expect(result.modified).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.hasChanges).toBe(true);
  });

  it('should detect removed MCPs', () => {
    const oldConfig = createConfig({ github: { command: 'mcp-github' } });
    const newConfig = createConfig({});

    const result = generateDiff(oldConfig, newConfig);

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual(['github']);
    expect(result.hasChanges).toBe(true);
  });

  it('should detect modified MCPs', () => {
    const oldConfig = createConfig({ github: { command: 'old-cmd' } });
    const newConfig = createConfig({ github: { command: 'new-cmd' } });

    const result = generateDiff(oldConfig, newConfig);

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].name).toBe('github');
    expect(result.modified[0].type).toBe('modified');
    expect(result.hasChanges).toBe(true);
  });

  it('should detect unchanged MCPs', () => {
    const config = createConfig({ github: { command: 'mcp-github' } });

    const result = generateDiff(config, config);

    expect(result.unchanged).toEqual(['github']);
    expect(result.hasChanges).toBe(false);
  });

  it('should handle multiple changes', () => {
    const oldConfig = createConfig({
      keep: { command: 'keep-cmd' },
      modify: { command: 'old-cmd' },
      remove: { command: 'remove-cmd' },
    });
    const newConfig = createConfig({
      keep: { command: 'keep-cmd' },
      modify: { command: 'new-cmd' },
      add: { command: 'add-cmd' },
    });

    const result = generateDiff(oldConfig, newConfig);

    expect(result.added).toEqual(['add']);
    expect(result.removed).toEqual(['remove']);
    expect(result.unchanged).toEqual(['keep']);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].name).toBe('modify');
    expect(result.hasChanges).toBe(true);
  });

  it('should detect field-level changes in modified MCPs', () => {
    const oldConfig = createConfig({
      github: { command: 'mcp-github', args: ['--old'] },
    });
    const newConfig = createConfig({
      github: { command: 'mcp-github', args: ['--new'] },
    });

    const result = generateDiff(oldConfig, newConfig);

    expect(result.modified[0].fieldChanges).toHaveLength(1);
    expect(result.modified[0].fieldChanges?.[0].field).toBe('args');
    expect(result.modified[0].fieldChanges?.[0].oldValue).toEqual(['--old']);
    expect(result.modified[0].fieldChanges?.[0].newValue).toEqual(['--new']);
  });

  it('should handle empty configs', () => {
    const result = generateDiff(createConfig({}), createConfig({}));

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.modified).toEqual([]);
    expect(result.unchanged).toEqual([]);
    expect(result.hasChanges).toBe(false);
  });

  it('should handle missing root keys', () => {
    const result = generateDiff({} as ClientMcpConfig, {} as ClientMcpConfig);

    expect(result.hasChanges).toBe(false);
  });

  it('should use custom root key', () => {
    const oldConfig = {
      servers: { mcp1: { command: 'cmd1', args: [] } },
    } as ClientMcpConfig;
    const newConfig = {
      servers: { mcp2: { command: 'cmd2', args: [] } },
    } as ClientMcpConfig;

    const result = generateDiff(oldConfig, newConfig, 'servers');

    expect(result.added).toEqual(['mcp2']);
    expect(result.removed).toEqual(['mcp1']);
  });

  it('should sort results alphabetically', () => {
    const oldConfig = createConfig({});
    const newConfig = createConfig({
      zebra: { command: 'z' },
      alpha: { command: 'a' },
      middle: { command: 'm' },
    });

    const result = generateDiff(oldConfig, newConfig);

    expect(result.added).toEqual(['alpha', 'middle', 'zebra']);
  });

  it('should handle nested object changes', () => {
    const oldConfig = createConfig({
      github: { command: 'cmd', env: { TOKEN: 'old-token' } },
    });
    const newConfig = createConfig({
      github: { command: 'cmd', env: { TOKEN: 'new-token' } },
    });

    const result = generateDiff(oldConfig, newConfig);

    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].fieldChanges).toContainEqual({
      field: 'env',
      oldValue: { TOKEN: 'old-token' },
      newValue: { TOKEN: 'new-token' },
    });
  });

  it('should detect added fields in MCP config', () => {
    // Create configs with explicit args arrays to match detectFieldChanges behavior
    const oldConfig: ClientMcpConfig = {
      mcpServers: { github: { command: 'cmd', args: [] } },
    };
    const newConfig: ClientMcpConfig = {
      mcpServers: { github: { command: 'cmd', args: ['--verbose'] } },
    };

    const result = generateDiff(oldConfig, newConfig);

    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].fieldChanges).toContainEqual({
      field: 'args',
      oldValue: [],
      newValue: ['--verbose'],
    });
  });

  it('should detect removed fields in MCP config', () => {
    const oldConfig: ClientMcpConfig = {
      mcpServers: { github: { command: 'cmd', args: ['--verbose'] } },
    };
    const newConfig: ClientMcpConfig = {
      mcpServers: { github: { command: 'cmd', args: [] } },
    };

    const result = generateDiff(oldConfig, newConfig);

    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].fieldChanges).toContainEqual({
      field: 'args',
      oldValue: ['--verbose'],
      newValue: [],
    });
  });

  it('should detect when field is added', () => {
    const oldConfig: ClientMcpConfig = {
      mcpServers: { github: { command: 'cmd', args: [] } },
    };
    const newConfig: ClientMcpConfig = {
      mcpServers: {
        github: { command: 'cmd', args: [], env: { TOKEN: 'secret' } },
      },
    };

    const result = generateDiff(oldConfig, newConfig);

    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].fieldChanges).toContainEqual({
      field: 'env',
      oldValue: undefined,
      newValue: { TOKEN: 'secret' },
    });
  });
});

describe('formatDiff', () => {
  it('should format diff with no changes', () => {
    const diff: ConfigDiff = {
      added: [],
      modified: [],
      removed: [],
      unchanged: ['github'],
      hasChanges: false,
    };

    const result = formatDiff(diff);

    expect(result).toContain('No changes detected');
  });

  it('should format diff with client name', () => {
    const diff: ConfigDiff = {
      added: ['github'],
      modified: [],
      removed: [],
      unchanged: [],
      hasChanges: true,
    };

    const result = formatDiff(diff, 'Claude Code');

    expect(result).toContain('Configuration changes for Claude Code');
  });

  it('should format added MCPs', () => {
    const diff: ConfigDiff = {
      added: ['github', 'filesystem'],
      modified: [],
      removed: [],
      unchanged: [],
      hasChanges: true,
    };

    const result = formatDiff(diff);

    expect(result).toContain('Added (2)');
    expect(result).toContain('+ github');
    expect(result).toContain('+ filesystem');
  });

  it('should format removed MCPs', () => {
    const diff: ConfigDiff = {
      added: [],
      modified: [],
      removed: ['slack'],
      unchanged: [],
      hasChanges: true,
    };

    const result = formatDiff(diff);

    expect(result).toContain('Removed (1)');
    expect(result).toContain('- slack');
  });

  it('should format modified MCPs with field changes', () => {
    const diff: ConfigDiff = {
      added: [],
      modified: [
        {
          name: 'github',
          type: 'modified',
          oldValue: { command: 'old' },
          newValue: { command: 'new' },
          fieldChanges: [
            { field: 'command', oldValue: 'old', newValue: 'new' },
          ],
        },
      ],
      removed: [],
      unchanged: [],
      hasChanges: true,
    };

    const result = formatDiff(diff);

    expect(result).toContain('Modified (1)');
    expect(result).toContain('~ github');
    expect(result).toContain('command:');
    expect(result).toContain('old: "old"');
    expect(result).toContain('new: "new"');
  });

  it('should include summary', () => {
    const diff: ConfigDiff = {
      added: ['a', 'b'],
      modified: [{ name: 'm', type: 'modified', oldValue: {}, newValue: {} }],
      removed: ['r'],
      unchanged: ['u'],
      hasChanges: true,
    };

    const result = formatDiff(diff);

    expect(result).toContain('Total changes: 4');
    expect(result).toContain('2 added');
    expect(result).toContain('1 modified');
    expect(result).toContain('1 removed');
    expect(result).toContain('Unchanged: 1');
  });

  it('should format undefined values', () => {
    const diff: ConfigDiff = {
      added: [],
      modified: [
        {
          name: 'test',
          type: 'modified',
          oldValue: {},
          newValue: {},
          fieldChanges: [
            { field: 'args', oldValue: undefined, newValue: ['new'] },
          ],
        },
      ],
      removed: [],
      unchanged: [],
      hasChanges: true,
    };

    const result = formatDiff(diff);

    expect(result).toContain('old: <undefined>');
  });

  it('should format null values', () => {
    const diff: ConfigDiff = {
      added: [],
      modified: [
        {
          name: 'test',
          type: 'modified',
          oldValue: {},
          newValue: {},
          fieldChanges: [{ field: 'env', oldValue: null, newValue: {} }],
        },
      ],
      removed: [],
      unchanged: [],
      hasChanges: true,
    };

    const result = formatDiff(diff);

    expect(result).toContain('old: <null>');
  });
});

describe('formatDiffSummary', () => {
  it('should return "No changes" when no changes', () => {
    const diff: ConfigDiff = {
      added: [],
      modified: [],
      removed: [],
      unchanged: ['github'],
      hasChanges: false,
    };

    expect(formatDiffSummary(diff)).toBe('No changes');
  });

  it('should format only added', () => {
    const diff: ConfigDiff = {
      added: ['a', 'b'],
      modified: [],
      removed: [],
      unchanged: [],
      hasChanges: true,
    };

    expect(formatDiffSummary(diff)).toBe('+2');
  });

  it('should format only modified', () => {
    const diff: ConfigDiff = {
      added: [],
      modified: [{ name: 'm', type: 'modified', oldValue: {}, newValue: {} }],
      removed: [],
      unchanged: [],
      hasChanges: true,
    };

    expect(formatDiffSummary(diff)).toBe('~1');
  });

  it('should format only removed', () => {
    const diff: ConfigDiff = {
      added: [],
      modified: [],
      removed: ['r'],
      unchanged: [],
      hasChanges: true,
    };

    expect(formatDiffSummary(diff)).toBe('-1');
  });

  it('should format all change types', () => {
    const diff: ConfigDiff = {
      added: ['a'],
      modified: [{ name: 'm', type: 'modified', oldValue: {}, newValue: {} }],
      removed: ['r', 'r2'],
      unchanged: [],
      hasChanges: true,
    };

    expect(formatDiffSummary(diff)).toBe('+1, ~1, -2');
  });
});
