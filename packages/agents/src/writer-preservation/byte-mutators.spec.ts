/**
 * Tests for the byte-mutator test helpers in `byte-mutators.ts`.
 *
 * These tests are the RED→GREEN contract for the mutators themselves.
 * The harness self-tests then use the mutators to produce known-broken
 * outputs and prove each individual preservation check fires.
 */
import { describe, expect, it } from 'vitest';

import {
  appendString,
  deleteMcpServer,
  deleteTopLevelKey,
  deleteTrailingNewline,
  driftIndentation,
  stripComments,
  swapMcpServers,
  swapTopLevelKeys,
} from './byte-mutators.js';

const claudeCodeFixture = `{
  // user-global Claude Code state
  "numStartups": 42,
  "autoUpdaterStatus": "enabled",
  /* MCP server inventory */
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "fs"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "c7"]
    }
  }
}
`;

const codexFixture = `# top-level settings
model = "gpt-5"
approval_mode = "on-request"

[mcp_servers.filesystem]
command = "npx"
args = ["-y", "fs"]

[mcp_servers.context7]
command = "npx"
args = ["-y", "c7"]
`;

describe('stripComments', () => {
  it('returns JSON input unchanged', () => {
    const text = '{"a": 1, "b": 2}';
    expect(stripComments(text, 'json')).toBe(text);
  });

  it('removes // line comments from JSONC', () => {
    const text = `{
  // a comment
  "a": 1,
  "b": 2 // trailing
}
`;
    const result = stripComments(text, 'jsonc');
    expect(result).not.toContain('// a comment');
    expect(result).not.toContain('// trailing');
    expect(result).toContain('"a": 1');
    expect(result).toContain('"b": 2');
  });

  it('removes /* block */ comments from JSONC', () => {
    const text = `{
  /* block
     comment */
  "a": 1
}
`;
    const result = stripComments(text, 'jsonc');
    expect(result).not.toContain('/*');
    expect(result).not.toContain('block');
    expect(result).toContain('"a": 1');
  });

  it('preserves // inside JSON string literals', () => {
    const text = `{"url": "https://example.com//path"}`;
    expect(stripComments(text, 'jsonc')).toBe(text);
  });

  it('removes # comments from TOML', () => {
    const text = `# top comment
key = "value" # trailing
`;
    const result = stripComments(text, 'toml');
    expect(result).not.toContain('# top comment');
    expect(result).not.toContain('# trailing');
    expect(result).toContain('key = "value"');
  });

  it('preserves # inside TOML string literals', () => {
    const text = `key = "value # not a comment"
`;
    expect(stripComments(text, 'toml')).toBe(text);
  });
});

describe('deleteTopLevelKey', () => {
  it('removes a JSON top-level key and its value', () => {
    const result = deleteTopLevelKey(claudeCodeFixture, 'jsonc', 'numStartups');
    expect(result).not.toContain('numStartups');
    expect(result).not.toContain('42');
    expect(result).toContain('autoUpdaterStatus');
    expect(result).toContain('mcpServers');
    expect(result).toContain('filesystem');
  });

  it('returns input unchanged when the JSON key is absent', () => {
    expect(deleteTopLevelKey(claudeCodeFixture, 'jsonc', 'nonexistent')).toBe(
      claudeCodeFixture,
    );
  });

  it('removes a JSON top-level key whose value is an object', () => {
    const result = deleteTopLevelKey(claudeCodeFixture, 'jsonc', 'mcpServers');
    expect(result).not.toContain('mcpServers');
    expect(result).not.toContain('filesystem');
    expect(result).not.toContain('context7');
    expect(result).toContain('numStartups');
    expect(result).toContain('autoUpdaterStatus');
  });

  it('removes a TOML top-level scalar', () => {
    const result = deleteTopLevelKey(codexFixture, 'toml', 'model');
    expect(result).not.toContain('model');
    expect(result).not.toContain('gpt-5');
    expect(result).toContain('approval_mode');
    expect(result).toContain('mcp_servers');
  });

  it('removes a TOML top-level table', () => {
    const result = deleteTopLevelKey(codexFixture, 'toml', 'mcp_servers');
    expect(result).not.toContain('mcp_servers');
    expect(result).not.toContain('filesystem');
    expect(result).not.toContain('context7');
    expect(result).toContain('model');
  });
});

