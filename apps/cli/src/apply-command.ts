/**
 * F1 + F2 — `overture apply` subcommand.
 *
 * Ships the gate-5 type surface (`ApplyDryRunResult`, `ApplyDryRunAgentResult`,
 * `RunApplyOptions`), the args-parsing + exit-code plumbing (`runApply`,
 * `exitCodeForApplyDryRun`, `APPLY_USAGE`), the human renderer
 * (`formatHumanApplyDryRun`), and the orchestration that wires the canonical
 * config to per-agent writers.
 *
 * F1 ships the `--dry-run` preview path. F2 adds the real-write path with
 * adjacent timestamped backups: two-pass per writer (dryRun: true → backup
 * snapshot → dryRun: false). The backup-before-write gate is controlled by
 * `settings.backupBeforeWrite` (default `true`); when `false`, the
 * orchestrator skips the backup step but still performs the write.
 *
 * Exit codes:
 *   - `0` — orchestration completed and every per-agent result is clean
 *           (`would-update` / `updated` / `no-change`).
 *   - `1` — orchestration completed but at least one per-agent result is a
 *           refusal (`not-targetable`, `parse-error`, `unsupported-shape`,
 *           `unsupported-format`, `backup-failed`), OR the canonical config
 *           is absent. The JSON / human envelope is still emitted so callers
 *           can read the failure model.
 *   - `2` — usage errors (unknown flags, `--json` without `--dry-run`),
 *           unknown profile name, or any orchestration failure that prevents
 *           the model from being built.
 */
import { randomBytes } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';

import {
  defaultOverturePaths,
  loadOvertureConfig,
  type OvertureConfig,
  type OverturePaths,
  type OvertureProfile,
} from '@overture/config';
import {
  agentRegistry,
  type AgentMcpWriteResult,
  type AgentMcpWriteServer,
  type PathResolutionContext,
} from '@overture/agents';

import { defaultPathResolutionContext } from './platforms/detect.js';

export type { StringWriter } from './scan-command.js';
import type { StringWriter } from './scan-command.js';

// ---------------------------------------------------------------------------
// Gate-5 — Apply dry-run output types.
// ---------------------------------------------------------------------------

/**
 * Per-agent outcome of a dry-run write.
 *
 * - `would-update`      — writer returned `changed: true` with at least one
 *                         entry written (dry-run so nothing was actually
 *                         written to disk; this is a preview).
 * - `no-change`         — writer returned `changed: false`. Exit code 0.
 * - `not-targetable`    — writer returned `reason: 'not-targetable'` OR the
 *                         agent id was unknown OR the writer was missing.
 * - `parse-error`       — writer returned `reason: 'parse-error'`.
 * - `unsupported-shape` — writer returned `reason: 'unsupported-shape'`.
 * - `unsupported-format`— writer returned `reason: 'unsupported-format'`.
 *
 * The last four are refusal statuses that propagate to a non-zero exit code
 * via {@link exitCodeForApplyDryRun}.
 */
export type ApplyDryRunStatus =
  | 'would-update'
  | 'no-change'
  | 'not-targetable'
  | 'parse-error'
  | 'unsupported-shape'
  | 'unsupported-format'
  | 'conflict';

/** Single per-agent entry in an {@link ApplyDryRunResult}. */
export interface ApplyDryRunAgentResult {
  readonly agentId: string;
  readonly displayName: string;
  readonly status: ApplyDryRunStatus;
  /** The writer envelope returned by `agent.mcp.write`, unchanged. */
  readonly result: AgentMcpWriteResult;
  /**
   * Optional human-readable reason. Populated when the writer omitted a
   * `reason` (e.g. unknown agent id, missing `mcp.write` slot) so the
   * human/JSON envelope still explains the refusal.
   */
  readonly reasonDetail?: string;
}

/** Top-level envelope emitted by `overture apply --dry-run [--json]`. */
export interface ApplyDryRunResult {
  readonly profile: string;
  readonly configPath: string;
  readonly disabledServers: readonly string[];
  readonly results: readonly ApplyDryRunAgentResult[];
}

// ---------------------------------------------------------------------------
// F2 — Apply real-write output types.
// ---------------------------------------------------------------------------

/**
 * Per-agent outcome of a real-write.
 *
 * - `updated`           — Pass 2 (real-write) succeeded and modified the
 *                         target file.
 * - `no-change`         — Pass 1 (dry-run discovery) returned `changed: false`
 *                         OR Pass 2 reported `changed: false`; nothing to do.
 * - `backup-failed`     — `fs.copyFile` failed for one or more target paths
 *                         during the backup step; Pass 2 was skipped.
 * - `not-targetable`    — unknown agent id OR missing `mcp.write` OR writer
 *                         returned `reason: 'not-targetable'`.
 * - `parse-error`       — writer returned `reason: 'parse-error'`.
 * - `unsupported-shape` — writer returned `reason: 'unsupported-shape'`.
 * - `unsupported-format`— writer returned `reason: 'unsupported-format'`.
 */
