/**
 * G1 + G2 — `apply-state` module: per-run state file codec, atomic writer,
 * retention GC.
 *
 * Lives in the CLI (not in `@overture/agents`) because G1 is an
 * orchestrator-side artifact: the runtime envelope stays decoupled
 * (`ApplyResult` is not widened), and the state schema is intentionally
 * parallel so future format changes can branch on `schemaVersion` without
 * re-parsing the rest.
 *
 * Per-run file:  `<stateDir>/apply/<runId>.json`     (one JSON per apply)
 * Per-run log:   `<stateDir>/apply/<runId>.log`      (one log per apply, G2)
 * Pointer file:  `<stateDir>/apply/last.json`         → `{ "runId": "..." }`
 *
 * Retention: GC keeps the `keep` (default 10) newest per-run artifacts;
 * `last.json` is never pruned. G2 promotes `pruneApplyState` to
 * `pruneApplyArtifacts`, which prunes the `.json` and `.log` files for the
 * same `<runId>` together so the two views of history never diverge.
 * `pruneApplyState` is preserved as a thin `.json`-only wrapper so G1 callers
 * (e.g. Case 6 of `apply-state.spec.ts`) continue to work unchanged.
 * Atomic write is inline open+write+fsync+close+rename (no shared helper).
 */
import { createHash, randomBytes } from 'node:crypto';
import {
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  unlink,
} from 'node:fs/promises';
import { join } from 'node:path';

import type { PathResolutionContext } from '@overture/agents';
import type { OverturePaths } from '@overture/config';

import {
  formatBackupTimestamp,
  resolveTargetBase,
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
 *
 * G3 fix (F3 BLOCKING): `ctx` is the same `PathResolutionContext` the
 * apply orchestrator hands to the writer. We need it here to resolve
 * the writer's relative `loc.relativePath` (`targetPaths[*].path` for
 * OpenCode / Codex) into an absolute path before persisting — the
 * downstream `restore-last` helper consumes the state record directly
 * and cannot guess the apply-time cwd on its own.
 */
export interface BuildApplyStateRecordArgs {
  readonly runId: string;
  readonly now: Date;
  readonly mode: 'apply';
  readonly profileName: string;
  readonly configPath: string;
  readonly backupBeforeWrite: boolean;
  readonly ctx: PathResolutionContext;
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
    // G3 fix (F3 BLOCKING): resolve every writer-reported target path
    // against the apply-time `PathResolutionContext` so the persisted
    // `targetPaths[i]` matches the absolute `backupPaths[i]` the apply
    // already resolves. Writers diverge (Claude/Copilot emit absolute;
    // OpenCode/Codex emit `loc.relativePath`); `resolveTargetBase` is
    // idempotent on absolute inputs so the on-disk contract
    // "Absolute paths of every `targetPaths[*]` entry, resolved."
    // (lines 81-82) holds uniformly.
    const targetPaths = agentResult.result.targetPaths.map((t) =>
      resolveTargetBase(t.base, t.path, args.ctx),
    );
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
 * `<stateDir>/apply/last.json` pointer, then GC older per-run artifacts so
 * that `keep` (default 10) remain. `pruneApplyArtifacts` is called
 * internally; the returned `pruned` list exposes what was unlinked for
 * observability.
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

  const pruned = await pruneApplyArtifacts(stateDir, keep);

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
  if (!isApplyStateRecord(parsed)) {
    throw new Error(
      `Invalid ApplyStateRecord at ${recordPath}: schemaVersion !== 1`,
    );
  }
  return parsed;
}

/**
 * GC `stateDir/apply/*.json` AND `*.log` to the `keep` newest runIds,
 * paired by basename-without-extension. Returns the basenames of the files
 * that were unlinked. `keep = 0` unlinks everything. The `last.json`
 * pointer is never pruned (excluded from the json set so it doesn't compete
 * for the retention budget).
 *
 * Grouping algorithm: read every `.json` (excluding `last.json`) and every
 * `.log` in the directory, bucket each filename by its extension-stripped
 * basename (the `<runId>`), sort runIds lexically (which encodes a sortable
 * timestamp per `generateRunId`), then slice off the oldest when
 * `runIds.length > keep` and unlink EVERY file in those buckets.
 *
 * G2 promotion: this function replaces G1's `.json`-only `pruneApplyState`
 * so the `.json` and `.log` for the same `<runId>` are unlinked together —
 * the two views of history never diverge. Backward-compat: orphan `.json`
 * files (legacy G1-only dirs) and orphan `.log` files (e.g. a half-completed
 * G2 run) are handled identically — the pruner treats them as single-file
 * buckets.
 */
