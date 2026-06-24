import { statSync } from 'node:fs';
import {
  defaultOverturePaths,
  loadOvertureConfig,
  type OvertureConfig,
  type OverturePaths,
  writeOvertureConfig,
  InvalidOvertureConfigError,
  OvertureConfigWriteError,
} from '@overture/config';

import { defaultPathResolutionContext } from './platforms/detect.js';
import { buildScanJsonOutput } from './scan.js';
import { buildBootstrapPlan, type BootstrapPlan } from './bootstrap.js';
import {
  formatHumanBootstrapProposal,
  formatHumanInteractiveResult,
} from './bootstrap-human.js';
import {
  applyInteractiveResolutions,
  type InteractiveResolution,
} from './bootstrap-resolution.js';
import {
  createStdinPrompt,
  formatPickablePrompt,
  parsePickableAnswer,
  type PromptQuestion,
} from './bootstrap-prompt.js';
export type { StringWriter } from './scan-command.js';
import type { StringWriter } from './scan-command.js';

export const BOOTSTRAP_USAGE = 'Usage: overture bootstrap --dry-run [--json]\n';

const BOOTSTRAP_WROTE_FOOTER = (path: string): string =>
  `Wrote config: ${path}\n`;

const BOOTSTRAP_INVALID_COMBINATION_MESSAGE =
  'Invalid flag combination: --json requires --dry-run.\n';

const BOOTSTRAP_EXISTING_CONFIG_MESSAGE =
  'Bootstrap is one-time. Existing canonical config already exists; run "overture scan" or remove the config file first.\n';

const BOOTSTRAP_UNKNOWN_FLAG_PREFIX = 'Unknown flag: ';

const BOOTSTRAP_NON_TTY_MESSAGE =
  'Interactive bootstrap requires a TTY. Run "overture bootstrap --dry-run" for a non-interactive preview.\n';

const MAX_INVALID_PROMPT_ATTEMPTS = 10;

/**
 * D2 - injection seam for tests and production. Production callers omit
 * `options`; tests inject a stubbed prompt + explicit `isTTY` so the
 * interactive flow can be exercised without a real TTY.
 */
export interface RunBootstrapOptions {
  readonly prompt?: PromptQuestion;
  readonly isTTY?: boolean;
}

export function exitCodeForBootstrap(plan: BootstrapPlan): 0 | 1 {
  return plan.proposal.status === 'blocked' ? 1 : 0;
}

export async function runBootstrap(
  args: readonly string[],
  stdout: StringWriter,
  stderr: StringWriter,
  options: RunBootstrapOptions = {},
): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) {
    stdout.write(BOOTSTRAP_USAGE);
    return 0;
  }

  const unknownFlags = args.filter(
    (flag) => flag !== '--dry-run' && flag !== '--json',
  );
  if (unknownFlags.length > 0) {
    stderr.write(
      `${BOOTSTRAP_UNKNOWN_FLAG_PREFIX}${unknownFlags[0]}\n${BOOTSTRAP_USAGE}`,
    );
    return 2;
  }

  const hasDryRun = args.includes('--dry-run');
  const hasJson = args.includes('--json');

  if (hasJson && !hasDryRun) {
    stderr.write(`${BOOTSTRAP_INVALID_COMBINATION_MESSAGE}${BOOTSTRAP_USAGE}`);
    return 2;
  }

  const paths = defaultOverturePaths();
  let config: OvertureConfig | null;
  // Treat a directory at the canonical config path as "no config yet" so
  // bootstrap can proceed and the writer can attempt (and surface EISDIR).
  if (isDirectoryAt(paths.configFile)) {
    config = null;
  } else {
    try {
      config = await loadOvertureConfig(paths);
    } catch (err) {
      stderr.write(`${messageForError(err)}\n`);
      return 2;
    }
  }

  if (config !== null) {
    stderr.write(BOOTSTRAP_EXISTING_CONFIG_MESSAGE);
    return 1;
  }

  let scanOutput;
  try {
    scanOutput = await buildScanJsonOutput({
      ctx: defaultPathResolutionContext(),
      config,
    });
  } catch (err) {
    stderr.write(`${messageForError(err)}\n`);
    return 2;
  }

  const plan = buildBootstrapPlan({
    scanOutput,
    configPath: paths.configFile,
  });

  if (!hasDryRun) {
    return runBootstrapInteractive(stdout, stderr, plan, paths, options);
  }

  if (!hasJson) {
    return runBootstrapHuman(stdout, plan);
  }

  stdout.write(
    JSON.stringify(
      {
        blockers: plan.blockers,
        conflicts: plan.conflicts,
        proposal: plan.proposal,
      },
      null,
      2,
    ) + '\n',
  );
  return exitCodeForBootstrap(plan);
}

