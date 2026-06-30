/**
 * GitHub Copilot CLI write target resolution.
 *
 * The writer chooses between two on-disk targets, in priority order:
 *   1. `<workspaceDir>/.github/mcp.json` (project scope)
 *   2. `<homeDir>/.copilot/mcp-config.json` (user scope)
 *
 * The picker is conservative: it returns a descriptor that records the
 * path it found. It never reads the file itself; the writer is responsible
 * for the byte-level splice.
 *
 * No creation. If no applicable target exists, the picker returns
 * `{ kind: 'none', path: '' }` so the writer can surface
 * `reason: 'not-targetable'`.
 */
import { access } from 'node:fs/promises';
import type { PathResolutionContext, TargetPath } from './types.js';

export type CopilotWriteTarget =
  | { readonly kind: 'workspace'; readonly path: string }
  | { readonly kind: 'user'; readonly path: string }
  | { readonly kind: 'none'; readonly path: '' };

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function pickCopilotWriteTarget(
  ctx: PathResolutionContext,
): Promise<CopilotWriteTarget> {
  const home = typeof ctx.homeDir === 'string' ? ctx.homeDir : '';
  const wsDir = typeof ctx.workspaceDir === 'string' ? ctx.workspaceDir : '';
  const workspacePath = wsDir.length > 0 ? `${wsDir}/.github/mcp.json` : '';
  const userPath = home.length > 0 ? `${home}/.copilot/mcp-config.json` : '';

  if (workspacePath.length > 0 && (await exists(workspacePath))) {
    return { kind: 'workspace', path: workspacePath };
  }
  if (userPath.length > 0 && (await exists(userPath))) {
    return { kind: 'user', path: userPath };
  }
  return { kind: 'none', path: '' };
}

export function targetPathFor(
  target: Exclude<CopilotWriteTarget, { kind: 'none' }>,
): TargetPath {
  const scope = target.kind === 'workspace' ? 'project' : 'user';
  const base = target.kind === 'workspace' ? 'workspace' : 'home';
  return { scope, base, path: target.path };
}
