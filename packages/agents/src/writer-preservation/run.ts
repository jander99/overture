/**
 * Public entry point for the writer preservation harness.
 *
 * `runPreservationChecks` is the single function every future
 * per-agent MCP writer (E2 OpenCode, E3 Claude Code + Copilot CLI,
 * E4 remaining agents) must pass before it is considered safe. The
 * harness proves that the writer preserved every byte outside the
 * targetPath subtree: comments, formatting, key order, unrelated
 * config keys, and unrelated MCP servers. It also verifies the
 * writer is idempotent across repeated dry-run/apply cycles.
 *
 * The harness is intentionally format-aware but agent-agnostic:
 * pass a `format` + `targetPath` + the bytes, and the harness runs
 * every check applicable to that format. The same harness gates
 * JSON, JSONC, and TOML writers without per-agent code paths.
 */
import {
  checksForFormat,
  commentsCheck,
  formattingCheck,
  idempotencyCheck,
  keyOrderCheck,
  mcpServersCheck,
  rawBytesCheck,
  topLevelKeysCheck,
} from './checks.js';
import type {
  PreservationCheckInput,
  PreservationCheckResult,
  PreservationReport,
} from './types.js';

export type {
  PreservationCheckInput,
  PreservationCheckName,
  PreservationCheckResult,
  PreservationReport,
  TargetPath,
} from './types.js';
export { checksForFormat } from './checks.js';

/**
 * Run every preservation check applicable to the input's format and
 * aggregate the results into a {@link PreservationReport}.
 *
 * - `original` is the file the writer started from.
 * - `written` is the output of the writer after a single apply.
 * - `rewritten` is the output of applying the writer a second time to
 *   `written`. Required input — the E1 contract mandates that every
 *   future per-agent writer prove idempotency. Callers that don't
 *   exercise a second apply can pass `written` again.
 * - `targetPath` is the path inside the document the writer was
 *   allowed to mutate. Empty array = whole document allowed; every
 *   structural check is skipped, but idempotency still runs.
 */
export function runPreservationChecks(
  input: PreservationCheckInput,
): PreservationReport {
  const { format, targetPath, original, written, rewritten } = input;
  // Short-circuit when the writer was allowed to mutate the whole
  // document — every structural check is trivially inapplicable, but
  // idempotency still runs (rewritten is required).
  if (targetPath.length === 0) {
    const checks: PreservationCheckResult[] = [
      {
        name: 'comments',
        pass: true,
        details: '',
        skipped: true,
      },
      {
        name: 'topLevelKeys',
        pass: true,
        details: '',
        skipped: true,
      },
      {
        name: 'keyOrder',
        pass: true,
        details: '',
        skipped: true,
      },
      {
        name: 'mcpServers',
        pass: true,
        details: '',
        skipped: true,
      },
      {
        name: 'formatting',
        pass: true,
        details: '',
        skipped: true,
      },
      idempotencyCheck(written, rewritten),
      {
        name: 'rawBytes',
        pass: true,
        details: '',
        skipped: true,
      },
    ];
    return {
      allPassed: checks.every((c) => c.pass),
      checks,
    };
  }

  const checks: PreservationCheckResult[] = [];
  // rawBytes runs first because it is the strongest preservation
  // guarantee (byte-for-byte) and surfaces regressions the structured
  // checks might miss.
  checks.push(rawBytesCheck(original, written, targetPath, format));
  for (const name of checksForFormat(format)) {
    if (name === 'comments') {
      checks.push(commentsCheck(original, written, targetPath, format));
    } else if (name === 'topLevelKeys') {
      checks.push(topLevelKeysCheck(original, written, targetPath, format));
    } else if (name === 'keyOrder') {
      checks.push(keyOrderCheck(original, written, targetPath, format));
    } else if (name === 'mcpServers') {
      checks.push(mcpServersCheck(original, written, targetPath, format));
    } else if (name === 'formatting') {
      checks.push(formattingCheck(original, written, targetPath, format));
    }
  }
  // Idempotency is always part of the report; `rewritten` is a
  // required input so the check always runs.
  checks.push(idempotencyCheck(written, rewritten));

  const allPassed = checks.every((c) => c.pass);
  return { allPassed, checks };
}
