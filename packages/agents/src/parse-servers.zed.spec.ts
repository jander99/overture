// Tests for the zed parseServers handler.
// This agent uses the top-level 'context_servers' key.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseZedMcpServers } from './zed.js';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'parse-servers-zed-'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

function writeFile(name: string, contents: string): string {
  const p = join(workdir, name);
  writeFileSync(p, contents);
  return p;
}

describe('parseZedMcpServers', () => {
  it('returns [] for an unreadable path', () => {
    expect(parseZedMcpServers('/no/such/file')).toEqual([]);
  });

  it('returns [] for malformed JSON', () => {
    const p = writeFile('bad.json', '{ not valid');
    expect(parseZedMcpServers(p)).toEqual([]);
  });

  it('extracts a local stdio server from context_servers', () => {
    const p = writeFile(
      'settings.json',
      JSON.stringify({
        context_servers: {
          'local-mcp-server': {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            env: {},
          },
        },
      }),
    );
    expect(parseZedMcpServers(p)).toEqual([
      {
        name: 'local-mcp-server',
        transport: 'local',
        command: ['npx', '-y', '@modelcontextprotocol/server-memory'],
      },
    ]);
  });

  it('extracts a remote server (inferred from url since Zed has no `type` field)', () => {
    const p = writeFile(
      'settings.json',
      JSON.stringify({
        context_servers: {
          'remote-mcp-server': {
            url: 'https://mcp.example.com/mcp',
            headers: { Authorization: 'Bearer ${MCP_TOKEN}' },
          },
        },
      }),
    );
    expect(parseZedMcpServers(p)).toEqual([
      {
        name: 'remote-mcp-server',
        transport: 'remote',
        url: 'https://mcp.example.com/mcp',
      },
    ]);
  });

  it('returns [] when the top-level key is mcpServers instead of context_servers', () => {
    const p = writeFile(
      'settings.json',
      JSON.stringify({ mcpServers: { foo: { command: 'x' } } }),
    );
    expect(parseZedMcpServers(p)).toEqual([]);
  });
});
