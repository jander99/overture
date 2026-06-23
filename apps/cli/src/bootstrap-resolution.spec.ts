import { describe, expect, it } from 'vitest';
import type { OvertureMcpServer } from '@overture/config';
import type {
  HardRefuseConflict,
  PickableConflict,
} from '@overture/scan-matrix';

import { buildBootstrapPlan } from './bootstrap.js';
import type {
  BootstrapBlocker,
  BootstrapPlan,
  BootstrapProposal,
} from './bootstrap.js';
import {
  applyInteractiveResolutions,
  type InteractiveResolution,
  type InteractiveResolutionResult,
} from './bootstrap-resolution.js';
import {
  CONTEXT7_REMOTE,
  HOME_FILESYSTEM_STDIO,
  PNPM_FILESYSTEM_STDIO,
  SCHEMA_URL,
  UPSTASH_CONTEXT7_STDIO,
  agentSnapshot,
  remoteServer,
  row,
  scanOutput,
} from '../test-support/bootstrap-test-support.js';

const SCHEMA_URL_TEST =
  'https://raw.githubusercontent.com/jander99/overture/main/schemas/overture.config.schema.json';

const PICKABLE_FILESYSTEM: readonly PickableConflict[] = [
  {
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
  },
];

const PICKABLE_CONTEXT7: readonly PickableConflict[] = [
  {
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
  },
];

const MIXED_HARD_REFUSE: readonly HardRefuseConflict[] = [
  {
    reason: 'mixed-transport-types',
    serverName: 'shared',
    agentId: null,
    displayName: null,
    message:
      'Cannot classify server "shared" because agents disagree on transport type (remote, stdio).',
  },
];

const PARSE_ERROR_REFUSE: readonly HardRefuseConflict[] = [
  {
    reason: 'parse-error',
    serverName: null,
    agentId: 'claude-code',
    displayName: 'claude-code',
    message: 'parse-error from claude-code',
  },
];

const NO_READABLE_AGENTS_BLOCKER: readonly BootstrapBlocker[] = [
  { reason: 'no-readable-agents' },
];

function planWithFilesystemPickable(): BootstrapPlan {
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
      conflicts: { pickable: PICKABLE_FILESYSTEM, hardRefuses: [] },
    }),
    configPath: '/tmp/overture.jsonc',
  });
}

function planWithTwoPickables(): BootstrapPlan {
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
      ],
      conflicts: {
        pickable: [...PICKABLE_FILESYSTEM, ...PICKABLE_CONTEXT7],
        hardRefuses: [],
      },
    }),
    configPath: '/tmp/overture.jsonc',
  });
}

function planWithHardRefuse(): BootstrapPlan {
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
        pickable: PICKABLE_FILESYSTEM,
        hardRefuses: MIXED_HARD_REFUSE,
      },
    }),
    configPath: '/tmp/overture.jsonc',
  });
}

function planWithBlocker(): BootstrapPlan {
  const baseProposal: BootstrapProposal = {
    status: 'blocked',
    configPath: '/tmp/overture.jsonc',
    config: {
      $schema: SCHEMA_URL_TEST,
      version: 1,
      settings: {
        defaultProfile: 'default',
        dryRunByDefault: true,
        backupBeforeWrite: true,
        conflictPolicy: 'refuse',
      },
      profiles: {
        default: {
          mcpServers: {},
          sync: { targets: [], disabledServers: [] },
          skills: [],
        },
      },
    },
    adoptedServers: [],
    targetAgents: [],
  };
  return {
    proposal: baseProposal,
    conflicts: { pickable: [], hardRefuses: [] },
    blockers: NO_READABLE_AGENTS_BLOCKER,
  };
}

function snapshotConfig(plan: BootstrapPlan): BootstrapProposal['config'] {
  return JSON.parse(
    JSON.stringify(plan.proposal.config),
  ) as BootstrapProposal['config'];
}

