/**
 * G3 — `restore-command` module: discover the last (or a chosen) apply run,
 * evaluate per-pair integrity, and execute `mv -v` to restore each backup
 * to its original target. The CLI surface is `overture restore-last`.
 *
 * Filesystem layout (inherited from G1 + G2; G3 is read-only on disk):
 *   `<stateDir>/apply/<runId>.json`   — canonical per-run record (G1)
 *   `<stateDir>/apply/<runId>.log`    — human-readable recovery log (G2)
 *   `<stateDir>/apply/last.json`      — `{ "runId": "<runId>" }` pointer (G1)
 *
 * G3 is intentionally narrow:
 *   - Read-only on disk. Gate G3-7 was rejected (no audit record, no
 *     `ApplyStateRecord.mode` widening).
 *   - One runId per invocation. No batched restoration.
 *   - Backups persist after restore. The next `overture apply` will
 *     prune them via `pruneApplyArtifacts`.
 *   - `child_process.spawn('mv', ['-v', backup, target])` per pair, never
 *     `fs.rename` (the on-disk log advertises `mv -v` semantics; matching
 *     the contract is the load-bearing requirement).
 *
 * Source preference is G1 JSON first, G2 log-tag-lines fallback. When
 * neither exists (e.g. a pruned runId reached via `last.json`), the plan
 * returns `source: 'last-json-pointer'` and an empty `pairs` array — the
 * caller exits 1 with a clear stderr message.
 *
 * The module is split into pure helpers (Wave 2) and the dispatcher-level
 * `runRestore` entry (Wave 3) so the integrity-evaluation logic is testable
 * without spawning child processes.
 */
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import { readApplyLog, shellQuotePath } from './apply-log.js';
import { readApplyState, sha256OfFile } from './apply-state.js';

// ---------------------------------------------------------------------------
// Public constants.
// ---------------------------------------------------------------------------

/**
 * Usage banner for `overture restore-last`. Mirrors `APPLY_USAGE` /
 * `BOOTSTRAP_USAGE` shape so the dispatcher can render it for `--help`,
 * `--unknown-flag`, and the no-args USAGE block in `cli.ts`.
 */
export const RESTORE_USAGE =
  'Usage: overture restore-last [--dry-run] [--yes] [--force] [--run-id <id>]\n';

const RESTORE_UNKNOWN_FLAG_PREFIX = 'Unknown flag: ';

const RESTORE_NON_TTY_MESSAGE =
  'interactive confirmation required (TTY) — pass --yes\n';

const RESTORE_NO_HISTORY_MESSAGE = (stateDir: string): string =>
  `no overture apply history found in ${stateDir}\n`;

const RESTORE_PRUNED_MESSAGE = (runId: string, stateDir: string): string =>
  `run ${runId} not found in ${stateDir} (retention window: 10)\n`;

// ---------------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------------

/**
 * Per-pair operating unit. One entry per (agent, target, backup) tuple from
 * the source's `restorePairs`. `integrityStatus` is set by `buildRestorePlan`
 * after evaluating the sha256 check against `preWriteSha256` (or skipped for
 * log-tag-lines source).
 */
export interface RestorePair {
  readonly agentId: string;
  readonly displayName: string;
  readonly backup: string;
  readonly target: string;
  readonly integrityStatus: 'ok' | 'mismatch' | 'unverified' | 'missing-backup';
  /** Present only when the source was G1 state-json. `null` when ENOENT. */
  readonly preWriteSha256: string | null | undefined;
  /** Current sha256 of `<target>`. `null` when ENOENT. */
  readonly currentSha256: string | null | undefined;
}

/**
 * Operational plan produced by `buildRestorePlan`. The `source` field
 * records which path fed the plan:
 *   - `state-json` — read from `<runId>.json`, integrity-checked.
 *   - `log-tag-lines` — read from `<runId>.log`, integrity not checked
 *     (no `preWriteSha256` available in the log).
 *   - `last-json-pointer` — `last.json` resolved to a runId whose files
 *     are absent (pruned or never existed); `pairs` is `[]`.
 */
export interface RestorePlan {
  readonly source: 'state-json' | 'log-tag-lines' | 'last-json-pointer';
  readonly runId: string;
  readonly pairs: readonly RestorePair[];
  readonly notes: readonly string[];
  readonly stateDir: string;
  readonly configPath: string;
}

