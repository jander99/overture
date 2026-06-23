import { AGENT_REGISTRY_ORDER } from '@overture/agents';
import type { OvertureConfig, OvertureMcpServer } from '@overture/config';
import {
  serverSettingsEqual,
  type ConflictClassification,
  type HardRefuseConflict,
  type PickableConflict,
  type ScanMatrix,
} from '@overture/scan-matrix';

import type { ScanJsonOutput } from './scan.js';

const SCHEMA_URL =
  'https://raw.githubusercontent.com/jander99/overture/main/schemas/overture.config.schema.json';

const DEFAULT_SETTINGS = {
  defaultProfile: 'default',
  dryRunByDefault: true,
  backupBeforeWrite: true,
  conflictPolicy: 'refuse',
} as const;

export interface BootstrapAdoptedServer {
  readonly name: string;
  readonly source: 'single-agent' | 'all-agents-equal' | 'selected-conflict';
  readonly agentIds: readonly string[];
}

export type BootstrapConflict = PickableConflict | HardRefuseConflict;
export type BootstrapConflicts = ConflictClassification;

export interface BootstrapBlocker {
  readonly reason: 'no-readable-agents';
}

export interface BootstrapProposal {
  readonly status: 'ready' | 'blocked';
  readonly configPath: string;
  readonly config: OvertureConfig;
  readonly adoptedServers: readonly BootstrapAdoptedServer[];
  readonly targetAgents: readonly string[];
}

export interface BootstrapPlan {
  readonly proposal: BootstrapProposal;
  readonly conflicts: BootstrapConflicts;
  readonly blockers: readonly BootstrapBlocker[];
}

interface AdoptedServerEntry extends BootstrapAdoptedServer {
  readonly server: OvertureMcpServer;
}

export function buildBootstrapPlan({
  scanOutput,
  configPath,
}: {
  readonly scanOutput: ScanJsonOutput;
  readonly configPath: string;
}): BootstrapPlan {
  const targetAgents = buildTargetAgents(scanOutput.matrix);
  const blockers =
    targetAgents.length === 0
      ? ([{ reason: 'no-readable-agents' }] as const)
      : ([] as const);
  const adoptedServers = buildAdoptedServers(scanOutput);
  const config = buildProposalConfig(adoptedServers, targetAgents);
  const status =
    blockers.length === 0 &&
    scanOutput.conflicts.pickable.length === 0 &&
    scanOutput.conflicts.hardRefuses.length === 0
      ? 'ready'
      : 'blocked';

  return {
    proposal: {
      status,
      configPath,
      config,
      adoptedServers: adoptedServers.map(stripServer),
      targetAgents,
    },
    conflicts: scanOutput.conflicts,
    blockers,
  };
}

function buildTargetAgents(matrix: ScanMatrix): readonly string[] {
  const positions = agentPositions();
  return [...matrix.agents]
    .filter(
      (agent) =>
        agent.installed === true &&
        agent.mcpSupport === 'supported' &&
        agent.readState === 'read-ok',
    )
    .sort((left, right) => compareAgentIds(left.id, right.id, positions))
    .map((agent) => agent.id);
}

function buildAdoptedServers(
  scanOutput: ScanJsonOutput,
): readonly AdoptedServerEntry[] {
  const blockedServerNames = new Set<string>();
  for (const conflict of scanOutput.conflicts.pickable) {
    blockedServerNames.add(conflict.serverName);
  }
  for (const conflict of scanOutput.conflicts.hardRefuses) {
    if (conflict.serverName !== null) {
      blockedServerNames.add(conflict.serverName);
    }
  }

  const rowsByServer = new Map<
    string,
    { readonly agentId: string; readonly server: OvertureMcpServer }[]
  >();

  for (const row of scanOutput.matrix.rows) {
    if (
      row.status !== 'extra-in-agent' ||
      row.agentServerName === null ||
      row.agentServer === null
    ) {
      continue;
    }
    const rows = rowsByServer.get(row.agentServerName) ?? [];
    rows.push({ agentId: row.agentId, server: row.agentServer });
    rowsByServer.set(row.agentServerName, rows);
  }

  const positions = agentPositions();
  const adopted: AdoptedServerEntry[] = [];
  for (const [name, rows] of rowsByServer) {
    if (blockedServerNames.has(name)) {
      continue;
    }
    if (rows.length === 0) {
      continue;
    }

    const sortedRows = [...rows].sort((left, right) =>
      compareAgentIds(left.agentId, right.agentId, positions),
    );
    const candidateServers = sortedRows.map((row) => row.server);
    const agentIds = sortedRows.map((row) => row.agentId);
    const first = candidateServers[0];
    if (first === undefined) {
      continue;
    }

    if (candidateServers.length === 1) {
      adopted.push({
        name,
        source: 'single-agent',
        agentIds,
        server: first,
      });
      continue;
    }

    const allEqual = candidateServers.every((server) =>
      serverSettingsEqual(first, server),
    );
    if (!allEqual) {
      continue;
    }

    adopted.push({
      name,
      source: 'all-agents-equal',
      agentIds,
      server: first,
    });
  }

  adopted.sort((left, right) => left.name.localeCompare(right.name));
  return adopted;
}

function buildProposalConfig(
  adoptedServers: readonly AdoptedServerEntry[],
  targetAgents: readonly string[],
): OvertureConfig {
  const mcpServers = Object.fromEntries(
    adoptedServers.map(({ name, server }) => [name, server]),
  ) as OvertureConfig['profiles']['default']['mcpServers'];

  return {
    $schema: SCHEMA_URL,
    version: 1,
    settings: {
      ...DEFAULT_SETTINGS,
    },
    profiles: {
      default: {
        mcpServers,
        sync: {
          targets: [...targetAgents],
          disabledServers: [],
        },
        skills: [],
      },
    },
  };
}

function agentPositions(): ReadonlyMap<string, number> {
  return new Map(AGENT_REGISTRY_ORDER.map((id, index) => [id, index]));
}

function compareAgentIds(
  left: string,
  right: string,
  positions: ReadonlyMap<string, number>,
): number {
  const leftPosition = positions.get(left) ?? Number.MAX_SAFE_INTEGER;
  const rightPosition = positions.get(right) ?? Number.MAX_SAFE_INTEGER;
  if (leftPosition !== rightPosition) {
    return leftPosition - rightPosition;
  }
  return left.localeCompare(right);
}

function stripServer(entry: AdoptedServerEntry): BootstrapAdoptedServer {
  return {
    name: entry.name,
    source: entry.source,
    agentIds: [...entry.agentIds],
  };
}
