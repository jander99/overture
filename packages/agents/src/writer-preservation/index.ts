/**
 * Public exports for the writer preservation harness.
 *
 * The harness is the E1 safety gate: every future per-agent MCP
 * writer (E2 OpenCode, E3 Claude Code + Copilot CLI, E4 remaining
 * agents) must pass `runPreservationChecks` with byte-for-byte
 * preservation outside the targetPath subtree. No production writer
 * exists yet; the harness is the contract future writers are held to.
 *
 * The test helpers in `byte-mutators.ts` are NOT exported from this
 * package surface — they are internal scaffolding for the harness
 * self-tests. Callers of the harness should import only from this
 * index.
 */
export type {
  PreservationCheckInput,
  PreservationCheckName,
  PreservationCheckResult,
  PreservationReport,
  TargetPath,
} from './types.js';
export { checksForFormat, runPreservationChecks } from './run.js';