export type ApplyStatus =
  | 'updated'
  | 'no-change'
  | 'backup-failed'
  | 'not-targetable'
  | 'parse-error'
  | 'unsupported-shape'
  | 'unsupported-format'
  | 'conflict';

/** Single per-agent entry in an {@link ApplyResult}. */
export interface ApplyAgentResult {
  readonly agentId: string;
  readonly displayName: string;
  readonly status: ApplyStatus;
  /**
   * The writer envelope returned by `agent.mcp.write`. For clean updates,
   * this is the real-write (Pass 2) envelope. For refusals / no-change, it
   * is the Pass 1 dry-run envelope (Pass 2 was skipped).
   */
  readonly result: AgentMcpWriteResult;
  /**
   * Absolute paths of the backup files created before Pass 2. Empty when
   * no backups were created (either `backupBeforeWrite: false` or Pass 2
   * was skipped due to a refusal / no-change).
   */
  readonly backupPaths: readonly string[];
  /**
   * Optional human-readable reason. Populated when the writer omitted a
   * `reason` (e.g. unknown agent id, missing `mcp.write` slot) or when the
   * backup step failed and Pass 2 was skipped.
   */
  readonly reasonDetail?: string;
}

/** Top-level envelope emitted by `overture apply` (no `--dry-run`). */
export interface ApplyResult {
  readonly profile: string;
  readonly configPath: string;
  readonly disabledServers: readonly string[];
  /** Echo of the effective `settings.backupBeforeWrite` value. */
  readonly backupBeforeWrite: boolean;
  readonly results: readonly ApplyAgentResult[];
}

/**
 * Injection seam for tests and production. The F2 slice adds `now` so
 * deterministic-timestamp tests can pin the backup timestamp without
 * relying on `vi.setSystemTime`. The `prompt` field is reserved for future
 * interactive flows; F1 ships it as `unknown` so callers can reference it
 * without churn.
 */
export interface RunApplyOptions {
  readonly prompt?: unknown;
  /**
   * Optional fixed clock for the backup step. When `undefined`, the
   * orchestrator uses `new Date()` (real wall clock).
   */
  readonly now?: Date;
}

// ---------------------------------------------------------------------------
// Constants.
// ---------------------------------------------------------------------------

export const APPLY_USAGE = 'Usage: overture apply [--dry-run] [--json]\n';

/** Number of retries when picking a unique backup path. */
const BACKUP_COLLISION_RETRIES = 3;

// ---------------------------------------------------------------------------
// Pure helpers.
// ---------------------------------------------------------------------------

/**
 * Decide the exit code for a successful dry-run based on per-agent outcomes.
 *
 * - `0` — every target is `would-update` or `no-change` (even mixed).
 * - `1` — at least one target is a refusal (`not-targetable`, `parse-error`,
 *         `unsupported-shape`, `unsupported-format`). The JSON envelope is
 *         still emitted to stdout so consumers can inspect what failed.
 *
 * Other exit codes (`2` for usage errors, missing canonical config,
 * orchestration failures) are owned by {@link runApply}.
 */
export function exitCodeForApplyDryRun(
  results: readonly ApplyDryRunAgentResult[],
): 0 | 1 {
  const refusalStatuses: ReadonlySet<ApplyDryRunStatus> = new Set([
    'not-targetable',
    'parse-error',
    'unsupported-shape',
    'unsupported-format',
  ]);
  return results.some((r) => refusalStatuses.has(r.status)) ? 1 : 0;
}

/**
 * Decide the exit code for a successful real-write based on per-agent
 * outcomes. Refusal set adds `backup-failed` to the dry-run refusal set;
 * clean statuses (`updated`, `no-change`) exit 0.
 */
export function exitCodeForApply(results: readonly ApplyAgentResult[]): 0 | 1 {
  const refusalStatuses: ReadonlySet<ApplyStatus> = new Set([
    'backup-failed',
    'not-targetable',
    'parse-error',
    'unsupported-shape',
    'unsupported-format',
  ]);
  return results.some((r) => refusalStatuses.has(r.status)) ? 1 : 0;
}

/**
 * Format `date` as `YYYYMMDD-HHmmssSSS` using UTC components. Lexically
 * sortable; matches the openclaw-style backup timestamp proposed in the
 * F2 plan (gate F2-2). Pure function — no `Date.now()` calls.
 */
export function formatBackupTimestamp(date: Date): string {
  const pad2 = (n: number): string => n.toString().padStart(2, '0');
  const pad3 = (n: number): string => n.toString().padStart(3, '0');
  const datePart =
    date.getUTCFullYear().toString() +
    pad2(date.getUTCMonth() + 1) +
    pad2(date.getUTCDate());
  const timePart =
    pad2(date.getUTCHours()) +
    pad2(date.getUTCMinutes()) +
    pad2(date.getUTCSeconds());
  return `${datePart}-${timePart}${pad3(date.getUTCMilliseconds())}`;
}

