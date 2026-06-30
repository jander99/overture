/**
 * Claude Code MCP writer (E3 slice).
 *
 * Self-contained writer: it carries its own path resolution via
 * `input.pathContext`, resolves the on-disk target via
 * `pickClaudeCodeTarget`, and refuses to create missing files.
 *
 * This slice establishes the wiring contract only — the byte-level
 * splice lands in the follow-up TDD step once `jsonc-map-write`
 * grows real byte splices. The function returns `parse-error` after
 * confirming the target exists so the wiring is exercised end-to-end
 * without performing any destructive IO.
 */
import type {
  AgentMcpWriteInput,
  AgentMcpWriteResult,
  TargetPath,
} from './types.js';
import {
  pickClaudeCodeTarget,
  type ClaudeCodeWriteTarget,
} from './claude-code-write-helpers.js';

function targetPathFor(
  target: Exclude<ClaudeCodeWriteTarget, { kind: 'none' }>,
): TargetPath {
  return { scope: 'user', base: 'home', path: target.path };
}

export async function writeClaudeCodeMcpConfig(
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

  // Discover target (./mcp.json OR ~/.claude.json top-level OR ~/.claude.json/projects[ws]/).
  // No creation: if no applicable target exists, return reason: 'not-targetable'.
  // No raw bytes in result.
  const target = await pickClaudeCodeTarget(input.pathContext);
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

  // For E3 stub: refuse to write; return parse-error after confirming
  // the target exists. Full per-server byte splicing arrives when
  // jsonc-map-write grows real byte splices; this slice establishes the
  // wiring contract.
  return {
    written: 0,
    changed: false,
    dryRun,
    serversWritten: [],
    targetPaths: [targetPathFor(target)],
    reason: 'parse-error',
  };
}