import { describe, expect, it } from 'vitest';
import type { OvertureMcpServer } from '@overture/config';
import {
  classifyConflicts,
  type AgentSnapshot,
  type ConflictClassification,
  type ScanMatrix,
  type ServerStatusRow,
} from '@overture/scan-matrix';
import { formatHumanScanDetail } from './scan-human.js';

const makeStdioServer = (
  command: string,
  args: readonly string[] = [],
  env: Readonly<Record<string, string>> = {},
): OvertureMcpServer => ({
  type: 'stdio',
  command,
  ...(args.length > 0 ? { args: [...args] } : {}),
  ...(Object.keys(env).length > 0 ? { env: { ...env } } : {}),
});

const makeRemoteServer = (
  url: string,
  headers: Readonly<Record<string, string>> = {},
): OvertureMcpServer => ({
  type: 'remote',
  url,
  ...(Object.keys(headers).length > 0 ? { headers: { ...headers } } : {}),
});

const makeAgent = (overrides: Partial<AgentSnapshot> = {}): AgentSnapshot => ({
  id: 'claude-code',
  displayName: 'Claude Code',
  installed: false,
  mcpSupport: 'supported',
  readState: 'not-installed',
  ...overrides,
});

const makeRow = (overrides: Partial<ServerStatusRow>): ServerStatusRow => ({
  agentId: 'claude-code',
  canonicalName: null,
  agentServerName: null,
  status: 'extra-in-agent',
  canonicalServer: null,
  agentServer: null,
  ...overrides,
});

