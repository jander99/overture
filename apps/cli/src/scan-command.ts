import {
  defaultOverturePaths,
  loadOvertureConfig,
  type OvertureConfig,
} from '@overture/config';
import { defaultPathResolutionContext } from './platforms/detect.js';
import { buildScanJsonOutput, type ScanJsonOutput } from './scan.js';
import { formatHumanScanDetail } from './scan-human.js';

export interface StringWriter {
  write(chunk: string): boolean;
}

/**
 * Decide the exit code for a successful `--json` scan based on the model the
 * C1 adapter emits. Exposed so the contract is unit-testable in isolation and
 * so the dispatcher in {@link runScan} only orchestrates I/O.
 *
 * Contract (Task 4):
 * - `0` — the scan matrix has no invalid-profile state and no hard-refuse
 *   conflicts. "No agents installed" returns `0` because an empty inventory is
 *   a valid scan result, not an error.
 * - `1` — `matrix.canonicalState === 'invalid-profile'` OR
 *   `conflicts.hardRefuses.length > 0`. The JSON envelope is still written to
 *   stdout so consumers can inspect what failed.
 *
 * Other exit codes (`2` for usage errors and pre-model orchestration failures)
 * are owned by the dispatcher, not this helper.
 */
export function exitCodeForScan(
  matrix: ScanJsonOutput['matrix'],
  conflicts: ScanJsonOutput['conflicts'],
): 0 | 1 {
  if (matrix.canonicalState === 'invalid-profile') return 1;
  if (conflicts.hardRefuses.length > 0) return 1;
  return 0;
}

/**
 * Dispatch the `overture scan` subcommand. Mirrors the {@link runDetect}
 * shape but routes through {@link buildScanJsonOutput} so the JSON output is
 * the same model the C1 adapter exposes to other consumers.
 *
 * Exit codes:
 * - `0` — clean scan (no invalid-profile state, no hard-refuse conflicts),
 *   including the "no agents installed" case; also returned for `--help` /
 *   `-h` and the no-flag human summary path.
 * - `1` — scan ran but produced a `matrix.canonicalState === 'invalid-profile'`
 *   state, or `conflicts.hardRefuses` is non-empty. The JSON envelope is
 *   still emitted to stdout before the non-zero exit so consumers can read
 *   the failure model.
 * - `2` — usage errors (unknown flags, already wired) AND pre-model
 *   orchestration failures (canonical config parse / validation errors, any
 *   unexpected thrown error). The dispatcher writes the error message to
 *   stderr and does NOT emit a fake scan matrix to stdout.
 *
 * `stdout` / `stderr` are injected so tests can pass mocks; the production
 * dispatcher in {@link run} always passes `process.stdout` / `process.stderr`.
 */
export async function runScan(
  args: readonly string[],
  stdout: StringWriter,
  stderr: StringWriter,
): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) {
    stdout.write('Usage: overture scan [--json]\n');
    return 0;
  }
  const unknownFlags = args.filter((f) => f !== '--json');
  if (unknownFlags.length > 0) {
    stderr.write(
      `Unknown flag: ${unknownFlags[0]}\nUsage: overture scan [--json]\n`,
    );
    return 2;
  }
  if (args.includes('--json')) {
    let config: OvertureConfig | null;
    try {
      config = await loadOvertureConfig(defaultOverturePaths());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stderr.write(`${message}\n`);
      return 2;
    }
    let scanOutput: ScanJsonOutput;
    try {
      scanOutput = await buildScanJsonOutput({
        ctx: defaultPathResolutionContext(),
        config,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stderr.write(`${message}\n`);
      return 2;
    }
    const { matrix, conflicts } = scanOutput;
    stdout.write(JSON.stringify({ matrix, conflicts }, null, 2) + '\n');
    return exitCodeForScan(matrix, conflicts);
  }
  let config: OvertureConfig | null;
  try {
    config = await loadOvertureConfig(defaultOverturePaths());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stderr.write(`${message}\n`);
    return 2;
  }
  let scanOutput: ScanJsonOutput;
  try {
    scanOutput = await buildScanJsonOutput({
      ctx: defaultPathResolutionContext(),
      config,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stderr.write(`${message}\n`);
    return 2;
  }
  const { matrix, conflicts } = scanOutput;
  stdout.write(formatHumanScanDetail(matrix, conflicts) + '\n');
  return exitCodeForScan(matrix, conflicts);
}
