// Tests for the github-copilot-vscode parseServers handler.
// This agent uses the top-level 'servers' key (not 'mcpServers').
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseGitHubCopilotVSCodeMcpServers } from './github-copilot-vscode.js';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'parse-servers-copilot-vscode-'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

function writeFile(name: string, contents: string): string {
  const p = join(workdir, name);
  writeFileSync(p, contents);
  return p;
}

describe('parseGitHubCopilotVSCodeMcpServers', () => {
  it('returns [] for an unreadable path', () => {
    expect(parseGitHubCopilotVSCodeMcpServers('/no/such/file')).toEqual([]);
  });

  it('returns [] for malformed JSON', () => {
    const p = writeFile('bad.json', '{ not valid');
    expect(parseGitHubCopilotVSCodeMcpServers(p)).toEqual([]);
  });

  it('extracts a remote HTTP server from the `servers` top-level key', () => {
    const p = writeFile(
      'mcp.json',
      JSON.stringify({
        servers: {
          github: { type: 'http', url: 'https://api.githubcopilot.com/mcp' },
        },
      }),
    );
    expect(parseGitHubCopilotVSCodeMcpServers(p)).toEqual([
      {
        name: 'github',
        transport: 'remote',
        url: 'https://api.githubcopilot.com/mcp',
      },
    ]);
  });

  it('extracts a local stdio server from the `servers` top-level key', () => {
    const p = writeFile(
      'mcp.json',
      JSON.stringify({
        servers: {
          playwright: {
            command: 'npx',
            args: ['-y', '@microsoft/mcp-server-playwright'],
          },
        },
      }),
    );
    expect(parseGitHubCopilotVSCodeMcpServers(p)).toEqual([
      {
        name: 'playwright',
        transport: 'local',
        command: ['npx', '-y', '@microsoft/mcp-server-playwright'],
      },
    ]);
  });

  it('returns [] when the file has `mcpServers` instead of `servers`', () => {
    const p = writeFile(
      'mcp.json',
      JSON.stringify({
        mcpServers: { foo: { command: 'x' } },
      }),
    );
    expect(parseGitHubCopilotVSCodeMcpServers(p)).toEqual([]);
  });
});
