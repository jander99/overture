/**
 * Per-section row renderers for the C2 detailed scan human report.
 *
 * Each `render*` function walks its source collection and returns the
 * `string[]` the cap machinery will emit. The functions are pure: no
 * I/O, no mutation, no shared state. {@link displayNameForRow} is the
 * single source of truth for resolving a row's `agentId` to a
 * human-readable display name.
 */

import type { ConflictClassification, ScanMatrix } from '@overture/scan-matrix';

import { renderFingerprint } from './fingerprint.js';

type MatrixAgent = ScanMatrix['agents'][number];
type MatrixRow = ScanMatrix['rows'][number];
type PickableConflict = ConflictClassification['pickable'][number];
type HardRefuseConflict = ConflictClassification['hardRefuses'][number];

/** Render the `Agents` section: one `  - ` line per agent, plus `config:` for resolved paths. */
export function renderAgents(agents: readonly MatrixAgent[]): string[] {
  const lines: string[] = [];
  for (const agent of agents) {
    lines.push(
      `  - ${agent.displayName} (${agent.id}): ${agent.installed ? 'installed' : 'not installed'}, mcp=${agent.mcpSupport}, read=${agent.readState}`,
    );
    if (agent.resolvedPath !== undefined) {
      lines.push(`    config: ${agent.resolvedPath}`);
    }
  }
  return lines;
}

/** Render the `Aligned servers` section: rows where `status === 'aligned'`. */
export function renderAlignedRows(
  matrix: ScanMatrix,
  rows: readonly MatrixRow[],
): string[] {
  const lines: string[] = [];
  for (const row of rows) {
    if (row.status !== 'aligned') {
      continue;
    }
    const name = row.canonicalName ?? row.agentServerName ?? '<unknown>';
    const displayName = displayNameForRow(matrix, row);
    lines.push(
      `  - ${name} on ${displayName} (${row.agentId}): ${renderFingerprint(row.canonicalServer ?? row.agentServer)}`,
    );
  }
  return lines;
}

/** Render the `Missing from agents` section: rows where `status === 'missing-from-agent'`. */
export function renderMissingRows(
  matrix: ScanMatrix,
  rows: readonly MatrixRow[],
): string[] {
  const lines: string[] = [];
  for (const row of rows) {
    if (row.status !== 'missing-from-agent') {
      continue;
    }
    const name = row.canonicalName ?? row.agentServerName ?? '<unknown>';
    const displayName = displayNameForRow(matrix, row);
    lines.push(
      `  - ${name} missing from ${displayName} (${row.agentId}): ${renderFingerprint(row.canonicalServer)}`,
    );
  }
  return lines;
}

/** Render the `Agent-only servers` section: rows where `status === 'extra-in-agent'`. */
export function renderExtraRows(
  matrix: ScanMatrix,
  rows: readonly MatrixRow[],
): string[] {
  const lines: string[] = [];
  for (const row of rows) {
    if (row.status !== 'extra-in-agent') {
      continue;
    }
    const name = row.agentServerName ?? row.canonicalName ?? '<unknown>';
    const displayName = displayNameForRow(matrix, row);
    lines.push(
      `  - ${name} on ${displayName} (${row.agentId}): ${renderFingerprint(row.agentServer)}`,
    );
  }
  return lines;
}

/** Render the `Pickable conflicts` section: one entry per pickable + indented candidate lines. */
export function renderPickable(
  conflicts: readonly PickableConflict[],
): string[] {
  const lines: string[] = [];
  for (const conflict of conflicts) {
    lines.push(`  - ${conflict.serverName}: ${conflict.message}`);
    for (const candidate of conflict.candidates) {
      lines.push(
        `    candidate ${candidate.displayName} (${candidate.agentId}): ${renderFingerprint(candidate.server)}`,
      );
    }
  }
  return lines;
}

/** Render the `Hard refuses` section: one entry per hard-refuse conflict. */
export function renderHardRefuses(
  conflicts: readonly HardRefuseConflict[],
): string[] {
  const lines: string[] = [];
  for (const conflict of conflicts) {
    lines.push(`  - ${conflict.reason}: ${conflict.message}`);
  }
  return lines;
}

/** Render the `Parse errors` section: one entry per agent with `readState === 'parse-error'`. */
export function renderParseErrors(agents: readonly MatrixAgent[]): string[] {
  const lines: string[] = [];
  for (const agent of agents) {
    if (agent.readState !== 'parse-error') {
      continue;
    }
    lines.push(
      `  - ${agent.displayName} (${agent.id}): ${agent.resolvedPath ?? 'unknown'} - ${agent.reason ?? 'no reason'}`,
    );
  }
  return lines;
}

/** Resolve a row's `agentId` to the matching agent's `displayName` (falls back to the id). */
function displayNameForRow(matrix: ScanMatrix, row: MatrixRow): string {
  return (
    matrix.agents.find((agent) => agent.id === row.agentId)?.displayName ??
    row.agentId
  );
}
