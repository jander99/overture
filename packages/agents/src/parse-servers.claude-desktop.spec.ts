import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseClaudeDesktopMcpServers } from './claude-desktop.js';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'claude-desktop-parse-'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

function writeFile(name: string, contents: string): string {
  const path = join(workdir, name);
  writeFileSync(path, contents);
  return path;
}

describe('parseClaudeDesktopMcpServers', () => {
  it('parses local-only npx servers', () => {
    const path = writeFile(
      'claude_desktop_config.json',
      JSON.stringify({
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
          },
        },
      }),
    );

    expect(parseClaudeDesktopMcpServers(path)).toEqual([
      {
        name: 'filesystem',
        transport: 'local',
        command: ['npx', '-y', '@modelcontextprotocol/server-filesystem'],
      },
    ]);
  });

  it('returns [] for a missing file', () => {
    expect(parseClaudeDesktopMcpServers('/no/such/file')).toEqual([]);
  });

  it('returns [] for malformed JSON', () => {
    const path = writeFile('bad.json', '{"mcpServers": {');
    expect(parseClaudeDesktopMcpServers(path)).toEqual([]);
  });

  it('returns [] when the top-level key is absent', () => {
    const path = writeFile('nokey.json', JSON.stringify({ other: {} }));
    expect(parseClaudeDesktopMcpServers(path)).toEqual([]);
  });
});
