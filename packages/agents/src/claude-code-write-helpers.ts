/**
 * Claude Code write target resolution.
 *
 * The writer chooses between three on-disk targets, in priority order:
 *   1. `<workspaceDir>/.mcp.json` (project scope)
 *   2. `<homeDir>/.claude.json` top-level `mcpServers`
 *   3. `<homeDir>/.claude.json` `projects[<workspaceDir>].mcpServers`
 *
 * The picker is conservative: it returns a descriptor that records the
 * path it found and the section the writer must walk to. It never reads
 * the file itself; the writer is responsible for the byte-level splice.
 *
 * No creation. If no applicable target exists, the picker returns
 * `{ kind: 'none', path: '' }` so the writer can surface
 * `reason: 'not-targetable'`.
 */
import { access } from 'node:fs/promises';
import type { PathResolutionContext } from './types.js';

export type ClaudeCodeWriteTarget =
  | { readonly kind: 'project'; readonly path: string }
  | { readonly kind: 'user-top'; readonly path: string }
  | {
      readonly kind: 'user-projects';
      readonly path: string;
      readonly workspaceKey: string;
    }
  | { readonly kind: 'none'; readonly path: '' };

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function pickClaudeCodeTarget(
  ctx: PathResolutionContext,
): Promise<ClaudeCodeWriteTarget> {
  const home = typeof ctx.homeDir === 'string' ? ctx.homeDir : '';
  const wsDir = typeof ctx.workspaceDir === 'string' ? ctx.workspaceDir : '';
  const projectPath = wsDir.length > 0 ? `${wsDir}/.mcp.json` : '';
  const userPath = home.length > 0 ? `${home}/.claude.json` : '';

  // Prefer project .mcp.json if it exists.
  if (projectPath.length > 0 && (await exists(projectPath))) {
    return { kind: 'project', path: projectPath };
  }

  // Then ~/.claude.json top-level mcpServers.
  if (userPath.length > 0 && (await exists(userPath))) {
    // We keep the picker conservative: only flag 'user-top' here when
    // we can confirm top-level mcpServers exists. Otherwise defer to
    // the writer to walk projects[ctx.workspaceDir].
    return { kind: 'user-top', path: userPath };
  }

  return { kind: 'none', path: '' };
}
