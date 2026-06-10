import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseOpenCodeMcpServerMap } from './parse-mcp-servers.js';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'opencode-parse-'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

function writeFile(name: string, contents: string): string {
  const path = join(workdir, name);
  writeFileSync(path, contents);
  return path;
}

describe('parseOpenCodeMcpServerMap', () => {
  it('parses a local server with command as an argv vector', () => {
    const path = writeFile(
      'opencode.json',
      JSON.stringify({
        mcp: {
          filesystem: {
            type: 'local',
            command: ['node', 'srv.js'],
          },
        },
      }),
    );

    expect(parseOpenCodeMcpServerMap(path)).toEqual([
      {
        name: 'filesystem',
        transport: 'local',
        command: ['node', 'srv.js'],
      },
    ]);
  });

  it('parses a local server with command as a single string', () => {
    // Opencode's documented shape is `command: string[]`, but the
    // shared helper also accepts a bare string and wraps it into a
    // single-element argv vector. This was the original inline-parser
    // behavior; preserve it for forward-compat.
    const path = writeFile(
      'opencode.json',
      JSON.stringify({
        mcp: {
          srv: { type: 'local', command: 'node' },
        },
      }),
    );

    expect(parseOpenCodeMcpServerMap(path)).toEqual([
      {
        name: 'srv',
        transport: 'local',
        command: ['node'],
      },
    ]);
  });

  it('parses a remote server with url', () => {
    const path = writeFile(
      'opencode.json',
      JSON.stringify({
        mcp: {
          remote: { type: 'remote', url: 'https://mcp.example.com/mcp' },
        },
      }),
    );

    expect(parseOpenCodeMcpServerMap(path)).toEqual([
      {
        name: 'remote',
        transport: 'remote',
        url: 'https://mcp.example.com/mcp',
      },
    ]);
  });

  it('tolerates JSONC trailing commas and comments', () => {
    const path = writeFile(
      'opencode.jsonc',
      `{
        // a local server
        "mcp": {
          "filesystem": {
            "type": "local",
            "command": ["node", "srv.js"],
          },
        },
      }`,
    );

    expect(parseOpenCodeMcpServerMap(path)).toEqual([
      {
        name: 'filesystem',
        transport: 'local',
        command: ['node', 'srv.js'],
      },
    ]);
  });

  it('returns [] for a missing file', () => {
    expect(parseOpenCodeMcpServerMap('/no/such/file')).toEqual([]);
  });

  it('returns [] for malformed JSON', () => {
    const path = writeFile('bad.json', '{ "mcp": ');
    expect(parseOpenCodeMcpServerMap(path)).toEqual([]);
  });

  it('returns [] when the `mcp` top-level key is absent', () => {
    const path = writeFile('nokey.json', JSON.stringify({ other: {} }));
    expect(parseOpenCodeMcpServerMap(path)).toEqual([]);
  });

  it('returns [] when `mcp` is an array (not a map)', () => {
    // JSON configs are always map-shaped; a list here is malformed.
    const path = writeFile(
      'list.json',
      JSON.stringify({ mcp: [{ name: 'foo', command: 'npx' }] }),
    );
    expect(parseOpenCodeMcpServerMap(path)).toEqual([]);
  });
});
