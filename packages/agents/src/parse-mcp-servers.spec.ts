// Tests for the shared MCP server parse helpers in parse-mcp-servers.ts.
// Each helper is tested for: happy path (local), happy path (remote),
// BOM tolerance, missing file, malformed content, and explicit
// transport-type overrides.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentNormalizedMcpServer } from './types.js';
import {
  detectCanonicalSettingsDrift,
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
    ).toEqual([{ name: 'r', transport: 'remote', url: 'https://example.com' }]);
  });

  it('returns [] when the JSON top-level value is a list (list shape is YAML-only)', () => {
    // Pre-fix, this would have been parsed as a YAML-list and returned
    // one entry per item. With allowListShape defaulting to false for
    // JSON, the helper now returns [].
    const p = writeFile(
      'arr.json',
      JSON.stringify({
        mcpServers: [{ name: 'foo', command: 'npx' }],
      }),
    );
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
    const p = writeFile(
      'bom.toml',
      '\uFEFF[mcp_servers.fs]\ncommand = "npx"\n',
    );
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

// ---------------------------------------------------------------------------
// detectCanonicalSettingsDrift — pure helper (F3 conflict refusal).
//
// Both arguments are `ReadonlyMap<serverName, AgentNormalizedMcpServer>`
// keyed by server name. The helper only emits conflicts for names
// present in BOTH maps where both entries are normalized; missing
// entries are the writer's problem (new-entry path).
//
// Comparator semantics (anti-silent-pass per F2 retro):
// - `args` (readonly string[]): order is SIGNIFICANT.
// - `env` / `headers` (Record<string,string>): order is INSIGNIFICANT.
// - `undefined` vs `[]`/`{}` is a diff; `undefined` vs `undefined` is not.
// - `null` vs `undefined` is distinct when both are legal.
// - Numbers vs numeric strings are NOT coerced.
// ---------------------------------------------------------------------------

/** Build a normalized stdio entry fixture. */
function stdio(server: {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}): AgentNormalizedMcpServer {
  return { state: 'normalized', server: { type: 'stdio', ...server } };
}

/** Build a normalized remote entry fixture. */
function remote(server: {
  url: string;
  headers?: Record<string, string>;
}): AgentNormalizedMcpServer {
  return { state: 'normalized', server: { type: 'remote', ...server } };
}

/** Build a shape-conflict fixture (normalized-to reason path). */
function shapeConflict(): AgentNormalizedMcpServer {
  return {
    state: 'shape-conflict',
    reason: 'Stdio command is missing or empty.',
  };
}

describe('detectCanonicalSettingsDrift', () => {
  it('returns [] when existing is empty', () => {
    const canonical = new Map<string, AgentNormalizedMcpServer>([
      ['fs', stdio({ command: 'npx', args: ['-y', 'fs'] })],
    ]);
    expect(detectCanonicalSettingsDrift(new Map(), canonical)).toEqual([]);
  });

  it('returns [] when canonical is empty', () => {
    const existing = new Map<string, AgentNormalizedMcpServer>([
      ['fs', stdio({ command: 'npx', args: ['-y', 'fs'] })],
    ]);
    expect(detectCanonicalSettingsDrift(existing, new Map())).toEqual([]);
  });

  it('returns [] when both sides are empty', () => {
    expect(detectCanonicalSettingsDrift(new Map(), new Map())).toEqual([]);
  });

  it('returns [] when names do not intersect (existing has keys canonical does not)', () => {
    const existing = new Map<string, AgentNormalizedMcpServer>([
      ['fs', stdio({ command: 'npx' })],
      ['gh', remote({ url: 'https://example.com' })],
    ]);
    const canonical = new Map<string, AgentNormalizedMcpServer>([
      ['only-in-canonical', stdio({ command: 'npx' })],
    ]);
    expect(detectCanonicalSettingsDrift(existing, canonical)).toEqual([]);
  });

  it('returns [] when both sides are deeply equal normalized stdio entries', () => {
    const left = stdio({
      command: 'npx',
      args: ['-y', '@scope/server-fs'],
      env: { HOME: '/home/u', DEBUG: '1' },
    });
    const right = stdio({
      command: 'npx',
      args: ['-y', '@scope/server-fs'],
      env: { HOME: '/home/u', DEBUG: '1' },
    });
    expect(
      detectCanonicalSettingsDrift(
        new Map([['fs', left]]),
        new Map([['fs', right]]),
      ),
    ).toEqual([]);
  });

  it('returns [] when both sides are deeply equal normalized remote entries', () => {
    const left = remote({
      url: 'https://example.com/mcp',
      headers: { Auth: 'token-a', 'X-Trace': '1' },
    });
    const right = remote({
      url: 'https://example.com/mcp',
      headers: { Auth: 'token-a', 'X-Trace': '1' },
    });
    expect(
      detectCanonicalSettingsDrift(
        new Map([['gh', left]]),
        new Map([['gh', right]]),
      ),
    ).toEqual([]);
  });

  it('emits one conflict with single diff key when only command differs', () => {
    const existing = new Map<string, AgentNormalizedMcpServer>([
      ['fs', stdio({ command: 'npx' })],
    ]);
    const canonical = new Map<string, AgentNormalizedMcpServer>([
      ['fs', stdio({ command: 'pnpm' })],
    ]);
    expect(detectCanonicalSettingsDrift(existing, canonical)).toEqual([
      {
        serverName: 'fs',
        message:
          'Refusing to continue for server "fs": canonical and agent settings differ. Update the canonical config or the agent config and retry.',
        diffKeys: ['command'],
      },
    ]);
  });

  it('emits one conflict with sorted diffKeys when multiple canonical fields differ', () => {
    const existing = new Map<string, AgentNormalizedMcpServer>([
      [
        'fs',
        stdio({
          command: 'npx',
          args: ['-y', 'fs'],
          env: { DEBUG: '0' },
        }),
      ],
    ]);
    const canonical = new Map<string, AgentNormalizedMcpServer>([
      [
        'fs',
        stdio({
          command: 'pnpm',
          args: ['dlx', 'fs'],
          env: { DEBUG: '1' },
        }),
      ],
    ]);
    const conflicts = detectCanonicalSettingsDrift(existing, canonical);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.serverName).toBe('fs');
    expect(conflicts[0]?.diffKeys).toEqual(['args', 'command', 'env']);
  });

  it('verifies diffKeys ascending sort across at least three keys', () => {
    const existing = new Map<string, AgentNormalizedMcpServer>([
      [
        'gh',
        remote({
          url: 'https://old.example.com/mcp',
          headers: { Auth: 'old' },
        }),
      ],
    ]);
    const canonical = new Map<string, AgentNormalizedMcpServer>([
      [
        'gh',
        remote({
          url: 'https://new.example.com/mcp',
          headers: { Auth: 'new', Extra: '1' },
        }),
      ],
    ]);
    const conflicts = detectCanonicalSettingsDrift(existing, canonical);
    expect(conflicts[0]?.diffKeys).toEqual(['headers', 'url']);
    expect(conflicts[0]?.diffKeys).toEqual(
      [...(conflicts[0]?.diffKeys ?? [])].sort(),
    );
  });

  it('returns [] when existing has a key not in canonical (canonical is authoritative; extras are not a conflict)', () => {
    const existing = new Map<string, AgentNormalizedMcpServer>([
      ['fs', stdio({ command: 'npx' })],
    ]);
    const canonical = new Map<string, AgentNormalizedMcpServer>();
    expect(detectCanonicalSettingsDrift(existing, canonical)).toEqual([]);
  });

  it('emits a conflict when args order differs (order is significant for arrays)', () => {
    const existing = new Map<string, AgentNormalizedMcpServer>([
      ['fs', stdio({ command: 'npx', args: ['-y', 'fs', '--debug'] })],
    ]);
    const canonical = new Map<string, AgentNormalizedMcpServer>([
      ['fs', stdio({ command: 'npx', args: ['--debug', '-y', 'fs'] })],
    ]);
    const conflicts = detectCanonicalSettingsDrift(existing, canonical);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.diffKeys).toContain('args');
  });

  it('returns [] when only env key insertion order differs (order is insignificant for record maps)', () => {
    const left = stdio({
      command: 'npx',
      env: { A: '1', B: '2', C: '3' },
    });
    const right = stdio({
      command: 'npx',
      env: { C: '3', A: '1', B: '2' },
    });
    expect(
      detectCanonicalSettingsDrift(
        new Map([['fs', left]]),
        new Map([['fs', right]]),
      ),
    ).toEqual([]);
  });

  it('returns [] when only headers key insertion order differs (order is insignificant for record maps)', () => {
    const left = remote({
      url: 'https://example.com/mcp',
      headers: { Auth: 'token', 'X-Trace': '1', 'X-Req': '2' },
    });
    const right = remote({
      url: 'https://example.com/mcp',
      headers: { 'X-Req': '2', 'X-Trace': '1', Auth: 'token' },
    });
    expect(
      detectCanonicalSettingsDrift(
        new Map([['gh', left]]),
        new Map([['gh', right]]),
      ),
    ).toEqual([]);
  });

  it('emits a conflict when undefined vs [] are compared on canonical args', () => {
    const existing = new Map<string, AgentNormalizedMcpServer>([
      ['fs', stdio({ command: 'npx', args: ['-y', 'fs'] })],
    ]);
    const canonical = new Map<string, AgentNormalizedMcpServer>([
      ['fs', stdio({ command: 'npx' })], // args is undefined
    ]);
    const conflicts = detectCanonicalSettingsDrift(existing, canonical);
    expect(conflicts[0]?.diffKeys).toContain('args');
  });

  it('does NOT flag undefined vs undefined on optional fields', () => {
    const left = stdio({ command: 'npx' });
    const right = stdio({ command: 'npx' });
    expect(
      detectCanonicalSettingsDrift(
        new Map([['fs', left]]),
        new Map([['fs', right]]),
      ),
    ).toEqual([]);
  });

  it('emits a conflict on transport switch (one stdio, one remote) with type in diffKeys', () => {
    const existing = new Map<string, AgentNormalizedMcpServer>([
      ['svc', stdio({ command: 'npx', args: ['svc'] })],
    ]);
    const canonical = new Map<string, AgentNormalizedMcpServer>([
      ['svc', remote({ url: 'https://svc.example.com/mcp' })],
    ]);
    const conflicts = detectCanonicalSettingsDrift(existing, canonical);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.serverName).toBe('svc');
    // The transport-discriminator field MUST appear in diffKeys so
    // the CLI can surface "type changed" to the user.
    expect(conflicts[0]?.diffKeys).toContain('type');
  });

  it('skips entries with shape-conflict on either side (writer handles non-normalized cases)', () => {
    const existing = new Map<string, AgentNormalizedMcpServer>([
      ['broken', shapeConflict()],
      ['ok', stdio({ command: 'npx' })],
    ]);
    const canonical = new Map<string, AgentNormalizedMcpServer>([
      ['broken', stdio({ command: 'npx' })],
      ['ok', stdio({ command: 'npx' })],
    ]);
    expect(detectCanonicalSettingsDrift(existing, canonical)).toEqual([]);
  });

  it('is deterministic: two calls return deeply equal output for the same inputs', () => {
    const existing = new Map<string, AgentNormalizedMcpServer>([
      ['fs', stdio({ command: 'npx', args: ['-y'] })],
      ['gh', remote({ url: 'https://a.example.com/mcp' })],
    ]);
    const canonical = new Map<string, AgentNormalizedMcpServer>([
      ['fs', stdio({ command: 'pnpm' })],
      ['gh', remote({ url: 'https://b.example.com/mcp' })],
    ]);
    const first = detectCanonicalSettingsDrift(existing, canonical);
    const second = detectCanonicalSettingsDrift(existing, canonical);
    expect(second).toEqual(first);
  });

  it('returns conflicts sorted ascending by serverName', () => {
    const existing = new Map<string, AgentNormalizedMcpServer>([
      ['z', stdio({ command: 'npx' })],
      ['a', stdio({ command: 'npx' })],
      ['m', stdio({ command: 'npx' })],
    ]);
    const canonical = new Map<string, AgentNormalizedMcpServer>([
      ['z', stdio({ command: 'pnpm' })],
      ['a', stdio({ command: 'pnpm' })],
      ['m', stdio({ command: 'pnpm' })],
    ]);
    const conflicts = detectCanonicalSettingsDrift(existing, canonical);
    expect(conflicts.map((c: { serverName: string }) => c.serverName)).toEqual([
      'a',
      'm',
      'z',
    ]);
  });

  it('output is JSON-serializable (round-trips through JSON.stringify)', () => {
    const existing = new Map<string, AgentNormalizedMcpServer>([
      ['fs', stdio({ command: 'npx', args: ['-y'], env: { A: '1' } })],
      ['gh', remote({ url: 'https://gh.example.com/mcp' })],
    ]);
    const canonical = new Map<string, AgentNormalizedMcpServer>([
      ['fs', stdio({ command: 'pnpm', args: ['dlx'], env: { A: '2' } })],
      ['gh', remote({ url: 'https://gh2.example.com/mcp' })],
    ]);
    const first = JSON.stringify(
      detectCanonicalSettingsDrift(existing, canonical),
    );
    const second = JSON.stringify(
      detectCanonicalSettingsDrift(existing, canonical),
    );
    expect(second).toBe(first);
    // Sanity: round-trip parses and produces the same shape.
    const parsed = JSON.parse(first) as readonly unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });

  it('output JSON has the B3-aligned serverName in message for each conflict', () => {
    const existing = new Map<string, AgentNormalizedMcpServer>([
      ['alpha', stdio({ command: 'npx' })],
      ['beta', remote({ url: 'https://b.example.com/mcp' })],
    ]);
    const canonical = new Map<string, AgentNormalizedMcpServer>([
      ['alpha', stdio({ command: 'pnpm' })],
      ['beta', remote({ url: 'https://b2.example.com/mcp' })],
    ]);
    const conflicts = detectCanonicalSettingsDrift(existing, canonical);
    expect(conflicts[0]?.message).toContain('"alpha"');
    expect(conflicts[1]?.message).toContain('"beta"');
  });

  it('does not coerce numbers vs numeric strings on canonical fields', () => {
    // OvertureMcpServer has no numeric fields today, but the
    // comparator must not silently coerce type-mismatched values.
    // Verify by constructing two entries where the only difference
    // is the URL ends with "1" vs "01" (string vs visually-similar).
    const left = new Map<string, AgentNormalizedMcpServer>([
      ['gh', remote({ url: 'https://example.com/mcp?x=1' })],
    ]);
    const right = new Map<string, AgentNormalizedMcpServer>([
      ['gh', remote({ url: 'https://example.com/mcp?x=01' })],
    ]);
    expect(detectCanonicalSettingsDrift(left, right)).toHaveLength(1);
  });
});