/**
 * Per-pair result of an `mv` execution. `ok` = exit 0; `failed` =
 * `mv` exited non-zero, a `mismatch` was blocked (no `--force`), or
 * `integrityStatus: 'missing-backup'`. Per the **user verdict
 * 2026-07-04**, gate G3-8, a missing backup is a FAILURE, not a silent
 * skip — we
 * cannot prove whether the file was consumed by a prior restore or
 * never existed, so the restore request cannot be fulfilled and the
 * user must investigate. The `'skipped'` status is reserved for
 * future slices that may need a non-fatal opt-out path; today nothing
 * emits it.
 */
export type RestoreOutcomeStatus = 'ok' | 'skipped' | 'failed';

export interface RestoreOutcome {
  readonly agentId: string;
  readonly displayName: string;
  readonly backup: string;
  readonly target: string;
  readonly status: RestoreOutcomeStatus;
  /** Populated for `failed` (stderr reason); optional for `ok` (mv stdout). */
  readonly reason?: string;
}

/**
 * Optional overrides for `runRestore`. `prompt` is the test-injection seam
 * for the TTY confirm prompt (matches `RunBootstrapOptions.prompt` shape);
 * `isTTY` is the explicit TTY flag (defaults to `process.stdin.isTTY ?? false`,
 * matching `runBootstrap`'s pattern); `stateDir` overrides the default
 * `XDG_STATE_HOME`-based resolution (used by tests and by the
 * `cli.spec.ts` end-to-end smoke); `now` is unused today but reserved so
 * callers (and tests) can pin a fixed clock for any future stamp.
 */
export interface RunRestoreOptions {
  readonly prompt?: (message: string) => Promise<string | null>;
  readonly isTTY?: boolean;
  readonly stateDir?: string;
  readonly now?: Date;
}

// ---------------------------------------------------------------------------
// Pure helpers — Wave 2 surface.
// ---------------------------------------------------------------------------

/**
 * Read the source data for `runId` from `<stateDir>/apply/`. Tries the
 * per-run G1 JSON first (canonical, carries `preWriteSha256`); on ENOENT
 * falls back to the G2 `.log` tag lines (no sha256 → integrity check
 * skipped with `integrityStatus: 'unverified'`); on ENOENT for both
 * returns `source: 'last-json-pointer'` with an empty `pairs` array and a
 * "state file missing, search retention" note.
 *
 * Pure source-reading layer — no integrity evaluation, no `sha256OfFile`
 * calls. `buildRestorePlan` consumes this output and applies the integrity
 * check for the `state-json` source.
 */
export async function readRestoreSource(
  stateDir: string,
  runId: string,
): Promise<{
  readonly source: RestorePlan['source'];
  readonly runId: string;
  readonly configPath: string;
  readonly rawPairs: readonly {
    readonly agentId: string;
    readonly displayName: string;
    readonly backup: string;
    readonly target: string;
    readonly preWriteSha256: string | null;
  }[];
  readonly notes: readonly string[];
}> {
  const jsonPath = join(stateDir, `${runId}.json`);
  try {
    const record = await readApplyState(jsonPath);
    const rawPairs = record.agents.flatMap((agent) =>
      agent.targetPaths.map((target, i) => ({
        agentId: agent.agentId,
        displayName: agent.displayName,
        backup: agent.backupPaths[i] ?? '',
        target,
        preWriteSha256: agent.preWriteSha256,
      })),
    );
    return {
      source: 'state-json',
      runId,
      configPath: record.configPath,
      rawPairs,
      notes: [],
    };
  } catch (err) {
    if (!isErrnoWithCode(err, 'ENOENT')) throw err;
  }

  const logPath = join(stateDir, `${runId}.log`);
  const logContent = await readApplyLog(logPath);
  if (logContent === null) {
    return {
      source: 'last-json-pointer',
      runId,
      configPath: '',
      rawPairs: [],
      notes: ['state file missing, search retention'],
    };
  }

  const rawPairs = logContent.entries.flatMap((entry) =>
    entry.restorePairs.map((pair) => ({
      agentId: entry.agentId,
      displayName: entry.displayName,
      backup: pair.backup,
      target: pair.target,
      preWriteSha256: null,
    })),
  );
  return {
    source: 'log-tag-lines',
    runId,
    configPath: logContent.configPath,
    rawPairs,
    notes: [],
  };
}

