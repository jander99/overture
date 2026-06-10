// Tests for the shared MCP server parse helpers in parse-mcp-servers.ts.
// Each helper is tested for: happy path (local), happy path (remote),
// BOM tolerance, missing file, malformed content, and explicit
// transport-type overrides.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseJsoncMcpServerMap,
  parseTomlMcpServerMap,
  parseYamlMcpServerList,
} from './parse-mcp-servers.js';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'parse-mcp-servers-'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

function writeFile(name: string, contents: string): string {
  const p = join(workdir, name);
  writeFileSync(p, contents);
  return p;
}

describe('parseJsoncMcpServerMap', () => {
  it('returns [] for an unreadable path', () => {
    expect(parseJsoncMcpServerMap('/no/such/file', 'mcpServers')).toEqual([]);
  });

  it('returns [] for an empty file', () => {
    const p = writeFile('empty.jsonc', '');
    expect(parseJsoncMcpServerMap(p, 'mcpServers')).toEqual([]);
  });

  it('returns [] for malformed JSON', () => {
    const p = writeFile('bad.json', '{ this is not json');
    expect(parseJsoncMcpServerMap(p, 'mcpServers')).toEqual([]);
  });

  it('returns [] when the top-level key is missing', () => {
    const p = writeFile('nokey.json', JSON.stringify({ other: {} }));
    expect(parseJsoncMcpServerMap(p, 'mcpServers')).toEqual([]);
  });

  it('strips a leading UTF-8 BOM', () => {
    const p = writeFile('bom.json', '\uFEFF{"mcpServers":{"fs":{}}}');
    expect(parseJsoncMcpServerMap(p, 'mcpServers')).toEqual([
      { name: 'fs', transport: 'local' },
    ]);
  });

  it('tolerates JSONC trailing commas and comments', () => {
    const body = `{
      // leading comment
      "mcpServers": {
        "fs": {
          "command": "npx",
          "args": ["-y", "fs"],
        },
        /* block */
      },
    }`;
    const p = writeFile('jsonc.json', body);
    expect(parseJsoncMcpServerMap(p, 'mcpServers')).toEqual([
      { name: 'fs', transport: 'local', command: ['npx', '-y', 'fs'] },
    ]);
  });

  it('extracts local servers with command+args argv', () => {
    const p = writeFile(
      'local.json',
      JSON.stringify({
        mcpServers: {
          fs: { command: 'npx', args: ['-y', 'server-fs'] },
        },
      }),
    );
    expect(parseJsoncMcpServerMap(p, 'mcpServers')).toEqual([
      { name: 'fs', transport: 'local', command: ['npx', '-y', 'server-fs'] },
    ]);
  });

  it('extracts remote servers from explicit type field', () => {
    const p = writeFile(
      'remote.json',
      JSON.stringify({
        mcpServers: {
          gh: { type: 'http', url: 'https://api.githubcopilot.com/mcp' },
        },
      }),
    );
    expect(parseJsoncMcpServerMap(p, 'mcpServers')).toEqual([
      {
        name: 'gh',
        transport: 'remote',
        url: 'https://api.githubcopilot.com/mcp',
      },
    ]);
  });

  it('infers remote transport from url field when no type is set', () => {
    const p = writeFile(
      'inferred.json',
      JSON.stringify({
        mcpServers: { context7: { url: 'https://mcp.context7.com/mcp' } },
      }),
    );
    expect(parseJsoncMcpServerMap(p, 'mcpServers')).toEqual([
      {
        name: 'context7',
        transport: 'remote',
        url: 'https://mcp.context7.com/mcp',
      },
    ]);
  });

  it('skips entries whose shape is not a record', () => {
    const p = writeFile(
      'skip.json',
      JSON.stringify({
        mcpServers: { good: { command: 'x' }, bad: 'not-a-record' },
      }),
    );
    expect(parseJsoncMcpServerMap(p, 'mcpServers')).toEqual([
      { name: 'good', transport: 'local', command: ['x'] },
    ]);
  });

  it('respects custom urlFields option', () => {
    const p = writeFile(
      'windsurf.json',
      JSON.stringify({
        mcpServers: { r: { serverUrl: 'https://example.com' } },
      }),
    );
    expect(
      parseJsoncMcpServerMap(p, 'mcpServers', {
        urlFields: ['url', 'serverUrl'],
      }),
    ).toEqual([
      { name: 'r', transport: 'remote', url: 'https://example.com' },
    ]);
  });

  it('returns [] when the top-level value is an array, not a map (JSON variant)', () => {
    const p = writeFile('arr.json', JSON.stringify({ mcpServers: [] }));
    expect(parseJsoncMcpServerMap(p, 'mcpServers')).toEqual([]);
  });
});

