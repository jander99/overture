import { describe, expect, it } from 'vitest';

import { AGENT_REGISTRY_ORDER } from '@overture/agents';
import type {
  HardRefuseConflict,
  PickableConflict,
} from '@overture/scan-matrix';

import { buildBootstrapPlan } from './bootstrap.js';
import {
  ALPHA_STDIO,
  CONTEXT7_REMOTE,
  SCHEMA_URL,
  HOME_FILESYSTEM_STDIO,
  agentSnapshot,
  filesystemGroup,
  PNPM_FILESYSTEM_STDIO,
  remoteServer,
  row,
  scanOutput,
  UPSTASH_CONTEXT7_STDIO,
  ZETA_STDIO,
} from '../test-support/bootstrap-test-support.js';

describe('buildBootstrapPlan', () => {
  it('adopts singleton and all-equal groups, then sorts adopted servers and targets', () => {
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
            server: ZETA_STDIO,
          }),
          row({
            agentId: 'github-copilot-cli',
            serverName: 'beta',
            server: remoteServer('https://example.test/beta'),
          }),
          row({
            agentId: 'opencode',
            serverName: 'alpha',
            server: ALPHA_STDIO,
          }),
          ...filesystemGroup('claude-code'),
        ],
      }),
      configPath: '/tmp/overture.jsonc',
    });

    expect(plan.proposal.status).toBe('ready');
    expect(plan.blockers).toEqual([]);
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

  it('adopts equal multi-agent servers via serverSettingsEqual', () => {
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
            filesystem: HOME_FILESYSTEM_STDIO,
          },
          sync: { targets: ['claude-code', 'opencode'], disabledServers: [] },
          skills: [],
        },
      },
    });
  });

  it('blocks pickable and hard-refuse conflicts without adopting their servers', () => {
    const pickable: readonly PickableConflict[] = [
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
        message: 'Pick one canonical entry or skip.',
      },
    ];
    const hardRefuses: readonly HardRefuseConflict[] = [
      {
        reason: 'mixed-transport-types',
        serverName: 'context7',
        agentId: null,
        displayName: null,
        message:
          'Cannot classify server "context7" because agents disagree on transport type (remote, stdio).',
      },
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
          agentSnapshot('claude-code', 'read-ok'),
          agentSnapshot('opencode', 'read-ok'),
          agentSnapshot('github-copilot-cli', 'read-ok'),
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
            agentId: 'github-copilot-cli',
            serverName: 'context7',
            server: UPSTASH_CONTEXT7_STDIO,
          }),
          row({
            agentId: 'opencode',
            serverName: 'context7',
            server: CONTEXT7_REMOTE,
          }),
        ],
        conflicts: { pickable, hardRefuses },
      }),
      configPath: '/tmp/overture.jsonc',
    });

    expect(plan.proposal.status).toBe('blocked');
    const adoptedNames = plan.proposal.adoptedServers.map(
      (server) => server.name,
    );
    expect(adoptedNames).not.toContain('filesystem');
    expect(adoptedNames).not.toContain('context7');
    expect(plan.conflicts.pickable).toEqual(pickable);
    expect(plan.conflicts.hardRefuses).toEqual(hardRefuses);
  });

  it('records a no-readable-agents blocker when nothing can be adopted', () => {
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

  it('emits exactly blockers, conflicts, and proposal at the top level', () => {
    const plan = buildBootstrapPlan({
      scanOutput: scanOutput({
        agents: [agentSnapshot('claude-code', 'read-ok')],
        rows: [
          row({
            agentId: 'claude-code',
            serverName: 'filesystem',
            server: HOME_FILESYSTEM_STDIO,
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
