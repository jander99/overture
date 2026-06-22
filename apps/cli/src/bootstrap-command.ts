import {
  defaultOverturePaths,
  loadOvertureConfig,
  type OvertureConfig,
} from '@overture/config';

import { defaultPathResolutionContext } from './platforms/detect.js';
import { buildScanJsonOutput } from './scan.js';
import { buildBootstrapPlan, type BootstrapPlan } from './bootstrap.js';
export type { StringWriter } from './scan-command.js';
import type { StringWriter } from './scan-command.js';

export const BOOTSTRAP_USAGE = 'Usage: overture bootstrap --dry-run [--json]\n';

export const BOOTSTRAP_RESERVED_MESSAGE =
  'Bootstrap writes are not implemented yet. Run "overture bootstrap --dry-run" to preview the proposal.\n';

const BOOTSTRAP_HUMAN_RESERVED_MESSAGE =
  'Human output is not implemented in D1 yet. Run "overture bootstrap --dry-run --json" for the machine-readable plan.\n';

const BOOTSTRAP_INVALID_COMBINATION_MESSAGE =
  'Invalid flag combination: --json requires --dry-run.\n';

const BOOTSTRAP_EXISTING_CONFIG_MESSAGE =
  'Bootstrap is one-time. Existing canonical config already exists; run "overture scan" or remove the config file first.\n';

const BOOTSTRAP_UNKNOWN_FLAG_PREFIX = 'Unknown flag: ';

export function exitCodeForBootstrap(plan: BootstrapPlan): 0 | 1 {
  return plan.proposal.status === 'blocked' ? 1 : 0;
}

export async function runBootstrap(
  args: readonly string[],
  stdout: StringWriter,
  stderr: StringWriter,
): Promise<number> {
  if (args.length === 0) {
    stderr.write(BOOTSTRAP_RESERVED_MESSAGE);
    return 2;
  }

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

  if (!hasDryRun) {
    stderr.write(BOOTSTRAP_RESERVED_MESSAGE);
    return 2;
  }

  if (!hasJson) {
    return runBootstrapHuman(stdout, stderr);
  }

  const paths = defaultOverturePaths();
  let config: OvertureConfig | null;
  try {
    config = await loadOvertureConfig(paths);
  } catch (err) {
    stderr.write(`${messageForError(err)}\n`);
    return 2;
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

function runBootstrapHuman(stdout: StringWriter, stderr: StringWriter): 2 {
  stderr.write(BOOTSTRAP_HUMAN_RESERVED_MESSAGE);
  return 2;
}

function messageForError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