describe('parseTomlMcpServerMap', () => {
  it('returns [] for an unreadable path', () => {
    expect(parseTomlMcpServerMap('/no/such/file', 'mcp_servers')).toEqual([]);
  });

  it('returns [] for malformed TOML', () => {
    const p = writeFile('bad.toml', 'this is = not = valid toml [');
    expect(parseTomlMcpServerMap(p, 'mcp_servers')).toEqual([]);
  });

  it('returns [] when the table is missing', () => {
    const p = writeFile('nokey.toml', '[other]\nfoo = "bar"\n');
    expect(parseTomlMcpServerMap(p, 'mcp_servers')).toEqual([]);
  });

  it('strips a leading UTF-8 BOM', () => {
    const p = writeFile('bom.toml', '\uFEFF[mcp_servers.fs]\ncommand = "npx"\n');
    expect(parseTomlMcpServerMap(p, 'mcp_servers')).toEqual([
      { name: 'fs', transport: 'local', command: ['npx'] },
    ]);
  });

  it('extracts a local server with command+args', () => {
    const p = writeFile(
      'local.toml',
      `
[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/home"]
`,
    );
    expect(parseTomlMcpServerMap(p, 'mcp_servers')).toEqual([
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
    ]);
  });

  it('extracts a remote server with url', () => {
    const p = writeFile(
      'remote.toml',
      `
[mcp_servers.remote_server]
url = "https://mcp.example.com/mcp"
bearer_token_env_var = "MCP_TOKEN"
`,
    );
    expect(parseTomlMcpServerMap(p, 'mcp_servers')).toEqual([
      {
        name: 'remote_server',
        transport: 'remote',
        url: 'https://mcp.example.com/mcp',
      },
    ]);
  });
});

describe('parseYamlMcpServerList', () => {
  it('returns [] for an unreadable path', () => {
    expect(parseYamlMcpServerList('/no/such/file', 'mcpServers')).toEqual([]);
  });

  it('returns [] for malformed YAML', () => {
    const p = writeFile('bad.yaml', 'name: [unterminated: : :');
    expect(parseYamlMcpServerList(p, 'mcpServers')).toEqual([]);
  });

  it('strips a leading UTF-8 BOM', () => {
    const p = writeFile(
      'bom.yaml',
      `
\uFEFFname: sample
mcpServers:
  - name: fs
    command: npx
    args:
      - -y
      - server-fs
`,
    );
    expect(parseYamlMcpServerList(p, 'mcpServers')).toEqual([
      { name: 'fs', transport: 'local', command: ['npx', '-y', 'server-fs'] },
    ]);
  });

  it('extracts a YAML list of local servers', () => {
    const p = writeFile(
      'local.yaml',
      `
name: sample
schema: v1
mcpServers:
  - name: playwright
    command: npx
    args:
      - -y
      - '@microsoft/mcp-server-playwright'
  - name: memory
    command: npx
    args:
      - -y
      - '@modelcontextprotocol/server-memory'
`,
    );
    expect(parseYamlMcpServerList(p, 'mcpServers')).toEqual([
      {
        name: 'playwright',
        transport: 'local',
        command: ['npx', '-y', '@microsoft/mcp-server-playwright'],
      },
      {
        name: 'memory',
        transport: 'local',
        command: ['npx', '-y', '@modelcontextprotocol/server-memory'],
      },
    ]);
  });

  it('extracts a YAML list of remote servers', () => {
    const p = writeFile(
      'remote.yaml',
      `
name: sample
mcpServers:
  - name: r
    type: streamable-http
    url: https://mcp.example.com/mcp
`,
    );
    expect(parseYamlMcpServerList(p, 'mcpServers')).toEqual([
      {
        name: 'r',
        transport: 'remote',
        url: 'https://mcp.example.com/mcp',
      },
    ]);
  });

  it('skips YAML list items missing the `name` field', () => {
    const p = writeFile(
      'skipname.yaml',
      `
mcpServers:
  - command: npx
`,
    );
    expect(parseYamlMcpServerList(p, 'mcpServers')).toEqual([]);
  });
});
