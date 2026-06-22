import { AGENT_REGISTRY_ORDER } from '@overture/agents';
import type { OvertureMcpServer } from '@overture/config';
import type {
  AgentSnapshot,
  ConflictClassification,
  ScanMatrix,
  ServerStatusRow,
} from '@overture/scan-matrix';

import type { ScanJsonOutput } from '../src/scan.js';

export const SCHEMA_URL =
  'https://raw.githubusercontent.com/jander99/overture/main/schemas/overture.config.schema.json';

export type AgentId = (typeof AGENT_REGISTRY_ORDER)[number];

export class BufferWriter {
  public readonly chunks: string[] = [];

  public write(chunk: string): boolean {
    this.chunks.push(chunk);
    return true;
  }

  public text(): string {
    return this.chunks.join('');
  }
}

export function stdioServer(
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

export const HOME_FILESYSTEM_STDIO = stdioServer('npx', [
  '-y',
  '@modelcontextprotocol/server-filesystem',
  '/home',
]);

export const PNPM_FILESYSTEM_STDIO = stdioServer('pnpm', [
  'dlx',
  '@modelcontextprotocol/server-filesystem',
  '/home',
]);

export const CONTEXT7_REMOTE = remoteServer('https://mcp.context7.com/mcp');

export const UPSTASH_CONTEXT7_STDIO = stdioServer('npx', [
  '-y',
  '@upstash/context7',
]);

export const ALPHA_STDIO = stdioServer('alpha');

export const ZETA_STDIO = stdioServer('zsh', ['-lc', 'zeta']);

export function remoteServer(
  url: string,
  headers: Record<string, string> = {},
): OvertureMcpServer {
  return {
    type: 'remote',
    url,
    headers: { ...headers },
  };
}

export function agentSnapshot(
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

export function row(params: {
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

export function scanOutput(params: {
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

export function filesystemGroup(
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

export function validCanonicalConfigJson(): string {
  return JSON.stringify(
    {
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
          sync: {
            targets: [],
            disabledServers: [],
          },
          skills: [],
        },
      },
    },
    null,
    2,
  );
}
