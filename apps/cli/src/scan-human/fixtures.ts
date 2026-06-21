/**
 * Test fixtures + assertion helpers shared by every `scan-human` spec.
 *
 * The fixtures build a canonical 4-agent `ScanMatrix` and an
 * `OvertureMcpServer` (stdio / remote) per spec. The assertion helpers
 * cover the two cross-cutting invariants the renderer must hold:
 *   1. No ANSI / TUI control bytes leak to the human report.
 *   2. No internal JSON keys (`matrix`, `canonicalServer`, `agentServer`)
 *      leak to the human report.
 * And one structural helper:
 *   3. The seven section headings appear in the documented order.
 */

import { expect } from 'vitest';
import type { OvertureMcpServer } from '@overture/config';
import type {
  AgentSnapshot,
  ConflictClassification,
  ScanMatrix,
  ServerStatusRow,
} from '@overture/scan-matrix';

export const makeStdioServer = (
  command: string,
  args: readonly string[] = [],
  env: Readonly<Record<string, string>> = {},
): OvertureMcpServer => ({
  type: 'stdio',
  command,
  ...(args.length > 0 ? { args: [...args] } : {}),
  ...(Object.keys(env).length > 0 ? { env: { ...env } } : {}),
});

export const makeRemoteServer = (
  url: string,
  headers: Readonly<Record<string, string>> = {},
): OvertureMcpServer => ({
  type: 'remote',
  url,
  ...(Object.keys(headers).length > 0 ? { headers: { ...headers } } : {}),
});

export const makeAgent = (
  overrides: Partial<AgentSnapshot> = {},
): AgentSnapshot => ({
  id: 'claude-code',
  displayName: 'Claude Code',
  installed: false,
  mcpSupport: 'supported',
  readState: 'not-installed',
  ...overrides,
});

export const makeRow = (
  overrides: Partial<ServerStatusRow>,
): ServerStatusRow => ({
  agentId: 'claude-code',
  canonicalName: null,
  agentServerName: null,
  status: 'extra-in-agent',
  canonicalServer: null,
  agentServer: null,
  ...overrides,
});

export const makeMatrix = (
  overrides: Partial<ScanMatrix> = {},
): ScanMatrix => ({
  canonicalState: 'absent',
  canonicalProfileName: null,
  canonicalIntent: {},
  agents: [
    makeAgent(),
    makeAgent({ id: 'opencode', displayName: 'OpenCode' }),
    makeAgent({ id: 'github-copilot-cli', displayName: 'GitHub Copilot CLI' }),
    makeAgent({ id: 'openai-codex', displayName: 'OpenAI Codex' }),
  ],
  rows: [],
  ...overrides,
});

export const snapshotFor = (
  matrix: ScanMatrix,
  agentId: string,
): AgentSnapshot => {
  const snapshot = matrix.agents.find((agent) => agent.id === agentId);
  if (snapshot === undefined) {
    throw new Error(`expected snapshot for agent '${agentId}'`);
  }
  return snapshot;
};

export const noConflicts: ConflictClassification = {
  pickable: [],
  hardRefuses: [],
};

export function expectCommonSanitization(out: string): void {
  expect(out).not.toContain('\x1b[');
  expect(out).not.toContain('\x1b');
  expect(out).not.toContain('"matrix"');
  expect(out).not.toContain('"canonicalServer"');
  expect(out).not.toContain('"agentServer"');
  expect(out).not.toContain('matrix');
  expect(out).not.toContain('canonicalServer');
  expect(out).not.toContain('agentServer');
}

export function expectSectionOrder(out: string): void {
  const titles = [
    'Agents',
    'Aligned servers',
    'Missing from agents',
    'Agent-only servers',
    'Pickable conflicts',
    'Hard refuses',
    'Parse errors',
  ];
  let cursor = -1;
  for (const title of titles) {
    const index = out.indexOf(`\n${title}\n`);
    expect(index).toBeGreaterThan(cursor);
    cursor = index;
  }
}