/**
 * Resolve the runId from `<stateDir>/apply/last.json` when `runId` is
 * omitted; otherwise use the explicit `runId`. Then call
 * {@link readRestoreSource} and apply the integrity check (sha256 vs
 * `preWriteSha256`) per pair. The resulting `RestorePlan` is the input to
 * the human renderer and the execution path.
 */
export async function buildRestorePlan(
  stateDir: string,
  runId: string | undefined,
  now: Date,
): Promise<RestorePlan> {
  let resolvedRunId: string;
  if (runId === undefined) {
    const fromPointer = await readLastJsonPointer(stateDir);
    if (fromPointer === null) {
      // Caller exits 1 with a clear stderr message (mirrors G2's "no log
      // file was written" guardrail). The plan we return is degenerate but
      // structurally sound so renderers don't crash on a missing history.
      return {
        source: 'last-json-pointer',
        runId: '',
        pairs: [],
        notes: ['no overture apply history found'],
        stateDir,
        configPath: '',
      };
    }
    resolvedRunId = fromPointer;
  } else {
    resolvedRunId = runId;
  }

  const source = await readRestoreSource(stateDir, resolvedRunId);

  // For log-tag-lines source: integrity is unverifiable (no preWriteSha256
  // in the log). Flag every pair as `unverified` and let the caller decide.
  if (source.source === 'log-tag-lines') {
    const pairs: RestorePair[] = source.rawPairs.map((p) => ({
      agentId: p.agentId,
      displayName: p.displayName,
      backup: p.backup,
      target: p.target,
      integrityStatus: 'unverified',
      preWriteSha256: undefined,
      currentSha256: undefined,
    }));
    return {
      source: 'log-tag-lines',
      runId: resolvedRunId,
      pairs,
      notes: source.notes,
      stateDir,
      configPath: source.configPath,
    };
  }

  if (source.source === 'last-json-pointer') {
    return {
      source: 'last-json-pointer',
      runId: resolvedRunId,
      pairs: [],
      notes: source.notes,
      stateDir,
      configPath: source.configPath,
    };
  }

  // state-json: evaluate sha256(current target) vs preWriteSha256 per pair.
  const notes: string[] = [...source.notes];
  const pairs: RestorePair[] = [];
  for (const raw of source.rawPairs) {
    const currentSha256 = await sha256OfFile(raw.target);
    let integrityStatus: RestorePair['integrityStatus'];
    if (raw.backup === '') {
      // Writer-aligned zipping means a `backup` slot may be empty when no
      // backup was created (no-change / unsupported). Skip these pairs.
      integrityStatus = 'missing-backup';
    } else if (!isAbsolute(raw.target)) {
      // F3 fix (belt-and-braces): the apply-state record should already
      // hold absolute targetPaths (buildApplyStateRecord resolves them
      // against the apply-time `PathResolutionContext`). If a record
      // somehow still has a relative path, the spawned `mv` would
      // resolve it against its own cwd and silently fail. Surface that
      // as `unverified` (refused) with a notes line so the caller can
      // surface a clear stderr message and exit 1.
      integrityStatus = 'unverified';
      notes.push(
        `target path ${raw.target} is not absolute — refusing restore. Re-apply to refresh the state record with absolute paths.`,
      );
    } else {
      const fs = await import('node:fs');
      if (!fs.existsSync(raw.backup)) {
        integrityStatus = 'missing-backup';
      } else if (raw.preWriteSha256 === null) {
        // No sha256 captured at apply time (best-effort failure). Treat as
        // a `mismatch`-style gate: the file's current bytes cannot be
        // verified against a missing reference; force the user to opt in.
        integrityStatus = 'mismatch';
      } else if (currentSha256 === null) {
        // Target absent on disk. Per gate G3-5: the restore is a creation,
        // not a clobber; the backup moves in cleanly → `ok`.
        integrityStatus = 'ok';
      } else if (currentSha256 === raw.preWriteSha256) {
        integrityStatus = 'ok';
      } else {
        integrityStatus = 'mismatch';
      }
    }
    pairs.push({
      agentId: raw.agentId,
      displayName: raw.displayName,
      backup: raw.backup,
      target: raw.target,
      integrityStatus,
      preWriteSha256: raw.preWriteSha256,
      currentSha256,
    });
  }

  // Suppress an unused-variable lint complaint when `now` is unused. The
  // parameter exists so future slices can stamp the plan / outcome with a
  // fixed clock for tests; today the renderer doesn't surface it.
  void now;

  return {
    source: 'state-json',
    runId: resolvedRunId,
    pairs,
    notes,
    stateDir,
    configPath: source.configPath,
  };
}

