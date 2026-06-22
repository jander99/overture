import { describe, expect, it } from 'vitest';

import { AGENT_REGISTRY_ORDER } from '@overture/agents';
import type { OvertureMcpServer } from '@overture/config';
import type {
  AgentSnapshot,
  ConflictClassification,
  HardRefuseConflict,
  PickableConflict,
  ScanMatrix,
  ServerStatusRow,
} from '@overture/scan-matrix';

import { buildBootstrapPlan } from './bootstrap.js';
import type { ScanJsonOutput } from './scan.js';

const SCHEMA_URL =
  'https://raw.githubusercontent.com/jander99/overture/main/schemas/overture.config.schema.json';

type AgentId = (typeof AGENT_REGISTRY_ORDER)[number];

function stdioServer(
  command: string,
  args: readonly string[] = [],
  env: Record<string, string> = {},
): OvertureMcpServer {
  return {
    type: 'stdio',
    command,
    args: [...args],
    env: { ...env },
  };
}

function remoteServer(
  url: string,
  headers: Record<string, string> = {},
): OvertureMcpServer {
  return {
    type: 'remote',
    url,
    headers: { ...headers },
  };
}

function agentSnapshot(
  id: AgentId,
  readState: AgentSnapshot['readState'],
  overrides: Partial<Pick<AgentSnapshot, 'resolvedPath' | 'reason'>> = {},
): AgentSnapshot {
  return {
    id,
    displayName: id,
    installed: readState !== 'not-installed',
    mcpSupport: 'supported',
    readState,
    ...overrides,
  };
}

function row(params: {
  readonly agentId: AgentId;
  readonly serverName: string;
  readonly server: OvertureMcpServer;
}): ServerStatusRow {
  return {
    agentId: params.agentId,
    canonicalName: null,
    agentServerName: params.serverName,
    status: 'extra-in-agent',
    canonicalServer: null,
    agentServer: params.server,
  };
}

function scanOutput(params: {
  readonly agents: readonly AgentSnapshot[];
  readonly rows: readonly ServerStatusRow[];
  readonly conflicts?: ConflictClassification;
}): ScanJsonOutput {
  return {
    matrix: {
      canonicalState: 'absent',
      canonicalProfileName: null,
      canonicalIntent: {},
      agents: [...params.agents],
      rows: [...params.rows],
    } satisfies ScanMatrix,
    conflicts: params.conflicts ?? { pickable: [], hardRefuses: [] },
  };
}

function filesystemGroup(
  ...agentIds: readonly AgentId[]
): readonly ServerStatusRow[] {
  return agentIds.map((agentId) =>
    row({
      agentId,
      serverName: 'filesystem',
      server: stdioServer('npx', [
        '-y',
        '@modelcontextprotocol/server-filesystem',
        '/home',
      ]),
    }),
  );
}

