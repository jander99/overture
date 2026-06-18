import { describe, it, expect, expectTypeOf } from 'vitest';
import type { McpSupport } from '@overture/agents';
import type { OvertureConfig, OvertureMcpServer } from '@overture/config';
import { compareAgentEntries, serverSettingsEqual } from './index.js';
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

describe('scan-matrix package', () => {
  it('smokes', () => {
    expect(1).toBe(1);
  });
});