export async function pruneApplyArtifacts(
  stateDir: string,
  keep: number,
): Promise<readonly string[]> {
  const entries = await readdir(stateDir);

  // Bucket each filename by its extension-stripped basename (the runId).
  // Exclude the `last.json` pointer so the retention count applies only to
  // per-run artifacts — `last.json` is a pointer, never pruned.
  interface Bucket {
    readonly json?: string;
    readonly log?: string;
  }
  const buckets = new Map<string, Bucket>();
  for (const name of entries) {
    if (name === 'last.json') continue;
    if (name.endsWith('.json')) {
      const runId = name.slice(0, -'.json'.length);
      const prior = buckets.get(runId) ?? {};
      buckets.set(runId, { ...prior, json: name });
    } else if (name.endsWith('.log')) {
      const runId = name.slice(0, -'.log'.length);
      const prior = buckets.get(runId) ?? {};
      buckets.set(runId, { ...prior, log: name });
    }
  }

  // runIds are lexically sortable (the runId embeds a sortable timestamp
  // per `generateRunId`). G1's Case 5 already proves this.
  const sortedRunIds = [...buckets.keys()].sort();
  if (sortedRunIds.length <= keep) return [];

  const toUnlink = sortedRunIds.slice(0, sortedRunIds.length - keep);
  const unlinked: string[] = [];
  for (const runId of toUnlink) {
    const bucket = buckets.get(runId);
    if (!bucket) continue;
    if (bucket.json !== undefined) unlinked.push(bucket.json);
    if (bucket.log !== undefined) unlinked.push(bucket.log);
  }
  await Promise.all(unlinked.map((name) => unlink(join(stateDir, name))));
  return unlinked;
}

/**
 * G1 backward-compat shim: prune only the `.json` files (the G1 behavior).
 * Delegates to {@link pruneApplyArtifacts} and filters out `.log` results
 * so existing G1 callers (e.g. Case 6 of `apply-state.spec.ts`) continue
 * to observe `.json`-only retention.
 *
 * New code should call {@link pruneApplyArtifacts} directly so paired `.log`
 * retention is enforced.
 */
export async function pruneApplyState(
  stateDir: string,
  keep: number,
): Promise<readonly string[]> {
  const pruned = await pruneApplyArtifacts(stateDir, keep);
  return pruned.filter((name) => !name.endsWith('.log'));
}

// ---------------------------------------------------------------------------
// Internal helpers.
// ---------------------------------------------------------------------------

/**
 * Inline atomic write — open temp → write → fsync → close → rename. Mirrors
 * the G1 plan's "write-to-temp + fsync before rename" contract; fsync
 * is what guarantees the bytes
 * survive a crash between the temp write and the rename. Kept local to G1
 * (no shared helper per the plan's "Must NOT introduce a shared atomic-write
 * helper" guardrail). On failure the temp file is unlinked best-effort so
 * no `.tmp-<hex>` debris persists, and the underlying error is rethrown
 * with a `[atomicWrite]` tag so callers can identify the failure surface.
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
    // Attach the underlying error so callers (and logs) can inspect the
    // root cause via `error.cause` (Node 16.9+, ES2022 standard).
    throw new Error(`[atomicWrite] failed: ${message}`, { cause: err });
  }
}

/**
 * Best-effort ENOENT detection: catches both `readFile` rejections (where
 * `code === 'ENOENT'`) and any error that carries a `NodeJS.ErrnoException`
 * property with the same code on it. Uses the canonical `'code' in err`
 * safe-property-check pattern (see `packages/os/src/detect.ts`,
 * `packages/agents/src/read-mcp-config.ts`) to avoid an `unknown` cast on
 * `err.code`.
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
 * common case). Uses the canonical `'schemaVersion' in value`
 * safe-property-check pattern to avoid an `unknown` cast on
 * `value.schemaVersion`.
 */
function isApplyStateRecord(value: unknown): value is ApplyStateRecord {
  if (typeof value !== 'object' || value === null) return false;
  if (!('schemaVersion' in value)) return false;
  return value.schemaVersion === 1;
}
