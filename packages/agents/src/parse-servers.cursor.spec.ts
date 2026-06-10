// Tests for the cursor parseServers handler.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCursorMcpServers } from './cursor.js';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'parse-servers-cursor-'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

function writeFile(name: string, contents: string): string {
  const p = join(workdir, name);
  writeFileSync(p, contents);
  return p;
}

describe('parseCursorMcpServers', () => {
  it('returns local-only servers', () => {
    const p = writeFile(
      'local.json',
      JSON.stringify({
        mcpServers: {
          fs: { command: 'npx', args: ['-y', 'server-fs'] },
        },
      }),
    );

    expect(parseCursorMcpServers(p)).toEqual([
      { name: 'fs', transport: 'local', command: ['npx', '-y', 'server-fs'] },
    ]);
  });

  it('returns remote-only servers inferred from url', () => {
    const p = writeFile(
      'remote.json',
      JSON.stringify({
        mcpServers: {
          gh: { url: 'https://api.githubcopilot.com/mcp' },
        },
      }),
    );

    expect(parseCursorMcpServers(p)).toEqual([
      {
        name: 'gh',
        transport: 'remote',
        url: 'https://api.githubcopilot.com/mcp',
      },
    ]);
  });

  it('returns [] for a missing file', () => {
    expect(parseCursorMcpServers('/no/such/file')).toEqual([]);
  });

  it('returns [] for malformed JSON', () => {
    const p = writeFile('bad.json', '{ not valid');
    expect(parseCursorMcpServers(p)).toEqual([]);
  });

  it('returns [] when the top-level key is absent', () => {
    const p = writeFile('nokey.json', JSON.stringify({ other: {} }));
    expect(parseCursorMcpServers(p)).toEqual([]);
  });
});
