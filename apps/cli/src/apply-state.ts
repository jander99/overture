/**
 * G1 — `apply-state` module: per-run state file codec, atomic writer,
 * retention GC.
 *
 * Lives in the CLI (not in `@overture/agents`) because G1 is an
 * orchestrator-side artifact: the runtime envelope stays decoupled
 * (`ApplyResult` is not widened), and the state schema is intentionally
 * parallel so future format changes can branch on `schemaVersion` without
 * re-parsing the rest.
 *
 * Per-run file:  `<stateDir>/apply/<runId>.json`     (one JSON per apply)
 * Pointer file:  `<stateDir>/apply/last.json`         → `{ "runId": "..." }`
 *
 * Retention: GC keeps the `keep` (default 10) newest per-run files;
 * `last.json` is never pruned (lexical selector filters for `*.json` only).
 * Atomic write is inline write-then-rename (no shared helper).
 */
import { createHash, randomBytes } from 'node:crypto';
import {
  mkdir,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import type { OverturePaths } from '@overture/config';

import {
  formatBackupTimestamp,
  type ApplyAgentResult,
} from './apply-command.js';

// ---------------------------------------------------------------------------
// Types — final per gate G1-1.
// ---------------------------------------------------------------------------

/**
 * Per-run state record written to `<stateDir>/apply/<runId>.json`.
 *
 * Parallel to `ApplyResult` (not an extension). Lives in its own namespace so
 * a state file written today remains parseable after future schema changes
 * to the live `ApplyResult` envelope. The `schemaVersion` literal lets future
 * consumers branch on format version without re-parsing the rest.
 */
export interface ApplyStateRecord {
  /** Format version literal. Future-proofs the on-disk schema. */
  readonly schemaVersion: 1;
  /** `<formatBackupTimestamp(now)>-<randomHex8>`. Lexically sortable. */
  readonly runId: string;
  /** ISO 8601 UTC, e.g. `2026-07-04T18:30:00.123Z`. */
  readonly timestamp: string;
  /** Always `'apply'` for G1. G3 may extend to `'restore'`. */
  readonly mode: 'apply';
  /** Resolved profile name. */
  readonly profile: string;
  /** Absolute path to the canonical `overture.jsonc`. */
  readonly configPath: string;
  /** Echo of the effective `settings.backupBeforeWrite` value. */
  readonly backupBeforeWrite: boolean;
  /** Per-agent outcomes. Registry order. */
  readonly agents: readonly ApplyStateAgent[];
}

/** Single per-agent entry in an {@link ApplyStateRecord}. */
export interface ApplyStateAgent {
  readonly agentId: string;
  readonly displayName: string;
  /**
   * `ApplyStatus` value, stored as `string` so a future runtime enum widening
   * does not invalidate old state files.
   */
  readonly status: string;
  /** Absolute paths of every `targetPaths[*]` entry, resolved. */
  readonly targetPaths: readonly string[];
  /** Adjacent backup files created before Pass 2. `[]` when none. */
  readonly backupPaths: readonly string[];
  /** SHA-256 hex digest of the target bytes BEFORE the write. `null` when absent. */
  readonly preWriteSha256: string | null;
  /** SHA-256 hex digest of the target bytes AFTER the write. `null` when absent. */
  readonly postWriteSha256: string | null;
  /** Optional refusal reason (mirrors `ApplyAgentResult.reasonDetail`). */
  readonly reason?: string;
}

/**
 * Input shape for {@link buildApplyStateRecord}. `preSnapshots` and
 * `postSnapshots` index in parallel with the writer's
 * `result.targetPaths` array, so the caller is responsible for the
 * pre/post mapping during Pass 1 → Pass 2 orchestration.
 */
export interface BuildApplyStateRecordArgs {
  readonly runId: string;
  readonly now: Date;
  readonly mode: 'apply';
  readonly profileName: string;
  /** Resolved profile object (passed through to the record as opaque data). */
  readonly profile: unknown;
  readonly configPath: string;
  readonly backupBeforeWrite: boolean;
  readonly perAgent: readonly {
    readonly agentResult: ApplyAgentResult;
    /** Hex digests captured BEFORE Pass 2. Length MUST match `agentResult.result.targetPaths`. `undefined` when no snapshots were captured. */
    readonly preSnapshots: readonly string[] | undefined;
    /** Hex digests captured AFTER Pass 2. Length MUST match `agentResult.result.targetPaths`. `undefined` when no snapshots were captured. */
    readonly postSnapshots: readonly string[] | undefined;
  }[];
}

/** Result of {@link writeApplyState}. */
export interface WriteApplyStateResult {
  /** Absolute path of the per-run record on disk. */
  readonly recordPath: string;
  /** Absolute path of the `last.json` pointer on disk. */
  readonly pointerPath: string;
  /** Per-run file basenames that GC unlinked during this call. */
  readonly pruned: readonly string[];
}

// ---------------------------------------------------------------------------
// Pure helpers.
// ---------------------------------------------------------------------------

/**
 * SHA-256 hex digest of the file at `path`, or `null` when the file is
 * absent / unreadable. ENOENT (and errors wrapping ENOENT) map to `null`;
 * every other filesystem error propagates so the orchestrator can surface
 * the real failure.
 */
export async function sha256OfFile(path: string): Promise<string | null> {
  try {
    const bytes = await readFile(path);
    return createHash('sha256').update(bytes).digest('hex');
  } catch (err) {
    if (isErrnoWithCode(err, 'ENOENT')) return null;
    throw err;
  }
}

/**
 * Run identifier `<formatBackupTimestamp(now)>-<randomHex8>`. 8 hex chars =
 * 32 bits entropy; collisions inside a single millisecond are unlikely but
 * not impossible, so the orchestrator should treat a duplicate as a retry
 * trigger (out of scope for G1).
 */
export function generateRunId(now: Date): string {
  const ts = formatBackupTimestamp(now);
  const suffix = randomBytes(4).toString('hex');
  return `${ts}-${suffix}`;
}

/** `<stateDir>/apply` — pure path computation. */
export function defaultApplyStateDir(paths: OverturePaths): string {
  return join(paths.stateDir, 'apply');
}

/** Project an orchestrator-side input bundle into an {@link ApplyStateRecord}. */
export function buildApplyStateRecord(
  args: BuildApplyStateRecordArgs,
): ApplyStateRecord {
  const agents = args.perAgent.map((entry): ApplyStateAgent => {
    const { agentResult, preSnapshots, postSnapshots } = entry;
    const targetPaths = agentResult.result.targetPaths.map((t) => t.path);
    const preWriteSha256 = pickHash(preSnapshots);
    const postWriteSha256 = pickHash(postSnapshots);
    const base: ApplyStateAgent = {
      agentId: agentResult.agentId,
      displayName: agentResult.displayName,
      status: agentResult.status,
      targetPaths,
      backupPaths: agentResult.backupPaths,
      preWriteSha256,
      postWriteSha256,
    };
    // Optional `reason` is only set when populated; absent vs. `undefined`
    // is preserved by the `reason?` declaration.
    if (agentResult.reasonDetail !== undefined) {
      return { ...base, reason: agentResult.reasonDetail };
    }
    return base;
  });

  return {
    schemaVersion: 1,
    runId: args.runId,
    timestamp: args.now.toISOString(),
    mode: args.mode,
    profile: args.profileName,
    configPath: args.configPath,
    backupBeforeWrite: args.backupBeforeWrite,
    agents,
  };
}

// ---------------------------------------------------------------------------
// Filesystem helpers.
// ---------------------------------------------------------------------------

/**
 * Atomically write `record` to `<stateDir>/apply/<runId>.json`, update the
 * `<stateDir>/apply/last.json` pointer, then GC older per-run files so that
 * `keep` (default 10) remain. `pruneApplyState` is called internally; the
 * returned `pruned` list exposes what was unlinked for observability.
 */
export async function writeApplyState(
  record: ApplyStateRecord,
  stateDir: string,
  retention?: number,
): Promise<WriteApplyStateResult> {
  const keep = retention ?? 10;
  await mkdir(stateDir, { recursive: true });

  const recordPath = join(stateDir, `${record.runId}.json`);
  // Compact serialization (no indent, no trailing newline) so the on-disk
  // bytes equal `JSON.stringify(JSON.parse(bytes))` — a property case 4
  // asserts via the round-trip in `readApplyState`.
  await atomicWrite(recordPath, JSON.stringify(record));

  const pointerPath = join(stateDir, 'last.json');
  await atomicWrite(pointerPath, JSON.stringify({ runId: record.runId }));

  const pruned = await pruneApplyState(stateDir, keep);

  return { recordPath, pointerPath, pruned };
}

/**
 * Read a per-run state record from `recordPath`. Parses JSON and returns
 * the decoded {@link ApplyStateRecord}. Throws on malformed input.
 */
export async function readApplyState(
  recordPath: string,
): Promise<ApplyStateRecord> {
  const raw = await readFile(recordPath);
  const parsed: unknown = JSON.parse(raw.toString('utf8'));
  if (!isApplyStateRecordShape(parsed)) {
    throw new Error(
      `Invalid ApplyStateRecord at ${recordPath}: schemaVersion !== 1`,
    );
  }
  return parsed;
}

/**
 * GC `stateDir/apply/*.json` to the `keep` newest entries, ordered lexically
 * by file name (which embeds a sortable runId). Returns the basenames of
 * the files that were unlinked. `keep = 0` unlinks everything. The
 * `last.json` pointer is never pruned.
 */
export async function pruneApplyState(
  stateDir: string,
  keep: number,
): Promise<readonly string[]> {
  const entries = await readdir(stateDir);
  // Exclude the `last.json` pointer so the retention count applies only
  // to per-run records. Without this, `last.json` would compete with
  // per-run files for the `keep` budget and the documented invariant
  // ("last.json is never pruned") would be violated.
  const perRun = entries
    .filter((name) => name.endsWith('.json') && name !== 'last.json')
    .sort();
  if (perRun.length <= keep) return [];
  const survivors = perRun.slice(0, perRun.length - keep);
  await Promise.all(survivors.map((name) => unlink(join(stateDir, name))));
  return survivors;
}

// ---------------------------------------------------------------------------
// Internal helpers.
// ---------------------------------------------------------------------------

/**
 * Inline write-then-rename pattern. Mirrors `atomicWrite` in
 * `packages/agents/src/claude-code-write.ts`, but kept local to G1 (no
 * shared helper per the plan's "Must NOT introduce a shared atomic-write
 * helper" guardrail). Failure of the underlying `writeFile` or `rename`
 * propagates to the caller; a stray `.tmp-<hex>` will be ignored by
 * `pruneApplyState`'s `*.json` filter and persists harmlessly until the
 * next apply's GC misses it.
 */
async function atomicWrite(
  targetPath: string,
  contents: string,
): Promise<void> {
  const tempPath = `${targetPath}.tmp-${randomBytes(4).toString('hex')}`;
  await writeFile(tempPath, contents, 'utf8');
  await rename(tempPath, targetPath);
}

/**
 * Best-effort ENOENT detection: catches both `readFile` rejections (where
 * `code === 'ENOENT'`) and any error that carries a `NodeJS.ErrnoException`
 * property with the same code on it.
 */
function isErrnoWithCode(err: unknown, code: string): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const candidate = err as { code?: unknown };
  return candidate.code === code;
}

/**
 * Reduce an optional snapshots array to the first hex digest, or `null`
 * when no snapshots were captured (or the array is empty).
 */
function pickHash(snapshots: readonly string[] | undefined): string | null {
  if (snapshots === undefined) return null;
  if (snapshots.length === 0) return null;
  return snapshots[0] ?? null;
}

/**
 * Narrow `unknown` from `JSON.parse` to the structural shape we trust
 * on disk. Only the `schemaVersion` literal is enforced here; the rest
 * is taken on faith (the orchestrator wrote it seconds ago in the
 * common case).
 */
function isApplyStateRecordShape(value: unknown): value is ApplyStateRecord {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { schemaVersion?: unknown };
  return candidate.schemaVersion === 1;
}
