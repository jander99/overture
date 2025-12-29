/**
 * MCP Conflict Detector
 *
 * Detects when the same MCP server has different configurations across clients.
 *
 * @module @overture/import-core/conflict-detector
 */

import type { DiscoveredMcp, McpConflict } from '@overture/config-types';

// Constant for duplicate string
const REASON_DIFFERENT_COMMAND = 'different-command' as const;

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
  const mcpGroups = groupMcpsByName(discovered);

  // Check each group for conflicts
  for (const [name, mcps] of mcpGroups.entries()) {
    if (mcps.length < 2) continue;

    const conflict = detectConflictInGroup(name, mcps);
    if (conflict) {
      conflicts.push(conflict);
    }
  }

  return conflicts;
}

/**
 * Group MCPs by name
 */
function groupMcpsByName(
  discovered: DiscoveredMcp[],
): Map<string, DiscoveredMcp[]> {
  const mcpGroups = new Map<string, DiscoveredMcp[]>();

  for (const mcp of discovered) {
    const existing = mcpGroups.get(mcp.name) || [];
    existing.push(mcp);
    mcpGroups.set(mcp.name, existing);
  }

  return mcpGroups;
}

/**
 * Detect conflict within a group of MCPs with same name
 */
function detectConflictInGroup(
  name: string,
  mcps: DiscoveredMcp[],
): McpConflict | null {
  const firstConfig = {
    command: mcps[0].command,
    args: mcps[0].args,
    env: mcps[0].env || {},
  };

  let hasConflict = false;
  let reason: McpConflict['reason'] = REASON_DIFFERENT_COMMAND;

  for (let i = 1; i < mcps.length; i++) {
    // eslint-disable-next-line security/detect-object-injection
    const currentMcp = mcps[i];
    if (!currentMcp) continue;

    const currentConfig = {
      command: currentMcp.command,
      args: currentMcp.args,
      env: currentMcp.env || {},
    };

    if (firstConfig.command !== currentConfig.command) {
      hasConflict = true;
      reason = REASON_DIFFERENT_COMMAND;
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

  if (!hasConflict) return null;

  return {
    name,
    sources: mcps.map((m) => m.source),
    configs: mcps.map((m) => ({
      command: m.command,
      args: m.args,
      env: m.env,
    })),
    reason,
  };
}

/**
 * Check if two arrays are equal
 */
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    // eslint-disable-next-line security/detect-object-injection
    const aValue = a[i];
    // eslint-disable-next-line security/detect-object-injection
    const bValue = b[i];
    if (aValue !== bValue) {
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
    // Keys validated with Object.hasOwn
    // eslint-disable-next-line security/detect-object-injection
    if (!Object.hasOwn(a, key) || !Object.hasOwn(b, key) || a[key] !== b[key]) {
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
    // eslint-disable-next-line security/detect-object-injection
    const source = conflict.sources[i];
    // eslint-disable-next-line security/detect-object-injection
    const config = conflict.configs[i];

    if (!source || !config) continue;

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
