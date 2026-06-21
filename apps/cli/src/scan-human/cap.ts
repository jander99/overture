/**
 * Cap + section-append machinery for the C2 detailed scan human report.
 *
 * The cap is shared across the six capped sections (Aligned, Missing,
 * Agent-only, Pickable, Hard refuses, Parse errors). Once the cap is
 * reached, the renderer emits a single trailing `... and N more entries`
 * line in the section that crossed the threshold and prints `(none)` for
 * every later section.
 *
 * The trailing count is **omitted detailed entries across the rest of
 * the report** — not just the section that fired. The renderer
 * pre-computes the total detailed-entry count up front and feeds it to
 * {@link createCap}, so the cap message can report
 * `total - emitted` even when the section that fired the cap holds
 * only a fraction of the omitted entries.
 */

/** Maximum detailed entries rendered before the cap fires. */
export const MAX_DETAILED_ENTRIES = 200;

const CAP_MESSAGE_PREFIX = '  ... and ';

/**
 * Mutable cap state. The renderer creates one per `formatHumanScanDetail`
 * call and threads it through every `appendCappedSection` call. The
 * `totalDetailedEntries` field is set once at construction time and is
 * used to compute the trailing `... and N more entries` count.
 */
export interface CapState {
  readonly limit: number;
  readonly totalDetailedEntries: number;
  emitted: number;
  capReached: boolean;
}

/**
 * Build a fresh cap state. `totalDetailedEntries` is the sum of the
 * body lengths of every section that will be appended via
 * {@link appendCappedSection} — used to compute the final
 * `omitted = total - emitted` count when the cap fires.
 */
export function createCap(
  totalDetailedEntries: number,
  limit: number = MAX_DETAILED_ENTRIES,
): CapState {
  return {
    limit,
    totalDetailedEntries,
    emitted: 0,
    capReached: false,
  };
}

/**
 * Append a section header and either the section body (subject to the
 * shared cap) or the `(none)` placeholder. Once `cap.capReached` is
 * true, every subsequent call emits only the header and `(none)`.
 *
 * The cap message that fires here reports
 * `cap.totalDetailedEntries - cap.emitted` — the count of detailed
 * entries the user is *not* seeing, including entries from later
 * sections that will now show `(none)`.
 */
export function appendCappedSection(
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
  const capacity = cap.limit - cap.emitted;
  if (capacity <= 0) {
    cap.capReached = true;
    const omitted = cap.totalDetailedEntries - cap.emitted;
    lines.push(formatCapMessage(omitted));
    return;
  }
  if (body.length <= capacity) {
    lines.push(...body);
    cap.emitted += body.length;
    return;
  }
  const head = body.slice(0, capacity);
  lines.push(...head);
  cap.emitted += capacity;
  cap.capReached = true;
  const omitted = cap.totalDetailedEntries - cap.emitted;
  lines.push(formatCapMessage(omitted));
}

/**
 * Append a non-capped section: header + body, or header + `(none)` if
 * the body is empty. The `Agents` summary is the only caller.
 */
export function appendSection(
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

/**
 * Append a free-form block (the install-suggestion block, currently),
 * preceded by a blank line when the buffer is non-empty.
 */
export function appendBlock(lines: string[], body: readonly string[]): void {
  if (lines.length > 0) {
    lines.push('');
  }
  lines.push(...body);
}

function formatCapMessage(omitted: number): string {
  return `${CAP_MESSAGE_PREFIX}${omitted} more entries; run "overture scan --json" for full details.`;
}
