/**
 * GitHub Copilot CLI MCP writer (E3 slice).
 *
 * Self-contained writer: it carries its own path resolution via
 * `input.pathContext`, resolves the on-disk target via
 * `pickCopilotWriteTarget`, and refuses to create missing files.
 *
 * This slice establishes the wiring contract only — the byte-level
 * splice lands in the follow-up TDD step once `jsonc-map-write`
 * grows real byte splices. The function returns `parse-error` after
 * confirming the target exists so the wiring is exercised end-to-end
 * without performing any destructive IO.
 */
import type { AgentMcpWriteInput, AgentMcpWriteResult } from './types.js';
import {
  pickCopilotWriteTarget,
  targetPathFor,
} from './github-copilot-cli-write-helpers.js';

export async function writeGitHubCopilotCliMcpConfig(
  input: AgentMcpWriteInput,
): Promise<AgentMcpWriteResult> {
  const dryRun = input.dryRun ?? false;

  if (input.pathContext === undefined) {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [],
      reason: 'not-targetable',
    };
  }

  const target = await pickCopilotWriteTarget(input.pathContext);
  if (target.kind === 'none') {
    return {
      written: 0,
      changed: false,
      dryRun,
      serversWritten: [],
      targetPaths: [],
      reason: 'not-targetable',
    };
  }

  // Stub: confirm target exists, return parse-error placeholder while
  // jsonc-map-write grows real byte splices (same pattern as claude-code).
  return {
    written: 0,
    changed: false,
    dryRun,
    serversWritten: [],
    targetPaths: [targetPathFor(target)],
    reason: 'parse-error',
  };
}
