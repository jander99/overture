import type { ConflictClassification, ScanMatrix } from '@overture/scan-matrix';

type MatrixAgent = ScanMatrix['agents'][number];
type MatrixRow = ScanMatrix['rows'][number];
type PickableConflict = ConflictClassification['pickable'][number];
type HardRefuseConflict = ConflictClassification['hardRefuses'][number];

type RenderableServer =
  | {
      readonly type: 'stdio';
      readonly command?: string;
      readonly args?: readonly string[];
      readonly env?: Readonly<Record<string, string>>;
      readonly reason?: string;
    }
  | {
      readonly type: 'remote';
      readonly url?: string;
      readonly headers?: Readonly<Record<string, string>>;
      readonly reason?: string;
    }
  | {
      readonly type?: string;
      readonly reason?: string;
    };

/**
 * Maximum number of detailed entries (rows, conflict entries, parse-error
 * entries, pickable candidates) rendered across the server / conflict / parse
 * sections. The Agents summary, section headers, the install suggestion block,
 * and the final JSON pointer line are NOT counted. When the cap is reached the
 * renderer appends a single truncation line and stops emitting further entries.
 *
 * Locked by the C2 plan; raised only when the user explicitly approves scope
 * expansion.
 */
export const MAX_DETAILED_ENTRIES = 200;
const CAP_MESSAGE_PREFIX = '  ... and ';

/**
 * Render the full C2 human report for a `{ matrix, conflicts }` scan result.
 *
 * Section order is fixed: summary, Agents, Aligned servers, Missing from
 * agents, Agent-only servers, Pickable conflicts, Hard refuses, Parse errors,
 * (zero-agent install suggestion block when applicable), and the final JSON
 * pointer line. Every section header is always emitted; empty sections show
 * `  (none)` under the heading.
 *
 * Detailed entries (rows, conflicts, parse errors) are capped at
 * {@link MAX_DETAILED_ENTRIES} across all server / conflict / parse sections.
 * When the cap is hit, the renderer appends a single
 * `  ... and N more entries; run "overture scan --json" for full details.`
 * line at the end of the section that crossed the cap and stops emitting
 * further entries.
 *
 * The function is pure: no I/O, no `process`, no `JSON.stringify`, no `console`.
 * It never throws for malformed URLs or absent optional fields.
 */
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
    `Detected agents: ${installedCount} / 4`,
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

  const cap = createCap();
  appendCappedSection(
    lines,
    cap,
    'Aligned servers',
    renderAlignedRows(matrix, matrix.rows),
  );
  appendCappedSection(
    lines,
    cap,
    'Missing from agents',
    renderMissingRows(matrix, matrix.rows),
  );
  appendCappedSection(
    lines,
    cap,
    'Agent-only servers',
    renderExtraRows(matrix, matrix.rows),
  );
  appendCappedSection(
    lines,
    cap,
    'Pickable conflicts',
    renderPickable(conflicts.pickable),
  );
  appendCappedSection(
    lines,
    cap,
    'Hard refuses',
    renderHardRefuses(conflicts.hardRefuses),
  );
  appendCappedSection(
    lines,
    cap,
    'Parse errors',
    renderParseErrors(matrix.agents),
  );

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
function renderAgents(agents: readonly MatrixAgent[]): string[] {
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

function renderAlignedRows(
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

function renderMissingRows(
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

function renderExtraRows(
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

function renderPickable(conflicts: readonly PickableConflict[]): string[] {
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

function renderHardRefuses(conflicts: readonly HardRefuseConflict[]): string[] {
  const lines: string[] = [];
  for (const conflict of conflicts) {
    lines.push(`  - ${conflict.reason}: ${conflict.message}`);
  }
  return lines;
}

function renderParseErrors(agents: readonly MatrixAgent[]): string[] {
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

function appendSection(
  lines: string[],
  title: string,
  body: readonly string[],
): void {
  if (lines.length > 0) {
    lines.push('');
  }
  lines.push(title);
  if (body.length === 0) {
    lines.push('  (none)');
    return;
  }
  lines.push(...body);
}

function appendBlock(lines: string[], body: readonly string[]): void {
  if (lines.length > 0) {
    lines.push('');
  }
  lines.push(...body);
}

/**
 * Mutable cap state shared across {@link appendCappedSection} calls. Tracks
 * how many detailed entries have been emitted so far, whether the cap has
 * already been reported, and how many entries would still have been rendered
 * (used to compute the trailing truncation message).
 */
interface CapState {
  readonly limit: number;
  emitted: number;
  capReached: boolean;
  truncatedLines: readonly string[];
}

function createCap(limit: number = MAX_DETAILED_ENTRIES): CapState {
  return {
    limit,
    emitted: 0,
    capReached: false,
    truncatedLines: [],
  };
}

function appendCappedSection(
  lines: string[],
  cap: CapState,
  title: string,
  body: readonly string[],
): void {
  if (lines.length > 0) {
    lines.push('');
  }
  lines.push(title);
  if (cap.capReached) {
    lines.push('  (none)');
    return;
  }
  if (body.length === 0) {
    lines.push('  (none)');
    return;
  }
  const remaining = body.length;
  const capacity = cap.limit - cap.emitted;
  if (capacity <= 0) {
    cap.capReached = true;
    cap.truncatedLines = body;
    lines.push(
      `${CAP_MESSAGE_PREFIX}${remaining} more entries; run "overture scan --json" for full details.`,
    );
    return;
  }
  if (remaining <= capacity) {
    lines.push(...body);
    cap.emitted += remaining;
    return;
  }
  const head = body.slice(0, capacity);
  lines.push(...head);
  cap.emitted += capacity;
  cap.capReached = true;
  cap.truncatedLines = body.slice(capacity);
  lines.push(
    `${CAP_MESSAGE_PREFIX}${cap.truncatedLines.length} more entries; run "overture scan --json" for full details.`,
  );
}

function displayNameForRow(matrix: ScanMatrix, row: MatrixRow): string {
  return (
    matrix.agents.find((agent) => agent.id === row.agentId)?.displayName ??
    row.agentId
  );
}

function renderFingerprint(server: unknown): string {
  if (!isRenderableServer(server)) {
    return '<unknown>';
  }
  if (isStdioRenderableServer(server)) {
    const command = server.command ?? '<unknown>';
    const args = server.args?.length ?? 0;
    const env = server.env === undefined ? 0 : Object.keys(server.env).length;
    return `stdio command=${command} args=${args} env=${env}`;
  }
  if (isRemoteRenderableServer(server)) {
    const headers =
      server.headers === undefined ? 0 : Object.keys(server.headers).length;
    return `remote url=${redactUrl(server.url ?? '')} headers=${headers}`;
  }
  if (server.reason !== undefined) {
    return `shape-conflict reason=${server.reason}`;
  }
  return '<unknown>';
}

function isRenderableServer(server: unknown): server is RenderableServer {
  return typeof server === 'object' && server !== null;
}

function isStdioRenderableServer(
  server: RenderableServer,
): server is Extract<RenderableServer, { readonly type: 'stdio' }> {
  return server.type === 'stdio';
}

function isRemoteRenderableServer(
  server: RenderableServer,
): server is Extract<RenderableServer, { readonly type: 'remote' }> {
  return server.type === 'remote';
}

function redactUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    let result = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    if (parsed.search !== '') {
      result += '?…';
    }
    if (parsed.hash !== '') {
      result += '#…';
    }
    return result;
  } catch {
    return '<invalid-url>';
  }
}
