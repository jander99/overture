/**
 * F1 — `overture apply` subcommand.
 *
 * Ships the gate-5 type surface (`ApplyDryRunResult`, `ApplyDryRunAgentResult`,
 * `RunApplyOptions`), the args-parsing + exit-code plumbing (`runApply`,
 * `exitCodeForApplyDryRun`, `APPLY_USAGE`), the human renderer
 * (`formatHumanApplyDryRun`), and the orchestration that wires the canonical
 * config to per-agent writers.
 *
 * Dry-run is the only supported mode in F1. Real writes (`overture apply`
 * without `--dry-run`) exit 2 with a "not yet implemented" advisory so
 * callers learn the difference between an invalid flag combination and a
 * not-yet-supported feature. The `--json` flag requires `--dry-run` (mirror
 * bootstrap's invalid-combination guard).
 *
 * Exit codes:
 *   - `0` — orchestration completed and every per-agent result is clean
 *           (`would-update` or `no-change`).
 *   - `1` — orchestration completed but at least one per-agent result is a
 *           refusal (`not-targetable`, `parse-error`, `unsupported-shape`,
 *           `unsupported-format`), OR the canonical config is absent
 *           (no `overture.jsonc` to apply). The JSON envelope is still
 *           emitted to stdout before the non-zero exit so consumers can
 *           read the failure model.
 *   - `2` — usage errors (unknown flags, `--json` without `--dry-run`,
 *           `apply` without `--dry-run`), unknown profile name, or any
 *           orchestration failure that prevents the model from being built.
 */
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
  | 'unsupported-format';

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

/**
 * Injection seam for tests and production. F1 ships it empty: the F1 slice
 * never wires a real prompt or path-context factory because writers are
 * called directly with `dryRun: true`. F2 / F3 may add fields
 * (e.g. `pathContextFactory`, `prompt`); keeping the interface exported
 * lets future tests reference it without churn.
 */

export interface RunApplyOptions {
  readonly prompt?: unknown;
}

// ---------------------------------------------------------------------------
// Constants.
// ---------------------------------------------------------------------------

export const APPLY_USAGE = 'Usage: overture apply --dry-run [--json]\n';

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
 *   5. F2 advisory footer pointing at `overture apply`.
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
  lines.push(
    'Run `overture apply` to write the planned changes (not yet implemented).',
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
 * Run a single per-agent dry-run write for the named target. Synthesizes a
 * `not-targetable` envelope when the agent id is unknown or the writer
 * slot is absent so the orchestrator can record every target in the report
 * (per plan decision point 2: "unknown agent id is a refusal, not a hard
 * error").
 */
async function applyToAgent(
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

  const servers: readonly AgentMcpWriteServer[] = Object.entries(
    profile.mcpServers,
  )
    .filter(([name]) => !profile.sync.disabledServers.includes(name))
    .map(([name, server]) => ({ name, server }));

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

/** Build the gate-5 envelope from a validated profile + per-agent results. */
function buildApplyResult(args: {
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
 * Dispatch `overture apply` with the gate-5 type surface.
 *
 * Parses args, loads + validates the canonical config, picks the profile
 * named by `settings.defaultProfile`, filters `disabledServers`, iterates
 * `sync.targets`, and calls each agent's `mcp.write` with `dryRun: true`.
 * The `--json` path emits the gate-5 envelope; the default path emits the
 * human-readable report. The non-dry-run `apply` branch exits 2 with a
 * "not yet implemented" advisory; F2 will replace it.
 */
export async function runApply(
  args: readonly string[],
  stdout: StringWriter,
  stderr: StringWriter,
  _options: RunApplyOptions = {},
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

  // Mirror bootstrap: explicit invalid-combination message wins over the
  // generic "not yet implemented" so callers learn the difference between
  // `apply --json` (invalid) and `apply` (valid shape, not yet supported).
  if (hasJson && !hasDryRun) {
    stderr.write(
      `Invalid flag combination: --json requires --dry-run.\n${APPLY_USAGE}`,
    );
    return 2;
  }

  if (!hasDryRun) {
    stderr.write(
      `overture apply is not yet implemented; use --dry-run to preview.\n${APPLY_USAGE}`,
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
  const agentResults: ApplyDryRunAgentResult[] = [];
  for (const agentId of validated.profile.sync.targets) {
    agentResults.push(await applyToAgent(ctx, validated.profile, agentId));
  }

  const result = buildApplyResult({
    profileName: validated.profileName,
    profile: validated.profile,
    configPath: validated.configPath,
    agentResults,
  });

  if (hasJson) {
    stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    // The formatter already emits a trailing newline; mirror the
    // bootstrap-command convention (which also calls
    // `formatHumanBootstrapProposal` / `formatHumanInteractiveResult`
    // directly via `stdout.write`, no extra `\n`).
    stdout.write(formatHumanApplyDryRun(result));
  }

  return exitCodeForApplyDryRun(agentResults);
}