/**
 * Pick a unique backup path for `targetPath`. Returns
 * `<target>.bak.<YYYYMMDD-HHmmssSSS>` by default. If that candidate is in
 * the `existing` set, append `-<randomHex(4)>` (Node
 * `crypto.randomBytes(2).toString('hex')`) and retry up to
 * {@link BACKUP_COLLISION_RETRIES} times. After the retry budget is
 * exhausted, returns the most recent candidate (the caller decides what
 * to do with it; the orchestrator returns `backup-failed`).
 *
 * Pure: filesystem presence is consulted through the optional `existing`
 * parameter so callers can pre-list the directory and pass results.
 */
export function backupPathFor(
  targetPath: string,
  now: Date,
  existing: readonly string[] = [],
): string {
  const base = `${targetPath}.bak.${formatBackupTimestamp(now)}`;
  const collisionSet = new Set(existing);
  let candidate = base;
  for (let i = 0; i < BACKUP_COLLISION_RETRIES; i++) {
    if (!collisionSet.has(candidate)) return candidate;
    candidate = `${base}-${randomBytes(2).toString('hex')}`;
  }
  return candidate;
}

/**
 * Tagged error thrown by {@link copyFileWithClassification}. `backup-failed`
 * is a CLI-local status (per project memory 112): it never appears in
 * `WriteReason`, only in the {@link ApplyStatus} union.
 */
export interface BackupFailedError extends Error {
  readonly kind: 'backup-failed';
  readonly code: NodeJS.ErrnoException['code'];
  readonly sourcePath: string;
  readonly backupPath: string;
}

/**
 * Wrap `fs.copyFile` so a per-target backup failure surfaces as a tagged
 * error the orchestrator can map to `status: 'backup-failed'`. Other
 * (non-ErrnoException) errors propagate unchanged — they are unexpected
 * programming bugs, not user-actionable filesystem states.
 */
export async function copyFileWithClassification(
  src: string,
  dest: string,
): Promise<void> {
  try {
    await copyFile(src, dest);
  } catch (err) {
    const code: NodeJS.ErrnoException['code'] =
      typeof err === 'object' &&
      err !== null &&
      typeof (err as Record<string, unknown>).code === 'string'
        ? ((err as Record<string, unknown>)
            .code as NodeJS.ErrnoException['code'])
        : undefined;
    const tagged: BackupFailedError = Object.assign(
      new Error(
        `backup failed: copyFile(${src} -> ${dest}): ${err instanceof Error ? err.message : String(err)}`,
      ),
      {
        kind: 'backup-failed' as const,
        code,
        sourcePath: src,
        backupPath: dest,
      },
    );
    throw tagged;
  }
}

/**
 * Render an {@link ApplyDryRunResult} as a human-readable report.
 *
 * Gate-5 layout (per `docs/overture-implementation-slices.md` and the
 * F1 plan's "Gate 5 — Apply dry-run output shape" section):
 *
 *   1. Heading (`Apply dry-run (no changes written)`).
 *   2. Profile, config path, and `disabledServers` echo lines.
 *   3. One section per agent:
 *      - clean statuses (`would-update`, `no-change`) — `target`,
 *        `changed`, `bytes` (signed), and `servers` lines.
 *      - refusal statuses (`not-targetable`, `parse-error`,
 *        `unsupported-shape`, `unsupported-format`) — `reason` line
 *        sourced from `reasonDetail` (preferred) or the writer's
 *        `reason` fallback.
 *   4. Summary line counting each status bucket.
 *   5. Footer pointing at `overture apply`.
 *
 * Plain text only — no ANSI colors. Resolved target paths come from
 * `result.targetPaths[0].path` (preferred) or `result.resolvedPath`;
 * raw original/written bytes are never embedded (F1 contract).
 */
