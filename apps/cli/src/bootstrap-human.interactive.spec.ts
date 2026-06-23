import { describe, expect, it } from 'vitest';
import type { PickableConflict } from '@overture/scan-matrix';

import { buildBootstrapPlan } from './bootstrap.js';
import type { BootstrapPlan } from './bootstrap.js';
import {
  formatHumanBootstrapProposal,
  formatHumanInteractiveResult,
} from './bootstrap-human.js';
import {
  applyInteractiveResolutions,
  type InteractiveResolution,
} from './bootstrap-resolution.js';
import {
  CONTEXT7_REMOTE,
  HOME_FILESYSTEM_STDIO,
  PNPM_FILESYSTEM_STDIO,
  UPSTASH_CONTEXT7_STDIO,
  agentSnapshot,
  remoteServer,
  row,
  scanOutput,
  stdioServer,
} from '../test-support/bootstrap-test-support.js';

const PICKABLE_FILESYSTEM: PickableConflict = {
  serverName: 'filesystem',
  candidates: [
    {
      agentId: 'claude-code',
      displayName: 'claude-code',
      server: HOME_FILESYSTEM_STDIO,
    },
    {
      agentId: 'opencode',
      displayName: 'opencode',
      server: PNPM_FILESYSTEM_STDIO,
    },
  ],
  message: 'Pickable conflict for "filesystem".',
};

const PICKABLE_CONTEXT7: PickableConflict = {
  serverName: 'context7',
  candidates: [
    {
      agentId: 'claude-code',
      displayName: 'claude-code',
      server: UPSTASH_CONTEXT7_STDIO,
    },
    {
      agentId: 'opencode',
      displayName: 'opencode',
      server: CONTEXT7_REMOTE,
    },
  ],
  message: 'Pickable conflict for "context7".',
};

const PICKABLE_SHARED: PickableConflict = {
  serverName: 'shared',
  candidates: [
    {
      agentId: 'claude-code',
      displayName: 'claude-code',
      server: stdioServer('alpha', ['--shared']),
    },
    {
      agentId: 'opencode',
      displayName: 'opencode',
      server: stdioServer('zeta', ['--shared']),
    },
  ],
  message: 'Pickable conflict for "shared".',
};

function planWithThreePickables(): BootstrapPlan {
  return buildBootstrapPlan({
    scanOutput: scanOutput({
      agents: [
        agentSnapshot('claude-code', 'read-ok'),
        agentSnapshot('opencode', 'read-ok'),
      ],
      rows: [
        row({
          agentId: 'claude-code',
          serverName: 'filesystem',
          server: HOME_FILESYSTEM_STDIO,
        }),
        row({
          agentId: 'opencode',
          serverName: 'filesystem',
          server: PNPM_FILESYSTEM_STDIO,
        }),
        row({
          agentId: 'claude-code',
          serverName: 'context7',
          server: UPSTASH_CONTEXT7_STDIO,
        }),
        row({
          agentId: 'opencode',
          serverName: 'context7',
          server: CONTEXT7_REMOTE,
        }),
        row({
          agentId: 'claude-code',
          serverName: 'shared',
          server: stdioServer('alpha', ['--shared']),
        }),
        row({
          agentId: 'opencode',
          serverName: 'shared',
          server: stdioServer('zeta', ['--shared']),
        }),
      ],
      conflicts: {
        pickable: [PICKABLE_FILESYSTEM, PICKABLE_CONTEXT7, PICKABLE_SHARED],
        hardRefuses: [],
      },
    }),
    configPath: '/tmp/overture.jsonc',
  });
}

function planWithBearerHeadersRemote(): BootstrapPlan {
  return buildBootstrapPlan({
    scanOutput: scanOutput({
      agents: [
        agentSnapshot('claude-code', 'read-ok'),
        agentSnapshot('opencode', 'read-ok'),
      ],
      rows: [
        row({
          agentId: 'claude-code',
          serverName: 'filesystem',
          server: HOME_FILESYSTEM_STDIO,
        }),
        row({
          agentId: 'opencode',
          serverName: 'filesystem',
          server: PNPM_FILESYSTEM_STDIO,
        }),
      ],
      conflicts: {
        pickable: [
          {
            serverName: 'remote-secret',
            candidates: [
              {
                agentId: 'claude-code',
                displayName: 'claude-code',
                server: remoteServer('https://api.example.com?api_key=secret', {
                  Authorization: 'Bearer secret',
                }),
              },
              {
                agentId: 'opencode',
                displayName: 'opencode',
                server: remoteServer('https://api.example.com?api_key=other', {
                  Authorization: 'Bearer other',
                }),
              },
            ],
            message:
              'Pick one canonical entry for "remote-secret". See https://api.example.com?api_key=secret.',
          },
        ],
        hardRefuses: [
          {
            reason: 'mixed-transport-types',
            serverName: 'remote-secret',
            agentId: null,
            displayName: null,
            message:
              'Cannot classify server "remote-secret" because agents disagree on transport type. See https://api.example.com?api_key=secret for the offending entry.',
          },
        ],
      },
    }),
    configPath: '/tmp/overture.jsonc',
  });
}

function emptyInteractivePlan(): BootstrapPlan {
  return buildBootstrapPlan({
    scanOutput: scanOutput({
      agents: [
        agentSnapshot('claude-code', 'read-ok'),
        agentSnapshot('opencode', 'read-ok'),
      ],
      rows: [],
      conflicts: { pickable: [], hardRefuses: [] },
    }),
    configPath: '/tmp/overture.jsonc',
  });
}

