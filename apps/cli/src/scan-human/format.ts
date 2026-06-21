/**
 * Top-level orchestrator for the C2 detailed scan human report.
 *
 * Section order is fixed: summary, Agents, Aligned servers, Missing
 * from agents, Agent-only servers, Pickable conflicts, Hard refuses,
 * Parse errors, (zero-agent install suggestion block when applicable),
 * and the final JSON pointer line.
 *
 * Detailed entries (rows, conflicts, parse errors) are capped at
 * {@link MAX_DETAILED_ENTRIES} across all server / conflict / parse
 * sections. When the cap is hit the renderer appends a single
 * `  ... and N more entries; run "overture scan --json" for full details.`
 * line at the end of the section that crossed the cap and emits `(none)`
 * for every later section. The `N` counts **every** omitted detailed
 * entry across the rest of the report — not just the ones from the
 * section that crossed the cap.
 *
 * The function is pure: no I/O, no `process`, no `JSON.stringify`, no
 * `console`. It never throws for malformed URLs or absent optional
 * fields.
 */

import type { ConflictClassification, ScanMatrix } from '@overture/scan-matrix';

import {
  appendBlock,
  appendCappedSection,
  appendSection,
  createCap,
} from './cap.js';
import {
  renderAgents,
  renderAlignedRows,
  renderExtraRows,
  renderHardRefuses,
  renderMissingRows,
  renderParseErrors,
  renderPickable,
} from './sections.js';

export function formatHumanScanDetail(
  matrix: ScanMatrix,
  conflicts: ConflictClassification,
): string {
  const lines: string[] = [];
  const installedCount = matrix.agents.filter(
    (agent) => agent.installed,
  ).length;
  const blocking =
    matrix.canonicalState === 'invalid-profile' ||
    conflicts.hardRefuses.length > 0;

  lines.push(
    blocking ? 'Scan completed with blocking issues.' : 'Scan complete.',
    `Detected agents: ${installedCount} / ${matrix.agents.length}`,
    `Canonical config: ${matrix.canonicalState}`,
  );
  if (matrix.canonicalProfileName !== null) {
    lines.push(`Canonical profile: ${matrix.canonicalProfileName}`);
  }
  if (matrix.reason !== undefined) {
    lines.push(`Canonical reason: ${matrix.reason}`);
  }
  lines.push(`Hard refuses: ${conflicts.hardRefuses.length}`);

  appendSection(lines, 'Agents', renderAgents(matrix.agents));

  // Compute every capped section's body up front so the cap can know the
  // total detailed-entry count across all sections and report an honest
  // `omitted = total - emitted` even when later sections contribute to
  // the omitted count.
  const alignedLines = renderAlignedRows(matrix, matrix.rows);
  const missingLines = renderMissingRows(matrix, matrix.rows);
  const extraLines = renderExtraRows(matrix, matrix.rows);
  const pickableLines = renderPickable(conflicts.pickable);
  const hardRefuseLines = renderHardRefuses(conflicts.hardRefuses);
  const parseErrorLines = renderParseErrors(matrix.agents);

  const totalDetailedEntries =
    alignedLines.length +
    missingLines.length +
    extraLines.length +
    pickableLines.length +
    hardRefuseLines.length +
    parseErrorLines.length;
  const cap = createCap(totalDetailedEntries);

  appendCappedSection(lines, cap, 'Aligned servers', alignedLines);
  appendCappedSection(lines, cap, 'Missing from agents', missingLines);
  appendCappedSection(lines, cap, 'Agent-only servers', extraLines);
  appendCappedSection(lines, cap, 'Pickable conflicts', pickableLines);
  appendCappedSection(lines, cap, 'Hard refuses', hardRefuseLines);
  appendCappedSection(lines, cap, 'Parse errors', parseErrorLines);

  if (installedCount === 0) {
    appendBlock(lines, [
      'No supported MCP-capable agents detected.',
      'Install one of these CLI agents on a supported OS (linux/darwin):',
      '  - Claude Code',
      '  - OpenCode',
      '  - GitHub Copilot CLI',
      '  - OpenAI Codex',
    ]);
  }

  if (lines.length > 0) {
    lines.push('');
  }
  lines.push('Run "overture scan --json" for machine-readable details.');
  return lines.join('\n');
}