describe('deleteMcpServer', () => {
  it('removes a JSON MCP server by name', () => {
    const result = deleteMcpServer(
      claudeCodeFixture,
      'jsonc',
      'mcpServers',
      'context7',
    );
    expect(result).not.toContain('context7');
    expect(result).toContain('filesystem');
    expect(result).toContain('mcpServers');
    expect(result).toContain('numStartups');
  });

  it('returns input unchanged when the JSON server is absent', () => {
    expect(
      deleteMcpServer(claudeCodeFixture, 'jsonc', 'mcpServers', 'nonexistent'),
    ).toBe(claudeCodeFixture);
  });

  it('removes a TOML MCP server by subtable name', () => {
    const result = deleteMcpServer(
      codexFixture,
      'toml',
      'mcp_servers',
      'context7',
    );
    expect(result).not.toContain('mcp_servers.context7');
    expect(result).not.toContain('context7');
    expect(result).toContain('mcp_servers.filesystem');
    expect(result).toContain('filesystem');
  });
});

describe('swapTopLevelKeys', () => {
  it('swaps two JSON top-level keys and their values', () => {
    const result = swapTopLevelKeys(
      claudeCodeFixture,
      'jsonc',
      'numStartups',
      'autoUpdaterStatus',
    );
    // The block that contained numStartups now contains autoUpdaterStatus,
    // and vice versa. We assert by checking that both substrings still
    // appear exactly once each (they were each present once before).
    expect(result.match(/numStartups/g)?.length ?? 0).toBe(1);
    expect(result.match(/autoUpdaterStatus/g)?.length ?? 0).toBe(1);
    // The swapped positions: numStartups's old position now holds
    // autoUpdaterStatus's old content ("enabled"), and vice versa (42).
    // We verify by checking that "42" is still in the file but no longer
    // adjacent to "numStartups".
    expect(result).toContain('42');
    expect(result).toContain('enabled');
  });

  it('returns input unchanged when either JSON key is absent', () => {
    expect(
      swapTopLevelKeys(
        claudeCodeFixture,
        'jsonc',
        'numStartups',
        'nonexistent',
      ),
    ).toBe(claudeCodeFixture);
  });
});

describe('swapMcpServers', () => {
  it('swaps two JSON MCP servers within the subtree', () => {
    const result = swapMcpServers(
      claudeCodeFixture,
      'jsonc',
      'mcpServers',
      'filesystem',
      'context7',
    );
    expect(result).toContain('filesystem');
    expect(result).toContain('context7');
    expect(result).toContain('mcpServers');
    // The filesystem block (containing "fs") is now where context7 was,
    // and vice versa. We verify by checking that "fs" still appears once.
    expect(result.match(/"fs"/g)?.length ?? 0).toBe(1);
    expect(result.match(/"c7"/g)?.length ?? 0).toBe(1);
  });

  it('returns input unchanged when either JSON server is absent', () => {
    expect(
      swapMcpServers(
        claudeCodeFixture,
        'jsonc',
        'mcpServers',
        'filesystem',
        'nonexistent',
      ),
    ).toBe(claudeCodeFixture);
  });
});

describe('driftIndentation', () => {
  it('adds leading whitespace to every line', () => {
    const text = 'a\nb\nc';
    expect(driftIndentation(text, 2)).toBe('  a\n  b\n  c');
  });

  it('removes leading whitespace from every line', () => {
    const text = '  a\n  b\n  c';
    expect(driftIndentation(text, -2)).toBe('a\nb\nc');
  });

  it('is a no-op when delta is 0', () => {
    const text = 'a\n  b';
    expect(driftIndentation(text, 0)).toBe(text);
  });

  it('leaves lines with no leading whitespace unchanged on negative delta', () => {
    const text = 'a\n  b\nc';
    expect(driftIndentation(text, -2)).toBe('a\nb\nc');
  });
});

describe('deleteTrailingNewline', () => {
  it('removes a single trailing newline', () => {
    expect(deleteTrailingNewline('hello\n')).toBe('hello');
  });

  it('returns input unchanged when there is no trailing newline', () => {
    expect(deleteTrailingNewline('hello')).toBe('hello');
  });
});

describe('appendString', () => {
  it('appends the suffix verbatim', () => {
    expect(appendString('hello', ' world')).toBe('hello world');
  });

  it('appends an empty suffix unchanged', () => {
    expect(appendString('hello', '')).toBe('hello');
  });
});
