/**
 * Writer preservation harness — public type contracts.
 *
 * The harness is the E1 safety gate: every future per-agent MCP writer
 * (E2 OpenCode, E3 Claude Code + Copilot CLI, E4 remaining agents) must
 * pass `runPreservationChecks` with byte-for-byte preservation outside
 * the targetPath subtree. No production writer exists yet; the harness
 * is the contract future writers are held to.
 *
 * The harness operates on raw bytes (the original file and the writer's
 * output) plus the path the writer was allowed to mutate. It does NOT
 * parse either side beyond the minimum needed for path-aware checks
 * (key order, top-level key existence, MCP-server inventory). Comment
 * preservation, whitespace drift, and idempotency are byte-level checks.
 */
import type { McpLocationFormat } from '../types.js';

/**
 * Path the writer was allowed to mutate. JSON-pointer-like; supports
 * both object key paths (e.g. `['mcpServers', 'filesystem']`) and TOML
 * table paths (e.g. `['mcp_servers', 'filesystem']`). An empty array
 * means the writer was allowed to mutate the entire document. Every
 * structural preservation check is trivially inapplicable, but
 * idempotency still runs — the harness is not a free pass when
 * the writer was allowed to mutate the whole document.
 */
export type TargetPath = readonly string[];

/**
 * Names of every individual preservation check the harness can run.
 * Each check is independent; the harness runs every check applicable
 * to the input format and aggregates results into a {@link PreservationReport}.
 *
 * - `comments`          — comment lines/block-runs outside targetPath must appear verbatim in `written` (jsonc/toml/yaml only).
 * - `topLevelKeys`      — every top-level key outside targetPath[0] must exist in `written` with equal parsed content.
 * - `keyOrder`          — outside targetPath, the parsed key order must match between `original` and `written`.
 * - `mcpServers`        — every MCP server name outside targetPath[1] (within the targetPath[0] subtree) must exist in `written` with equal parsed content.
 * - `formatting`        — outside targetPath, line-leading whitespace and trailing newline must match.
 * - `idempotency`       — `rewritten` (the output of a second apply) must equal `written` byte-for-byte; required input.
 * - `rawBytes`          — every byte outside the targetPath subtree must be byte-identical between `original` and `written`. This is the strongest preservation guarantee and is the primary E1 contract.
 */
export type PreservationCheckName =
  | 'comments'
  | 'topLevelKeys'
  | 'keyOrder'
  | 'mcpServers'
  | 'formatting'
  | 'idempotency'
  | 'rawBytes';

/**
 * Input to {@link runPreservationChecks}. All fields are required.
 *
 * `rewritten` is mandatory (not optional): the E1 contract requires every
 * future per-agent writer to prove idempotency across a second apply,
 * and an optional `rewritten` would let a writer skip the check entirely.
 *
 * **Real per-agent writer specs MUST supply bytes produced by a real
 * second apply** of the writer to its own output. Reusing `written` as
 * `rewritten` is only acceptable for *pure harness / no-op scenarios*
 * — tests of `runPreservationChecks` itself, where no writer is in the
 * loop. Reusing `written` in a real writer spec silently turns the
 * `idempotency` check into a tautology (`written === written`) and
 * defeats the E1 safety gate.
 */
export interface PreservationCheckInput {
  readonly format: McpLocationFormat;
  /** Path the writer was allowed to mutate. Empty array = whole-doc allowed. */
  readonly targetPath: TargetPath;
  /** Original file bytes the writer started from. */
  readonly original: string;
  /** Output bytes after the writer ran once. */
  readonly written: string;
  /**
   * Output bytes after applying the writer a SECOND time to `written`.
   *
   * For real per-agent writer specs, `rewritten` must come from a real
   * second invocation of the writer against the same scratch config and
   * the same input — not from `written` reused. For pure harness / no-op
   * specs (tests of `runPreservationChecks` itself), reusing `written`
   * is acceptable because there is no writer in the loop.
   *
   * The harness always runs the `idempotency` check
   * (`rewritten === written` byte-for-byte); it cannot distinguish the
   * two cases, so the contract is enforced by spec discipline, not by
   * types.
   */
  readonly rewritten: string;
}

/**
 * Result of one preservation check. `details` is populated when the
 * check fails so test failures and future writer debugging can see
 * exactly which byte/line/key triggered the failure.
 */
export interface PreservationCheckResult {
  readonly name: PreservationCheckName;
  readonly pass: boolean;
  /** Human-readable failure detail. Empty when `pass` is true. */
  readonly details: string;
  /** True when the check was skipped (not applicable or not supplied). */
  readonly skipped: boolean;
}

/**
 * Aggregate result. `allPassed` is true when every applicable check
 * passed (or was skipped); false when any check failed.
 */
export interface PreservationReport {
  readonly allPassed: boolean;
  readonly checks: readonly PreservationCheckResult[];
}
