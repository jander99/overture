/**
 * G2 — `apply-log` module: per-run human-readable recovery log codec, the
 * plain-text renderer, the atomic writer, the line-prefix reader, and the
 * paired `.json` + `.log` retention GC.
 *
 * Per-run file:  `<stateDir>/apply/<runId>.log`     (one log per apply, G2)
 * Sibling:       `<stateDir>/apply/<runId>.json`     (G1 state file)
 * Pointer file:  `<stateDir>/apply/last.json`         → `{ "runId": "..." }`
 *
 * The log is the human-readable recovery surface: paired `backup:` / `target:`
 * tag lines alongside ready-to-paste `mv -v` lines so the future
 * `overture restore-last` helper (G3) can grep restoration data out of the
 * log without depending on G1's JSON shape. The renderer is a pure function
 * (`renderApplyLog`) — the writer (`writeApplyLog`) just renders, writes
 * atomically, and runs `pruneApplyArtifacts` so log retention is lockstep
 * with G1's JSON retention.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';

import type { ApplyStateRecord } from './apply-state.js';
import { pruneApplyArtifacts } from './apply-state.js';

// ---------------------------------------------------------------------------
// Types — final per gate G2-1.
// ---------------------------------------------------------------------------

/**
 * Single per-agent entry in an {@link ApplyLogContent}.
 *
 * `status` is a plain `string` (decoupled from the runtime `ApplyStatus`
 * enum) so a future runtime widening does not invalidate old log files.
 * `restorePairs` is the load-bearing G3-prep field: it pairs
 * `targetPaths[i]` with `backupPaths[i]` by index so a future `restore-last`
 * helper can grep `backup:` / `target:` tag lines out of the rendered log
 * without depending on G1's JSON shape.
 */
export interface ApplyLogEntry {
  readonly agentId: string;
  readonly displayName: string;
  readonly status: string;
  readonly restorePairs: readonly {
    readonly backup: string;
    readonly target: string;
  }[];
  /** Optional refusal reason (mirrors `ApplyStateAgent.reason`). */
  readonly reason?: string;
}

/**
 * Structured render-ready document for `<stateDir>/apply/<runId>.log`.
 *
 * The renderer (`renderApplyLog`) projects this into the 5-section
 * plain-text format. `lastJsonPointer` is the absolute path to the
 * per-run G1 JSON file (i.e. `<stateDir>/<runId>.json`), surfaced as the
 * last-pointer reference's `state:` line in the rendered footer.
 */
export interface ApplyLogContent {
  readonly runId: string;
  readonly timestamp: string;
  readonly profile: string;
  readonly configPath: string;
  readonly backupBeforeWrite: boolean;
  /** `"overture@<cli-version>"` per gate G2-1; falls back to `"overture"`. */
  readonly generatedBy: string;
  readonly entries: readonly ApplyLogEntry[];
  /** Absolute path to `<stateDir>/<runId>.json` (the per-run G1 state file). */
  readonly lastJsonPointer: string;
}

/** Result of {@link writeApplyLog}. Mirrors `WriteApplyStateResult` shape. */
export interface WriteApplyLogResult {
  /** Absolute path of the per-run log file on disk. */
  readonly logPath: string;
  /** Per-run artifact basenames that GC unlinked during this call. */
  readonly pruned: readonly string[];
}

// ---------------------------------------------------------------------------
// Pure helpers.
// ---------------------------------------------------------------------------

/**
 * Single-quote a path with embedded-`'` escaped as `'\''`. Handles
 * spaces, `$`, `;`, `&`, `(`, `)`, and embedded single quotes correctly.
 * Pure function.
 */
export function shellQuotePath(path: string): string {
  return `'${path.replace(/'/g, "'\\''")}'`;
}

/**
 * Project an `ApplyStateRecord` into the render-ready {@link ApplyLogContent}.
 * Pairs `targetPaths[i]` with `backupPaths[i]` by index per the plan's
 * `ApplyRecord` projection seam. `stateDir` is threaded through so
 * `lastJsonPointer` resolves to the absolute path of the sibling G1 JSON
 * file (matches the test contract in `apply-log.spec.ts` Case 2).
 */