describe('buildBootstrapPlan', () => {
  it('adopts a singleton readable server and emits ready config defaults', () => {
    const plan = buildBootstrapPlan({
      scanOutput: scanOutput({
        agents: [agentSnapshot('claude-code', 'read-ok')],
        rows: [
          row({
            agentId: 'claude-code',
            serverName: 'filesystem',
            server: stdioServer(
              'npx',
              ['-y', '@modelcontextprotocol/server-filesystem', '/home'],
              {
                NODE_ENV: 'production',
              },
            ),
          }),
        ],
      }),
      configPath: '/tmp/overture.jsonc',
    });

    expect(plan.proposal.status).toBe('ready');
    expect(plan.blockers).toEqual([]);
    expect(plan.proposal.targetAgents).toEqual(['claude-code']);
    expect(plan.proposal.adoptedServers).toEqual([
      {
        name: 'filesystem',
        source: 'single-agent',
        agentIds: ['claude-code'],
      },
    ]);
    expect(plan.proposal.config).toEqual({
      $schema: SCHEMA_URL,
      version: 1,
      settings: {
        defaultProfile: 'default',
        dryRunByDefault: true,
        backupBeforeWrite: true,
        conflictPolicy: 'refuse',
      },
      profiles: {
        default: {
          mcpServers: {
            filesystem: stdioServer(
              'npx',
              ['-y', '@modelcontextprotocol/server-filesystem', '/home'],
              {
                NODE_ENV: 'production',
              },
            ),
          },
          sync: {
            targets: ['claude-code'],
            disabledServers: [],
          },
          skills: [],
        },
      },
    });
  });

  it('adopts all-equal multi-agent servers via serverSettingsEqual', () => {
    const plan = buildBootstrapPlan({
      scanOutput: scanOutput({
        agents: [
          agentSnapshot('opencode', 'read-ok'),
          agentSnapshot('claude-code', 'read-ok'),
        ],
        rows: filesystemGroup('opencode', 'claude-code'),
      }),
      configPath: '/tmp/overture.jsonc',
    });

    expect(plan.proposal.status).toBe('ready');
    expect(plan.proposal.adoptedServers).toEqual([
      {
        name: 'filesystem',
        source: 'all-agents-equal',
        agentIds: ['claude-code', 'opencode'],
      },
    ]);
    expect(plan.proposal.config.profiles.default.mcpServers).toEqual({
      filesystem: stdioServer('npx', [
        '-y',
        '@modelcontextprotocol/server-filesystem',
        '/home',
      ]),
    });
  });

  it('omits pickable conflicts and blocks bootstrap when settings differ', () => {
    const candidates: readonly PickableConflict[] = [
      {
        serverName: 'filesystem',
        candidates: [
          {
            agentId: 'claude-code',
            displayName: 'claude-code',
            server: stdioServer('npx', [
              '-y',
              '@modelcontextprotocol/server-filesystem',
              '/home',
            ]),
          },
          {
            agentId: 'opencode',
            displayName: 'opencode',
            server: stdioServer('pnpm', [
              'dlx',
              '@modelcontextprotocol/server-filesystem',
              '/home',
            ]),
          },
        ],
        message: 'Pick one canonical entry or skip.',
      },
    ];

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
            server: stdioServer('npx', [
              '-y',
              '@modelcontextprotocol/server-filesystem',
              '/home',
            ]),
          }),
          row({
            agentId: 'opencode',
            serverName: 'filesystem',
            server: stdioServer('pnpm', [
              'dlx',
              '@modelcontextprotocol/server-filesystem',
              '/home',
            ]),
          }),
        ],
        conflicts: { pickable: candidates, hardRefuses: [] },
      }),
      configPath: '/tmp/overture.jsonc',
    });

    expect(plan.proposal.status).toBe('blocked');
    expect(
      plan.proposal.adoptedServers.map((server) => server.name),
    ).not.toContain('filesystem');
    expect(plan.conflicts.pickable).toEqual(candidates);
  });

  it('omits mixed-transport context7 hard refuses and blocks bootstrap', () => {
    const hardRefuses: readonly HardRefuseConflict[] = [
      {
        reason: 'mixed-transport-types',
        serverName: 'context7',
        agentId: null,
        displayName: null,
        message:
          'Cannot classify server "context7" because agents disagree on transport type (remote, stdio).',
      },
    ];

    const plan = buildBootstrapPlan({
      scanOutput: scanOutput({
        agents: [
          agentSnapshot('claude-code', 'read-ok'),
          agentSnapshot('github-copilot-cli', 'read-ok'),
          agentSnapshot('opencode', 'read-ok'),
        ],
        rows: [
          row({
            agentId: 'claude-code',
            serverName: 'context7',
            server: stdioServer('npx', ['-y', '@upstash/context7']),
          }),
          row({
            agentId: 'github-copilot-cli',
            serverName: 'context7',
            server: stdioServer('npx', ['-y', '@upstash/context7']),
          }),
          row({
            agentId: 'opencode',
            serverName: 'context7',
            server: remoteServer('https://mcp.context7.com/mcp'),
          }),
        ],
        conflicts: { pickable: [], hardRefuses },
      }),
      configPath: '/tmp/overture.jsonc',
    });

    expect(plan.proposal.status).toBe('blocked');
    expect(
      plan.proposal.adoptedServers.map((server) => server.name),
    ).not.toContain('context7');
    expect(plan.conflicts.hardRefuses).toEqual(hardRefuses);
  });

  it('keeps parse-error hard refuses out of the proposal', () => {
    const hardRefuses: readonly HardRefuseConflict[] = [
      {
        reason: 'parse-error',
        serverName: null,
        agentId: 'claude-code',
        displayName: 'claude-code',
        message:
          'Cannot classify MCP conflicts because claude-code could not parse /tmp/claude.jsonc: invalid json.',
      },
    ];

    const plan = buildBootstrapPlan({
      scanOutput: scanOutput({
        agents: [
          agentSnapshot('claude-code', 'parse-error', {
            reason: 'invalid json',
          }),
        ],
        rows: [],
        conflicts: { pickable: [], hardRefuses },
      }),
      configPath: '/tmp/overture.jsonc',
    });

    expect(plan.proposal.status).toBe('blocked');
    expect(plan.proposal.adoptedServers).toEqual([]);
    expect(plan.conflicts.hardRefuses).toEqual(hardRefuses);
  });

  it('adds a no-readable-agents blocker when nothing can be adopted', () => {
    const plan = buildBootstrapPlan({
      scanOutput: scanOutput({
        agents: [
          agentSnapshot('claude-code', 'not-installed'),
          agentSnapshot('opencode', 'unsupported-agent'),
          agentSnapshot('github-copilot-cli', 'read-empty'),
          agentSnapshot('openai-codex', 'read-no-config'),
        ],
        rows: [],
      }),
      configPath: '/tmp/overture.jsonc',
    });

    expect(plan.proposal.status).toBe('blocked');
    expect(plan.blockers).toEqual([{ reason: 'no-readable-agents' }]);
    expect(plan.proposal.targetAgents).toEqual([]);
    expect(plan.proposal.adoptedServers).toEqual([]);
    expect(plan.proposal.config.profiles.default.sync.targets).toEqual([]);
  });

  it('sorts target agents by registry order and adopted servers by name', () => {
    const plan = buildBootstrapPlan({
      scanOutput: scanOutput({
        agents: [
          agentSnapshot('openai-codex', 'read-ok'),
          agentSnapshot('github-copilot-cli', 'read-ok'),
          agentSnapshot('opencode', 'read-ok'),
          agentSnapshot('claude-code', 'read-ok'),
        ],
        rows: [
          row({
            agentId: 'openai-codex',
            serverName: 'zeta',
            server: stdioServer('zsh', ['-lc', 'zeta']),
          }),
          row({
            agentId: 'github-copilot-cli',
            serverName: 'beta',
            server: remoteServer('https://example.test/beta'),
          }),
          row({
            agentId: 'opencode',
            serverName: 'alpha',
            server: stdioServer('alpha'),
          }),
          row({
            agentId: 'claude-code',
            serverName: 'filesystem',
            server: stdioServer('npx', [
              '-y',
              '@modelcontextprotocol/server-filesystem',
              '/home',
            ]),
          }),
        ],
      }),
      configPath: '/tmp/overture.jsonc',
    });

    expect(plan.proposal.targetAgents).toEqual([...AGENT_REGISTRY_ORDER]);
    expect(plan.proposal.adoptedServers.map((server) => server.name)).toEqual([
      'alpha',
      'beta',
      'filesystem',
      'zeta',
    ]);
    expect(
      Object.keys(plan.proposal.config.profiles.default.mcpServers),
    ).toEqual(['alpha', 'beta', 'filesystem', 'zeta']);
  });

  it('emits exactly blockers, conflicts, and proposal at the top level', () => {
    const plan = buildBootstrapPlan({
      scanOutput: scanOutput({
        agents: [agentSnapshot('claude-code', 'read-ok')],
        rows: [
          row({
            agentId: 'claude-code',
            serverName: 'filesystem',
            server: stdioServer('npx', [
              '-y',
              '@modelcontextprotocol/server-filesystem',
              '/home',
            ]),
          }),
        ],
      }),
      configPath: '/tmp/overture.jsonc',
    });

    expect(Object.keys(plan).sort()).toEqual([
      'blockers',
      'conflicts',
      'proposal',
    ]);
  });
});