export function formatHumanApplyDryRun(result: ApplyDryRunResult): string {
  const lines: string[] = [];

  lines.push('Apply dry-run (no changes written)');
  lines.push(`Profile: ${result.profile}`);
  lines.push(`Config:  ${result.configPath}`);
  lines.push(
    `Disabled: ${
      result.disabledServers.length === 0
        ? '[]'
        : result.disabledServers.join(', ')
    }`,
  );
  lines.push('');

  const isCleanStatus = (
    status: ApplyDryRunStatus,
  ): status is 'would-update' | 'no-change' =>
    status === 'would-update' || status === 'no-change';

  for (const agent of result.results) {
    lines.push(`[${agent.agentId}]`);
    lines.push(`  status:    ${agent.status}`);
    if (isCleanStatus(agent.status)) {
      const target = agent.result.targetPaths[0];
      const targetPath =
        target?.path ?? agent.result.resolvedPath ?? '(unknown)';
      lines.push(`  target:    ${targetPath}`);
      lines.push(`  changed:   ${String(agent.result.changed)}`);
      const bytes = agent.result.bytesChanged ?? 0;
      const sign = bytes > 0 && agent.result.changed ? '+' : '';
      lines.push(`  bytes:     ${sign}${bytes}`);
      if (agent.result.serversWritten.length > 0) {
        lines.push(`  servers:   ${agent.result.serversWritten.join(', ')}`);
      }
    } else {
      const reason = agent.reasonDetail ?? agent.result.reason ?? '(no reason)';
      lines.push(`  reason:    ${reason}`);
    }
    lines.push('');
  }

  const counts = {
    wouldUpdate: result.results.filter((r) => r.status === 'would-update')
      .length,
    noChange: result.results.filter((r) => r.status === 'no-change').length,
    refusals: result.results.filter(
      (r) =>
        r.status === 'not-targetable' ||
        r.status === 'parse-error' ||
        r.status === 'unsupported-shape' ||
        r.status === 'unsupported-format',
    ).length,
  };
  const total = result.results.length;
  lines.push(
    `Summary: ${String(total)} agent${total === 1 ? '' : 's'}, ` +
      `${String(counts.wouldUpdate)} would-update, ` +
      `${String(counts.noChange)} no-change, ` +
      `${String(counts.refusals)} refusal(s).`,
  );
  lines.push('Run `overture apply` to write the planned changes.');
  return `${lines.join('\n')}\n`;
}

/**
 * Render an {@link ApplyResult} as a human-readable report.
 *
 * Layout (per F2 gate F2-4 — human-only):
 *
 *   1. Heading — `Apply (changes written)` when any agent is `updated`,
 *      otherwise `Apply (no changes written)`.
 *   2. Profile, config path, `disabledServers`, and `backup` echo lines.
 *   3. One section per agent:
 *      - clean statuses (`updated`, `no-change`) — `target`,
 *        `backup` (only when `backupPaths.length > 0`), `changed`,
 *        `bytes` (signed), and `servers` lines.
 *      - refusal statuses (`backup-failed`, `not-targetable`,
 *        `parse-error`, `unsupported-shape`, `unsupported-format`) —
 *        `reason` line sourced from `reasonDetail` (preferred) or the
 *        writer's `reason` fallback.
 *   4. Summary line counting each status bucket.
 *   5. Footer pointing at `overture apply --dry-run`.
 *
 * Plain text only — no ANSI colors. Raw original/written bytes are never
 * embedded (F1 carry-over).
 */