export function buildApplyLog(
  applyRecord: ApplyStateRecord,
  generatedBy: string,
  stateDir: string,
): ApplyLogContent {
  const entries: ApplyLogEntry[] = applyRecord.agents.map(
    (agent): ApplyLogEntry => {
      const restorePairs = agent.backupPaths.map(
        (backup, i): { backup: string; target: string } => ({
          backup,
          target: agent.targetPaths[i] ?? '',
        }),
      );
      const base: ApplyLogEntry = {
        agentId: agent.agentId,
        displayName: agent.displayName,
        status: agent.status,
        restorePairs,
      };
      // Optional `reason` is only set when populated; absent vs. `undefined`
      // is preserved by the `reason?` declaration.
      if (agent.reason !== undefined) {
        return { ...base, reason: agent.reason };
      }
      return base;
    },
  );

  return {
    runId: applyRecord.runId,
    timestamp: applyRecord.timestamp,
    profile: applyRecord.profile,
    configPath: applyRecord.configPath,
    backupBeforeWrite: applyRecord.backupBeforeWrite,
    generatedBy,
    entries,
    lastJsonPointer: join(stateDir, `${applyRecord.runId}.json`),
  };
}

/**
 * Render the 5-section plain-text document. Sections in order:
 * header → warning → per-agent `restore:` blocks → footer `roll-back-all:`
 * → last-pointer references. Pure function — the on-disk trailing newline is
 * added by {@link writeApplyLog}, not here.
 */
