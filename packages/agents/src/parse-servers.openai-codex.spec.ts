// Tests for the openai-codex parseServers handler.
// This agent stores MCP config in TOML tables keyed [mcp_servers.<name>].
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseOpenAICodexMcpServers } from './openai-codex.js';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'parse-servers-openai-codex-'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

function writeFile(name: string, contents: string): string {
  const p = join(workdir, name);
  writeFileSync(p, contents);
  return p;
}

describe('parseOpenAICodexMcpServers', () => {
  it('returns [] for an unreadable path', () => {
    expect(parseOpenAICodexMcpServers('/no/such/file')).toEqual([]);
  });

  it('returns [] for malformed TOML', () => {
    const p = writeFile('bad.toml', 'this is = not = valid toml [');
    expect(parseOpenAICodexMcpServers(p)).toEqual([]);
  });

  it('extracts a local stdio server from a TOML table', () => {
    const p = writeFile(
      'config.toml',
      `
[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/home"]
enabled = true
`,
    );
    expect(parseOpenAICodexMcpServers(p)).toEqual([
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

  it('extracts a remote server from a TOML table', () => {
    const p = writeFile(
      'config.toml',
      `
[mcp_servers.remote_server]
url = "https://mcp.example.com/mcp"
bearer_token_env_var = "MCP_TOKEN"
`,
    );
    expect(parseOpenAICodexMcpServers(p)).toEqual([
      {
        name: 'remote_server',
        transport: 'remote',
        url: 'https://mcp.example.com/mcp',
      },
    ]);
  });

  it('returns [] when the [mcp_servers] table is absent', () => {
    const p = writeFile('config.toml', '[other]\nfoo = "bar"\n');
    expect(parseOpenAICodexMcpServers(p)).toEqual([]);
  });
});
