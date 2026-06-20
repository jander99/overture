import { describe, it, expect, expectTypeOf } from 'vitest';
import type { McpSupport } from '@overture/agents';
import type { OvertureConfig, OvertureMcpServer } from '@overture/config';
import {
  DEFAULT_REGISTRY_ORDER,
  buildScanMatrix,
  classifyConflicts,
  compareAgentEntries,
  serverSettingsEqual,
} from './index.js';
import type {
  AgentReadState,
  AgentScanInput,
  AgentSnapshot,
  BuildScanMatrixInput,
  CompareAgentEntriesInput,
  ConflictClassification,
  HardRefuseConflict,
  HardRefuseReason,
  NormalizedAgentServer,
  PickableConflict,
  PickableConflictCandidate,
  ScanMatrix,
  ServerStatus,
  ServerStatusRow,
} from './index.js';

// Type-only compile-time assertions for the B1 model. Each `expectTypeOf`
// call exercises a fixture of the target type; the runtime matcher fails
// only when the fixture drifts from the declared type. Tests for actual
// function behavior land in Tasks 3-5.

describe('B1 public type contracts', () => {
  it('ServerStatus is the approved five-row vocabulary', () => {
    expectTypeOf<ServerStatus>().toEqualTypeOf<
      | 'aligned'
      | 'missing-from-agent'
      | 'extra-in-agent'
      | 'different-settings'
      | 'shape-conflict'
    >();
  });

  it('AgentReadState is the approved seven-state vocabulary', () => {
    expectTypeOf<AgentReadState>().toEqualTypeOf<
      | 'not-installed'
      | 'unsupported-agent'
      | 'not-read'
      | 'read-ok'
      | 'read-empty'
      | 'read-no-config'
      | 'parse-error'
    >();
  });

  it('McpSupport narrows to the approved three-state vocabulary', () => {
    expectTypeOf<McpSupport>().toEqualTypeOf<
      'supported' | 'unsupported' | 'unknown'
    >();
  });

  it('OvertureMcpServer and OvertureConfig resolve to upstream types', () => {
    const server: OvertureMcpServer = { type: 'stdio', command: 'echo' };
    const config: OvertureConfig = {
      version: 1,
      settings: { defaultProfile: 'default' },
      profiles: {
        default: {
          mcpServers: {},
          sync: { targets: [], disabledServers: [] },
          skills: [],
        },
      },
    };
    expectTypeOf(server).toMatchTypeOf<OvertureMcpServer>();
    expectTypeOf(config).toMatchTypeOf<OvertureConfig>();
  });

  it('NormalizedAgentServer discriminates on state and narrows correctly', () => {
    expectTypeOf<NormalizedAgentServer>().toEqualTypeOf<
      | { readonly state: 'normalized'; readonly server: OvertureMcpServer }
      | { readonly state: 'shape-conflict'; readonly reason: string }
    >();
  });

  it('AgentScanInput accepts all optional slots', () => {
    const input: AgentScanInput = {
      id: 'claude-code',
      displayName: 'Claude Code',
      installed: true,
      mcpSupport: 'supported',
      readState: 'read-ok',
      resolvedPath: '/home/user/.claude.json',
      servers: {
        stdio: { state: 'normalized', server: { type: 'stdio', command: 'x' } },
      },
    };
    expectTypeOf(input).toMatchTypeOf<AgentScanInput>();
  });

  it('AgentSnapshot is the public server-free view', () => {
    const snapshot: AgentSnapshot = {
      id: 'opencode',
      displayName: 'OpenCode',
      installed: true,
      mcpSupport: 'supported',
      readState: 'read-empty',
    };
    expectTypeOf(snapshot).toMatchTypeOf<AgentSnapshot>();
  });

  it('ServerStatusRow uses nullable names instead of magic sentinels', () => {
    const aligned: ServerStatusRow = {
      agentId: 'claude-code',
      canonicalName: 'memory',
      agentServerName: 'memory',
      status: 'aligned',
      canonicalServer: { type: 'stdio', command: 'x' },
      agentServer: { type: 'stdio', command: 'x' },
    };
    const extra: ServerStatusRow = {
      agentId: 'opencode',
      canonicalName: null,
      agentServerName: 'extra-server',
      status: 'extra-in-agent',
      canonicalServer: null,
      agentServer: { type: 'stdio', command: 'x' },
      reason: 'Canonical intent has no server named "extra-server"',
    };
    const missing: ServerStatusRow = {
      agentId: 'openai-codex',
      canonicalName: 'memory',
      agentServerName: null,
      status: 'missing-from-agent',
      canonicalServer: { type: 'stdio', command: 'x' },
      agentServer: null,
      reason: 'Agent has no server named "memory"',
    };
    expectTypeOf(aligned).toMatchTypeOf<ServerStatusRow>();
    expectTypeOf(extra).toMatchTypeOf<ServerStatusRow>();
    expectTypeOf(missing).toMatchTypeOf<ServerStatusRow>();
  });

  it('ScanMatrix enumerates the three canonical states', () => {
    const ready: ScanMatrix = {
      canonicalState: 'ready',
      canonicalProfileName: 'default',
      canonicalIntent: {},
      agents: [],
      rows: [],
    };
    const absent: ScanMatrix = {
      canonicalState: 'absent',
      canonicalProfileName: null,
      canonicalIntent: {},
      agents: [],
      rows: [],
    };
    const invalid: ScanMatrix = {
      canonicalState: 'invalid-profile',
      canonicalProfileName: 'default',
      canonicalIntent: {},
      agents: [],
      rows: [],
      reason: 'Default profile "default" does not exist',
    };
    expectTypeOf(ready).toMatchTypeOf<ScanMatrix>();
    expectTypeOf(absent).toMatchTypeOf<ScanMatrix>();
    expectTypeOf(invalid).toMatchTypeOf<ScanMatrix>();
  });

  it('BuildScanMatrixInput allows null config and an optional registryOrder', () => {
    const withConfig: BuildScanMatrixInput = {
      config: {
        version: 1,
        settings: { defaultProfile: 'default' },
        profiles: {
          default: {
            mcpServers: {},
            sync: { targets: [], disabledServers: [] },
            skills: [],
          },
        },
      },
      agents: [],
    };
    const withoutConfig: BuildScanMatrixInput = {
      config: null,
      agents: [],
      registryOrder: ['claude-code', 'opencode'],
    };
    expectTypeOf(withConfig).toMatchTypeOf<BuildScanMatrixInput>();
    expectTypeOf(withoutConfig).toMatchTypeOf<BuildScanMatrixInput>();
  });

  it('CompareAgentEntriesInput carries canonical, agent, and agentId', () => {
    const input: CompareAgentEntriesInput = {
      canonical: {},
      agent: {},
      agentId: 'claude-code',
    };
    expectTypeOf(input).toMatchTypeOf<CompareAgentEntriesInput>();
  });
});