/**
 * Render the pre-execute human-readable plan. Three sections:
 *   1. Header — `runId`, `timestamp` (when known), `source`, `stateDir`,
 *      `configPath`.
 *   2. Per-pair block — one line per pair with `agentId + status +
 *      mv -v '<backup>' '<target>'`.
 *   3. Footer — count summary + notes.
 *
 * Pure function; locked format (mirrors G2's `renderApplyLog` contract).
 */
export function formatHumanRestorePlan(plan: RestorePlan): string {
  const sections: string[] = [];

  // ----- HEADER -----------------------------------------------------------
  sections.push('='.repeat(72));
  sections.push('Overture restore plan');
  sections.push('='.repeat(72));
  sections.push(`run id:        ${plan.runId}`);
  sections.push(`source:        ${plan.source}`);
  sections.push(`state dir:     ${plan.stateDir}`);
  if (plan.configPath.length > 0) {
    sections.push(`config path:   ${plan.configPath}`);
  }
  sections.push('');

  // ----- PER-PAIR BLOCKS -------------------------------------------------
  for (const pair of plan.pairs) {
    sections.push(`[${pair.agentId}] ${pair.displayName}`);
    sections.push(`  status: ${pair.integrityStatus}`);
    sections.push(
      `  mv -v ${shellQuotePath(pair.backup)} ${shellQuotePath(pair.target)}`,
    );
    sections.push('');
  }

  // ----- FOOTER ----------------------------------------------------------
  sections.push('-'.repeat(72));
  sections.push(`pairs: ${plan.pairs.length}`);
  if (plan.notes.length > 0) {
    sections.push('notes:');
    for (const note of plan.notes) sections.push(`  - ${note}`);
  }
  return sections.join('\n') + '\n';
}

/**
 * Render the post-execute human-readable outcome. Same header → per-pair
 * result line (`ok` / `failed: <reason>`) → summary
 * (`restored: N, skipped: M, failed: K`).
 *
 * Today the `'skipped'` bucket is always 0 — the user verdict 2026-07-04
 * (gate G3-8) classifies `missing-backup` pairs as `failed`, not
 * `skipped`, so the only contributor to `M` would be a future slice
 * that adds a non-fatal opt-out path. The summary line keeps the
 * `skipped: M` slot for that forward-compat reason.
 *
 * Pure function; locked format. Mirrors G2's `renderApplyLog` shape.
 */
