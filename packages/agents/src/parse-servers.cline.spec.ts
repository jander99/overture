// Tests for the cline parseServers handler.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseClineMcpServers } from './cline.js';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'parse-servers-cline-'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

function writeFile(name: string, contents: string): string {
  const p = join(workdir, name);
  writeFileSync(p, contents);
  return p;
}

describe('parseClineMcpServers', () => {
  it('returns [] for an unreadable path', () => {
    expect(parseClineMcpServers('/no/such/file')).toEqual([]);
  });

  it('returns [] for malformed JSON', () => {
    const p = writeFile('bad.json', '{ not valid');
    expect(parseClineMcpServers(p)).toEqual([]);
  });

  it('extracts a local stdio server (ignores the `disabled` field)', () => {
    const p = writeFile(
      'local.json',
      JSON.stringify({
        mcpServers: {
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            env: {},
            disabled: false,
          },
        },
      }),
    );
    expect(parseClineMcpServers(p)).toEqual([
      {
        name: 'memory',
        transport: 'local',
        command: ['npx', '-y', '@modelcontextprotocol/server-memory'],
      },
    ]);
  });

  it('extracts a remote server with explicit `transportType`', () => {
    const p = writeFile(
      'remote.json',
      JSON.stringify({
        mcpServers: {
          r: {
            url: 'https://mcp.example.com/mcp',
            headers: { Authorization: 'Bearer ${TOKEN}' },
          },
        },
      }),
    );
    expect(parseClineMcpServers(p)).toEqual([
      { name: 'r', transport: 'remote', url: 'https://mcp.example.com/mcp' },
    ]);
  });

  it('returns [] when the top-level key is absent', () => {
    const p = writeFile('nokey.json', JSON.stringify({ other: {} }));
    expect(parseClineMcpServers(p)).toEqual([]);
  });
});
