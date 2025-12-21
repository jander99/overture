/**
 * MCP Conflict Detector
 *
 * Detects when the same MCP server has different configurations across clients.
 *
 * @module @overture/import-core/conflict-detector
 */

import type { DiscoveredMcp, McpConflict } from '@overture/config-types';

/**
 * Detect conflicts in discovered MCPs
 *
 * A conflict occurs when the same MCP name appears in multiple clients
 * but with different configurations.
 *
 * @param discovered - Array of discovered MCPs
 * @returns Array of conflicts
 */
export function detectConflicts(discovered: DiscoveredMcp[]): McpConflict[] {
  const conflicts: McpConflict[] = [];
  const mcpGroups = new Map<string, DiscoveredMcp[]>();

  // Group MCPs by name
  for (const mcp of discovered) {
    const existing = mcpGroups.get(mcp.name) || [];
    existing.push(mcp);
    mcpGroups.set(mcp.name, existing);
  }

  // Check each group for conflicts
  for (const [name, mcps] of mcpGroups.entries()) {
    if (mcps.length < 2) {
      continue; // No conflict if only one source
    }

    // Check if all configs are identical
    const firstConfig = {
      command: mcps[0].command,
      args: mcps[0].args,
      env: mcps[0].env || {},
    };

    let hasConflict = false;
    let reason: McpConflict['reason'] = 'different-command';

    for (let i = 1; i < mcps.length; i++) {
      const currentConfig = {
        command: mcps[i].command,
        args: mcps[i].args,
        env: mcps[i].env || {},
      };

      if (firstConfig.command !== currentConfig.command) {
        hasConflict = true;
        reason = 'different-command';
        break;
      }

      if (!arraysEqual(firstConfig.args, currentConfig.args)) {
        hasConflict = true;
        reason = 'different-args';
        break;
      }

      if (!objectsEqual(firstConfig.env, currentConfig.env)) {
        hasConflict = true;
        reason = 'different-env';
        break;
      }
    }

    if (hasConflict) {
      conflicts.push({
        name,
        sources: mcps.map((m) => m.source),
        configs: mcps.map((m) => ({
          command: m.command,
          args: m.args,
          env: m.env,
        })),
        reason,
      });
    }
  }

  return conflicts;
}

/**
 * Check if two arrays are equal
 */
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Check if two objects are equal (shallow comparison)
 */
function objectsEqual(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();

  if (!arraysEqual(aKeys, bKeys)) {
    return false;
  }

  for (const key of aKeys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Format conflict for display
 */
export function formatConflict(conflict: McpConflict): string {
  const lines: string[] = [];

  lines.push(`⚠️  MCP '${conflict.name}' has conflicting configurations:`);
  lines.push('');

  for (let i = 0; i < conflict.sources.length; i++) {
    const source = conflict.sources[i];
    const config = conflict.configs[i];

    lines.push(`  Source ${i + 1}: ${source.client} (${source.location})`);
    lines.push(`    Command: ${config.command}`);
    lines.push(`    Args: ${JSON.stringify(config.args)}`);

    if (config.env && Object.keys(config.env).length > 0) {
      lines.push(`    Env: ${JSON.stringify(config.env)}`);
    }

    lines.push('');
  }

  lines.push(`  Reason: ${formatReason(conflict.reason)}`);

  return lines.join('\n');
}

/**
 * Format conflict reason for display
 */
function formatReason(reason: McpConflict['reason']): string {
  switch (reason) {
    case 'different-command':
      return 'Different commands';
    case 'different-args':
      return 'Different arguments';
    case 'different-env':
      return 'Different environment variables';
    default:
      return 'Unknown';
  }
}