export function formatHumanRestoreOutcome(
  plan: RestorePlan,
  outcomes: readonly RestoreOutcome[],
): string {
  const sections: string[] = [];

  // ----- HEADER -----------------------------------------------------------
  sections.push('='.repeat(72));
  sections.push('Overture restore outcome');
  sections.push('='.repeat(72));
  sections.push(`run id:        ${plan.runId}`);
  sections.push(`source:        ${plan.source}`);
  sections.push('');

  // ----- PER-PAIR OUTCOMES -----------------------------------------------
  for (const outcome of outcomes) {
    sections.push(`[${outcome.agentId}] ${outcome.displayName}`);
    const line =
      outcome.status === 'failed' && outcome.reason !== undefined
        ? `  ${outcome.status}: ${outcome.reason}`
        : `  ${outcome.status}`;
    sections.push(line);
    sections.push('');
  }

  // ----- SUMMARY ---------------------------------------------------------
  const restored = outcomes.filter((o) => o.status === 'ok').length;
  const skipped = outcomes.filter((o) => o.status === 'skipped').length;
  const failed = outcomes.filter((o) => o.status === 'failed').length;
  sections.push('-'.repeat(72));
  sections.push(
    `restored: ${restored}, skipped: ${skipped}, failed: ${failed}`,
  );
  return sections.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Dispatcher entry — Wave 3 surface.
// ---------------------------------------------------------------------------

/**
 * Dispatcher-level entry for `overture restore-last`. Mirrors `runApply`'s
 * shape: flag parse → resolve runId from `last.json` when omitted → build
 * the plan → render the plan to stdout → if `--dry-run` exit 0, else
 * confirm via `--yes` or interactive prompt → execute `mv -v` per pair
 * sequentially → render the outcome → return 0/1/2 per gate G3-8.
 */
export async function runRestore(
  args: readonly string[],
  stdout: { write(s: string): void },
  stderr: { write(s: string): void },
  options: RunRestoreOptions = {},
): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) {
    stdout.write(RESTORE_USAGE);
    return 0;
  }

  // Flag whitelist: only the four documented flags. `--run-id` is value-bearing.
  const allowedValueFlags = new Set(['--run-id']);
  const allowedBooleanFlags = new Set(['--dry-run', '--yes', '--force']);
  let explicitRunId: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === undefined) continue;
    if (allowedBooleanFlags.has(arg)) continue;
    if (allowedValueFlags.has(arg)) {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--')) {
        stderr.write(`Missing value for ${arg}\n${RESTORE_USAGE}`);
        return 2;
      }
      if (arg === '--run-id') explicitRunId = value;
      i += 1;
      continue;
    }
    stderr.write(`${RESTORE_UNKNOWN_FLAG_PREFIX}${arg}\n${RESTORE_USAGE}`);
    return 2;
  }

  const hasDryRun = args.includes('--dry-run');
  const hasYes = args.includes('--yes');
  const hasForce = args.includes('--force');

  const stateDir =
    options.stateDir ?? join(resolveStateHomeDir(), 'overture', 'apply');

  // `last.json` may be absent; resolve runId either way (buildRestorePlan
  // surfaces the missing-history case as a degenerate plan).
  let runId = explicitRunId;
  if (runId === undefined) {
    try {
      runId = (await readLastJsonPointer(stateDir)) ?? undefined;
    } catch (err) {
      // F2 fix: surface the underlying error so a real permission / IO
      // failure is not silently collapsed into "no history found". The
      // no-history fallback below still runs so the user gets the
      // USAGE hint; the warning precedes the fallback.
      const message = err instanceof Error ? err.message : String(err);
      stderr.write(`warning: failed to read last.json: ${message}\n`);
      runId = undefined;
    }
  }

  if (runId === undefined) {
    stderr.write(RESTORE_NO_HISTORY_MESSAGE(stateDir));
    stderr.write(RESTORE_USAGE);
    return 1;
  }

  // If the user passed `--run-id`, the resolved-runId's files may be
  // absent (pruned). buildRestorePlan flags that as `last-json-pointer`
  // with empty pairs — surface a pruned message and exit 1.
  const plan = await buildRestorePlan(stateDir, runId, new Date());

  if (
    plan.source === 'last-json-pointer' &&
    plan.pairs.length === 0 &&
    explicitRunId !== undefined
  ) {
    stderr.write(RESTORE_PRUNED_MESSAGE(runId, stateDir));
    return 1;
  }
  if (
    plan.source === 'last-json-pointer' &&
    plan.pairs.length === 0 &&
    explicitRunId === undefined
  ) {
    // Pointer resolved to nothing (state + log both absent for the
    // runId in last.json). Same pruning-style message.
    stderr.write(RESTORE_PRUNED_MESSAGE(runId, stateDir));
    return 1;
  }

  // F2 fix: log-tag-lines source (no sha256 reference) surfaces a
  // stderr WARN on every path (--dry-run + --yes + interactive) so
  // the user knows the integrity check was skipped. Per gate G3-5
  // recommendation: "no sha256 exists → integrityStatus: 'unverified';
  // restore proceeds without comparison; a stderr WARN on --dry-run
  // and --yes paths."
  if (plan.pairs.some((p) => p.integrityStatus === 'unverified')) {
    stderr.write(
      'warning: integrity check skipped — restore source was a log file without sha256 hashes. Run `overture apply --dry-run` first if you want a full integrity check.\n',
    );
  }

  // Always render the plan first — even on `--dry-run` the user should
  // see exactly what would happen.
  stdout.write(formatHumanRestorePlan(plan));

  if (hasDryRun) {
    // No execute path on dry-run. The plan IS the deliverable.
    return 0;
  }

  // Integrity gate: any `mismatch` pair without `--force` aborts the
  // batch (atomic whole-run semantics per gate G3-4).
  const hasMismatch = plan.pairs.some((p) => p.integrityStatus === 'mismatch');
  if (hasMismatch && !hasForce) {
    for (const pair of plan.pairs) {
      if (pair.integrityStatus === 'mismatch') {
        stderr.write(
          `refusing to restore ${shellQuotePath(pair.target)}: target was edited since apply (pass --force to override)\n`,
        );
      }
    }
    return 1;
  }
  if (hasMismatch && hasForce) {
    for (const pair of plan.pairs) {
      if (pair.integrityStatus === 'mismatch') {
        stderr.write(
          `WARN: target ${shellQuotePath(pair.target)} was edited since apply; restore forced.\n`,
        );
      }
    }
  }

  // Confirmation gate (gate G3-4): with `--yes` we proceed; otherwise we
  // prompt — but ONLY when stdin is a TTY. Non-TTY without `--yes` → exit 2.
  if (!hasYes) {
    const isTTY = options.isTTY ?? process.stdin.isTTY === true;
    if (!isTTY) {
      stderr.write(`${RESTORE_NON_TTY_MESSAGE}${RESTORE_USAGE}`);
      return 2;
    }
    const prompt = options.prompt ?? createStdinConfirmPrompt();
    const answer = (await prompt('Proceed? [y/N] ')) ?? '';
    if (answer !== 'y' && answer !== 'Y') {
      stderr.write('aborted by user\n');
      return 1;
    }
  }

  // Pre-scan the plan for ANY missing-backup pair BEFORE issuing any
  // `mv`. Per the **user verdict 2026-07-04** recorded in gate G3-8
  // of the plan, `integrityStatus: 'missing-backup'` (the G1 backup
  // file is absent on disk) is treated as a FAILURE, not a silent
  // skip — we cannot prove whether the backup was consumed by a prior
  // restore or never existed, and the user's "restore this" request
  // cannot be guaranteed. Issuing `mv` for the `ok` pairs while
  // leaving the missing-backup pairs as failures would be a *worse*
  // partial-success: the user couldn't re-run the restore and get
  // the missing files back because the backup is gone. So when ANY
  // pair has a missing backup we refuse the whole request: stderr
  // gets one `error: backup file missing: …` line per missing pair
  // plus a follow-up investigation hint, the rendered outcome reports
  // every pair as `failed` (with a distinct reason per type), and we
  // exit 1 with ZERO `mv` shell-outs fired.
  const missingBackupPairs = plan.pairs.filter(
    (p) => p.integrityStatus === 'missing-backup',
  );
  if (missingBackupPairs.length > 0) {
    for (const pair of missingBackupPairs) {
      stderr.write(
        `error: backup file missing: ${shellQuotePath(pair.backup)}\n`,
      );
    }
    stderr.write(
      `error: could not complete restore — backup file(s) may have been consumed by a previous restore, or never existed. Investigate with \`ls ${plan.stateDir}/\` before retrying.\n`,
    );

    // Render every pair in the outcome so the summary line accurately
    // reflects the plan size. Missing-backup pairs surface with reason
    // `backup file missing`; every other pair (which we deliberately
    // did NOT execute) is shown with reason
    // `restore aborted — another pair is missing its backup`.
    const outcomes: RestoreOutcome[] = plan.pairs.map((pair) => {
      if (pair.integrityStatus === 'missing-backup') {
        return {
          agentId: pair.agentId,
          displayName: pair.displayName,
          backup: pair.backup,
          target: pair.target,
          status: 'failed' as const,
          reason: 'backup file missing',
        };
      }
      return {
        agentId: pair.agentId,
        displayName: pair.displayName,
        backup: pair.backup,
        target: pair.target,
        status: 'failed' as const,
        reason: 'restore aborted — another pair is missing its backup',
      };
    });

    stdout.write(formatHumanRestoreOutcome(plan, outcomes));
    return 1;
  }

  // No missing-backup pairs: execute `mv -v` per pair, sequentially.
  // Atomic whole-run: the first `mv` failure (non-zero exit) aborts
  // the batch and we surface the partial outcome + exit 1.
  const outcomes: RestoreOutcome[] = [];
  let aborted = false;
  for (const pair of plan.pairs) {
    const mvResult = await spawnMvVerbose(pair.backup, pair.target);
    if (mvResult.code === 0) {
      outcomes.push({
        agentId: pair.agentId,
        displayName: pair.displayName,
        backup: pair.backup,
        target: pair.target,
        status: 'ok',
        reason: mvResult.stdout.trim() || undefined,
      });
    } else {
      outcomes.push({
        agentId: pair.agentId,
        displayName: pair.displayName,
        backup: pair.backup,
        target: pair.target,
        status: 'failed',
        reason: (
          mvResult.stderr || `mv exited with code ${mvResult.code}`
        ).trim(),
      });
      aborted = true;
      break;
    }
  }

  stdout.write(formatHumanRestoreOutcome(plan, outcomes));
  if (aborted) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Internal helpers.