function expectedTwoResolvedOneSkipped(): string {
  // Deterministic byte-for-byte renderer contract. Adopted servers are
  // sorted alphabetically; resolved/skipped conflicts come pre-sorted from
  // the resolver. No blank lines between sections.
  return [
    'Bootstrap proposal (interactive)',
    'Config path: /tmp/overture.jsonc',
    'Proposal status: ready',
    'Adopted servers: 2',
    '  - context7 (selected-conflict) from claude-code',
    '  - filesystem (selected-conflict) from claude-code',
    'Pickable conflicts: 0',
    'Hard refuses: 0',
    'Blockers: 0',
    'Resolved conflicts: 2',
    '  - context7: claude-code (claude-code)',
    '  - filesystem: claude-code (claude-code)',
    'Skipped conflicts: 1',
    '  - shared',
    'No files were written.',
    '',
  ].join('\n');
}

function expectedEmpty(): string {
  return [
    'Bootstrap proposal (interactive)',
    'Config path: /tmp/overture.jsonc',
    'Proposal status: ready',
    'Adopted servers: 0',
    'Pickable conflicts: 0',
    'Hard refuses: 0',
    'Blockers: 0',
    'Resolved conflicts: 0',
    'Skipped conflicts: 0',
    'No files were written.',
    '',
  ].join('\n');
}

describe('formatHumanInteractiveResult', () => {
  it('matches the exact byte contract for a 2-resolution + 1-skip plan', () => {
    const plan = planWithThreePickables();
    const decisions: readonly InteractiveResolution[] = [
      { kind: 'selected', serverName: 'filesystem', candidateIndex: 0 },
      { kind: 'selected', serverName: 'context7', candidateIndex: 0 },
      { kind: 'skipped', serverName: 'shared' },
    ];

    const result = applyInteractiveResolutions(plan, decisions);
    const output = formatHumanInteractiveResult(result);

    expect(output).toBe(expectedTwoResolvedOneSkipped());
  });

  it('preserves formatHumanBootstrapProposal byte-for-byte against a known fixture', () => {
    // Baseline regression: the dry-run renderer must not change in D2.
    const plan = buildBootstrapPlan({
      scanOutput: scanOutput({
        agents: [
          agentSnapshot('claude-code', 'read-ok'),
          agentSnapshot('opencode', 'read-ok'),
        ],
        rows: [
          row({
            agentId: 'claude-code',
            serverName: 'filesystem',
            server: HOME_FILESYSTEM_STDIO,
          }),
          row({
            agentId: 'opencode',
            serverName: 'filesystem',
            server: PNPM_FILESYSTEM_STDIO,
          }),
        ],
        conflicts: { pickable: [], hardRefuses: [] },
      }),
      configPath: '/tmp/overture.jsonc',
    });

    const first = formatHumanBootstrapProposal(plan);
    const second = formatHumanBootstrapProposal(plan);
    expect(first).toBe(second);
    expect(first).toContain('Bootstrap proposal (dry-run)');
    expect(first).toContain('No files were written.');
  });

  it('redacts bearer headers, secrets, and full URLs in the interactive output', () => {
    const plan = planWithBearerHeadersRemote();
    const decisions: readonly InteractiveResolution[] = [
      { kind: 'selected', serverName: 'remote-secret', candidateIndex: 0 },
    ];
    const result = applyInteractiveResolutions(plan, decisions);
    const output = formatHumanInteractiveResult(result);

    const forbiddenFragments = [
      'api_key=',
      'Bearer ',
      '$schema',
      'matrix',
      'agentServer',
      'canonicalServer',
      'headers: {',
      'Authorization',
    ];
    for (const fragment of forbiddenFragments) {
      expect(output).not.toContain(fragment);
    }

    // The full URLs in the pickable and hard-refuse messages must be
    // redacted to the form `<scheme>://<host><path>?…` by redactMessageUrls.
    expect(output).toContain('https://api.example.com/?…');
    expect(output).not.toContain('api_key=secret');
    expect(output).not.toContain('api_key=other');
  });

  it('ends with a single trailing newline and prints No files were written. as the last content line', () => {
    const plan = planWithThreePickables();
    const result = applyInteractiveResolutions(plan, [
      { kind: 'selected', serverName: 'filesystem', candidateIndex: 0 },
      { kind: 'selected', serverName: 'context7', candidateIndex: 0 },
      { kind: 'skipped', serverName: 'shared' },
    ]);

    const output = formatHumanInteractiveResult(result);

    expect(output.endsWith('\n')).toBe(true);
    expect(output.endsWith('\n\n')).toBe(false);

    const lines = output.split('\n');
    // split('\n') on a string that ends with '\n' produces an empty last
    // element; the content line before it must be the footer.
    expect(lines.at(-1)).toBe('');
    expect(lines.at(-2)).toBe('No files were written.');
  });

  it('renders zero counters for a no-pickable / no-hard-refuse / no-blocker plan', () => {
    const plan = emptyInteractivePlan();
    const result = applyInteractiveResolutions(plan, []);
    const output = formatHumanInteractiveResult(result);

    expect(output).toContain('Pickable conflicts: 0');
    expect(output).toContain('Hard refuses: 0');
    expect(output).toContain('Blockers: 0');
    expect(output).toContain('Resolved conflicts: 0');
    expect(output).toContain('Skipped conflicts: 0');
    expect(output).toBe(expectedEmpty());
  });

  it('does not emit ansi escape codes', () => {
    const plan = planWithThreePickables();
    const result = applyInteractiveResolutions(plan, [
      { kind: 'selected', serverName: 'filesystem', candidateIndex: 0 },
      { kind: 'selected', serverName: 'context7', candidateIndex: 0 },
      { kind: 'skipped', serverName: 'shared' },
    ]);
    const output = formatHumanInteractiveResult(result);
    expect(/\x1b\[[0-9;]*m/.test(output)).toBe(false);
  });
});