const makeMatrix = (overrides: Partial<ScanMatrix> = {}): ScanMatrix => ({
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

const snapshotFor = (matrix: ScanMatrix, agentId: string): AgentSnapshot => {
  const snapshot = matrix.agents.find((agent) => agent.id === agentId);
  if (snapshot === undefined) {
    throw new Error(`expected snapshot for agent '${agentId}'`);
  }
  return snapshot;
};

const noConflicts: ConflictClassification = {
  pickable: [],
  hardRefuses: [],
};

function expectCommonSanitization(out: string): void {
  expect(out).not.toContain('\x1b[');
  expect(out).not.toContain('\x1b');
  expect(out).not.toContain('"matrix"');
  expect(out).not.toContain('"canonicalServer"');
  expect(out).not.toContain('"agentServer"');
  expect(out).not.toContain('matrix');
  expect(out).not.toContain('canonicalServer');
  expect(out).not.toContain('agentServer');
}

function expectSectionOrder(out: string): void {
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
    const index = out.indexOf(`
${title}
`);
    expect(index).toBeGreaterThan(cursor);
    cursor = index;
  }
}

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
        makeAgent({ id: 'github-copilot-cli', displayName: 'GitHub Copilot CLI' }),
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
        makeAgent({ id: 'github-copilot-cli', displayName: 'GitHub Copilot CLI' }),
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
        makeAgent({ id: 'github-copilot-cli', displayName: 'GitHub Copilot CLI' }),
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
        makeAgent({ id: 'github-copilot-cli', displayName: 'GitHub Copilot CLI' }),
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
        makeAgent({ id: 'github-copilot-cli', displayName: 'GitHub Copilot CLI' }),
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
        makeAgent({ id: 'github-copilot-cli', displayName: 'GitHub Copilot CLI' }),
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
        makeAgent({ id: 'github-copilot-cli', displayName: 'GitHub Copilot CLI' }),
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
        makeAgent({ id: 'github-copilot-cli', displayName: 'GitHub Copilot CLI' }),
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

  it('renders a remote row with URL redaction and header count', () => {
    const remoteServer = makeRemoteServer(
      'https://mcp.example.com/mcp?token=abc123#frag456',
      { Authorization: 'Bearer test-token' },
    );
    const matrix = makeMatrix({
      canonicalState: 'ready',
      canonicalProfileName: 'default',
      canonicalIntent: {
        context7: remoteServer,
      },
      agents: [
        makeAgent({
          id: 'claude-code',
          displayName: 'Claude Code',
          installed: true,
          readState: 'read-ok',
        }),
        makeAgent({ id: 'opencode', displayName: 'OpenCode' }),
        makeAgent({ id: 'github-copilot-cli', displayName: 'GitHub Copilot CLI' }),
        makeAgent({ id: 'openai-codex', displayName: 'OpenAI Codex' }),
      ],
      rows: [
        makeRow({
          agentId: 'claude-code',
          canonicalName: 'context7',
          agentServerName: 'context7',
          status: 'aligned',
          canonicalServer: remoteServer,
          agentServer: remoteServer,
        }),
      ],
    });

    const conflicts = classifyConflicts(matrix);
    const out = formatHumanScanDetail(matrix, conflicts);

    expect(out).toContain(
      '  - context7 on Claude Code (claude-code): remote url=https://mcp.example.com/mcp?…#… headers=1',
    );
    expect(out).not.toContain('Bearer test-token');
    expect(out).not.toContain('abc123');
    expect(out).not.toContain('frag456');
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
        makeAgent({ id: 'github-copilot-cli', displayName: 'GitHub Copilot CLI' }),
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
        makeAgent({ id: 'github-copilot-cli', displayName: 'GitHub Copilot CLI' }),
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
    expectSectionOrder(out);
    expectCommonSanitization(out);
  });

  it('redacts env values, header values, arg values, bearer tokens, query and fragment values from stdio/remote output', () => {
    const secretArg = 'top-secret-arg-value';
    const bearerA = 'Bearer top-secret-token-a';
    const bearerB = 'Bearer another-secret-token-b';
    const matrix = makeMatrix({
      canonicalState: 'ready',
      canonicalProfileName: 'default',
      canonicalIntent: {
        secretServer: makeStdioServer('node', [secretArg], {
          Authorization: bearerA,
          DEBUG: '1',
        }),
      },
      agents: [
        makeAgent({
          id: 'claude-code',
          displayName: 'Claude Code',
          installed: true,
          readState: 'read-ok',
        }),
        makeAgent({ id: 'opencode', displayName: 'OpenCode' }),
        makeAgent({ id: 'github-copilot-cli', displayName: 'GitHub Copilot CLI' }),
        makeAgent({ id: 'openai-codex', displayName: 'OpenAI Codex' }),
      ],
      rows: [
        makeRow({
          agentId: 'claude-code',
          canonicalName: 'secretServer',
          agentServerName: 'secretServer',
          status: 'aligned',
          canonicalServer: makeStdioServer('node', [secretArg], {
            Authorization: bearerA,
            DEBUG: '1',
          }),
          agentServer: makeStdioServer('node', [secretArg], {
            Authorization: bearerA,
            DEBUG: '1',
          }),
        }),
        makeRow({
          agentId: 'claude-code',
          canonicalName: 'remoteSecret',
          agentServerName: 'remoteSecret',
          status: 'aligned',
          canonicalServer: makeRemoteServer(
            'https://api.example.com/mcp?token=secret-query&key=value#frag=secret-fragment',
            { Authorization: bearerB, 'X-Trace': 'yes' },
          ),
          agentServer: makeRemoteServer(
            'https://api.example.com/mcp?token=secret-query&key=value#frag=secret-fragment',
            { Authorization: bearerB, 'X-Trace': 'yes' },
          ),
        }),
      ],
    });

    const conflicts = classifyConflicts(matrix);
    const out = formatHumanScanDetail(matrix, conflicts);

    expect(out).toContain('stdio command=node args=1 env=2');
    expect(out).toContain(
      'remote url=https://api.example.com/mcp?…#… headers=2',
    );
    expect(out).not.toContain(secretArg);
    expect(out).not.toContain(bearerA);
    expect(out).not.toContain(bearerB);
    expect(out).not.toContain('secret-query');
    expect(out).not.toContain('key=value');
    expect(out).not.toContain('frag=secret-fragment');
    expect(out).not.toContain('token=secret-query');
    expect(out).not.toContain('DEBUG=1');
    expectCommonSanitization(out);
  });

  it('renders <invalid-url> for malformed URLs and never throws', () => {
    for (const badUrl of ['not a valid url', '', 'http://', 'ht!tp://x']) {
      const matrix = makeMatrix({
        canonicalState: 'ready',
        canonicalProfileName: 'default',
        canonicalIntent: {
          badServer: makeRemoteServer(badUrl, { Authorization: 'Bearer x' }),
        },
        agents: [
          makeAgent({
            id: 'claude-code',
            displayName: 'Claude Code',
            installed: true,
            readState: 'read-ok',
          }),
          makeAgent({ id: 'opencode', displayName: 'OpenCode' }),
          makeAgent({ id: 'github-copilot-cli', displayName: 'GitHub Copilot CLI' }),
          makeAgent({ id: 'openai-codex', displayName: 'OpenAI Codex' }),
        ],
        rows: [
          makeRow({
            agentId: 'claude-code',
            canonicalName: 'badServer',
            agentServerName: 'badServer',
            status: 'aligned',
            canonicalServer: makeRemoteServer(badUrl, { Authorization: 'Bearer x' }),
            agentServer: makeRemoteServer(badUrl, { Authorization: 'Bearer x' }),
          }),
        ],
      });
      const conflicts = classifyConflicts(matrix);
      let out = '';
      expect(() => {
        out = formatHumanScanDetail(matrix, conflicts);
      }).not.toThrow();
      expect(out).toContain('remote url=<invalid-url>');
      expect(out).not.toContain('Bearer x');
    }
  });

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
        makeAgent({ id: 'github-copilot-cli', displayName: 'GitHub Copilot CLI' }),
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
        makeAgent({ id: 'github-copilot-cli', displayName: 'GitHub Copilot CLI' }),
        makeAgent({ id: 'openai-codex', displayName: 'OpenAI Codex' }),
      ],
      rows: [],
    });
    const shapeConflict = {
      type: 'unknown-transport',
      reason: 'invalid transport discriminator',
    } as unknown as OvertureMcpServer;
    const matrixWithShape: ScanMatrix = {
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