describe('applyInteractiveResolutions', () => {
  it('puts the selected candidate server in proposal.config.profiles.default.mcpServers', () => {
    const plan = planWithFilesystemPickable();
    const decisions: readonly InteractiveResolution[] = [
      { kind: 'selected', serverName: 'filesystem', candidateIndex: 0 },
    ];

    const result: InteractiveResolutionResult = applyInteractiveResolutions(
      plan,
      decisions,
    );

    const filesystemEntry: OvertureMcpServer | undefined =
      result.plan.proposal.config.profiles.default.mcpServers.filesystem;
    expect(filesystemEntry).toEqual(HOME_FILESYSTEM_STDIO);
    expect(result.plan.proposal.config.profiles.default.mcpServers).toEqual({
      filesystem: HOME_FILESYSTEM_STDIO,
    });

    expect(result.resolvedConflicts).toEqual([
      {
        serverName: 'filesystem',
        agentId: 'claude-code',
        displayName: 'claude-code',
      },
    ]);
    expect(result.skippedConflicts).toEqual([]);
    expect(result.aborted).toBe(false);
  });

  it('uses the second candidate when candidateIndex 1 is selected (context7)', () => {
    const plan = planWithTwoPickables();
    const decisions: readonly InteractiveResolution[] = [
      { kind: 'selected', serverName: 'context7', candidateIndex: 1 },
    ];

    const result = applyInteractiveResolutions(plan, decisions);

    const context7Entry =
      result.plan.proposal.config.profiles.default.mcpServers.context7;
    expect(context7Entry).toBeDefined();
    expect(context7Entry).toEqual(CONTEXT7_REMOTE);
    if (context7Entry?.type !== 'remote') {
      throw new Error('expected remote context7 entry');
    }
    expect(context7Entry.url).toBe('https://mcp.context7.com/mcp');
    expect(context7Entry.headers).toEqual({});

    expect(result.resolvedConflicts).toEqual([
      {
        serverName: 'context7',
        agentId: 'opencode',
        displayName: 'opencode',
      },
    ]);

    const adopted = result.plan.proposal.adoptedServers.find(
      (entry) => entry.name === 'context7',
    );
    expect(adopted).toEqual({
      name: 'context7',
      source: 'selected-conflict',
      agentIds: ['opencode'],
    });
  });

  it('uses the second candidate for filesystem (selected-conflict + stdio shape)', () => {
    const plan = planWithFilesystemPickable();
    const decisions: readonly InteractiveResolution[] = [
      { kind: 'selected', serverName: 'filesystem', candidateIndex: 1 },
    ];

    const result = applyInteractiveResolutions(plan, decisions);

    const filesystemEntry =
      result.plan.proposal.config.profiles.default.mcpServers.filesystem;
    expect(filesystemEntry).toEqual(PNPM_FILESYSTEM_STDIO);
    if (filesystemEntry?.type !== 'stdio') {
      throw new Error('expected stdio filesystem entry');
    }
    expect(filesystemEntry.command).toBe('pnpm');
    expect(filesystemEntry.args).toEqual([
      'dlx',
      '@modelcontextprotocol/server-filesystem',
      '/home',
    ]);
    expect(filesystemEntry.env).toEqual({});
  });

  it('records adopted server with source: selected-conflict and agentIds = [candidate.agentId]', () => {
    const plan = planWithFilesystemPickable();
    const decisions: readonly InteractiveResolution[] = [
      { kind: 'selected', serverName: 'filesystem', candidateIndex: 0 },
    ];

    const result = applyInteractiveResolutions(plan, decisions);

    const adopted = result.plan.proposal.adoptedServers.find(
      (entry) => entry.name === 'filesystem',
    );
    expect(adopted).toEqual({
      name: 'filesystem',
      source: 'selected-conflict',
      agentIds: ['claude-code'],
    });
  });

  it('skipped pickable is absent from mcpServers, adoptedServers, and recorded in skippedConflicts', () => {
    const plan = planWithFilesystemPickable();
    const decisions: readonly InteractiveResolution[] = [
      { kind: 'skipped', serverName: 'filesystem' },
    ];

    const result = applyInteractiveResolutions(plan, decisions);

    expect(
      result.plan.proposal.config.profiles.default.mcpServers,
    ).not.toHaveProperty('filesystem');
    expect(
      result.plan.proposal.adoptedServers.find(
        (entry) => entry.name === 'filesystem',
      ),
    ).toBeUndefined();
    expect(result.skippedConflicts).toEqual(['filesystem']);
    expect(result.resolvedConflicts).toEqual([]);
  });

  it('all-decisions-given plan with no hard refuses/blockers becomes status: ready', () => {
    const plan = planWithTwoPickables();
    expect(plan.proposal.status).toBe('blocked');

    const decisions: readonly InteractiveResolution[] = [
      { kind: 'selected', serverName: 'filesystem', candidateIndex: 0 },
      { kind: 'selected', serverName: 'context7', candidateIndex: 0 },
    ];

    const result = applyInteractiveResolutions(plan, decisions);

    expect(result.plan.proposal.status).toBe('ready');
    expect(result.plan.conflicts.pickable).toEqual([]);
    expect(result.plan.conflicts.hardRefuses).toEqual([]);
    expect(result.plan.blockers).toEqual([]);
  });

  it('all-skipped plan with no hard refuses/blockers also becomes status: ready', () => {
    const plan = planWithTwoPickables();
    const decisions: readonly InteractiveResolution[] = [
      { kind: 'skipped', serverName: 'filesystem' },
      { kind: 'skipped', serverName: 'context7' },
    ];

    const result = applyInteractiveResolutions(plan, decisions);

    expect(result.plan.proposal.status).toBe('ready');
    expect(result.skippedConflicts).toEqual(['context7', 'filesystem']);
    expect(result.resolvedConflicts).toEqual([]);
  });

  it('hard refuses pass through unchanged and keep status: blocked even when decisions are supplied', () => {
    const plan = planWithHardRefuse();
    expect(plan.proposal.status).toBe('blocked');

    const decisions: readonly InteractiveResolution[] = [
      { kind: 'selected', serverName: 'filesystem', candidateIndex: 0 },
    ];

    const result = applyInteractiveResolutions(plan, decisions);

    expect(result.plan.conflicts.hardRefuses).toEqual(MIXED_HARD_REFUSE);
    expect(result.plan.proposal.status).toBe('blocked');

    const filesystemEntry =
      result.plan.proposal.config.profiles.default.mcpServers.filesystem;
    expect(filesystemEntry).toEqual(HOME_FILESYSTEM_STDIO);
  });

  it('blockers pass through unchanged', () => {
    const plan = planWithBlocker();
    const decisions: readonly InteractiveResolution[] = [];

    const result = applyInteractiveResolutions(plan, decisions);

    expect(result.plan.blockers).toEqual(NO_READABLE_AGENTS_BLOCKER);
    expect(result.plan.proposal.status).toBe('blocked');
  });

  it('parse-error hard refuses pass through even when no pickable decisions are given', () => {
    const plan = buildBootstrapPlan({
      scanOutput: scanOutput({
        agents: [agentSnapshot('claude-code', 'parse-error')],
        rows: [],
        conflicts: { pickable: [], hardRefuses: PARSE_ERROR_REFUSE },
      }),
      configPath: '/tmp/overture.jsonc',
    });

    const result = applyInteractiveResolutions(plan, []);

    expect(result.plan.conflicts.hardRefuses).toEqual(PARSE_ERROR_REFUSE);
    expect(result.plan.proposal.status).toBe('blocked');
  });

  it("kind: 'abort' returns the original plan with aborted: true and no config mutation", () => {
    const plan = planWithFilesystemPickable();
    const planConfigBefore = snapshotConfig(plan);
    const planAdoptedBefore = JSON.parse(
      JSON.stringify(plan.proposal.adoptedServers),
    );
    const planConflictsBefore = JSON.parse(JSON.stringify(plan.conflicts));

    const decisions: readonly InteractiveResolution[] = [{ kind: 'abort' }];

    const result = applyInteractiveResolutions(plan, decisions);

    expect(result.aborted).toBe(true);
    expect(result.resolvedConflicts).toEqual([]);
    expect(result.skippedConflicts).toEqual([]);
    expect(result.plan).toBe(plan);
    expect(snapshotConfig(result.plan)).toEqual(planConfigBefore);
    expect(
      JSON.parse(JSON.stringify(result.plan.proposal.adoptedServers)),
    ).toEqual(planAdoptedBefore);
    expect(JSON.parse(JSON.stringify(result.plan.conflicts))).toEqual(
      planConflictsBefore,
    );
  });

  it("kind: 'abort' short-circuits even when other decisions are supplied", () => {
    const plan = planWithTwoPickables();
    const decisions: readonly InteractiveResolution[] = [
      { kind: 'selected', serverName: 'filesystem', candidateIndex: 0 },
      { kind: 'abort' },
      { kind: 'selected', serverName: 'context7', candidateIndex: 0 },
    ];

    const result = applyInteractiveResolutions(plan, decisions);

    expect(result.aborted).toBe(true);
    expect(result.plan).toBe(plan);
  });

  it('out-of-range candidateIndex throws', () => {
    const plan = planWithFilesystemPickable();

    expect(() =>
      applyInteractiveResolutions(plan, [
        { kind: 'selected', serverName: 'filesystem', candidateIndex: 2 },
      ]),
    ).toThrow(/candidateIndex 2 is out of range/);

    expect(() =>
      applyInteractiveResolutions(plan, [
        { kind: 'selected', serverName: 'filesystem', candidateIndex: -1 },
      ]),
    ).toThrow(/candidateIndex -1 is out of range/);
  });

  it('unknown serverName throws', () => {
    const plan = planWithFilesystemPickable();

    expect(() =>
      applyInteractiveResolutions(plan, [
        { kind: 'selected', serverName: 'does-not-exist', candidateIndex: 0 },
      ]),
    ).toThrow(/unknown serverName "does-not-exist"/);

    expect(() =>
      applyInteractiveResolutions(plan, [
        { kind: 'skipped', serverName: 'does-not-exist' },
      ]),
    ).toThrow(/unknown serverName "does-not-exist"/);
  });

  it('duplicate serverName decisions throw deterministically (first duplicate wins)', () => {
    const plan = planWithTwoPickables();

    expect(() =>
      applyInteractiveResolutions(plan, [
        { kind: 'selected', serverName: 'filesystem', candidateIndex: 0 },
        { kind: 'skipped', serverName: 'filesystem' },
      ]),
    ).toThrow(/duplicate decision for pickable serverName "filesystem"/);

    expect(() =>
      applyInteractiveResolutions(plan, [
        { kind: 'skipped', serverName: 'context7' },
        { kind: 'selected', serverName: 'context7', candidateIndex: 0 },
      ]),
    ).toThrow(/duplicate decision for pickable serverName "context7"/);
  });

  it('does not mutate the input plan or its proposal config', () => {
    const plan = planWithTwoPickables();
    const inputSnapshot = {
      config: snapshotConfig(plan),
      adoptedServers: JSON.parse(JSON.stringify(plan.proposal.adoptedServers)),
      pickable: JSON.parse(JSON.stringify(plan.conflicts.pickable)),
      hardRefuses: JSON.parse(JSON.stringify(plan.conflicts.hardRefuses)),
      blockers: JSON.parse(JSON.stringify(plan.blockers)),
      status: plan.proposal.status,
    };

    const decisions: readonly InteractiveResolution[] = [
      { kind: 'selected', serverName: 'filesystem', candidateIndex: 0 },
      { kind: 'skipped', serverName: 'context7' },
    ];

    applyInteractiveResolutions(plan, decisions);

    expect(snapshotConfig(plan)).toEqual(inputSnapshot.config);
    expect(JSON.parse(JSON.stringify(plan.proposal.adoptedServers))).toEqual(
      inputSnapshot.adoptedServers,
    );
    expect(JSON.parse(JSON.stringify(plan.conflicts.pickable))).toEqual(
      inputSnapshot.pickable,
    );
    expect(JSON.parse(JSON.stringify(plan.conflicts.hardRefuses))).toEqual(
      inputSnapshot.hardRefuses,
    );
    expect(JSON.parse(JSON.stringify(plan.blockers))).toEqual(
      inputSnapshot.blockers,
    );
    expect(plan.proposal.status).toBe(inputSnapshot.status);
  });

  it('does not mutate the input decisions array', () => {
    const plan = planWithTwoPickables();
    const decisions: InteractiveResolution[] = [
      { kind: 'selected', serverName: 'filesystem', candidateIndex: 0 },
      { kind: 'skipped', serverName: 'context7' },
    ];
    const originalDecisionsJson = JSON.parse(JSON.stringify(decisions));

    applyInteractiveResolutions(plan, decisions);

    expect(JSON.parse(JSON.stringify(decisions))).toEqual(
      originalDecisionsJson,
    );
  });

  it('selected conflict does not overwrite a non-pickable adopted server with the same name', () => {
    const plan = planWithFilesystemPickable();

    // Sanity: filesystem is NOT in adoptedServers initially (it's a pickable).
    const initialAdopted = plan.proposal.adoptedServers.find(
      (entry) => entry.name === 'filesystem',
    );
    expect(initialAdopted).toBeUndefined();

    const result = applyInteractiveResolutions(plan, [
      { kind: 'selected', serverName: 'filesystem', candidateIndex: 0 },
    ]);

    const adopted = result.plan.proposal.adoptedServers.find(
      (entry) => entry.name === 'filesystem',
    );
    expect(adopted).toEqual({
      name: 'filesystem',
      source: 'selected-conflict',
      agentIds: ['claude-code'],
    });
  });

  it('preserves existing adopted servers when adding a selected conflict', () => {
    const plan = buildBootstrapPlan({
      scanOutput: scanOutput({
        agents: [
          agentSnapshot('claude-code', 'read-ok'),
          agentSnapshot('opencode', 'read-ok'),
        ],
        rows: [
          row({
            agentId: 'claude-code',
            serverName: 'alpha',
            server: { type: 'stdio', command: 'alpha-cli', args: [] },
          }),
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
        conflicts: { pickable: PICKABLE_FILESYSTEM, hardRefuses: [] },
      }),
      configPath: '/tmp/overture.jsonc',
    });

    expect(plan.proposal.adoptedServers.map((entry) => entry.name)).toEqual([
      'alpha',
    ]);

    const result = applyInteractiveResolutions(plan, [
      { kind: 'selected', serverName: 'filesystem', candidateIndex: 0 },
    ]);

    expect(
      result.plan.proposal.adoptedServers.map((entry) => entry.name),
    ).toEqual(['alpha', 'filesystem']);
    expect(
      result.plan.proposal.adoptedServers.find(
        (entry) => entry.name === 'alpha',
      )?.source,
    ).toBe('single-agent');
    expect(
      result.plan.proposal.adoptedServers.find(
        (entry) => entry.name === 'filesystem',
      )?.source,
    ).toBe('selected-conflict');
  });

  it('selected conflict uses the chosen candidate headers (remote shape preserved)', () => {
    const bearerRemote: OvertureMcpServer = remoteServer(
      'https://api.example.com/v1',
      { Authorization: 'Bearer secret' },
    );
    const plan = buildBootstrapPlan({
      scanOutput: scanOutput({
        agents: [
          agentSnapshot('claude-code', 'read-ok'),
          agentSnapshot('opencode', 'read-ok'),
        ],
        rows: [
          row({
            agentId: 'claude-code',
            serverName: 'remote-server',
            server: bearerRemote,
          }),
          row({
            agentId: 'opencode',
            serverName: 'remote-server',
            server: remoteServer('https://api.example.com/v1'),
          }),
        ],
        conflicts: {
          pickable: [
            {
              serverName: 'remote-server',
              candidates: [
                {
                  agentId: 'claude-code',
                  displayName: 'claude-code',
                  server: bearerRemote,
                },
                {
                  agentId: 'opencode',
                  displayName: 'opencode',
                  server: remoteServer('https://api.example.com/v1'),
                },
              ],
              message: 'Pickable conflict for "remote-server".',
            },
          ],
          hardRefuses: [],
        },
      }),
      configPath: '/tmp/overture.jsonc',
    });

    const result = applyInteractiveResolutions(plan, [
      { kind: 'selected', serverName: 'remote-server', candidateIndex: 0 },
    ]);

    const entry =
      result.plan.proposal.config.profiles.default.mcpServers['remote-server'];
    expect(entry).toBeDefined();
    if (entry?.type !== 'remote') {
      throw new Error('expected remote entry');
    }
    expect(entry.url).toBe('https://api.example.com/v1');
    expect(entry.headers).toEqual({ Authorization: 'Bearer secret' });
  });

  it('selected conflict stores the candidate server (not the conflict fingerprint)', () => {
    const plan = planWithFilesystemPickable();

    const result = applyInteractiveResolutions(plan, [
      { kind: 'selected', serverName: 'filesystem', candidateIndex: 1 },
    ]);

    const entry =
      result.plan.proposal.config.profiles.default.mcpServers.filesystem;
    expect(entry).toEqual(PNPM_FILESYSTEM_STDIO);
    if (entry?.type !== 'stdio') {
      throw new Error('expected stdio entry');
    }
    // Verify the FULL normalized server (not redacted) is stored.
    expect(entry.command).toBe('pnpm');
    expect(entry.args).toEqual([
      'dlx',
      '@modelcontextprotocol/server-filesystem',
      '/home',
    ]);
  });
});

describe('buildBootstrapPlan (D2 baseline characterization)', () => {
  it('pickables block proposal status without any resolution applied', () => {
    const plan = planWithFilesystemPickable();

    expect(plan.proposal.status).toBe('blocked');
    expect(plan.proposal.config.profiles.default.mcpServers).not.toHaveProperty(
      'filesystem',
    );
    expect(
      plan.proposal.adoptedServers.find((entry) => entry.name === 'filesystem'),
    ).toBeUndefined();
  });

  it('SCHEMA_URL matches the bootstrap module constant (consistency check)', () => {
    expect(SCHEMA_URL).toBe(SCHEMA_URL_TEST);
  });
});