// ---------------------------------------------------------------------------

/**
 * Read `<stateDir>/apply/last.json` and return the resolved `runId`, or
 * `null` when the pointer file is absent. Non-ENOENT errors propagate.
 */
async function readLastJsonPointer(stateDir: string): Promise<string | null> {
  const pointerPath = join(stateDir, 'last.json');
  let raw: string;
  try {
    raw = await readFile(pointerPath, 'utf8');
  } catch (err) {
    if (isErrnoWithCode(err, 'ENOENT')) return null;
    throw err;
  }
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'runId' in parsed &&
    typeof parsed.runId === 'string'
  ) {
    return parsed.runId;
  }
  return null;
}

/** Compute `<stateDir>` from `XDG_STATE_HOME` (or platform default). */
function resolveStateHomeDir(): string {
  const xdg = process.env.XDG_STATE_HOME;
  if (typeof xdg === 'string' && xdg.length > 0) return xdg;
  const home = process.env.HOME;
  if (typeof home === 'string' && home.length > 0) {
    return join(home, '.local', 'state');
  }
  return '';
}

/**
 * Spawn `mv -v <backup> <target>` and resolve with the captured exit code
 * + stdout/stderr. Uses Node's `child_process.spawn` exactly as gate G3-6
 * mandates — never `fs.rename`.
 */