export function formatHumanApply(result: ApplyResult): string {
  const lines: string[] = [];
  const anyUpdated = result.results.some((r) => r.status === 'updated');
  lines.push(
    anyUpdated ? 'Apply (changes written)' : 'Apply (no changes written)',
  );
  lines.push(`Profile: ${result.profile}`);
  lines.push(`Config:  ${result.configPath}`);
  lines.push(
    `Disabled: ${
      result.disabledServers.length === 0
        ? '[]'
        : result.disabledServers.join(', ')
    }`,
  );
  lines.push(`Backup:   ${result.backupBeforeWrite ? 'enabled' : 'disabled'}`);
  lines.push('');

  const isCleanStatus = (
    status: ApplyStatus,
  ): status is 'updated' | 'no-change' =>
    status === 'updated' || status === 'no-change';

  for (const agent of result.results) {
    lines.push(`[${agent.agentId}]`);
    lines.push(`  status:    ${agent.status}`);
    if (isCleanStatus(agent.status)) {
      const target = agent.result.targetPaths[0];
      const targetPath =
        target?.path ?? agent.result.resolvedPath ?? '(unknown)';
      lines.push(`  target:    ${targetPath}`);
      if (agent.backupPaths.length > 0) {
        for (const bp of agent.backupPaths) {
          lines.push(`  backup:    ${bp}`);
        }
      }
      lines.push(`  changed:   ${String(agent.result.changed)}`);
      const bytes = agent.result.bytesChanged ?? 0;
      const sign = bytes > 0 && agent.result.changed ? '+' : '';
      lines.push(`  bytes:     ${sign}${bytes}`);
      if (agent.result.serversWritten.length > 0) {
        lines.push(`  servers:   ${agent.result.serversWritten.join(', ')}`);
      }
    } else {
      const reason = agent.reasonDetail ?? agent.result.reason ?? '(no reason)';
      lines.push(`  reason:    ${reason}`);
    }
    lines.push('');
  }

  const counts = {
    updated: result.results.filter((r) => r.status === 'updated').length,
    noChange: result.results.filter((r) => r.status === 'no-change').length,
    refusals: result.results.filter(
      (r) =>
        r.status === 'backup-failed' ||
        r.status === 'not-targetable' ||
        r.status === 'parse-error' ||
        r.status === 'unsupported-shape' ||
        r.status === 'unsupported-format',
    ).length,
  };
  const total = result.results.length;
  lines.push(
    `Summary: ${String(total)} agent${total === 1 ? '' : 's'}, ` +
      `${String(counts.updated)} updated, ` +
      `${String(counts.noChange)} no-change, ` +
      `${String(counts.refusals)} refusal(s).`,
  );
  lines.push(
    'Run `overture apply --dry-run` to preview changes without writing.',
  );
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Orchestration helpers.
// ---------------------------------------------------------------------------

/** Stringify an unknown thrown value. Mirrors `bootstrap-command.ts:281-283`. */
function messageForError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Map a writer's {@link AgentMcpWriteResult} to the gate-5
 * {@link ApplyDryRunStatus}. Refusal reasons win over the "did anything
 * happen?" flags so `parse-error` propagates even when the writer happens
 * to leave `written` at 0.
 *
 * Writer conventions diverge on `changed` in dry-run: Claude Code / GitHub
 * Copilot CLI leave `changed: false` and rely on `serversWritten` /
 * `bytesChanged` metadata to signal a planned update, while OpenCode and
 * OpenAI Codex report `changed: true` for the same case. We OR all four
 * signals (`changed`, `written > 0`, `serversWritten.length > 0`,
 * `bytesChanged > 0`) so a planned dry-run update is never misclassified
 * as `no-change`. Real (non-dry-run) writes also satisfy `changed: true`,
 * so this does not conflict with the live-write path.
 *
 * `no-change` is intentionally NOT a refusal status: a writer that confirms
 * the target already matches the canonical intent exits 0.
 */
function statusFromWriterResult(
  result: AgentMcpWriteResult,
): ApplyDryRunStatus {
  const reason = result.reason;
  if (reason === 'parse-error') return 'parse-error';
  if (reason === 'unsupported-shape') return 'unsupported-shape';
  if (reason === 'unsupported-format') return 'unsupported-format';
  if (reason === 'not-targetable') return 'not-targetable';
  const plannedUpdate =
    result.changed ||
    result.written > 0 ||
    result.serversWritten.length > 0 ||
    (result.bytesChanged !== undefined && result.bytesChanged > 0);
  return plannedUpdate ? 'would-update' : 'no-change';
}

/**
 * Map a writer's {@link AgentMcpWriteResult} to the F2 {@link ApplyStatus}.
 * Mirrors {@link statusFromWriterResult} but maps `would-update` →
 * `updated`. Pass 2 (`dryRun: false`) writers always set `changed: true`
 * when they actually wrote, so the plannedUpdate OR signals reduce to a
 * `changed` check.
 */
function statusFromRealWriterResult(result: AgentMcpWriteResult): ApplyStatus {
  const reason = result.reason;
  if (reason === 'parse-error') return 'parse-error';
  if (reason === 'unsupported-shape') return 'unsupported-shape';
  if (reason === 'unsupported-format') return 'unsupported-format';
  if (reason === 'not-targetable') return 'not-targetable';
  const plannedUpdate =
    result.changed ||
    result.written > 0 ||
    result.serversWritten.length > 0 ||
    (result.bytesChanged !== undefined && result.bytesChanged > 0);
  return plannedUpdate ? 'updated' : 'no-change';
}

/**
 * Build the canonical-filtered server list shared by both Pass 1 (dry-run
 * discovery) and Pass 2 (real-write). Keeping the filter in one helper
 * guarantees the disabled-server invariant holds across both passes.
 */
function buildFilteredServers(
  profile: OvertureProfile,
): readonly AgentMcpWriteServer[] {
  return Object.entries(profile.mcpServers)
    .filter(([name]) => !profile.sync.disabledServers.includes(name))
    .map(([name, server]) => ({ name, server }));
}

/** Inferred shape of a single entry in `AgentMcpWriteResult.targetPaths`. */
type WriteTargetPath = AgentMcpWriteResult['targetPaths'][number];

/**
 * Resolve a `WriteTargetPath` to its absolute path on disk given a
 * `PathResolutionContext`. Mirrors `apps/cli/src/platforms/detect.ts`'s
 * `resolveMcpLocationPath` so the orchestrator agrees with the writers
 * about where the file lives.
 *
 * Writer convention diverges: OpenCode / Codex emit `targetPaths[*].path`
 * as the raw `loc.relativePath` (relative — e.g. `opencode/opencode.json`),
 * while Claude / Copilot emit the fully-resolved absolute path. We detect
 * the absolute-vs-relative distinction here and resolve once, so `fs.copyFile`
 * always sees an absolute path. The `base` field is a hint for relative
 * paths; absolute paths bypass it.
 */
function resolveTargetBase(
  base: WriteTargetPath['base'],
  filePath: string,
  ctx: PathResolutionContext,
): string {
  if (isAbsolute(filePath)) return filePath;
  switch (base) {
    case 'home':
      return join(ctx.homeDir, filePath);
    case 'config':
      return join(ctx.configDir, filePath);
    case 'workspace':
      return join(ctx.workspaceDir, filePath);
    case 'absolute':
      return filePath;
  }
}

/**
 * Collect the absolute target paths a writer intends to back up. Dedupes
 * across `targetPaths[*]` (resolved via the writer's `base` field) and
 * the legacy `resolvedPath` fallback so a writer that emits both does not
 * double-back-up the same file. `targetPaths[*].path` is treated as a
 * relative path against its declared `base` — the writer surfaces only the
 * raw `loc.relativePath` there (see `packages/agents/src/opencode-write.ts`
 * line 435 for the convention), so resolving it here is required for
 * `fs.copyFile` to find the source.
 */
function collectBackupTargets(
  result: AgentMcpWriteResult,
  ctx: PathResolutionContext,
): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tp of result.targetPaths) {
    if (tp.path.length === 0) continue;
    const absolute = resolveTargetBase(tp.base, tp.path, ctx);
    if (!seen.has(absolute)) {
      seen.add(absolute);
      out.push(absolute);
    }
  }
  if (result.resolvedPath !== undefined && !seen.has(result.resolvedPath)) {
    seen.add(result.resolvedPath);
    out.push(result.resolvedPath);
  }
  return out;
}

