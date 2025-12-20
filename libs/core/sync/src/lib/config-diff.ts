/**
 * Configuration Diff Generation
 *
 * Generates human-readable diffs showing changes between old and new configurations.
 * Useful for dry-run mode and showing users what will change before syncing.
 *
 * @module @overture/sync-core/config-diff
 * @version 3.0
 */

import type { ClientMcpConfig } from '@overture/client-adapters';

/**
 * Type of change detected
 */
export type ChangeType = 'added' | 'modified' | 'removed' | 'unchanged';

/**
 * Detailed change information for a specific MCP server
 */
export interface McpChange {
  name: string;
  type: ChangeType;
  oldValue?: any;
  newValue?: any;
  fieldChanges?: FieldChange[];
}

/**
 * Field-level change within an MCP server configuration
 */
export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
}

/**
 * Complete diff result
 */
export interface ConfigDiff {
  added: string[];
  modified: McpChange[];
  removed: string[];
  unchanged: string[];
  hasChanges: boolean;
}

/**
 * Generate diff between old and new client configurations
 *
 * @param oldConfig - Existing client configuration
 * @param newConfig - New client configuration to apply
 * @param rootKey - Root key for MCP servers ('mcpServers', 'servers', or 'mcp')
 * @returns Detailed diff information
 */
export function generateDiff(
  oldConfig: ClientMcpConfig,
  newConfig: ClientMcpConfig,
  rootKey: 'mcpServers' | 'servers' | 'mcp' = 'mcpServers'
): ConfigDiff {
  const oldServers = oldConfig[rootKey] || {};
  const newServers = newConfig[rootKey] || {};

  const oldKeys = new Set(Object.keys(oldServers));
  const newKeys = new Set(Object.keys(newServers));

  const added: string[] = [];
  const removed: string[] = [];
  const modified: McpChange[] = [];
  const unchanged: string[] = [];

  // Find added MCPs
  for (const key of newKeys) {
    if (!oldKeys.has(key)) {
      added.push(key);
    }
  }

  // Find removed MCPs
  for (const key of oldKeys) {
    if (!newKeys.has(key)) {
      removed.push(key);
    }
  }

  // Find modified and unchanged MCPs
  for (const key of oldKeys) {
    if (newKeys.has(key)) {
      const oldValue = oldServers[key];
      const newValue = newServers[key];

      if (isEqual(oldValue, newValue)) {
        unchanged.push(key);
      } else {
        // Detect field-level changes
        const fieldChanges = detectFieldChanges(oldValue, newValue);
        modified.push({
          name: key,
          type: 'modified',
          oldValue,
          newValue,
          fieldChanges,
        });
      }
    }
  }

  return {
    added: added.sort(),
    modified: modified.sort((a, b) => a.name.localeCompare(b.name)),
    removed: removed.sort(),
    unchanged: unchanged.sort(),
    hasChanges: added.length > 0 || modified.length > 0 || removed.length > 0,
  };
}

/**
 * Detect field-level changes between two objects
 *
 * @param oldObj - Old object
 * @param newObj - New object
 * @returns Array of field changes
 */
function detectFieldChanges(oldObj: any, newObj: any): FieldChange[] {
  const changes: FieldChange[] = [];

  const allFields = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);

  for (const field of allFields) {
    const oldValue = oldObj?.[field];
    const newValue = newObj?.[field];

    if (!isEqual(oldValue, newValue)) {
      changes.push({ field, oldValue, newValue });
    }
  }

  return changes.sort((a, b) => a.field.localeCompare(b.field));
}

/**
 * Deep equality comparison
 *
 * @param a - First value
 * @param b - Second value
 * @returns true if values are deeply equal
 */
function isEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => isEqual(val, b[idx]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => isEqual(a[key], b[key]));
  }

  return false;
}

/**
 * Format diff for human-readable output
 *
 * @param diff - Diff result
 * @param clientName - Name of the client for context
 * @returns Formatted diff string
 */
export function formatDiff(diff: ConfigDiff, clientName?: string): string {
  const lines: string[] = [];

  if (clientName) {
    lines.push(`Configuration changes for ${clientName}:`);
    lines.push('');
  }

  if (!diff.hasChanges) {
    lines.push('No changes detected.');
    return lines.join('\n');
  }

  // Added MCPs
  if (diff.added.length > 0) {
    lines.push(`Added (${diff.added.length}):`);
    for (const name of diff.added) {
      lines.push(`  + ${name}`);
    }
    lines.push('');
  }

  // Modified MCPs
  if (diff.modified.length > 0) {
    lines.push(`Modified (${diff.modified.length}):`);
    for (const change of diff.modified) {
      lines.push(`  ~ ${change.name}`);
      if (change.fieldChanges && change.fieldChanges.length > 0) {
        for (const fieldChange of change.fieldChanges) {
          lines.push(`    - ${fieldChange.field}:`);
          lines.push(`      old: ${formatValue(fieldChange.oldValue)}`);
          lines.push(`      new: ${formatValue(fieldChange.newValue)}`);
        }
      }
    }
    lines.push('');
  }

  // Removed MCPs
  if (diff.removed.length > 0) {
    lines.push(`Removed (${diff.removed.length}):`);
    for (const name of diff.removed) {
      lines.push(`  - ${name}`);
    }
    lines.push('');
  }

  // Summary
  const total = diff.added.length + diff.modified.length + diff.removed.length;
  lines.push(`Total changes: ${total} (${diff.added.length} added, ${diff.modified.length} modified, ${diff.removed.length} removed)`);
  lines.push(`Unchanged: ${diff.unchanged.length}`);

  return lines.join('\n');
}

/**
 * Format a value for display in diff output
 *
 * @param value - Value to format
 * @returns Formatted string
 */
function formatValue(value: any): string {
  if (value === undefined) return '<undefined>';
  if (value === null) return '<null>';
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

/**
 * Generate a compact single-line diff summary
 *
 * @param diff - Diff result
 * @returns Compact summary string
 */
export function formatDiffSummary(diff: ConfigDiff): string {
  if (!diff.hasChanges) return 'No changes';

  const parts: string[] = [];
  if (diff.added.length > 0) parts.push(`+${diff.added.length}`);
  if (diff.modified.length > 0) parts.push(`~${diff.modified.length}`);
  if (diff.removed.length > 0) parts.push(`-${diff.removed.length}`);

  return parts.join(', ');
}
