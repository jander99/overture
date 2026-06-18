import { describe, it, expect, expectTypeOf } from 'vitest';
import type { McpSupport } from '@overture/agents';
import type { OvertureConfig, OvertureMcpServer } from '@overture/config';
import { serverSettingsEqual } from './index.js';
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

describe('scan-matrix package', () => {
  it('smokes', () => {
    expect(1).toBe(1);
  });
});