function runBootstrapHuman(stdout: StringWriter, plan: BootstrapPlan): 0 | 1 {
  stdout.write(formatHumanBootstrapProposal(plan));
  return exitCodeForBootstrap(plan);
}

/**
 * D3 - Interactive dispatch for the no-flag path. Writes the canonical
 * `overture.jsonc` on success when the plan is ready.
 *
 * Decision tree (matches the D3 plan exactly):
 *   1. hard refuses OR blockers -> print proposal and return 1; never prompt.
 *   2. pickables AND non-TTY -> print TTY hint to stderr and return 2.
 *   3. pickables AND TTY     -> prompt each conflict in order, collect
 *      decisions, apply them in-memory, write the config if the resulting
 *      plan is ready, return 1 if still blocked, else 0.
 *   4. otherwise (no conflicts of any kind) -> write the config, return 0.
 *
 * Writes only `overture.jsonc` via `writeOvertureConfig`; never touches
 * any agent config.
 */
async function runBootstrapInteractive(
  stdout: StringWriter,
  stderr: StringWriter,
  plan: BootstrapPlan,
  paths: OverturePaths,
  options: RunBootstrapOptions,
): Promise<number> {
  if (plan.conflicts.hardRefuses.length > 0 || plan.blockers.length > 0) {
    stdout.write(formatHumanBootstrapProposal(plan));
    return 1;
  }

  if (plan.conflicts.pickable.length === 0) {
    stdout.write(formatHumanBootstrapProposal(plan, { footer: 'wrote' }));
    try {
      await writeOvertureConfig({ paths, config: plan.proposal.config });
    } catch (err) {
      if (
        err instanceof InvalidOvertureConfigError ||
        err instanceof OvertureConfigWriteError
      ) {
        stderr.write(`${err.message}\n`);
        return 2;
      }
      throw err;
    }
    stdout.write(BOOTSTRAP_WROTE_FOOTER(paths.configFile));
    return 0;
  }

  const isTTY = options.isTTY ?? process.stdin.isTTY ?? false;
  if (!isTTY) {
    stderr.write(BOOTSTRAP_NON_TTY_MESSAGE);
    return 2;
  }

  const prompt = options.prompt ?? createStdinPrompt();
  const decisions: InteractiveResolution[] = [];

  for (const conflict of plan.conflicts.pickable) {
    stdout.write(formatPickablePrompt(conflict));
    let resolved = false;
    let invalidAttempts = 0;
    while (!resolved) {
      const answer = await prompt(formatPickablePrompt(conflict));
      if (answer === null) {
        stderr.write(`Bootstrap aborted: ${conflict.serverName}\n`);
        return 2;
      }
      const parsed = parsePickableAnswer(answer, conflict.candidates.length);
      if (parsed.kind === 'abort') {
        stderr.write(`Bootstrap aborted: ${conflict.serverName}\n`);
        return 2;
      }
      if (parsed.kind === 'invalid') {
        invalidAttempts += 1;
        if (invalidAttempts >= MAX_INVALID_PROMPT_ATTEMPTS) {
          stderr.write(
            `Bootstrap aborted: too many invalid answers for ${conflict.serverName}\n`,
          );
          return 2;
        }
        stdout.write(formatPickablePrompt(conflict));
        continue;
      }
      if (parsed.kind === 'skipped') {
        decisions.push({
          kind: 'skipped',
          serverName: conflict.serverName,
        });
        resolved = true;
        continue;
      }
      decisions.push({
        kind: 'selected',
        serverName: conflict.serverName,
        candidateIndex: parsed.candidateIndex,
      });
      resolved = true;
    }
  }

  const result = applyInteractiveResolutions(plan, decisions);
  if (result.aborted) {
    stderr.write('Bootstrap aborted: user requested abort\n');
    return 2;
  }

  if (result.plan.proposal.status === 'ready') {
    stdout.write(formatHumanInteractiveResult(result, { footer: 'wrote' }));
    try {
      await writeOvertureConfig({ paths, config: result.plan.proposal.config });
    } catch (err) {
      if (
        err instanceof InvalidOvertureConfigError ||
        err instanceof OvertureConfigWriteError
      ) {
        stderr.write(`${err.message}\n`);
        return 2;
      }
      throw err;
    }
    stdout.write(BOOTSTRAP_WROTE_FOOTER(paths.configFile));
    return 0;
  }

  stdout.write(formatHumanInteractiveResult(result));
  return 1;
}

function messageForError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isDirectoryAt(targetPath: string): boolean {
  try {
    return statSync(targetPath).isDirectory();
  } catch (err) {
    if (
      err instanceof Error &&
      'code' in err &&
      typeof err.code === 'string' &&
      err.code === 'ENOENT'
    ) {
      return false;
    }
    throw err;
  }
}
