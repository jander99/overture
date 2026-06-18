import { describe, it, expect, expectTypeOf } from 'vitest';
import type { McpSupport } from '@overture/agents';
import type { OvertureConfig, OvertureMcpServer } from '@overture/config';
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

describe('scan-matrix package', () => {
  it('smokes', () => {
    expect(1).toBe(1);
  });
});