/**
 * Run a single per-agent dry-run write for the named target. Synthesizes a
 * `not-targetable` envelope when the agent id is unknown or the writer
 * slot is absent so the orchestrator can record every target in the report
 * (per plan decision point 2: "unknown agent id is a refusal, not a hard
 * error").
 */
async function applyToAgentDryRun(
  ctx: PathResolutionContext,
  profile: OvertureProfile,
  agentId: string,
): Promise<ApplyDryRunAgentResult> {
  const entry = agentRegistry.find((a) => a.id === agentId);
  if (entry === undefined) {
    return {
      agentId,
      displayName: agentId,
      status: 'not-targetable',
      result: {
        written: 0,
        changed: false,
        dryRun: true,
        serversWritten: [],
        targetPaths: [],
        reason: 'not-targetable',
      },
      reasonDetail: `unknown agent id '${agentId}' in profile.sync.targets`,
    };
  }

  if (entry.mcp.write === undefined) {
    return {
      agentId,
      displayName: entry.displayName,
      status: 'not-targetable',
      result: {
        written: 0,
        changed: false,
        dryRun: true,
        serversWritten: [],
        targetPaths: [],
        reason: 'not-targetable',
      },
      reasonDetail: 'no writer registered',
    };
  }

  const servers = buildFilteredServers(profile);

  const writerResult = await entry.mcp.write(ctx, {
    servers,
    dryRun: true,
    pathContext: ctx,
  });

  return {
    agentId,
    displayName: entry.displayName,
    status: statusFromWriterResult(writerResult),
    result: writerResult,
  };
}

/**
 * Two-pass per-agent write: Pass 1 (dry-run discovery) → backup snapshot
 * (when `backupBeforeWrite` is `true` and Pass 1 plans an update) → Pass 2
 * (real-write). Synthesizes `not-targetable` envelopes for unknown / missing
 * writers so the orchestrator records every target.
 *
 * Backup failure short-circuits to `status: 'backup-failed'` and skips
 * Pass 2; the target file is left untouched (the writer's atomic-rename
 * rename path never runs). The seeded filesystem stays intact so the
 * operator can investigate.
 */
