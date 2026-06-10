// Tests for the continue parseServers handler.
// This agent accepts both YAML standalone files (.yaml/.yml) and
// JSON imports copied from clients like Claude/Cursor/Cline.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseContinueMcpServers } from './continue.js';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'parse-servers-continue-'));
});

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true });
});

function writeFile(name: string, contents: string): string {
  const p = join(workdir, name);
  writeFileSync(p, contents);
  return p;
}

describe('parseContinueMcpServers', () => {
  it('returns [] for an unreadable path', () => {
    expect(parseContinueMcpServers('/no/such/file')).toEqual([]);
  });

  it('parses a YAML list of local servers (YAML standalone)', () => {
    const p = writeFile(
      'playwright.yaml',
      `
name: playwright-mcp
version: 0.0.1
schema: v1
mcpServers:
  - name: playwright
    command: npx
    args:
      - -y
      - '@microsoft/mcp-server-playwright'
`,
    );
    expect(parseContinueMcpServers(p)).toEqual([
      {
        name: 'playwright',
        transport: 'local',
        command: ['npx', '-y', '@microsoft/mcp-server-playwright'],
      },
    ]);
  });

  it('parses a YAML list of remote servers', () => {
    const p = writeFile(
      'remote.yml',
      `
name: remote-mcp
schema: v1
mcpServers:
  - name: remote-server
    type: streamable-http
    url: https://mcp.example.com/mcp
`,
    );
    expect(parseContinueMcpServers(p)).toEqual([
      {
        name: 'remote-server',
        transport: 'remote',
        url: 'https://mcp.example.com/mcp',
      },
    ]);
  });

  it('parses a JSON file imported from another client (JSON fallback)', () => {
    const p = writeFile(
      'mcp.json',
      JSON.stringify({
        mcpServers: {
          fs: { command: 'npx', args: ['-y', 'fs-server'] },
        },
      }),
    );
    expect(parseContinueMcpServers(p)).toEqual([
      {
        name: 'fs',
        transport: 'local',
        command: ['npx', '-y', 'fs-server'],
      },
    ]);
  });

  it('returns [] for malformed YAML', () => {
    const p = writeFile('bad.yaml', 'name: [unterminated: : :');
    expect(parseContinueMcpServers(p)).toEqual([]);
  });

  it('returns [] for malformed JSON', () => {
    const p = writeFile('mcp.json', '{ not valid');
    expect(parseContinueMcpServers(p)).toEqual([]);
  });
});
