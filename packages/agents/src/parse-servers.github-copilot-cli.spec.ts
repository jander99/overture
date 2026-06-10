// Tests for the github-copilot-cli parseServers handler.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseGitHubCopilotCliMcpServers } from './github-copilot-cli.js';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'parse-servers-copilot-cli-'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

function writeFile(name: string, contents: string): string {
  const p = join(workdir, name);
  writeFileSync(p, contents);
  return p;
}

describe('parseGitHubCopilotCliMcpServers', () => {
  it('returns [] for an unreadable path', () => {
    expect(parseGitHubCopilotCliMcpServers('/no/such/file')).toEqual([]);
  });

  it('returns [] for malformed JSON', () => {
    const p = writeFile('bad.json', '{ not valid');
    expect(parseGitHubCopilotCliMcpServers(p)).toEqual([]);
  });

  it('extracts a local server with explicit type=local', () => {
    const p = writeFile(
      'local.json',
      JSON.stringify({
        mcpServers: {
          memory: {
            type: 'local',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-memory'],
            env: {},
            tools: ['*'],
          },
        },
      }),
    );
    expect(parseGitHubCopilotCliMcpServers(p)).toEqual([
      {
        name: 'memory',
        transport: 'local',
        command: ['npx', '-y', '@modelcontextprotocol/server-memory'],
      },
    ]);
  });

  it('extracts a remote server with type=http', () => {
    const p = writeFile(
      'remote.json',
      JSON.stringify({
        mcpServers: {
          r: {
            type: 'http',
            url: 'https://mcp.example.com/mcp',
            headers: { Authorization: 'Bearer ${MCP_TOKEN}' },
            tools: ['tool_a', 'tool_b'],
          },
        },
      }),
    );
    expect(parseGitHubCopilotCliMcpServers(p)).toEqual([
      { name: 'r', transport: 'remote', url: 'https://mcp.example.com/mcp' },
    ]);
  });

  it('extracts a mixed local+remote config', () => {
    const p = writeFile(
      'mixed.json',
      JSON.stringify({
        mcpServers: {
          local: { type: 'local', command: 'npx', args: ['-y', 'a'] },
          remote: { type: 'http', url: 'https://example.com/mcp' },
        },
      }),
    );
    expect(parseGitHubCopilotCliMcpServers(p)).toEqual([
      { name: 'local', transport: 'local', command: ['npx', '-y', 'a'] },
      {
        name: 'remote',
        transport: 'remote',
        url: 'https://example.com/mcp',
      },
    ]);
  });

  it('returns [] when the top-level key is absent', () => {
    const p = writeFile('nokey.json', JSON.stringify({ other: {} }));
    expect(parseGitHubCopilotCliMcpServers(p)).toEqual([]);
  });
});
