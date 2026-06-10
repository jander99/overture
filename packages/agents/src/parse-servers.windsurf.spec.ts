// Tests for the windsurf parseServers handler.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseWindsurfMcpServers } from './windsurf.js';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'parse-servers-windsurf-'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

function writeFile(name: string, contents: string): string {
  const p = join(workdir, name);
  writeFileSync(p, contents);
  return p;
}

describe('parseWindsurfMcpServers', () => {
  it('returns [] for an unreadable path', () => {
    expect(parseWindsurfMcpServers('/no/such/file')).toEqual([]);
  });

  it('returns [] for malformed JSON', () => {
    const p = writeFile('bad.json', '{ not valid');
    expect(parseWindsurfMcpServers(p)).toEqual([]);
  });

  it('extracts local stdio servers (filesystem + memory)', () => {
    const p = writeFile(
      'local.json',
      JSON.stringify({
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/home'],
          },
          memory: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
          },
        },
      }),
    );
    expect(parseWindsurfMcpServers(p)).toEqual([
      {
        name: 'filesystem',
        transport: 'local',
        command: [
          'npx',
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '/home',
        ],
      },
      {
        name: 'memory',
        transport: 'local',
        command: ['npx', '-y', '@modelcontextprotocol/server-memory'],
      },
    ]);
  });

  it('extracts a remote server with `url`', () => {
    const p = writeFile(
      'remote-url.json',
      JSON.stringify({
        mcpServers: { r: { url: 'https://mcp.example.com/mcp' } },
      }),
    );
    expect(parseWindsurfMcpServers(p)).toEqual([
      { name: 'r', transport: 'remote', url: 'https://mcp.example.com/mcp' },
    ]);
  });

  it('extracts a remote server with `serverUrl` (Windsurf-specific alias)', () => {
    const p = writeFile(
      'remote-serverurl.json',
      JSON.stringify({
        mcpServers: { r: { serverUrl: 'https://mcp.example.com/mcp' } },
      }),
    );
    expect(parseWindsurfMcpServers(p)).toEqual([
      { name: 'r', transport: 'remote', url: 'https://mcp.example.com/mcp' },
    ]);
  });

  it('returns [] when the top-level key is absent', () => {
    const p = writeFile('nokey.json', JSON.stringify({ other: {} }));
    expect(parseWindsurfMcpServers(p)).toEqual([]);
  });
});