function spawnMvVerbose(
  backup: string,
  target: string,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('mv', ['-v', backup, target]);
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      resolve({ code: 1, stdout, stderr: stderr || err.message });
    });
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

/**
 * Production TTY confirm prompt. Reads one line from stdin via
 * `node:readline/promises` and returns the trimmed answer (or `null` on
 * EOF / error). Lazy-imported so the readline bundle stays out of the
 * unit-test path.
 */
function createStdinConfirmPrompt(): (
  message: string,
) => Promise<string | null> {
  return async (message: string): Promise<string | null> => {
    // F2 fix: surface readline initialization failures instead of
    // silently returning `null`. The `try` block is also split so the
    // init error is reported separately from the per-question error —
    // a broken stdin / TTY is a different class of failure from a
    // user pressing Ctrl-C mid-question.
    let rl: import('node:readline/promises').Interface;
    try {
      const readline = await import('node:readline/promises');
      rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `warning: failed to initialize confirmation prompt: ${message}\n`,
      );
      return null;
    }
    try {
      const answer = await rl.question(message);
      return answer.trim();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `warning: failed to read confirmation prompt: ${message}\n`,
      );
      return null;
    } finally {
      if (rl !== null) rl.close();
    }
  };
}

/**
 * Best-effort ENOENT detection: catches both `readFile` rejections (where
 * `code === 'ENOENT'`) and any error that carries a `NodeJS.ErrnoException`
 * property with the same code on it. Mirrors `apply-state.ts` /
 * `apply-log.ts` patterns so this module is consistent with the G1/G2
 * codec.
 */
function isErrnoWithCode(err: unknown, code: string): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    typeof (err as { code?: unknown }).code === 'string' &&
    (err as { code: string }).code === code
  );
}
