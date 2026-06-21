import {
  defaultOverturePaths,
  loadOvertureConfig,
  type OvertureConfig,
} from '@overture/config';
import { defaultPathResolutionContext } from './platforms/detect.js';
import { buildScanJsonOutput, type ScanJsonOutput } from './scan.js';

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
 * Render the default-human summary for `overture scan` (the no-flag path).
 *
 * Always emitted lines:
 * - `Scan complete.`                          — `exitCodeForScan === 0`
 *   OR `Scan completed with blocking issues.` — `exitCodeForScan === 1`.
 * - `Detected agents: N / 4`                  — count of `matrix.agents`
 *   entries with `installed === true`. The `/ 4` denominator is the
 *   canonical four-agent registry (claude-code, opencode,
 *   github-copilot-cli, openai-codex).
 * - `Canonical config: <state>`              — verbatim `matrix.canonicalState`
 *   (`absent` | `ready` | `invalid-profile`).
 * - `Hard refuses: <count>`                   — `conflicts.hardRefuses.length`.
 * - `Run "overture scan --json" ...`          — pointer to the machine-readable
 *   path so terminal users always know where to go next.
 *
 * When zero agents are detected, an additional install-suggestion block is
 * appended that names the four supported CLIs and the host OSes overture
 * runs on. The block is suppressed when at least one agent is installed
 * because the inventory already proves the user's platform supports one.
 *
 * Output is plain text: no ANSI escape sequences, no trailing newline.
 * The dispatcher in {@link runScan} appends the final `\n` when writing to
 * stdout.
 */
export function formatHumanScanSummary(
  matrix: ScanJsonOutput['matrix'],
  conflicts: ScanJsonOutput['conflicts'],
): string {
  const installedCount = matrix.agents.filter((a) => a.installed).length;
  const blocking = exitCodeForScan(matrix, conflicts) === 1;
  const lines: string[] = [
    blocking ? 'Scan completed with blocking issues.' : 'Scan complete.',
    `Detected agents: ${installedCount} / 4`,
    `Canonical config: ${matrix.canonicalState}`,
    `Hard refuses: ${conflicts.hardRefuses.length}`,
    'Run "overture scan --json" for machine-readable details.',
  ];
  if (installedCount === 0) {
    lines.push(
      '',
      'No supported MCP-capable agents detected.',
      'Install one of these CLI agents on a supported OS (linux/darwin):',
      '  - Claude Code',
      '  - OpenCode',
      '  - GitHub Copilot CLI',
      '  - OpenAI Codex',
    );
  }
  return lines.join('\n');
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
  stdout.write(formatHumanScanSummary(matrix, conflicts) + '\n');
  return exitCodeForScan(matrix, conflicts);
}