export function renderApplyLog(content: ApplyLogContent): string {
  const sections: string[] = [];

  // ----- HEADER -----------------------------------------------------------
  sections.push('='.repeat(80));
  sections.push('Overture apply log');
  sections.push('='.repeat(80));
  sections.push(`run id:               ${content.runId}`);
  sections.push(`timestamp:            ${content.timestamp}`);
  sections.push(`profile:              ${content.profile}`);
  sections.push(`config path:          ${content.configPath}`);
  sections.push(
    `backup before write:  ${content.backupBeforeWrite ? 'enabled' : 'disabled'}`,
  );
  sections.push(`generated by:         ${content.generatedBy}`);
  sections.push('');

  // ----- WARNING ----------------------------------------------------------
  sections.push('#'.repeat(80));
  sections.push(
    '# DO NOT source this file — read it and run individual commands.',
  );
  sections.push('#'.repeat(80));
  sections.push('');

  // ----- PER-AGENT BLOCKS -------------------------------------------------
  for (const entry of content.entries) {
    sections.push(`[${entry.agentId}] ${entry.displayName}`);
    sections.push(`  status: ${entry.status}`);
    if (entry.restorePairs.length > 0) {
      for (const pair of entry.restorePairs) {
        sections.push(`backup: ${shellQuotePath(pair.backup)}`);
        sections.push(`target: ${shellQuotePath(pair.target)}`);
        sections.push(
          `  mv -v ${shellQuotePath(pair.backup)} ${shellQuotePath(pair.target)}`,
        );
      }
    }
    if (
      entry.reason !== undefined &&
      entry.status !== 'updated' &&
      entry.status !== 'no-change'
    ) {
      sections.push(`  reason: ${entry.reason}`);
    }
    sections.push('');
  }

  // ----- ROLL-BACK-ALL FOOTER --------------------------------------------
  sections.push('='.repeat(80));
  sections.push('Roll-back all (read first, run after review)');
  sections.push('='.repeat(80));
  sections.push('roll-back-all:');
  sections.push(
    `# roll-back generated ${content.timestamp} for run ${content.runId}`,
  );
  // Reverse agent order; within an agent, pairs are in writer-aligned order.
  for (let i = content.entries.length - 1; i >= 0; i--) {
    const entry = content.entries[i];
    if (!entry) continue;
    for (const pair of entry.restorePairs) {
      sections.push(
        `  mv -v ${shellQuotePath(pair.backup)} ${shellQuotePath(pair.target)}`,
      );
    }
  }
  sections.push('');

  // ----- LAST-POINTER SECTION --------------------------------------------
  const stateDir = dirnameOf(content.lastJsonPointer, content.runId);
  sections.push('-'.repeat(80));
  sections.push('Last logs/state pointer:');
  sections.push(`  log:      ${join(stateDir, `${content.runId}.log`)}`);
  sections.push(`  state:    ${content.lastJsonPointer}`);
  sections.push(`  pointer:  ${join(stateDir, 'last.json')}`);

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// Filesystem helpers.
// ---------------------------------------------------------------------------

/**
 * Atomically write the rendered log to `<stateDir>/apply/<runId>.log` via
 * `open+writeFile+fsync+close+rename` (mirrors G1's inline pattern in
 * `apply-state.ts`). Then call `pruneApplyArtifacts(stateDir, keep)` so the
 * G2 logs prune in lockstep with G1's JSONs.
 */
export async function writeApplyLog(
  content: ApplyLogContent,
  stateDir: string,
  keep = 10,
): Promise<WriteApplyLogResult> {
  await mkdir(stateDir, { recursive: true });

  const logPath = join(stateDir, `${content.runId}.log`);
  await atomicWrite(logPath, `${renderApplyLog(content)}\n`);

  const pruned = await pruneApplyArtifacts(stateDir, keep);

  return { logPath, pruned };
}

/**
 * Read a per-run log file from `logPath` and parse it back into an
 * {@link ApplyLogContent}. Returns `null` when the file is absent. The
 * parser uses line-prefix matching against the locked tag-line shapes
 * (`backup:`, `target:`, `status:`, `mv -v`, `roll-back-all:`).
 */
export async function readApplyLog(
  logPath: string,
): Promise<ApplyLogContent | null> {
  let raw: string;
  try {
    raw = await readFile(logPath, 'utf8');
  } catch (err) {
    if (isErrnoWithCode(err, 'ENOENT')) return null;
    throw err;
  }
  return parseLogContent(raw);
}

/**
 * GC `<stateDir>/apply/*.json` AND `*.log` to the `keep` newest runIds.
 * Groups files by basename-without-extension so the `.json` and `.log`
 * for the same `<runId>` are unlinked together. Excludes `last.json` from
 * the json set (G1 invariant preserved). Returns the unlinked basenames
 * (no directory prefix).
 *
 * Implementation re-exported from `apply-state.ts` (G1 promotion in
 * Wave 1 of this slice). Single source of truth so G1 and G2 retention
 * stay in lockstep without a shared helper to drift.
 */
export { pruneApplyArtifacts };

// ---------------------------------------------------------------------------
// Internal helpers.
// ---------------------------------------------------------------------------

/**
 * Inline atomic write — open temp → write → fsync → close → rename. Mirrors
 * G1's `atomicWrite` in `apply-state.ts` exactly (no shared helper per the
 * plan's "Must NOT introduce a shared atomic-write helper" guardrail).
 * fsync guarantees the bytes survive a crash between the temp write and
 * the rename. On failure the temp file is unlinked best-effort so no
 * `.tmp-<hex>` debris persists, and the underlying error is rethrown with
 * a `[atomicWrite]` tag so callers can identify the failure surface.
 */
async function atomicWrite(
  targetPath: string,
  contents: string,
): Promise<void> {
  const tempPath = `${targetPath}.tmp-${randomBytes(4).toString('hex')}`;
  let handle: import('node:fs/promises').FileHandle | null = null;
  try {
    handle = await open(tempPath, 'w');
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(tempPath, targetPath);
  } catch (err) {
    // Close the handle if it's still open so we don't leak the FD.
    if (handle !== null) {
      try {
        await handle.close();
      } catch {
        /* swallow — already failing */
      }
    }
    // Best-effort cleanup so no `.tmp-<hex>` debris persists across retries.
    try {
      await unlink(tempPath);
    } catch {
      /* already gone or never created — that's fine */
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[atomicWrite] failed: ${message}`, { cause: err });
  }
}

/**
 * Best-effort ENOENT detection: catches both `readFile` rejections (where
 * `code === 'ENOENT'`) and any error that carries a `NodeJS.ErrnoException`
 * property with the same code on it. Uses the canonical `'code' in err`
 * safe-property-check pattern to avoid an `unknown` cast on `err.code`.
 */
function isErrnoWithCode(err: unknown, code: string): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    typeof err.code === 'string' &&
    err.code === code
  );
}

/**
 * Extract the directory component from a `lastJsonPointer` whose shape is
 * `<stateDir>/<runId>.json`. Used by the renderer's last-pointer section
 * to emit the sibling `.log` and `last.json` paths without recomputing
 * stateDir from scratch.
 */
function dirnameOf(lastJsonPointer: string, runId: string): string {
  const suffix = `${runId}.json`;
  if (lastJsonPointer.endsWith(suffix)) {
    return lastJsonPointer.slice(0, -suffix.length);
  }
  // Defensive fallback: split on the last separator.
  const idx = lastJsonPointer.lastIndexOf('/');
  if (idx < 0) return '';
  return lastJsonPointer.slice(0, idx);
}

/**
 * Extract the single-quoted path out of a `backup: '<path>'` / `target: '<path>'`
 * line. Returns the unquoted path string. Handles the `'\''` escape inside
 * the quoted region by reconstructing the literal `'` characters.
 */
function extractQuotedPath(value: string): string {
  // Strip the surrounding single quotes: '<path>'.
  if (!value.startsWith("'") || !value.endsWith("'")) return value;
  const inner = value.slice(1, -1);
  // Unescape the canonical POSIX `'\''` (literal close, escaped quote, open).
  return inner.replace(/'\\''/g, "'");
}

/**
 * Minimal line-prefix parser that recovers the load-bearing fields
 * (`runId`, `entries` with `restorePairs`, `lastJsonPointer`) from the
 * rendered text. Other fields default to empty / `false`; full prose
 * fidelity is not required (per the plan's "structural parser" contract —
 * the renderer is the spec, the parser confirms anchors).
 */
function parseLogContent(raw: string): ApplyLogContent {
  const lines = raw.split('\n');

  let runId = '';
  let timestamp = '';
  let profile = '';
  let configPath = '';
  let backupBeforeWrite = false;
  let generatedBy = '';
  let lastJsonPointer = '';

  // Build entries via mutation against `Mutable<ApplyLogEntry>` so we can
  // patch fields as we walk the rendered text. (TypeScript narrowing of
  // `let current: ApplyLogEntry | null` does not flow through long
  // `else if` chains cleanly; explicit mutable records keep the parser
  // compact and the types honest.)
  type MutableEntry = {
    -readonly [K in keyof ApplyLogEntry]: ApplyLogEntry[K];
  };
  const entries: MutableEntry[] = [];
  let current: MutableEntry | null = null;
  let pendingBackup: string | null = null;

  const sliceStatus = (line: string, prefix: string): string =>
    line.slice(prefix.length).trim();

  for (const line of lines) {
    if (line.startsWith('run id:')) {
      runId = sliceStatus(line, 'run id:');
    } else if (line.startsWith('timestamp:')) {
      timestamp = sliceStatus(line, 'timestamp:');
    } else if (line.startsWith('profile:')) {
      profile = sliceStatus(line, 'profile:');
    } else if (line.startsWith('config path:')) {
      configPath = sliceStatus(line, 'config path:');
    } else if (line.startsWith('backup before write:')) {
      const val = sliceStatus(line, 'backup before write:');
      backupBeforeWrite = val === 'enabled' || val === 'true';
    } else if (line.startsWith('generated by:')) {
      generatedBy = sliceStatus(line, 'generated by:');
    } else if (line.startsWith('  state:')) {
      lastJsonPointer = sliceStatus(line, '  state:');
    } else if (line.startsWith('state:')) {
      lastJsonPointer = sliceStatus(line, 'state:');
    } else if (line.startsWith('[')) {
      const match = /^\[([^\]]+)\]\s*(.*)$/.exec(line);
      if (match) {
        const fresh: MutableEntry = {
          agentId: match[1] ?? '',
          displayName: match[2] ?? '',
          status: '',
          restorePairs: [],
        };
        current = fresh;
        entries.push(fresh);
        pendingBackup = null;
      }
    } else if (current !== null) {
      if (line.startsWith('  status:')) {
        current.status = sliceStatus(line, '  status:');
      } else if (line.startsWith('status:')) {
        current.status = sliceStatus(line, 'status:');
      } else if (line.startsWith('backup:')) {
        pendingBackup = extractQuotedPath(sliceStatus(line, 'backup:'));
      } else if (line.startsWith('target:') && pendingBackup !== null) {
        const target = extractQuotedPath(sliceStatus(line, 'target:'));
        current.restorePairs = [
          ...current.restorePairs,
          { backup: pendingBackup, target },
        ];
        pendingBackup = null;
      } else if (line.startsWith('  reason:')) {
        current.reason = sliceStatus(line, '  reason:');
      } else if (line.startsWith('reason:')) {
        current.reason = sliceStatus(line, 'reason:');
      }
    }
  }

  return {
    runId,
    timestamp,
    profile,
    configPath,
    backupBeforeWrite,
    generatedBy,
    entries: entries.map(
      (e): ApplyLogEntry => ({
        agentId: e.agentId,
        displayName: e.displayName,
        status: e.status,
        restorePairs: e.restorePairs.map((p) => ({
          backup: p.backup,
          target: p.target,
        })),
        ...(e.reason !== undefined ? { reason: e.reason } : {}),
      }),
    ),
    lastJsonPointer,
  };
}