async function applyToAgentReal(
  ctx: PathResolutionContext,
  profile: OvertureProfile,
  agentId: string,
  options: {
    readonly backupBeforeWrite: boolean;
    readonly now: Date;
  },
): Promise<ApplyAgentResult> {
  const entry = agentRegistry.find((a) => a.id === agentId);
  if (entry === undefined) {
    return {
      agentId,
      displayName: agentId,
      status: 'not-targetable',
      result: {
        written: 0,
        changed: false,
        dryRun: true,
        serversWritten: [],
        targetPaths: [],
        reason: 'not-targetable',
      },
      backupPaths: [],
      reasonDetail: `unknown agent id '${agentId}' in profile.sync.targets`,
    };
  }

  if (entry.mcp.write === undefined) {
    return {
      agentId,
      displayName: entry.displayName,
      status: 'not-targetable',
      result: {
        written: 0,
        changed: false,
        dryRun: true,
        serversWritten: [],
        targetPaths: [],
        reason: 'not-targetable',
      },
      backupPaths: [],
      reasonDetail: 'no writer registered',
    };
  }

  const servers = buildFilteredServers(profile);

  // Pass 1 — dry-run discovery.
  const dryResult = await entry.mcp.write(ctx, {
    servers,
    dryRun: true,
    pathContext: ctx,
  });
  const dryStatus = statusFromWriterResult(dryResult);
  // Refusal / no-change / parse-error / unsupported-* → no backup, no Pass 2.
  if (dryStatus !== 'would-update') {
    return {
      agentId,
      displayName: entry.displayName,
      status:
        dryStatus === 'no-change'
          ? 'no-change'
          : mapDryRefusalToApply(dryStatus),
      result: dryResult,
      backupPaths: [],
    };
  }

  // Pass 1 says we should write. Optionally back up each target first.
  const backupPaths: string[] = [];
  if (options.backupBeforeWrite) {
    const targets = collectBackupTargets(dryResult, ctx);
    for (const target of targets) {
      // Resolve the candidate path against any existing backups on disk.
      // We can't synchronously readdir here (async caller) — instead, scan
      // the parent directory lazily and feed the result to backupPathFor.
      const dir = dirname(target);
      const base = basename(target);
      const existing: readonly string[] = (() => {
        try {
          return readdirSync(dir)
            .filter((entry) => entry.startsWith(`${base}.bak.`))
            .map((entry) => `${dir}/${entry}`);
        } catch {
          return [];
        }
      })();
      const bp = backupPathFor(target, options.now, existing);
      try {
        await copyFileWithClassification(target, bp);
        backupPaths.push(bp);
      } catch (err) {
        const detail = messageForError(err);
        return {
          agentId,
          displayName: entry.displayName,
          status: 'backup-failed',
          result: dryResult,
          backupPaths: [...backupPaths],
          reasonDetail: `backup failed for ${target}: ${detail}`,
        };
      }
    }
  }

  // Pass 2 — real write.
  const realResult = await entry.mcp.write(ctx, {
    servers,
    dryRun: false,
    pathContext: ctx,
  });
  return {
    agentId,
    displayName: entry.displayName,
    status: statusFromRealWriterResult(realResult),
    result: realResult,
    backupPaths,
  };
}

/** Map a dry-run refusal status to the equivalent F2 {@link ApplyStatus}. */
function mapDryRefusalToApply(status: ApplyDryRunStatus): ApplyStatus {
  switch (status) {
    case 'parse-error':
      return 'parse-error';
    case 'unsupported-shape':
      return 'unsupported-shape';
    case 'unsupported-format':
      return 'unsupported-format';
    case 'not-targetable':
      return 'not-targetable';
    case 'no-change':
      return 'no-change';
    case 'conflict':
      // Identity map — `'conflict'` is a CLI-local status that pairs across
      // the dry-run and real-write envelopes. Unreachable today (Task 4
      // wires the `AgentMcpWriteResult.conflicts` → status mapping) but
      // required by `noImplicitReturns` once the union is widened.
      return 'conflict';
    case 'would-update':
      // Caller never reaches here for would-update (handled above), but
      // satisfy the exhaustive switch.
      return 'updated';
  }
}

/** Build the gate-5 envelope from a validated profile + per-agent results. */
function buildApplyDryRunResult(args: {
  readonly profileName: string;
  readonly profile: OvertureProfile;
  readonly configPath: string;
  readonly agentResults: readonly ApplyDryRunAgentResult[];
}): ApplyDryRunResult {
  return {
    profile: args.profileName,
    configPath: args.configPath,
    disabledServers: [...args.profile.sync.disabledServers],
    results: args.agentResults,
  };
}

/** Build the F2 envelope from a validated profile + per-agent results. */
function buildApplyResult(args: {
  readonly profileName: string;
  readonly profile: OvertureProfile;
  readonly configPath: string;
  readonly backupBeforeWrite: boolean;
  readonly agentResults: readonly ApplyAgentResult[];
}): ApplyResult {
  return {
    profile: args.profileName,
    configPath: args.configPath,
    disabledServers: [...args.profile.sync.disabledServers],
    backupBeforeWrite: args.backupBeforeWrite,
    results: args.agentResults,
  };
}

/**
 * Resolve the canonical config path, load + validate the config, and pick
 * the profile named by `settings.defaultProfile`.
 *
 * Returns a tagged union so {@link runApply} can map each failure to its
 * exit code:
 *   - `null` config (ENOENT) → exit `1` ("no overture config yet")
 *   - parse / schema error or unknown profile name → exit `2`
 *
 * Every other path returns the resolved config + profile + name + path so
 * the orchestrator can build the envelope without re-reading anything.
 */
async function loadAndValidateProfile(paths: OverturePaths): Promise<
  | {
      readonly ok: true;
      readonly config: OvertureConfig;
      readonly profileName: string;
      readonly profile: OvertureProfile;
      readonly configPath: string;
    }
  | { readonly ok: false; readonly exitCode: 1 | 2; readonly message: string }
