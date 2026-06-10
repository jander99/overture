// Tests for the roo-code parseServers handler.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseRooCodeMcpServers } from './roo-code.js';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'parse-servers-roo-code-'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

function writeFile(name: string, contents: string): string {
  const p = join(workdir, name);
  writeFileSync(p, contents);
  return p;
}

describe('parseRooCodeMcpServers', () => {
  it('returns [] for an unreadable path', () => {
    expect(parseRooCodeMcpServers('/no/such/file')).toEqual([]);
  });

  it('returns [] for malformed JSON', () => {
    const p = writeFile('bad.json', '{ not valid');
    expect(parseRooCodeMcpServers(p)).toEqual([]);
  });

  it('extracts a local stdio server (ignores the policy extras)', () => {
    const p = writeFile(
      'local.json',
      JSON.stringify({
        mcpServers: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            cwd: '/home/me/project',
            env: {},
            alwaysAllow: [],
            disabled: false,
            timeout: 60,
            watchPaths: [],
            disabledTools: [],
          },
        },
      }),
    );
    expect(parseRooCodeMcpServers(p)).toEqual([
      {
        name: 'memory',
        transport: 'local',
        command: ['npx', '-y', '@modelcontextprotocol/server-memory'],
      },
    ]);
  });

  it('extracts a remote streamable-http server', () => {
    const p = writeFile(
      'remote.json',
      JSON.stringify({
        mcpServers: {
          r: {
            type: 'streamable-http',
            url: 'https://mcp.example.com/mcp',
            headers: { Authorization: 'Bearer ${MCP_TOKEN}' },
          },
        },
      }),
    );
    expect(parseRooCodeMcpServers(p)).toEqual([
      { name: 'r', transport: 'remote', url: 'https://mcp.example.com/mcp' },
    ]);
  });

  it('returns [] when the top-level key is absent', () => {
    const p = writeFile('nokey.json', JSON.stringify({ other: {} }));
    expect(parseRooCodeMcpServers(p)).toEqual([]);
  });
});
