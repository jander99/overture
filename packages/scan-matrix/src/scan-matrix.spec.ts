import { describe, it, expect, expectTypeOf } from 'vitest';
import type { McpSupport } from '@overture/agents';
import type { OvertureConfig, OvertureMcpServer } from '@overture/config';
import {
  DEFAULT_REGISTRY_ORDER,
  buildScanMatrix,
  compareAgentEntries,
  serverSettingsEqual,
} from './index.js';
import type {
  AgentReadState,
  AgentScanInput,
  AgentSnapshot,
  BuildScanMatrixInput,
  CompareAgentEntriesInput,
  NormalizedAgentServer,
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
