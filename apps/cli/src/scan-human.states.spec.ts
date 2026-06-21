import { describe, expect, it } from 'vitest';
import { classifyConflicts } from '@overture/scan-matrix';
import { formatHumanScanDetail } from './scan-human.js';
import {
  expectCommonSanitization,
  expectSectionOrder,
  makeAgent,
  makeMatrix,
  makeRow,
  snapshotFor,
} from './scan-human/fixtures.js';

describe('formatHumanScanDetail states', () => {
  it('surfaces invalid-profile canonical state in the summary line and skips the install suggestion block', () => {
    const matrix = makeMatrix({
      canonicalState: 'invalid-profile',
      canonicalProfileName: 'missing-profile',
      reason: 'profile not found: missing-profile',
      agents: [
        makeAgent({
          id: 'claude-code',
          displayName: 'Claude Code',
          installed: true,
          readState: 'read-ok',
        }),
        makeAgent({ id: 'opencode', displayName: 'OpenCode' }),
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

    expect(out.startsWith('Scan completed with blocking issues.')).toBe(true);
    expect(out).toContain('Canonical config: invalid-profile');
    expect(out).toContain('Canonical profile: missing-profile');
    expect(out).not.toContain('No supported MCP-capable agents detected.');
    expectSectionOrder(out);
    expectCommonSanitization(out);
  });

  it('surfaces invalid-profile reason visibility in the summary', () => {
    const matrix = makeMatrix({
      canonicalState: 'invalid-profile',
      canonicalProfileName: 'missing-profile',
      reason: 'Default profile "missing-profile" does not exist',
      agents: [
        makeAgent({
          id: 'claude-code',
          displayName: 'Claude Code',
          installed: true,
          readState: 'read-ok',
        }),
        makeAgent({ id: 'opencode', displayName: 'OpenCode' }),
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

    expect(out).toContain('Scan completed with blocking issues.');
    expect(out).toContain('Canonical config: invalid-profile');
    expect(out).toContain('Canonical profile: missing-profile');
    expect(out).toContain(
      'Canonical reason: Default profile "missing-profile" does not exist',
    );
    expectSectionOrder(out);
    expectCommonSanitization(out);
  });

  it('surfaces an unsupported-agent snapshot distinctly from not-installed', () => {
    const matrix = makeMatrix({
      canonicalState: 'ready',
      canonicalProfileName: 'default',
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
          mcpSupport: 'unsupported',
          readState: 'unsupported-agent',
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

    expect(snapshotFor(matrix, 'opencode').mcpSupport).toBe('unsupported');
    expect(out).toContain(
      '  - OpenCode (opencode): installed, mcp=unsupported, read=unsupported-agent',
    );
    expect(out).toContain(
      '  - Claude Code (claude-code): installed, mcp=supported, read=read-ok',
    );
    expectSectionOrder(out);
    expectCommonSanitization(out);
  });

  it('renders shape-conflict fingerprint with reason', () => {
    const matrix = makeMatrix({
      canonicalState: 'absent',
      canonicalProfileName: null,
      agents: [
        makeAgent({
          id: 'opencode',
          displayName: 'OpenCode',
          installed: true,
          readState: 'read-ok',
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
    const shapeConflict = {
      type: 'unknown-transport',
      reason: 'invalid transport discriminator',
    } as unknown as import('@overture/config').OvertureMcpServer;
    const matrixWithShape = {
      ...matrix,
      rows: [
        makeRow({
          agentId: 'opencode',
          canonicalName: 'broken',
          agentServerName: 'broken',
          status: 'aligned',
          canonicalServer: shapeConflict,
          agentServer: shapeConflict,
        }),
      ],
    };
    const conflicts = classifyConflicts(matrixWithShape);
    const out = formatHumanScanDetail(matrixWithShape, conflicts);

    expect(out).toContain(
      '  - broken on OpenCode (opencode): shape-conflict reason=invalid transport discriminator',
    );
    expectCommonSanitization(out);
  });
});