> {
  let config: OvertureConfig | null;
  try {
    config = await loadOvertureConfig(paths);
  } catch (err) {
    return { ok: false, exitCode: 2, message: messageForError(err) };
  }
  if (config === null) {
    return {
      ok: false,
      exitCode: 1,
      message:
        `No overture config found at ${paths.configFile}\n` +
        `Run \`overture bootstrap\` to create one, then retry.`,
    };
  }
  // `settings` is declared `.partial()` in the schema so every field is
  // typed `T | undefined` even though `.default('default')` guarantees a
  // string at runtime. Coalesce to 'default' to mirror that runtime
  // contract; an explicit string is required to satisfy the index type
  // for `profiles[profileName]` below.
  const profileName = config.settings.defaultProfile ?? 'default';
  const profile = config.profiles[profileName];
  if (profile === undefined) {
    return {
      ok: false,
      exitCode: 2,
      message: `Unknown profile '${profileName}'. Available: ${Object.keys(config.profiles).join(', ')}`,
    };
  }
  return {
    ok: true,
    config,
    profileName,
    profile,
    configPath: paths.configFile,
  };
}

// ---------------------------------------------------------------------------
// Dispatcher.
// ---------------------------------------------------------------------------

/**
 * Dispatch `overture apply` with the gate-5 + F2 type surface.
 *
 * F1: `--dry-run [--json]` (preview path).
 * F2: `apply` (no flag) → real-write path with per-target backups.
 *
 * Both paths share the same loader (canonical config + profile + disabled
 * server filter) and the same registry iteration. The only divergence is
 * which writer call mode (`dryRun: true` vs `dryRun: false`) and whether
 * the backup step runs.
 */
export async function runApply(
  args: readonly string[],
  stdout: StringWriter,
  stderr: StringWriter,
  options: RunApplyOptions = {},
): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) {
    stdout.write(APPLY_USAGE);
    return 0;
  }

  const allowedFlags = new Set(['--dry-run', '--json']);
  const unknownFlags = args.filter((flag) => !allowedFlags.has(flag));
  if (unknownFlags.length > 0) {
    stderr.write(`Unknown flag: ${unknownFlags[0]}\n${APPLY_USAGE}`);
    return 2;
  }

  const hasDryRun = args.includes('--dry-run');
  const hasJson = args.includes('--json');

  // F1 carry-over: `--json` without `--dry-run` is reserved for the
  // dry-run JSON envelope (per F2 gate F2-4 — no real-write JSON shape).
  if (hasJson && !hasDryRun) {
    stderr.write(
      `Invalid flag combination: --json requires --dry-run.\n${APPLY_USAGE}`,
    );
    return 2;
  }

  const validated = await loadAndValidateProfile(defaultOverturePaths());
  if (!validated.ok) {
    if (validated.exitCode === 2) {
      stderr.write(`${validated.message}\n`);
    } else {
      stdout.write(`${validated.message}\n`);
    }
    return validated.exitCode;
  }

  // Use a single `PathResolutionContext` for every writer so the
  // `homeDir` / `configDir` / `workspaceDir` they see is consistent
  // (the E1 preservation harness compares bytes against the seeded
  // fixtures; project memory 72 forbids passing `defaultOverturePaths`
  // here). Writers that take an explicit `ctx` arg still see it via
  // the first arg; `pathContext` mirrors it for self-contained writers.
  const ctx = defaultPathResolutionContext();
  const backupBeforeWrite = validated.config.settings.backupBeforeWrite ?? true;
  const now = options.now ?? new Date();

  if (hasDryRun) {
    // ----- F1 — preview path ---------------------------------------------
    const agentResults: ApplyDryRunAgentResult[] = [];
    for (const agentId of validated.profile.sync.targets) {
      agentResults.push(
        await applyToAgentDryRun(ctx, validated.profile, agentId),
      );
    }
    const result = buildApplyDryRunResult({
      profileName: validated.profileName,
      profile: validated.profile,
      configPath: validated.configPath,
      agentResults,
    });
    if (hasJson) {
      stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      stdout.write(formatHumanApplyDryRun(result));
    }
    return exitCodeForApplyDryRun(agentResults);
  }

  // ----- F2 — real-write path -------------------------------------------
  const agentResults: ApplyAgentResult[] = [];
  for (const agentId of validated.profile.sync.targets) {
    agentResults.push(
      await applyToAgentReal(ctx, validated.profile, agentId, {
        backupBeforeWrite,
        now,
      }),
    );
  }
  const result = buildApplyResult({
    profileName: validated.profileName,
    profile: validated.profile,
    configPath: validated.configPath,
    backupBeforeWrite,
    agentResults,
  });
  // F2 gate F2-4: real-write emits the human report only. `--json` is
  // reserved for the dry-run envelope (validated above).
  stdout.write(formatHumanApply(result));
  return exitCodeForApply(agentResults);
}
