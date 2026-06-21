import { describe, expect, it } from 'vitest';
import { classifyConflicts } from '@overture/scan-matrix';
import { formatHumanScanDetail } from './scan-human.js';
import {
  expectCommonSanitization,
  expectSectionOrder,
  makeAgent,
  makeMatrix,
  makeRow,
  makeStdioServer,
} from './scan-human/fixtures.js';

describe('formatHumanScanDetail conflicts', () => {
  it('renders a pickable conflict only when canonicalState is absent', () => {
    const matrix = makeMatrix({
      canonicalState: 'absent',
      canonicalProfileName: null,
      agents: [
        makeAgent({
          id: 'claude-code',
          displayName: 'Claude Code',
          installed: true,
          readState: 'read-ok',
        }),
        makeAgent({
          id: 'opencode',
          displayName: 'OpenCode',
          installed: true,
          readState: 'read-ok',
        }),
        makeAgent({
          id: 'github-copilot-cli',
          displayName: 'GitHub Copilot CLI',
        }),
        makeAgent({ id: 'openai-codex', displayName: 'OpenAI Codex' }),
      ],
      rows: [
        makeRow({
          agentId: 'claude-code',
          canonicalName: null,
          agentServerName: 'memory',
          status: 'extra-in-agent',
          agentServer: makeStdioServer('npx', ['memory-a']),
        }),
        makeRow({
          agentId: 'opencode',
          canonicalName: null,
          agentServerName: 'memory',
          status: 'extra-in-agent',
          agentServer: makeStdioServer('node', ['memory-b', '--flag']),
        }),
      ],
    });

    const conflicts = classifyConflicts(matrix);
    const [pickable] = conflicts.pickable;
    const out = formatHumanScanDetail(matrix, conflicts);

    expect(conflicts.pickable).toHaveLength(1);
    expect(pickable?.message).toBe(
      'Pickable conflict for "memory" across 2 agents (stdio): choose one canonical entry or skip.',
    );
    expect(out).toContain('Pickable conflicts');
    expect(out).toContain(
      '  - memory: Pickable conflict for "memory" across 2 agents (stdio): choose one canonical entry or skip.',
    );
    expect(out).toContain(
      '    candidate Claude Code (claude-code): stdio command=npx args=1 env=0',
    );
    expect(out).toContain(
      '    candidate OpenCode (opencode): stdio command=node args=2 env=0',
    );
    expectSectionOrder(out);
    expectCommonSanitization(out);
  });

  it('does NOT render pickable conflicts when canonicalState is ready', () => {
    const matrix = makeMatrix({
      canonicalState: 'ready',
      canonicalProfileName: 'default',
      canonicalIntent: {
        memory: makeStdioServer('npx', ['memory-a']),
      },
      agents: [
        makeAgent({
          id: 'claude-code',
          displayName: 'Claude Code',
          installed: true,
          readState: 'read-ok',
        }),
        makeAgent({
          id: 'opencode',
          displayName: 'OpenCode',
          installed: true,
          readState: 'read-ok',
        }),
        makeAgent({
          id: 'github-copilot-cli',
          displayName: 'GitHub Copilot CLI',
        }),
        makeAgent({ id: 'openai-codex', displayName: 'OpenAI Codex' }),
      ],
      rows: [
        makeRow({
          agentId: 'claude-code',
          canonicalName: null,
          agentServerName: 'memory',
          status: 'extra-in-agent',
          agentServer: makeStdioServer('npx', ['memory-a']),
        }),
        makeRow({
          agentId: 'opencode',
          canonicalName: null,
          agentServerName: 'memory',
          status: 'extra-in-agent',
          agentServer: makeStdioServer('node', ['memory-b']),
        }),
      ],
    });

    const conflicts = classifyConflicts(matrix);
    const out = formatHumanScanDetail(matrix, conflicts);

    expect(conflicts.pickable).toHaveLength(0);
    expect(out).toContain('Pickable conflicts\n  (none)');
    expectSectionOrder(out);
    expectCommonSanitization(out);
  });

  it('renders a hard-refuse using classifier message text without recalculating reasons', () => {
    const matrix = makeMatrix({
      canonicalState: 'absent',
      canonicalProfileName: null,
      agents: [
        makeAgent({
          id: 'opencode',
          displayName: 'OpenCode',
          installed: true,
          readState: 'parse-error',
          resolvedPath: '/home/u/.config/opencode/config.json',
          reason: 'Unexpected token at position 42',
        }),
        makeAgent({ id: 'claude-code', displayName: 'Claude Code' }),
        makeAgent({
          id: 'github-copilot-cli',
          displayName: 'GitHub Copilot CLI',
        }),
        makeAgent({ id: 'openai-codex', displayName: 'OpenAI Codex' }),
      ],
      rows: [],
    });

    const conflicts = classifyConflicts(matrix);
    const [hardRefuse] = conflicts.hardRefuses;
    const out = formatHumanScanDetail(matrix, conflicts);

    expect(conflicts.hardRefuses).toHaveLength(1);
    expect(hardRefuse?.message).toBe(
      'Cannot classify MCP conflicts because OpenCode could not parse /home/u/.config/opencode/config.json: Unexpected token at position 42. Fix that config file and retry.',
    );
    expect(out).toContain(hardRefuse?.message ?? '');
    expect(out).toContain(
      '  - parse-error: Cannot classify MCP conflicts because OpenCode could not parse /home/u/.config/opencode/config.json: Unexpected token at position 42. Fix that config file and retry.',
    );
    expectSectionOrder(out);
    expectCommonSanitization(out);
  });

  it('renders parse-error section derived from matrix.agents (one entry per parse-error agent)', () => {
    const matrix = makeMatrix({
      canonicalState: 'absent',
      canonicalProfileName: null,
      agents: [
        makeAgent({
          id: 'opencode',
          displayName: 'OpenCode',
          installed: true,
          readState: 'parse-error',
          resolvedPath: '/home/u/.config/opencode/config.json',
          reason: 'Unexpected token at position 42',
        }),
        makeAgent({
          id: 'claude-code',
          displayName: 'Claude Code',
          installed: true,
          readState: 'parse-error',
        }),
        makeAgent({
          id: 'github-copilot-cli',
          displayName: 'GitHub Copilot CLI',
        }),
        makeAgent({ id: 'openai-codex', displayName: 'OpenAI Codex' }),
      ],
      rows: [],
    });

    const conflicts = classifyConflicts(matrix);
    const out = formatHumanScanDetail(matrix, conflicts);

    expect(out).toContain('Parse errors');
    expect(out).toContain(
      '  - OpenCode (opencode): /home/u/.config/opencode/config.json - Unexpected token at position 42',
    );
    expect(out).toContain('  - Claude Code (claude-code): unknown - no reason');
    expectSectionOrder(out);
    expectCommonSanitization(out);
  });
});
