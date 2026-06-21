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
  noConflicts,
} from './scan-human/fixtures.js';

describe('formatHumanScanDetail', () => {
  it('renders the zero agents human scan golden', () => {
    const zeroAgentMatrix = makeMatrix();
    const actual = formatHumanScanDetail(zeroAgentMatrix, noConflicts);

    expect(actual).toBe(`Scan complete.
Detected agents: 0 / 4
Canonical config: absent
Hard refuses: 0

Agents
  - Claude Code (claude-code): not installed, mcp=supported, read=not-installed
  - OpenCode (opencode): not installed, mcp=supported, read=not-installed
  - GitHub Copilot CLI (github-copilot-cli): not installed, mcp=supported, read=not-installed
  - OpenAI Codex (openai-codex): not installed, mcp=supported, read=not-installed

Aligned servers
  (none)

Missing from agents
  (none)

Agent-only servers
  (none)

Pickable conflicts
  (none)

Hard refuses
  (none)

Parse errors
  (none)

No supported MCP-capable agents detected.
Install one of these CLI agents on a supported OS (linux/darwin):
  - Claude Code
  - OpenCode
  - GitHub Copilot CLI
  - OpenAI Codex

Run "overture scan --json" for machine-readable details.`);
    expectCommonSanitization(actual);
  });

  it('renders an aligned row with a stdio fingerprint', () => {
    const matrix = makeMatrix({
      canonicalState: 'ready',
      canonicalProfileName: 'default',
      canonicalIntent: {
        memory: makeStdioServer(
          'npx',
          ['-y', '@modelcontextprotocol/server-memory'],
          { NODE_ENV: 'production' },
        ),
      },
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
      rows: [
        makeRow({
          agentId: 'claude-code',
          canonicalName: 'memory',
          agentServerName: 'memory',
          status: 'aligned',
          canonicalServer: makeStdioServer(
            'npx',
            ['-y', '@modelcontextprotocol/server-memory'],
            { NODE_ENV: 'production' },
          ),
          agentServer: makeStdioServer(
            'npx',
            ['-y', '@modelcontextprotocol/server-memory'],
            { NODE_ENV: 'production' },
          ),
        }),
      ],
    });

    const conflicts = classifyConflicts(matrix);
    const out = formatHumanScanDetail(matrix, conflicts);

    expect(out).toContain('Aligned servers');
    expect(out).toContain(
      '  - memory on Claude Code (claude-code): stdio command=npx args=2 env=1',
    );
    expect(out).toContain('Missing from agents\n  (none)');
    expect(out).toContain('Agent-only servers\n  (none)');
    expect(out).toContain('Pickable conflicts\n  (none)');
    expect(out).toContain('Hard refuses\n  (none)');
    expect(out).toContain('Parse errors\n  (none)');
    expectSectionOrder(out);
    expectCommonSanitization(out);
  });

  it('renders a missing-from-agent row when canonical names a server absent from a read-ok agent', () => {
    const matrix = makeMatrix({
      canonicalState: 'ready',
      canonicalProfileName: 'default',
      canonicalIntent: {
        memory: makeStdioServer(
          'npx',
          ['-y', '@modelcontextprotocol/server-memory'],
          { NODE_ENV: 'production', DEBUG: '1' },
        ),
      },
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
      rows: [
        makeRow({
          agentId: 'claude-code',
          canonicalName: 'memory',
          agentServerName: null,
          status: 'missing-from-agent',
          canonicalServer: makeStdioServer(
            'npx',
            ['-y', '@modelcontextprotocol/server-memory'],
            { NODE_ENV: 'production', DEBUG: '1' },
          ),
        }),
      ],
    });

    const conflicts = classifyConflicts(matrix);
    const out = formatHumanScanDetail(matrix, conflicts);

    expect(out).toContain('Missing from agents');
    expect(out).toContain(
      '  - memory missing from Claude Code (claude-code): stdio command=npx args=2 env=2',
    );
    expectSectionOrder(out);
    expectCommonSanitization(out);
  });

  it('renders an extra-in-agent row when an agent has a server absent from canonical', () => {
    const matrix = makeMatrix({
      canonicalState: 'ready',
      canonicalProfileName: 'default',
      canonicalIntent: {},
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
      rows: [
        makeRow({
          agentId: 'claude-code',
          canonicalName: null,
          agentServerName: 'memory',
          status: 'extra-in-agent',
          agentServer: makeStdioServer('node', ['server.js'], { DEBUG: '1' }),
        }),
      ],
    });

    const conflicts = classifyConflicts(matrix);
    const out = formatHumanScanDetail(matrix, conflicts);

    expect(out).toContain('Agent-only servers');
    expect(out).toContain(
      '  - memory on Claude Code (claude-code): stdio command=node args=1 env=1',
    );
    expectSectionOrder(out);
    expectCommonSanitization(out);
  });
});