describe('serverSettingsEqual', () => {
  // Fixtures: keep the equality tests focused on the fields the helper
  // is contract-bound to compare. Each case is a single behavioral
  // assertion that pins the post-normalization contract.
  const stdioBase: OvertureMcpServer = {
    type: 'stdio',
    command: 'npx',
    args: ['-y', 'mcp-server'],
    env: { API_KEY: 'secret', REGION: 'us-east-1' },
  };
  const remoteBase: OvertureMcpServer = {
    type: 'remote',
    url: 'https://api.example.com/mcp',
    headers: { Authorization: 'Bearer token', Accept: 'application/json' },
  };

  it('identical stdio entries are equal', () => {
    expect(serverSettingsEqual(stdioBase, { ...stdioBase })).toBe(true);
  });

  it('identical remote entries are equal', () => {
    expect(serverSettingsEqual(remoteBase, { ...remoteBase })).toBe(true);
  });

  it('stdio command differs', () => {
    const right: OvertureMcpServer = { ...stdioBase, command: 'node' };
    expect(serverSettingsEqual(stdioBase, right)).toBe(false);
  });

  it('stdio command differs by case (npx vs Npx)', () => {
    const right: OvertureMcpServer = { ...stdioBase, command: 'Npx' };
    expect(serverSettingsEqual(stdioBase, right)).toBe(false);
  });

  it('stdio command differs by whitespace (npx vs " npx ")', () => {
    const right: OvertureMcpServer = { ...stdioBase, command: ' npx ' };
    expect(serverSettingsEqual(stdioBase, right)).toBe(false);
  });

  it('stdio args missing vs [] are unequal', () => {
    const left: OvertureMcpServer = {
      type: 'stdio',
      command: 'npx',
      env: { API_KEY: 'secret' },
    };
    const right: OvertureMcpServer = {
      type: 'stdio',
      command: 'npx',
      args: [],
      env: { API_KEY: 'secret' },
    };
    expect(serverSettingsEqual(left, right)).toBe(false);
  });

  it('stdio args order differs', () => {
    const right: OvertureMcpServer = {
      ...stdioBase,
      args: ['mcp-server', '-y'],
    };
    expect(serverSettingsEqual(stdioBase, right)).toBe(false);
  });

  it('stdio env subset differs', () => {
    const right: OvertureMcpServer = {
      ...stdioBase,
      env: { API_KEY: 'secret' },
    };
    expect(serverSettingsEqual(stdioBase, right)).toBe(false);
  });

  it('stdio env key insertion order does not differ', () => {
    const right: OvertureMcpServer = {
      ...stdioBase,
      env: { REGION: 'us-east-1', API_KEY: 'secret' },
    };
    expect(serverSettingsEqual(stdioBase, right)).toBe(true);
  });

  it('remote url differs', () => {
    const right: OvertureMcpServer = {
      ...remoteBase,
      url: 'https://api.example.com/v2/mcp',
    };
    expect(serverSettingsEqual(remoteBase, right)).toBe(false);
  });

  it('remote url trailing slash differs', () => {
    const right: OvertureMcpServer = {
      ...remoteBase,
      url: 'https://api.example.com/mcp/',
    };
    expect(serverSettingsEqual(remoteBase, right)).toBe(false);
  });

  it('remote scheme differs', () => {
    const right: OvertureMcpServer = {
      ...remoteBase,
      url: 'http://api.example.com/mcp',
    };
    expect(serverSettingsEqual(remoteBase, right)).toBe(false);
  });

  it('remote host case differs', () => {
    const right: OvertureMcpServer = {
      ...remoteBase,
      url: 'https://API.EXAMPLE.COM/mcp',
    };
    expect(serverSettingsEqual(remoteBase, right)).toBe(false);
  });

  it('remote headers subset differs', () => {
    const right: OvertureMcpServer = {
      ...remoteBase,
      headers: { Authorization: 'Bearer token' },
    };
    expect(serverSettingsEqual(remoteBase, right)).toBe(false);
  });

  it('remote headers missing vs {} differs', () => {
    const left: OvertureMcpServer = {
      type: 'remote',
      url: 'https://api.example.com/mcp',
    };
    const right: OvertureMcpServer = {
      type: 'remote',
      url: 'https://api.example.com/mcp',
      headers: {},
    };
    expect(serverSettingsEqual(left, right)).toBe(false);
  });

  it('remote headers key insertion order does not differ', () => {
    const right: OvertureMcpServer = {
      ...remoteBase,
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer token',
      },
    };
    expect(serverSettingsEqual(remoteBase, right)).toBe(true);
  });

  it('type mismatch returns false and does not inspect cross-type fields', () => {
    // Even when every cross-type field matches, the type mismatch must
    // short-circuit to false. The fixture intentionally sets stdio.command
    // to the remote url and remote.url to the stdio command to prove no
    // field value is consulted once `type` differs.
    const stdioSide: OvertureMcpServer = {
      type: 'stdio',
      command: 'https://api.example.com/mcp',
      args: [],
    };
    const remoteSide: OvertureMcpServer = {
      type: 'remote',
      url: 'npx',
      headers: { '0': 'npx', '1': 'mcp-server' },
    };
    expect(serverSettingsEqual(stdioSide, remoteSide)).toBe(false);
    expect(serverSettingsEqual(remoteSide, stdioSide)).toBe(false);
  });
});

