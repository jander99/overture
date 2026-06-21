import { describe, expect, it } from 'vitest';
import type { OvertureMcpServer } from '@overture/config';
import { classifyConflicts, type ServerStatusRow } from '@overture/scan-matrix';
import { formatHumanScanDetail } from './scan-human.js';
import {
  expectCommonSanitization,
  makeAgent,
  makeMatrix,
  makeRow,
  makeStdioServer,
} from './scan-human/fixtures.js';

describe('formatHumanScanDetail cap', () => {
  it('truncates output to 200 detailed entries and appends the JSON pointer cap message', () => {
    const totalRows = 250;
    const rows: ServerStatusRow[] = [];
    const canonicalIntent: Record<string, OvertureMcpServer> = {};
    for (let i = 0; i < totalRows; i += 1) {
      const name = `server-${String(i).padStart(3, '0')}`;
      canonicalIntent[name] = makeStdioServer('node', ['server.js']);
      rows.push(
        makeRow({
          agentId: 'claude-code',
          canonicalName: name,
          agentServerName: name,
          status: 'aligned',
          canonicalServer: makeStdioServer('node', ['server.js']),
          agentServer: makeStdioServer('node', ['server.js']),
        }),
      );
    }
    const matrix = makeMatrix({
      canonicalState: 'ready',
      canonicalProfileName: 'default',
      canonicalIntent,
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
      rows,
    });

    const conflicts = classifyConflicts(matrix);
    const out = formatHumanScanDetail(matrix, conflicts);

    expect(out).toContain(
      '  ... and 50 more entries; run "overture scan --json" for full details.',
    );
    const alignedSection = out.split('Aligned servers\n')[1] ?? '';
    const alignedLines = alignedSection.split('\n');
    const entryLines = alignedLines.filter(
      (line) => line.startsWith('  - ') || line.startsWith('    candidate '),
    );
    expect(entryLines.length).toBe(200);
    // Once the cap fires, later sections show `(none)` and are NOT emitted.
    expect(out).toContain('Missing from agents\n  (none)');
    expect(out).toContain('Pickable conflicts\n  (none)');
    expect(out).toContain('Parse errors\n  (none)');
    expectCommonSanitization(out);
  });

  it('counts omitted entries from later sections in the cap message', () => {
    const alignedRows: ServerStatusRow[] = [];
    const missingRows: ServerStatusRow[] = [];
    const extraRows: ServerStatusRow[] = [];
    const canonicalIntent: Record<string, OvertureMcpServer> = {};

    for (let i = 0; i < 150; i += 1) {
      const name = `aligned-${String(i).padStart(3, '0')}`;
      canonicalIntent[name] = makeStdioServer('node', ['server.js']);
      alignedRows.push(
        makeRow({
          agentId: 'claude-code',
          canonicalName: name,
          agentServerName: name,
          status: 'aligned',
          canonicalServer: makeStdioServer('node', ['server.js']),
          agentServer: makeStdioServer('node', ['server.js']),
        }),
      );
    }

    for (let i = 0; i < 100; i += 1) {
      const name = `missing-${String(i).padStart(3, '0')}`;
      canonicalIntent[name] = makeStdioServer('node', ['server.js']);
      missingRows.push(
        makeRow({
          agentId: 'claude-code',
          canonicalName: name,
          agentServerName: null,
          status: 'missing-from-agent',
          canonicalServer: makeStdioServer('node', ['server.js']),
        }),
      );
    }

    for (let i = 0; i < 50; i += 1) {
      const name = `extra-${String(i).padStart(3, '0')}`;
      extraRows.push(
        makeRow({
          agentId: 'claude-code',
          canonicalName: null,
          agentServerName: name,
          status: 'extra-in-agent',
          agentServer: makeStdioServer('node', ['server.js']),
        }),
      );
    }

    const matrix = makeMatrix({
      canonicalState: 'ready',
      canonicalProfileName: 'default',
      canonicalIntent,
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
      rows: [...alignedRows, ...missingRows, ...extraRows],
    });

    const conflicts = classifyConflicts(matrix);
    const out = formatHumanScanDetail(matrix, conflicts);

    // 150 aligned + 100 missing + 50 extra = 300 total; cap = 200
    // Aligned renders all 150, missing renders 50, cap fires with omitted = 100
    expect(out).toContain(
      '  ... and 100 more entries; run "overture scan --json" for full details.',
    );

    // Later sections after the cap show `(none)`
    expect(out).toContain('Agent-only servers\n  (none)');
    expect(out).toContain('Pickable conflicts\n  (none)');
    expect(out).toContain('Hard refuses\n  (none)');
    expect(out).toContain('Parse errors\n  (none)');
    expectCommonSanitization(out);
  });
});
