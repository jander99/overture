/**
 * OpenAI Codex write target resolution.
 *
 * Codex read-path precedence is USER-FIRST (unlike Copilot's workspace-first):
 *   1. <homeDir>/.codex/config.toml (user scope)
 *   2. <workspaceDir>/.codex/config.toml (workspace scope)
 *
 * The picker is conservative: it returns a descriptor that records the
 * path it found. It never reads the file itself; the writer is responsible
 * for the byte-level splice.
 *
 * No creation. If no applicable target exists, the picker returns
 * { kind: 'none', path: '' } so the writer can surface reason: 'not-targetable'.
 */
import { access } from 'node:fs/promises';
import type { PathResolutionContext, TargetPath } from './types.js';

export type CodexWriteTarget =
  | { readonly kind: 'user'; readonly path: string }
  | { readonly kind: 'workspace'; readonly path: string }
  | { readonly kind: 'none'; readonly path: '' };

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function pickCodexWriteTarget(
  ctx: PathResolutionContext,
): Promise<CodexWriteTarget> {
  const home = typeof ctx.homeDir === 'string' ? ctx.homeDir : '';
  const wsDir = typeof ctx.workspaceDir === 'string' ? ctx.workspaceDir : '';
  const userPath = home.length > 0 ? `${home}/.codex/config.toml` : '';
  const workspacePath = wsDir.length > 0 ? `${wsDir}/.codex/config.toml` : '';

  if (userPath.length > 0 && (await exists(userPath))) {
    return { kind: 'user', path: userPath };
  }
  if (workspacePath.length > 0 && (await exists(workspacePath))) {
    return { kind: 'workspace', path: workspacePath };
  }
  return { kind: 'none', path: '' };
}

export function targetPathFor(
  target: Exclude<CodexWriteTarget, { kind: 'none' }>,
): TargetPath {
  const scope = target.kind === 'user' ? 'user' : 'project';
  const base = target.kind === 'user' ? 'home' : 'workspace';
  return { scope, base, path: target.path };
}