describe('compareAgentEntries', () => {
  const stdioA: OvertureMcpServer = {
    type: 'stdio',
    command: 'npx',
    args: ['-y', 'mcp-server'],
  };
  const stdioB: OvertureMcpServer = {
    type: 'stdio',
    command: 'npx',
    args: ['-y', 'mcp-server', '--debug'],
  };
  const remoteA: OvertureMcpServer = {
    type: 'remote',
    url: 'https://api.example.com/mcp',
  };

  it('emits one aligned row for an identical stdio pair', () => {
    const rows = compareAgentEntries({
      agentId: 'claude-code',
      canonical: { memory: stdioA },
      agent: { memory: { state: 'normalized', server: stdioA } },
    });
    expect(rows).toEqual([
      {
        agentId: 'claude-code',
        canonicalName: 'memory',
        agentServerName: 'memory',
        status: 'aligned',
        canonicalServer: stdioA,
        agentServer: stdioA,
      },
    ]);
  });

  it('emits one aligned row for an identical remote pair', () => {
    const rows = compareAgentEntries({
      agentId: 'opencode',
      canonical: { r: remoteA },
      agent: { r: { state: 'normalized', server: remoteA } },
    });
    expect(rows).toEqual([
      {
        agentId: 'opencode',
        canonicalName: 'r',
        agentServerName: 'r',
        status: 'aligned',
        canonicalServer: remoteA,
        agentServer: remoteA,
      },
    ]);
  });

  it('emits different-settings when same type but field values differ', () => {
    const rows = compareAgentEntries({
      agentId: 'claude-code',
      canonical: { memory: stdioA },
      agent: { memory: { state: 'normalized', server: stdioB } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      agentId: 'claude-code',
      canonicalName: 'memory',
      agentServerName: 'memory',
      status: 'different-settings',
      canonicalServer: stdioA,
      agentServer: stdioB,
      reason: 'Canonical and agent settings differ',
    });
  });

  it('emits shape-conflict when canonical stdio and agent remote disagree on type', () => {
    const rows = compareAgentEntries({
      agentId: 'claude-code',
      canonical: { mixed: stdioA },
      agent: { mixed: { state: 'normalized', server: remoteA } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      agentId: 'claude-code',
      canonicalName: 'mixed',
      agentServerName: 'mixed',
      status: 'shape-conflict',
      canonicalServer: stdioA,
      agentServer: null,
      reason: 'Canonical type "stdio" differs from agent type "remote"',
    });
  });

  it('emits shape-conflict when agent normalization returned a shape-conflict marker', () => {
    const conflictReason = 'agent entry is missing required "command" field';
    const rows = compareAgentEntries({
      agentId: 'opencode',
      canonical: { memory: stdioA },
      agent: {
        memory: { state: 'shape-conflict', reason: conflictReason },
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      agentId: 'opencode',
      canonicalName: 'memory',
      agentServerName: 'memory',
      status: 'shape-conflict',
      canonicalServer: stdioA,
      agentServer: null,
      reason: conflictReason,
    });
  });

  it('emits missing-from-agent when agent has no entry for the canonical name', () => {
    const rows = compareAgentEntries({
      agentId: 'claude-code',
      canonical: { memory: stdioA },
      agent: {},
    });
    expect(rows).toEqual([
      {
        agentId: 'claude-code',
        canonicalName: 'memory',
        agentServerName: null,
        status: 'missing-from-agent',
        canonicalServer: stdioA,
        agentServer: null,
        reason: 'Agent has no server named "memory"',
      },
    ]);
  });

  it('emits extra-in-agent when canonical has no entry for the agent name', () => {
    const rows = compareAgentEntries({
      agentId: 'opencode',
      canonical: {},
      agent: { bonus: { state: 'normalized', server: stdioA } },
    });
    expect(rows).toEqual([
      {
        agentId: 'opencode',
        canonicalName: null,
        agentServerName: 'bonus',
        status: 'extra-in-agent',
        canonicalServer: null,
        agentServer: stdioA,
        reason: 'Canonical intent has no server named "bonus"',
      },
    ]);
  });

  it('emits all extras when canonical is empty and agent is populated', () => {
    const rows = compareAgentEntries({
      agentId: 'opencode',
      canonical: {},
      agent: {
        a: { state: 'normalized', server: stdioA },
        b: { state: 'normalized', server: remoteA },
      },
    });
    expect(rows).toEqual([
      {
        agentId: 'opencode',
        canonicalName: null,
        agentServerName: 'a',
        status: 'extra-in-agent',
        canonicalServer: null,
        agentServer: stdioA,
        reason: 'Canonical intent has no server named "a"',
      },
      {
        agentId: 'opencode',
        canonicalName: null,
        agentServerName: 'b',
        status: 'extra-in-agent',
        canonicalServer: null,
        agentServer: remoteA,
        reason: 'Canonical intent has no server named "b"',
      },
    ]);
  });

  it('emits all missing when canonical is populated and agent is empty', () => {
    const rows = compareAgentEntries({
      agentId: 'claude-code',
      canonical: { x: stdioA, y: remoteA },
      agent: {},
    });
    expect(rows).toEqual([
      {
        agentId: 'claude-code',
        canonicalName: 'x',
        agentServerName: null,
        status: 'missing-from-agent',
        canonicalServer: stdioA,
        agentServer: null,
        reason: 'Agent has no server named "x"',
      },
      {
        agentId: 'claude-code',
        canonicalName: 'y',
        agentServerName: null,
        status: 'missing-from-agent',
        canonicalServer: remoteA,
        agentServer: null,
        reason: 'Agent has no server named "y"',
      },
    ]);
  });

  it('emits zero rows when both sides are empty', () => {
    const rows = compareAgentEntries({
      agentId: 'claude-code',
      canonical: {},
      agent: {},
    });
    expect(rows).toEqual([]);
  });

  it('sorts multiple canonical names ascending then appends agent-only rows ascending', () => {
    const rows = compareAgentEntries({
      agentId: 'claude-code',
      canonical: {
        charlie: stdioA,
        alpha: remoteA,
        bravo: stdioA,
      },
      agent: {
        bravo: { state: 'normalized', server: stdioA },
        delta: { state: 'normalized', server: stdioA },
        charlie: { state: 'shape-conflict', reason: 'agent shape conflict' },
        alpha: { state: 'normalized', server: remoteA },
      },
    });
    expect(rows.map((r) => r.canonicalName ?? r.agentServerName)).toEqual([
      'alpha',
      'bravo',
      'charlie',
      'delta',
    ]);
    expect(rows.map((r) => r.status)).toEqual([
      'aligned',
      'aligned',
      'shape-conflict',
      'extra-in-agent',
    ]);
    expect(rows.map((r) => r.agentId)).toEqual([
      'claude-code',
      'claude-code',
      'claude-code',
      'claude-code',
    ]);
  });

  it('extra rows use canonicalName: null and the agent server name', () => {
    const rows = compareAgentEntries({
      agentId: 'opencode',
      canonical: { shared: stdioA },
      agent: {
        shared: { state: 'normalized', server: stdioA },
        orphan: { state: 'normalized', server: stdioA },
      },
    });
    const extras = rows.filter((r) => r.status === 'extra-in-agent');
    expect(extras).toHaveLength(1);
    expect(extras[0]?.canonicalName).toBeNull();
    expect(extras[0]?.canonicalServer).toBeNull();
    expect(extras[0]?.agentServerName).toBe('orphan');
    expect(extras[0]?.agentServer).toBe(stdioA);
  });

  it('row name fields are null on the absent side, never sentinel strings', () => {
    const rows = compareAgentEntries({
      agentId: 'claude-code',
      canonical: { present: stdioA, missing: stdioA },
      agent: {
        present: { state: 'normalized', server: stdioA },
        absent: { state: 'normalized', server: stdioA },
      },
    });
    const missing = rows.find((r) => r.status === 'missing-from-agent');
    const extra = rows.find((r) => r.status === 'extra-in-agent');
    const aligned = rows.find((r) => r.status === 'aligned');
    expect(missing?.agentServerName).toBeNull();
    expect(missing?.agentServer).toBeNull();
    expect(extra?.canonicalName).toBeNull();
    expect(extra?.canonicalServer).toBeNull();
    expect(aligned?.canonicalName).toBe('present');
    expect(aligned?.agentServerName).toBe('present');
  });

  it('emits shape-conflict rows after canonical rows for agent-only conflicts', () => {
    const rows = compareAgentEntries({
      agentId: 'opencode',
      canonical: { a: stdioA },
      agent: {
        a: { state: 'normalized', server: stdioA },
        broken: { state: 'shape-conflict', reason: 'agent side is broken' },
      },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.status).toBe('aligned');
    expect(rows[1]).toMatchObject({
      agentId: 'opencode',
      canonicalName: null,
      agentServerName: 'broken',
      status: 'shape-conflict',
      canonicalServer: null,
      agentServer: null,
      reason: 'agent side is broken',
    });
  });
});

describe('buildScanMatrix', () => {
  // Minimal fixtures shared by the buildScanMatrix tests. Each helper
  // produces a strict-mode-compliant `OvertureConfig` or `AgentScanInput`
  // so individual tests can focus on the field under test rather than
  // Zod noise.
  const stdioA: OvertureMcpServer = {
    type: 'stdio',
    command: 'npx',
    args: ['-y', 'mcp-a'],
  };
  const stdioB: OvertureMcpServer = {
    type: 'stdio',
    command: 'npx',
    args: ['-y', 'mcp-b'],
  };
  const remoteA: OvertureMcpServer = {
    type: 'remote',
    url: 'https://api.example.com/mcp',
  };

  const makeConfig = (
    profileName: string,
    profileOverrides: {
      mcpServers?: Record<string, OvertureMcpServer>;
      targets?: readonly string[];
      disabledServers?: readonly string[];
    } = {},
  ): OvertureConfig => {
    const profile = {
      mcpServers: profileOverrides.mcpServers ?? {},
      sync: {
        targets: [...(profileOverrides.targets ?? [])],
        disabledServers: [...(profileOverrides.disabledServers ?? [])],
      },
      skills: [],
    };
    const profiles: OvertureConfig['profiles'] = { default: profile };
    if (profileName !== 'default') {
      profiles[profileName] = profile;
    }
    return {
      version: 1,
      settings: { defaultProfile: profileName },
      profiles,
    };
  };

  const makeAgent = (
    id: string,
    overrides: Partial<AgentScanInput> = {},
  ): AgentScanInput => ({
    id,
    displayName: id,
    installed: true,
    mcpSupport: 'supported',
    readState: 'read-ok',
    servers: {},
    ...overrides,
  });

  it('config: null uses registryOrder as targets and ignores unknown input agent ids', () => {
    const matrix = buildScanMatrix({
      config: null,
      registryOrder: ['claude-code'],
      agents: [
        makeAgent('claude-code', {
          readState: 'read-ok',
          servers: { x: { state: 'normalized', server: stdioA } },
        }),
        makeAgent('unknown-future', {
          readState: 'read-ok',
          servers: { y: { state: 'normalized', server: stdioA } },
        }),
      ],
    });
    expect(matrix.canonicalState).toBe('absent');
    expect(matrix.canonicalProfileName).toBeNull();
    expect(matrix.canonicalIntent).toEqual({});
    expect(matrix.agents.map((a) => a.id)).toEqual(['claude-code']);
    // The unknown input agent is dropped, so no extras for it.
    expect(matrix.rows.map((r) => r.agentServerName)).toEqual(['x']);
  });

  it('config: null with empty agent entries synthesizes not-installed snapshots for every registry id', () => {
    const matrix = buildScanMatrix({ config: null, agents: [] });
    expect(matrix.canonicalState).toBe('absent');
    expect(matrix.agents.map((a) => a.id)).toEqual([
      'claude-code',
      'opencode',
      'github-copilot-cli',
      'openai-codex',
    ]);
    for (const snapshot of matrix.agents) {
      expect(snapshot.readState).toBe('not-installed');
      expect(snapshot.installed).toBe(false);
      expect(snapshot.mcpSupport).toBe('unknown');
      expect(snapshot.reason).toBe(`No scan input for target "${snapshot.id}"`);
    }
    expect(matrix.rows).toEqual([]);
  });

  it('config: null with populated read-ok agents emits extra-in-agent rows only', () => {
    const matrix = buildScanMatrix({
      config: null,
      agents: [
        makeAgent('claude-code', {
          readState: 'read-ok',
          servers: { orphan: { state: 'normalized', server: stdioA } },
        }),
      ],
    });
    expect(matrix.canonicalIntent).toEqual({});
    expect(matrix.rows).toHaveLength(1);
    expect(matrix.rows[0]).toMatchObject({
      agentId: 'claude-code',
      canonicalName: null,
      agentServerName: 'orphan',
      status: 'extra-in-agent',
      canonicalServer: null,
      agentServer: stdioA,
      reason: 'Canonical intent has no server named "orphan"',
    });
  });

  it('uses the default profile when the named profile exists', () => {
    const matrix = buildScanMatrix({
      config: makeConfig('staging', {
        mcpServers: { x: stdioA },
        targets: ['claude-code'],
      }),
      agents: [
        makeAgent('claude-code', {
          readState: 'read-ok',
          servers: { x: { state: 'normalized', server: stdioA } },
        }),
      ],
    });
    expect(matrix.canonicalState).toBe('ready');
    expect(matrix.canonicalProfileName).toBe('staging');
    expect(matrix.canonicalIntent).toEqual({ x: stdioA });
    expect(matrix.rows).toEqual([
      {
        agentId: 'claude-code',
        canonicalName: 'x',
        agentServerName: 'x',
        status: 'aligned',
        canonicalServer: stdioA,
        agentServer: stdioA,
      },
    ]);
  });

  it('returns invalid-profile with populated agents and zero rows when the default profile is missing', () => {
    // Inlined so the config intentionally lacks the named 'missing'
    // profile: only 'default' is present, but the defaultProfile setting
    // points elsewhere. `makeConfig` auto-creates the named profile, so
    // it cannot express this case.
    const matrix = buildScanMatrix({
      config: {
        version: 1,
        settings: { defaultProfile: 'missing' },
        profiles: {
          default: {
            mcpServers: {},
            sync: { targets: ['claude-code'], disabledServers: [] },
            skills: [],
          },
        },
      },
      agents: [
        makeAgent('claude-code', {
          readState: 'read-ok',
          servers: { x: { state: 'normalized', server: stdioA } },
        }),
      ],
    });
    expect(matrix.canonicalState).toBe('invalid-profile');
    expect(matrix.canonicalProfileName).toBe('missing');
    expect(matrix.canonicalIntent).toEqual({});
    expect(matrix.reason).toBe('Default profile "missing" does not exist');
    expect(matrix.agents.map((a) => a.id)).toEqual(['claude-code']);
    expect(matrix.rows).toEqual([]);
  });

  it('sync.targets empty includes every registry id present in the input', () => {
    const matrix = buildScanMatrix({
      config: makeConfig('default', { targets: [] }),
      agents: [
        makeAgent('claude-code'),
        makeAgent('opencode'),
        makeAgent('github-copilot-cli'),
        makeAgent('openai-codex'),
      ],
    });
    expect(matrix.agents.map((a) => a.id)).toEqual(DEFAULT_REGISTRY_ORDER);
  });

  it('sync.targets non-empty filters agents to only the listed ids', () => {
    const matrix = buildScanMatrix({
      config: makeConfig('default', { targets: ['opencode'] }),
      agents: [
        makeAgent('claude-code'),
        makeAgent('opencode'),
        makeAgent('github-copilot-cli'),
        makeAgent('openai-codex'),
      ],
    });
    expect(matrix.agents.map((a) => a.id)).toEqual(['opencode']);
  });

  it('unknown target id produces an unsupported-agent snapshot with the approved reason', () => {
    const matrix = buildScanMatrix({
      config: makeConfig('default', {
        targets: ['claude-code', 'unknown-future'],
      }),
      agents: [makeAgent('claude-code')],
    });
    expect(matrix.agents.map((a) => a.id)).toEqual([
      'claude-code',
      'unknown-future',
    ]);
    const unsupported = matrix.agents[1];
    expect(unsupported).toMatchObject({
      id: 'unknown-future',
      displayName: 'unknown-future',
      installed: false,
      mcpSupport: 'unsupported',
      readState: 'unsupported-agent',
      reason: 'Target "unknown-future" is not supported by this Overture build',
    });
  });

  it('known target id without a matching input produces a not-installed snapshot', () => {
    const matrix = buildScanMatrix({
      config: makeConfig('default', { targets: ['claude-code'] }),
      agents: [],
    });
    expect(matrix.agents).toHaveLength(1);
    expect(matrix.agents[0]).toMatchObject({
      id: 'claude-code',
      displayName: 'claude-code',
      installed: false,
      mcpSupport: 'unknown',
      readState: 'not-installed',
      reason: 'No scan input for target "claude-code"',
    });
    expect(matrix.rows).toEqual([]);
  });

  it('sync.disabledServers removes the named servers from canonicalIntent and makes matching agent entries extra', () => {
    const matrix = buildScanMatrix({
      config: makeConfig('default', {
        mcpServers: { keep: stdioA, drop: stdioB },
        targets: ['claude-code'],
        disabledServers: ['drop'],
      }),
      agents: [
        makeAgent('claude-code', {
          readState: 'read-ok',
          servers: {
            keep: { state: 'normalized', server: stdioA },
            drop: { state: 'normalized', server: stdioB },
          },
        }),
      ],
    });
    expect(matrix.canonicalIntent).toEqual({ keep: stdioA });
    expect(
      matrix.rows.map((r) => ({
        canonical: r.canonicalName,
        agent: r.agentServerName,
        status: r.status,
      })),
    ).toEqual([
      { canonical: 'keep', agent: 'keep', status: 'aligned' },
      { canonical: null, agent: 'drop', status: 'extra-in-agent' },
    ]);
  });

  it('parse-error agent snapshots preserve the parse reason and produce no rows', () => {
    const matrix = buildScanMatrix({
      config: makeConfig('default', {
        mcpServers: { x: stdioA },
        targets: ['claude-code'],
      }),
      agents: [
        makeAgent('claude-code', {
          readState: 'parse-error',
          reason: 'unexpected token at position 42',
          // No `servers` on a parse-error agent.
        }),
      ],
    });
    expect(matrix.agents[0]).toMatchObject({
      id: 'claude-code',
      readState: 'parse-error',
      reason: 'unexpected token at position 42',
    });
    expect(matrix.rows).toEqual([]);
  });

  it('read-empty and read-no-config snapshots are preserved verbatim and produce no rows', () => {
    const matrix = buildScanMatrix({
      config: makeConfig('default', {
        mcpServers: { x: stdioA },
        targets: ['claude-code', 'opencode'],
      }),
      agents: [
        makeAgent('claude-code', {
          readState: 'read-empty',
        }),
        makeAgent('opencode', {
          readState: 'read-no-config',
        }),
      ],
    });
    expect(matrix.agents[0]?.readState).toBe('read-empty');
    expect(matrix.agents[1]?.readState).toBe('read-no-config');
    expect(matrix.rows).toEqual([]);
  });

  it('multiple agents sharing a server name produce independent rows keyed by agentId', () => {
    const matrix = buildScanMatrix({
      config: makeConfig('default', {
        mcpServers: { shared: stdioA },
        targets: ['claude-code', 'opencode'],
      }),
      agents: [
        makeAgent('claude-code', {
          readState: 'read-ok',
          servers: { shared: { state: 'normalized', server: stdioA } },
        }),
        makeAgent('opencode', {
          readState: 'read-ok',
          servers: { shared: { state: 'normalized', server: stdioA } },
        }),
      ],
    });
    const aligned = matrix.rows.filter((r) => r.status === 'aligned');
    expect(aligned).toHaveLength(2);
    const ids = aligned.map((r) => r.agentId).sort();
    expect(ids).toEqual(['claude-code', 'opencode']);
    for (const row of aligned) {
      expect(row.canonicalName).toBe('shared');
      expect(row.agentServerName).toBe('shared');
    }
  });

  it('JSON.stringify is identical for repeated buildScanMatrix calls with the same input', () => {
    const input: BuildScanMatrixInput = {
      config: makeConfig('default', {
        mcpServers: { a: stdioA, b: stdioB },
        targets: ['claude-code', 'opencode'],
      }),
      agents: [
        makeAgent('claude-code', {
          readState: 'read-ok',
          servers: {
            a: { state: 'normalized', server: stdioA },
            c: { state: 'normalized', server: remoteA },
          },
        }),
        makeAgent('opencode', {
          readState: 'parse-error',
          reason: 'bad token',
        }),
      ],
    };
    const first = JSON.stringify(buildScanMatrix(input));
    const second = JSON.stringify(buildScanMatrix(input));
    expect(first).toBe(second);
  });

  it('applies the global row order: canonical rows by name then agent, extras by agent then name', () => {
    const matrix = buildScanMatrix({
      config: makeConfig('default', {
        mcpServers: { a: stdioA, b: stdioB },
        targets: ['claude-code', 'opencode'],
      }),
      agents: [
        makeAgent('claude-code', {
          readState: 'read-ok',
          servers: {
            a: { state: 'normalized', server: stdioA },
            b: { state: 'normalized', server: stdioB },
            c: { state: 'normalized', server: remoteA },
          },
        }),
        makeAgent('opencode', {
          readState: 'read-ok',
          servers: {
            a: { state: 'normalized', server: stdioA },
            b: { state: 'normalized', server: stdioB },
            d: { state: 'normalized', server: remoteA },
          },
        }),
      ],
    });
    const summary = matrix.rows.map((r) => ({
      canonical: r.canonicalName,
      agent: r.agentId,
      server: r.agentServerName,
      status: r.status,
    }));
    expect(summary).toEqual([
      { canonical: 'a', agent: 'claude-code', server: 'a', status: 'aligned' },
      { canonical: 'a', agent: 'opencode', server: 'a', status: 'aligned' },
      { canonical: 'b', agent: 'claude-code', server: 'b', status: 'aligned' },
      { canonical: 'b', agent: 'opencode', server: 'b', status: 'aligned' },
      {
        canonical: null,
        agent: 'claude-code',
        server: 'c',
        status: 'extra-in-agent',
      },
      {
        canonical: null,
        agent: 'opencode',
        server: 'd',
        status: 'extra-in-agent',
      },
    ]);
  });

  it('does not mutate the input config, agents, or server entries', () => {
    const config = makeConfig('default', {
      mcpServers: { a: stdioA },
      targets: ['claude-code'],
    });
    const agentInput = makeAgent('claude-code', {
      readState: 'read-ok',
      servers: {
        a: { state: 'normalized', server: stdioA },
        extra: { state: 'normalized', server: stdioB },
      },
    });
    const configSnapshot = JSON.parse(JSON.stringify(config));
    const agentSnapshot = JSON.parse(JSON.stringify(agentInput));
    const originalStdioA = JSON.parse(JSON.stringify(stdioA));

    buildScanMatrix({ config, agents: [agentInput] });

    expect(JSON.parse(JSON.stringify(config))).toEqual(configSnapshot);
    expect(JSON.parse(JSON.stringify(agentInput))).toEqual(agentSnapshot);
    expect(JSON.parse(JSON.stringify(stdioA))).toEqual(originalStdioA);
  });

  it('readState not in read-ok is the only state gate for row emission (not-installed, not-read, unsupported-agent)', () => {
    const matrix = buildScanMatrix({
      config: makeConfig('default', {
        mcpServers: { x: stdioA },
        targets: ['claude-code', 'opencode', 'github-copilot-cli'],
      }),
      agents: [
        makeAgent('claude-code', {
          readState: 'not-installed',
          installed: false,
        }),
        makeAgent('opencode', {
          readState: 'not-read',
        }),
        makeAgent('github-copilot-cli', {
          readState: 'unsupported-agent',
          mcpSupport: 'unsupported',
          installed: false,
        }),
      ],
    });
    expect(matrix.agents.map((a) => a.readState)).toEqual([
      'not-installed',
      'not-read',
      'unsupported-agent',
    ]);
    expect(matrix.rows).toEqual([]);
  });

  it('DEFAULT_REGISTRY_ORDER lists the four canonical agent ids in the documented order', () => {
    expect(DEFAULT_REGISTRY_ORDER).toEqual([
      'claude-code',
      'opencode',
      'github-copilot-cli',
      'openai-codex',
    ]);
  });
});

describe('scan-matrix package', () => {
  it('smokes', () => {
    expect(1).toBe(1);
  });
});

describe('B3 conflict type contracts', () => {
  it('HardRefuseReason is the approved four-reason vocabulary', () => {
    expectTypeOf<HardRefuseReason>().toEqualTypeOf<
      | 'parse-error'
      | 'shape-conflict'
      | 'mixed-transport-types'
      | 'canonical-settings-drift'
    >();
  });

  it('PickableConflictCandidate exposes agentId, displayName, server only', () => {
    const c: PickableConflictCandidate = {
      agentId: 'claude-code',
      displayName: 'Claude Code',
      server: { type: 'stdio', command: 'x' },
    };
    expectTypeOf(c).toMatchTypeOf<PickableConflictCandidate>();
  });

  it('PickableConflict is serverName + candidates + message', () => {
    const p: PickableConflict = {
      serverName: 'memory',
      candidates: [
        {
          agentId: 'claude-code',
          displayName: 'Claude Code',
          server: { type: 'stdio', command: 'a' },
        },
        {
          agentId: 'opencode',
          displayName: 'OpenCode',
          server: { type: 'stdio', command: 'b' },
        },
      ],
      message: 'pickable: memory',
    };
    expectTypeOf(p).toMatchTypeOf<PickableConflict>();
  });

  it('HardRefuseConflict allows null serverName/agentId/displayName', () => {
    const h: HardRefuseConflict = {
      reason: 'parse-error',
      serverName: null,
      agentId: 'opencode',
      displayName: 'OpenCode',
      message:
        'Cannot classify MCP conflicts because OpenCode could not parse /home/u/.config/opencode/config.json: Unexpected token.',
    };
    expectTypeOf(h).toMatchTypeOf<HardRefuseConflict>();
  });

  it('ConflictClassification has pickable and hardRefuses arrays only', () => {
    const cc: ConflictClassification = { pickable: [], hardRefuses: [] };
    expectTypeOf(cc).toMatchTypeOf<ConflictClassification>();
  });
});

describe('classifyConflicts shell', () => {
  const makeMatrix = (overrides: Partial<ScanMatrix> = {}): ScanMatrix => ({
    canonicalState: 'ready',
    canonicalProfileName: 'default',
    canonicalIntent: {},
    agents: [],
    rows: [],
    ...overrides,
  });

  it('returns empty arrays for a fully empty ready-state matrix', () => {
    const result = classifyConflicts(makeMatrix());
    expect(result).toEqual({ pickable: [], hardRefuses: [] });
  });

  it('returns empty arrays for an invalid-profile matrix', () => {
    const result = classifyConflicts(
      makeMatrix({
        canonicalState: 'invalid-profile',
        canonicalProfileName: 'missing',
      }),
    );
    expect(result).toEqual({ pickable: [], hardRefuses: [] });
  });

  it('returns empty arrays for an absent canonical state', () => {
    const result = classifyConflicts(
      makeMatrix({ canonicalState: 'absent', canonicalProfileName: null }),
    );
    expect(result).toEqual({ pickable: [], hardRefuses: [] });
  });

  it('does not mutate the input matrix', () => {
    const matrix = makeMatrix({
      agents: [
        {
          id: 'claude-code',
          displayName: 'Claude Code',
          installed: true,
          mcpSupport: 'supported',
          readState: 'read-ok',
        },
      ],
      rows: [],
    });
    const snapshot = JSON.stringify(matrix);
    classifyConflicts(matrix);
    expect(JSON.stringify(matrix)).toBe(snapshot);
  });
});
describe('classifyConflicts hard-refuse (B3 Task 2)', () => {
  // Server fixtures used across the hard-refuse tests. They are small and
  // distinct so messages remain readable in failure output. Each helper
  // composes a ScanMatrix by hand so the tests are independent of
  // buildScanMatrix; B3 is a read model on top of scan-matrix data, not a
  // pipeline that requires buildScanMatrix to run.
  const stdioA: OvertureMcpServer = { type: 'stdio', command: 'npx' };
  const stdioB: OvertureMcpServer = {
    type: 'stdio',
    command: 'node',
    args: ['server.js'],
  };

  const makeSnapshot = (overrides: Partial<AgentSnapshot>): AgentSnapshot => ({
    id: 'claude-code',
    displayName: 'Claude Code',
    installed: true,
    mcpSupport: 'supported',
    readState: 'read-ok',
    ...overrides,
  });

  const makeConfig = (
    ready: boolean,
    mcpServers: Record<string, OvertureMcpServer>,
  ): {
    canonicalState: 'ready' | 'absent';
    canonicalProfileName: string | null;
    canonicalIntent: Record<string, OvertureMcpServer>;
    agents: AgentSnapshot[];
    rows: ServerStatusRow[];
  } => ({
    canonicalState: ready ? 'ready' : 'absent',
    canonicalProfileName: ready ? 'default' : null,
    canonicalIntent: mcpServers,
    agents: [],
    rows: [],
  });

  it('parse-error snapshot produces one hard-refuse using displayName, resolvedPath, and reason verbatim', () => {
    const matrix: ScanMatrix = {
      ...makeConfig(false, {}),
      agents: [
        makeSnapshot({
          id: 'opencode',
          displayName: 'OpenCode',
          readState: 'parse-error',
          resolvedPath: '/home/u/.config/opencode/config.json',
          reason: 'Unexpected token at position 42',
        }),
      ],
      rows: [],
    };
    const result = classifyConflicts(matrix);
    expect(result.pickable).toEqual([]);
    expect(result.hardRefuses).toEqual([
      {
        reason: 'parse-error',
        serverName: null,
        agentId: 'opencode',
        displayName: 'OpenCode',
        message:
          'Cannot classify MCP conflicts because OpenCode could not parse /home/u/.config/opencode/config.json: Unexpected token at position 42. Fix that config file and retry.',
      },
    ]);
  });

  it('parse-error snapshot without resolvedPath uses <unknown path> fallback', () => {
    const matrix: ScanMatrix = {
      ...makeConfig(false, {}),
      agents: [
        makeSnapshot({
          id: 'opencode',
          displayName: 'OpenCode',
          readState: 'parse-error',
          reason: 'Bad token',
        }),
      ],
      rows: [],
    };
    const result = classifyConflicts(matrix);
    expect(result.hardRefuses).toHaveLength(1);
    expect(result.hardRefuses[0]?.message).toBe(
      'Cannot classify MCP conflicts because OpenCode could not parse <unknown path>: Bad token. Fix that config file and retry.',
    );
  });

  it('parse-error snapshot without reason uses <no reason provided> fallback', () => {
    const matrix: ScanMatrix = {
      ...makeConfig(false, {}),
      agents: [
        makeSnapshot({
          id: 'opencode',
          displayName: 'OpenCode',
          readState: 'parse-error',
          resolvedPath: '/etc/opencode.json',
        }),
      ],
      rows: [],
    };
    const result = classifyConflicts(matrix);
    expect(result.hardRefuses).toHaveLength(1);
    expect(result.hardRefuses[0]?.message).toBe(
      'Cannot classify MCP conflicts because OpenCode could not parse /etc/opencode.json: <no reason provided>. Fix that config file and retry.',
    );
  });

  it('shape-conflict row produces one hard-refuse wrapping the B2 reason verbatim', () => {
    const matrix: ScanMatrix = {
      ...makeConfig(true, { memory: stdioA }),
      agents: [makeSnapshot({ id: 'claude-code', displayName: 'Claude Code' })],
      rows: [
        {
          agentId: 'claude-code',
          canonicalName: 'memory',
          agentServerName: 'memory',
          status: 'shape-conflict',
          canonicalServer: stdioA,
          agentServer: null,
          reason: 'Stdio command is missing or empty.',
        },
      ],
    };
    const result = classifyConflicts(matrix);
    expect(result.pickable).toEqual([]);
    expect(result.hardRefuses).toEqual([
      {
        reason: 'shape-conflict',
        serverName: 'memory',
        agentId: 'claude-code',
        displayName: 'Claude Code',
        message:
          'Cannot classify server "memory" from Claude Code: Stdio command is missing or empty.. Fix that config entry and retry.',
      },
    ]);
  });

  it('shape-conflict row in extra-in-agent slot uses agentServerName as the offending server name', () => {
    const matrix: ScanMatrix = {
      ...makeConfig(false, {}),
      agents: [makeSnapshot({ id: 'opencode', displayName: 'OpenCode' })],
      rows: [
        {
          agentId: 'opencode',
          canonicalName: null,
          agentServerName: 'orphan',
          status: 'shape-conflict',
          canonicalServer: null,
          agentServer: null,
          reason: 'agent entry is missing required "command" field',
        },
      ],
    };
    const result = classifyConflicts(matrix);
    expect(result.hardRefuses).toEqual([
      {
        reason: 'shape-conflict',
        serverName: 'orphan',
        agentId: 'opencode',
        displayName: 'OpenCode',
        message:
          'Cannot classify server "orphan" from OpenCode: agent entry is missing required "command" field. Fix that config entry and retry.',
      },
    ]);
  });

  it('different-settings row in canonical ready state produces one canonical-settings-drift hard-refuse', () => {
    const matrix: ScanMatrix = {
      ...makeConfig(true, { memory: stdioA }),
      agents: [makeSnapshot({ id: 'opencode', displayName: 'OpenCode' })],
      rows: [
        {
          agentId: 'opencode',
          canonicalName: 'memory',
          agentServerName: 'memory',
          status: 'different-settings',
          canonicalServer: stdioA,
          agentServer: stdioB,
          reason: 'Canonical and agent settings differ',
        },
      ],
    };
    const result = classifyConflicts(matrix);
    expect(result.hardRefuses).toEqual([
      {
        reason: 'canonical-settings-drift',
        serverName: 'memory',
        agentId: 'opencode',
        displayName: 'OpenCode',
        message:
          'Refusing to continue for server "memory" on OpenCode: canonical and agent settings differ. Update the canonical config or the agent config and retry.',
      },
    ]);
  });

  it('different-settings row in canonical absent state does NOT produce a canonical-settings-drift entry (no canonical to drift from)', () => {
    const matrix: ScanMatrix = {
      ...makeConfig(false, {}),
      agents: [makeSnapshot({ id: 'opencode', displayName: 'OpenCode' })],
      rows: [
        {
          agentId: 'opencode',
          canonicalName: 'memory',
          agentServerName: 'memory',
          status: 'different-settings',
          canonicalServer: stdioA,
          agentServer: stdioB,
          reason: 'Canonical and agent settings differ',
        },
      ],
    };
    const result = classifyConflicts(matrix);
    expect(result.hardRefuses).toEqual([]);
  });

  it('aligned, missing-from-agent, extra-in-agent rows produce no hard-refuse entries', () => {
    const matrix: ScanMatrix = {
      ...makeConfig(true, { memory: stdioA, notes: stdioB }),
      agents: [
        makeSnapshot({ id: 'claude-code', displayName: 'Claude Code' }),
        makeSnapshot({ id: 'opencode', displayName: 'OpenCode' }),
      ],
      rows: [
        {
          agentId: 'claude-code',
          canonicalName: 'memory',
          agentServerName: 'memory',
          status: 'aligned',
          canonicalServer: stdioA,
          agentServer: stdioA,
        },
        {
          agentId: 'opencode',
          canonicalName: 'notes',
          agentServerName: null,
          status: 'missing-from-agent',
          canonicalServer: stdioB,
          agentServer: null,
          reason: 'Agent has no server named "notes"',
        },
        {
          agentId: 'claude-code',
          canonicalName: null,
          agentServerName: 'bonus',
          status: 'extra-in-agent',
          canonicalServer: null,
          agentServer: stdioB,
          reason: 'Canonical intent has no server named "bonus"',
        },
      ],
    };
    const result = classifyConflicts(matrix);
    expect(result.hardRefuses).toEqual([]);
  });

  it('not-installed, unsupported-agent, not-read, read-empty, read-no-config snapshots produce no hard-refuse entries', () => {
    const matrix: ScanMatrix = {
      ...makeConfig(true, { memory: stdioA }),
      agents: [
        makeSnapshot({
          id: 'claude-code',
          displayName: 'Claude Code',
          readState: 'not-installed',
          installed: false,
          mcpSupport: 'unknown',
        }),
        makeSnapshot({
          id: 'opencode',
          displayName: 'OpenCode',
          readState: 'unsupported-agent',
          installed: false,
          mcpSupport: 'unsupported',
        }),
        makeSnapshot({ id: 'github-copilot-cli', readState: 'not-read' }),
        makeSnapshot({ id: 'openai-codex', readState: 'read-empty' }),
        makeSnapshot({
          id: 'aider',
          displayName: 'Aider',
          readState: 'read-no-config',
        }),
      ],
      rows: [],
    };
    const result = classifyConflicts(matrix);
    expect(result.hardRefuses).toEqual([]);
  });

  it('two hard-refuses sort by (reason, serverName, agentId) ascending', () => {
    const matrix: ScanMatrix = {
      ...makeConfig(true, { alpha: stdioA, beta: stdioB }),
      agents: [
        makeSnapshot({ id: 'claude-code', displayName: 'Claude Code' }),
        makeSnapshot({ id: 'opencode', displayName: 'OpenCode' }),
      ],
      rows: [
        // Intentionally reversed canonical name + agentId ordering: alpha/zulu
        // sorts after bravo/alpha when reason and serverName tie.
        {
          agentId: 'opencode',
          canonicalName: 'beta',
          agentServerName: 'beta',
          status: 'different-settings',
          canonicalServer: stdioB,
          agentServer: stdioA,
          reason: 'Canonical and agent settings differ',
        },
        {
          agentId: 'claude-code',
          canonicalName: 'alpha',
          agentServerName: 'alpha',
          status: 'different-settings',
          canonicalServer: stdioA,
          agentServer: stdioB,
          reason: 'Canonical and agent settings differ',
        },
      ],
    };
    const result = classifyConflicts(matrix);
    expect(
      result.hardRefuses.map((h) => [h.reason, h.serverName, h.agentId]),
    ).toEqual([
      ['canonical-settings-drift', 'alpha', 'claude-code'],
      ['canonical-settings-drift', 'beta', 'opencode'],
    ]);
  });

  it('multiple parse-error snapshots produce one hard-refuse per snapshot (no aggregation)', () => {
    const matrix: ScanMatrix = {
      ...makeConfig(false, {}),
      agents: [
        makeSnapshot({
          id: 'opencode',
          displayName: 'OpenCode',
          readState: 'parse-error',
          resolvedPath: '/etc/opencode.json',
          reason: 'bad',
        }),
        makeSnapshot({
          id: 'github-copilot-cli',
          displayName: 'GitHub Copilot CLI',
          readState: 'parse-error',
          resolvedPath: '/etc/copilot.json',
          reason: 'worse',
        }),
      ],
      rows: [],
    };
    const result = classifyConflicts(matrix);
    expect(result.hardRefuses).toHaveLength(2);
    expect(result.hardRefuses.map((h) => h.agentId)).toEqual([
      'github-copilot-cli',
      'opencode',
    ]);
    expect(result.hardRefuses[0]?.message).toBe(
      'Cannot classify MCP conflicts because GitHub Copilot CLI could not parse /etc/copilot.json: worse. Fix that config file and retry.',
    );
    expect(result.hardRefuses[1]?.message).toBe(
      'Cannot classify MCP conflicts because OpenCode could not parse /etc/opencode.json: bad. Fix that config file and retry.',
    );
  });

  it('multiple parse-error + one canonical-settings-drift sorts canonical-settings-drift before parse-error (reason key)', () => {
    // Reason alphabetical: 'canonical-settings-drift' ('c') < 'parse-error' ('p').
    // The matrix literal lists the parse-error snapshot first to prove the
    // sort key is the reason string, not insertion order.
    const matrix: ScanMatrix = {
      ...makeConfig(true, { memory: stdioA }),
      agents: [
        makeSnapshot({
          id: 'claude-code',
          displayName: 'Claude Code',
          readState: 'parse-error',
          resolvedPath: '/etc/claude.json',
          reason: 'parse failed',
        }),
        makeSnapshot({ id: 'opencode', displayName: 'OpenCode' }),
      ],
      rows: [
        {
          agentId: 'opencode',
          canonicalName: 'memory',
          agentServerName: 'memory',
          status: 'different-settings',
          canonicalServer: stdioA,
          agentServer: stdioB,
          reason: 'Canonical and agent settings differ',
        },
      ],
    };
    const result = classifyConflicts(matrix);
    expect(result.hardRefuses.map((h) => h.reason)).toEqual([
      'canonical-settings-drift',
      'parse-error',
    ]);
  });
});

describe('classifyConflicts bootstrap pickable + mixed-transport (B3 Task 3)', () => {
  // Server fixtures used across the bootstrap pickable tests. They are
  // small and distinct so messages remain readable in failure output. Each
  // helper composes a ScanMatrix by hand so the tests are independent of
  // buildScanMatrix; B3 is a read model on top of scan-matrix data, not a
  // pipeline that requires buildScanMatrix to run.
  const stdioA: OvertureMcpServer = { type: 'stdio', command: 'npx' };
  const stdioB: OvertureMcpServer = {
    type: 'stdio',
    command: 'node',
    args: ['server.js'],
  };
  const stdioC: OvertureMcpServer = {
    type: 'stdio',
    command: 'python',
    args: ['-m', 'memory'],
    env: { MODE: 'fast' },
  };
  const remoteA: OvertureMcpServer = {
    type: 'remote',
    url: 'https://example.com/mcp',
  };
  const remoteB: OvertureMcpServer = {
    type: 'remote',
    url: 'https://other.example.com/mcp',
  };

  const makeSnapshot = (overrides: Partial<AgentSnapshot>): AgentSnapshot => ({
    id: 'claude-code',
    displayName: 'Claude Code',
    installed: true,
    mcpSupport: 'supported',
    readState: 'read-ok',
    ...overrides,
  });

  const makeRow = (overrides: Partial<ServerStatusRow>): ServerStatusRow => ({
    agentId: 'claude-code',
    canonicalName: null,
    agentServerName: 'memory',
    status: 'extra-in-agent',
    canonicalServer: null,
    agentServer: stdioA,
    ...overrides,
  });

  const makeMatrix = (overrides: Partial<ScanMatrix>): ScanMatrix => ({
    canonicalState: 'absent',
    canonicalProfileName: null,
    canonicalIntent: {},
    agents: [],
    rows: [],
    ...overrides,
  });

  it('absent canonical + two same-name stdio extras with non-equal settings → one pickable with two candidates', () => {
    const matrix = makeMatrix({
      agents: [
        makeSnapshot({ id: 'claude-code', displayName: 'Claude Code' }),
        makeSnapshot({ id: 'opencode', displayName: 'OpenCode' }),
      ],
      rows: [
        makeRow({
          agentId: 'claude-code',
          agentServerName: 'memory',
          agentServer: stdioA,
        }),
        makeRow({
          agentId: 'opencode',
          agentServerName: 'memory',
          agentServer: stdioB,
        }),
      ],
    });
    const result = classifyConflicts(matrix);
    expect(result.hardRefuses).toEqual([]);
    expect(result.pickable).toHaveLength(1);
    expect(result.pickable[0]?.serverName).toBe('memory');
    expect(result.pickable[0]?.candidates.map((c) => c.agentId)).toEqual([
      'claude-code',
      'opencode',
    ]);
    expect(result.pickable[0]?.candidates[0]?.server).toEqual(stdioA);
    expect(result.pickable[0]?.candidates[1]?.server).toEqual(stdioB);
    expect(result.pickable[0]?.candidates[0]?.displayName).toBe('Claude Code');
    expect(result.pickable[0]?.candidates[1]?.displayName).toBe('OpenCode');
    expect(result.pickable[0]?.message).toBe(
      'Pickable conflict for "memory" across 2 agents (stdio): choose one canonical entry or skip.',
    );
  });

  it('absent canonical + three same-name stdio extras with non-equal settings → one pickable with three candidates', () => {
    const matrix = makeMatrix({
      agents: [
        makeSnapshot({ id: 'claude-code', displayName: 'Claude Code' }),
        makeSnapshot({ id: 'opencode', displayName: 'OpenCode' }),
        makeSnapshot({
          id: 'github-copilot-cli',
          displayName: 'GitHub Copilot CLI',
        }),
      ],
      rows: [
        makeRow({
          agentId: 'claude-code',
          agentServerName: 'memory',
          agentServer: stdioA,
        }),
        makeRow({
          agentId: 'opencode',
          agentServerName: 'memory',
          agentServer: stdioB,
        }),
        makeRow({
          agentId: 'github-copilot-cli',
          agentServerName: 'memory',
          agentServer: stdioC,
        }),
      ],
    });
    const result = classifyConflicts(matrix);
    expect(result.hardRefuses).toEqual([]);
    expect(result.pickable).toHaveLength(1);
    expect(result.pickable[0]?.serverName).toBe('memory');
    expect(result.pickable[0]?.candidates.map((c) => c.agentId)).toEqual([
      'claude-code',
      'opencode',
      'github-copilot-cli',
    ]);
    expect(result.pickable[0]?.message).toBe(
      'Pickable conflict for "memory" across 3 agents (stdio): choose one canonical entry or skip.',
    );
  });

  it('absent canonical + same-name extras with all-equal settings → no pickable, no mixed-transport', () => {
    const matrix = makeMatrix({
      agents: [
        makeSnapshot({ id: 'claude-code', displayName: 'Claude Code' }),
        makeSnapshot({ id: 'opencode', displayName: 'OpenCode' }),
      ],
      rows: [
        makeRow({
          agentId: 'claude-code',
          agentServerName: 'memory',
          agentServer: stdioA,
        }),
        makeRow({
          agentId: 'opencode',
          agentServerName: 'memory',
          agentServer: stdioA,
        }),
      ],
    });
    const result = classifyConflicts(matrix);
    expect(result.pickable).toEqual([]);
    expect(result.hardRefuses).toEqual([]);
  });

  it('absent canonical + mixed stdio+remote same-name extras → one mixed-transport-types hard-refuse, no pickable', () => {
    const matrix = makeMatrix({
      agents: [
        makeSnapshot({ id: 'claude-code', displayName: 'Claude Code' }),
        makeSnapshot({ id: 'opencode', displayName: 'OpenCode' }),
      ],
      rows: [
        makeRow({
          agentId: 'claude-code',
          agentServerName: 'memory',
          agentServer: stdioA,
        }),
        makeRow({
          agentId: 'opencode',
          agentServerName: 'memory',
          agentServer: remoteA,
        }),
      ],
    });
    const result = classifyConflicts(matrix);
    expect(result.pickable).toEqual([]);
    expect(result.hardRefuses).toEqual([
      {
        reason: 'mixed-transport-types',
        serverName: 'memory',
        agentId: null,
        displayName: null,
        message:
          'Cannot classify server "memory" because agents disagree on transport type (remote, stdio). Rename or fix the source entries and retry.',
      },
    ]);
  });

  it('ready canonical + same-name extras → no pickable, no hard-refuses (extras are not conflicts)', () => {
    const matrix = makeMatrix({
      canonicalState: 'ready',
      canonicalProfileName: 'default',
      canonicalIntent: { notes: stdioB },
      agents: [
        makeSnapshot({ id: 'claude-code', displayName: 'Claude Code' }),
        makeSnapshot({ id: 'opencode', displayName: 'OpenCode' }),
      ],
      rows: [
        makeRow({
          agentId: 'claude-code',
          agentServerName: 'memory',
          agentServer: stdioA,
        }),
        makeRow({
          agentId: 'opencode',
          agentServerName: 'memory',
          agentServer: stdioC,
        }),
      ],
    });
    const result = classifyConflicts(matrix);
    expect(result.pickable).toEqual([]);
    expect(result.hardRefuses).toEqual([]);
  });

  it('absent canonical + pickable candidates sort by matrix agent order', () => {
    // The matrix.agents list intentionally puts opencode first, claude-code
    // second, github-copilot-cli third, but the row array lists them in a
    // different order. The candidate list must follow matrix.agents order.
    const matrix = makeMatrix({
      agents: [
        makeSnapshot({ id: 'opencode', displayName: 'OpenCode' }),
        makeSnapshot({ id: 'claude-code', displayName: 'Claude Code' }),
        makeSnapshot({
          id: 'github-copilot-cli',
          displayName: 'GitHub Copilot CLI',
        }),
      ],
      rows: [
        makeRow({
          agentId: 'claude-code',
          agentServerName: 'memory',
          agentServer: stdioB,
        }),
        makeRow({
          agentId: 'github-copilot-cli',
          agentServerName: 'memory',
          agentServer: stdioC,
        }),
        makeRow({
          agentId: 'opencode',
          agentServerName: 'memory',
          agentServer: stdioA,
        }),
      ],
    });
    const result = classifyConflicts(matrix);
    expect(result.pickable).toHaveLength(1);
    expect(result.pickable[0]?.candidates.map((c) => c.agentId)).toEqual([
      'opencode',
      'claude-code',
      'github-copilot-cli',
    ]);
  });

  it('absent canonical + pickable list sorts by serverName ascending across multiple groups', () => {
    const matrix = makeMatrix({
      agents: [
        makeSnapshot({ id: 'claude-code', displayName: 'Claude Code' }),
        makeSnapshot({ id: 'opencode', displayName: 'OpenCode' }),
      ],
      rows: [
        // Insert zebra first to prove the sort key is serverName, not row order.
        makeRow({
          agentId: 'opencode',
          agentServerName: 'zebra',
          agentServer: stdioC,
        }),
        makeRow({
          agentId: 'claude-code',
          agentServerName: 'alpha',
          agentServer: stdioB,
        }),
        makeRow({
          agentId: 'opencode',
          agentServerName: 'alpha',
          agentServer: stdioA,
        }),
        makeRow({
          agentId: 'claude-code',
          agentServerName: 'zebra',
          agentServer: stdioA,
        }),
      ],
    });
    const result = classifyConflicts(matrix);
    expect(result.pickable.map((p) => p.serverName)).toEqual([
      'alpha',
      'zebra',
    ]);
    expect(result.pickable[0]?.candidates.map((c) => c.agentId)).toEqual([
      'claude-code',
      'opencode',
    ]);
    expect(result.pickable[1]?.candidates.map((c) => c.agentId)).toEqual([
      'claude-code',
      'opencode',
    ]);
  });

  it('ready canonical + same-name extras that are mixed stdio+remote → still one mixed-transport-types hard-refuse', () => {
    // Mixed-transport detection happens regardless of canonical state: an
    // agent-only disagreement about transport type is a hard-refuse, even
    // when canonical intent exists.
    const matrix = makeMatrix({
      canonicalState: 'ready',
      canonicalProfileName: 'default',
      canonicalIntent: { notes: stdioB },
      agents: [
        makeSnapshot({ id: 'claude-code', displayName: 'Claude Code' }),
        makeSnapshot({ id: 'opencode', displayName: 'OpenCode' }),
      ],
      rows: [
        makeRow({
          agentId: 'claude-code',
          agentServerName: 'memory',
          agentServer: stdioA,
        }),
        makeRow({
          agentId: 'opencode',
          agentServerName: 'memory',
          agentServer: remoteB,
        }),
      ],
    });
    const result = classifyConflicts(matrix);
    expect(result.pickable).toEqual([]);
    expect(result.hardRefuses).toEqual([
      {
        reason: 'mixed-transport-types',
        serverName: 'memory',
        agentId: null,
        displayName: null,
        message:
          'Cannot classify server "memory" because agents disagree on transport type (remote, stdio). Rename or fix the source entries and retry.',
      },
    ]);
  });

  it('absent canonical + same-name group with a shape-conflict extra → no pickable (only normalized entries are candidates)', () => {
    // The shape-conflict row carries agentServer: null (the B2 reason text
    // already produces a hard-refuse). It is filtered out of the candidate
    // set, so the remaining single normalized row cannot form a pickable
    // conflict and the group is silent.
    const matrix = makeMatrix({
      agents: [
        makeSnapshot({ id: 'claude-code', displayName: 'Claude Code' }),
        makeSnapshot({ id: 'opencode', displayName: 'OpenCode' }),
      ],
      rows: [
        makeRow({
          agentId: 'claude-code',
          agentServerName: 'memory',
          agentServer: stdioA,
        }),
        {
          agentId: 'opencode',
          canonicalName: null,
          agentServerName: 'memory',
          status: 'shape-conflict',
          canonicalServer: null,
          agentServer: null,
          reason: 'Stdio command is missing or empty.',
        },
      ],
    });
    const result = classifyConflicts(matrix);
    expect(result.pickable).toEqual([]);
    expect(result.hardRefuses).toEqual([
      {
        reason: 'shape-conflict',
        serverName: 'memory',
        agentId: 'opencode',
        displayName: 'OpenCode',
        message:
          'Cannot classify server "memory" from OpenCode: Stdio command is missing or empty.. Fix that config entry and retry.',
      },
    ]);
  });

  it('absent canonical + zero rows + zero agents → empty pickable + empty hardRefuses (smoke)', () => {
    const matrix = makeMatrix({ agents: [], rows: [] });
    const result = classifyConflicts(matrix);
    expect(result).toEqual({ pickable: [], hardRefuses: [] });
  });
});

describe('classifyConflicts determinism (B3 Task 4)', () => {
  const makeMatrix = (overrides: Partial<ScanMatrix> = {}): ScanMatrix => ({
    canonicalState: 'ready',
    canonicalProfileName: 'default',
    canonicalIntent: {},
    agents: [],
    rows: [],
    ...overrides,
  });

  const populatedMatrix = (): ScanMatrix =>
    makeMatrix({
      canonicalState: 'absent',
      canonicalProfileName: null,
      canonicalIntent: {},
      agents: [
        {
          id: 'claude-code',
          displayName: 'Claude Code',
          installed: true,
          mcpSupport: 'supported',
          readState: 'parse-error',
          resolvedPath: '/home/u/.claude.json',
          reason: 'Unexpected token at line 4',
        },
      ],
      rows: [
        {
          agentId: 'opencode',
          canonicalName: 'memory',
          agentServerName: 'memory',
          status: 'extra-in-agent',
          canonicalServer: null,
          agentServer: { type: 'stdio', command: 'npx', args: ['memory'] },
          reason: 'Canonical intent has no server named "memory"',
        },
        {
          agentId: 'github-copilot-cli',
          canonicalName: 'memory',
          agentServerName: 'memory',
          status: 'extra-in-agent',
          canonicalServer: null,
          agentServer: { type: 'stdio', command: 'node', args: ['mem.js'] },
          reason: 'Canonical intent has no server named "memory"',
        },
      ],
    });

  it('two calls with the same fixture return deeply equal objects', () => {
    const matrix = populatedMatrix();
    const a = classifyConflicts(matrix);
    const b = classifyConflicts(matrix);
    expect(a).toEqual(b);
  });

  it('JSON.stringify output is stable across calls', () => {
    const matrix = populatedMatrix();
    const a = JSON.stringify(classifyConflicts(matrix));
    const b = JSON.stringify(classifyConflicts(matrix));
    expect(a).toBe(b);
  });

  it('classifier output is JSON-serializable', () => {
    const matrix = populatedMatrix();
    const result = classifyConflicts(matrix);
    expect(typeof JSON.stringify(result)).toBe('string');
    for (const entry of result.hardRefuses) {
      expect(typeof entry.message).toBe('string');
      expect(typeof entry.reason).toBe('string');
    }
    for (const conflict of result.pickable) {
      expect(typeof conflict.serverName).toBe('string');
      expect(typeof conflict.message).toBe('string');
    }
  });
});
