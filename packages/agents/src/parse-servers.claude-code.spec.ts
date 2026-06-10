// Tests for the claude-code parseServers handler.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseClaudeCodeMcpServers } from './claude-code.js';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'parse-servers-claude-code-'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

function writeFile(name: string, contents: string): string {
  const p = join(workdir, name);
  writeFileSync(p, contents);
  return p;
}

describe('parseClaudeCodeMcpServers', () => {
  it('returns [] for an unreadable path', () => {
    expect(parseClaudeCodeMcpServers('/no/such/file')).toEqual([]);
  });

  it('returns [] for malformed JSON', () => {
    const p = writeFile('bad.json', '{ not valid');
    expect(parseClaudeCodeMcpServers(p)).toEqual([]);
  });

  it('extracts a local stdio server', () => {
    const p = writeFile(
      'local.json',
      JSON.stringify({
        mcpServers: {
          shared: { command: '/path/to/server', args: [], env: {} },
        },
      }),
    );
    expect(parseClaudeCodeMcpServers(p)).toEqual([
      { name: 'shared', transport: 'local', command: ['/path/to/server'] },
    ]);
  });

  it('extracts a remote HTTP server with headers', () => {
    const p = writeFile(
      'remote.json',
      JSON.stringify({
        mcpServers: {
          remote: {
            type: 'http',
            url: 'https://mcp.example.com/mcp',
            headers: { Authorization: 'Bearer ${MCP_TOKEN}' },
          },
        },
      }),
    );
    expect(parseClaudeCodeMcpServers(p)).toEqual([
      {
        name: 'remote',
        transport: 'remote',
        url: 'https://mcp.example.com/mcp',
      },
    ]);
  });

  it('returns [] when the top-level key is absent', () => {
    const p = writeFile('nokey.json', JSON.stringify({ other: {} }));
    expect(parseClaudeCodeMcpServers(p)).toEqual([]);
  });
});
