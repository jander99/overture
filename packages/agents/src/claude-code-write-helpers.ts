/**
 * Claude Code write target resolution.
 *
 * The writer chooses between three on-disk targets, in priority order:
 *   1. `<workspaceDir>/.mcp.json` (project scope)
 *   2. `<homeDir>/.claude.json` top-level `mcpServers`
 *   3. `<homeDir>/.claude.json` `projects[<workspaceDir>].mcpServers`
 *
 * The picker is conservative: it returns a descriptor that records the
 * path it found and the section the writer must walk to. It reads the
 * user file to determine whether top-level mcpServers or nested
 * projects[workspaceDir].mcpServers is present.
 *
 * No creation. If no applicable target exists, the picker returns
 * `{ kind: 'none', path: '' }` so the writer can surface
 * `reason: 'not-targetable'`.
 */
import { access, readFile } from 'node:fs/promises';
import { isRecord } from './normalize-mcp-config.js';
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

/**
 * Decision table for Claude Code write target:
 * - project `.mcp.json` exists → project
 * - else `~/.claude.json` with top-level `mcpServers` → user-top
 * - else `~/.claude.json.projects[workspaceDir].mcpServers` exists → user-projects
 * - else none
 */
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

  // Then check user file for top-level or nested mcpServers.
  if (userPath.length > 0 && (await exists(userPath))) {
    try {
      const body = await readFile(userPath, 'utf8');
      const parsed: unknown = JSON.parse(body);
      if (!isRecord(parsed)) {
        return { kind: 'none', path: '' };
      }
      const top = parsed['mcpServers'];
      if (isRecord(top)) {
        // Top-level mcpServers exists → user-top
        return { kind: 'user-top', path: userPath };
      }
      // Check nested projects[workspaceDir].mcpServers
      const wsKey = wsDir.length > 0 ? wsDir : '';
      if (wsKey.length > 0) {
        const projects = parsed['projects'];
        if (isRecord(projects)) {
          const project = projects[wsKey];
          if (isRecord(project)) {
            const nested = project['mcpServers'];
            if (isRecord(nested)) {
              return { kind: 'user-projects', path: userPath, workspaceKey: wsKey };
            }
          }
        }
      }
    } catch {
      // File read/parse failed → not targetable
      return { kind: 'none', path: '' };
    }
  }

  return { kind: 'none', path: '' };
}
