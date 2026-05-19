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
  oldValue?: unknown;
  newValue?: unknown;
  fieldChanges?: FieldChange[];
}

/**
 * Field-level change within an MCP server configuration
 */
export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
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
/**
 * Categorize keys into added, removed, and common
 */
function getRecordEntry(
  record: Record<string, unknown>,
  targetKey: string,
): unknown {
  return Object.entries(record).find(([key]) => key === targetKey)?.[1];
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getRootRecord(
  config: ClientMcpConfig,
  rootKey: 'mcpServers' | 'servers' | 'mcp',
): Record<string, unknown> {
  return toRecord(getRecordEntry(config, rootKey));
}

function categorizeKeys(
  oldKeys: Set<string>,
  newKeys: Set<string>,
): { added: string[]; removed: string[]; common: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  const common: string[] = [];

  for (const key of newKeys) {
    if (!oldKeys.has(key)) {
      added.push(key);
    } else {
      common.push(key);
    }
  }

  for (const key of oldKeys) {
    if (!newKeys.has(key)) {
      removed.push(key);
    }
  }

  return { added, removed, common };
}

export function generateDiff(
  oldConfig: ClientMcpConfig,
  newConfig: ClientMcpConfig,
  rootKey: 'mcpServers' | 'servers' | 'mcp' = 'mcpServers',
): ConfigDiff {
  const oldServers = getRootRecord(oldConfig, rootKey);
  const newServers = getRootRecord(newConfig, rootKey);

  const oldKeys = new Set(Object.keys(oldServers));
  const newKeys = new Set(Object.keys(newServers));

  const { added, removed, common } = categorizeKeys(oldKeys, newKeys);
  const modified: McpChange[] = [];
  const unchanged: string[] = [];

  // Check common keys for modifications
  for (const key of common) {
    const oldValue = getRecordEntry(oldServers, key);
    const newValue = getRecordEntry(newServers, key);

    if (isEqual(oldValue, newValue)) {
      unchanged.push(key);
    } else {
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
function detectFieldChanges(oldObj: unknown, newObj: unknown): FieldChange[] {
  const changes: FieldChange[] = [];

  const oldRecord = toRecord(oldObj);
  const newRecord = toRecord(newObj);

  const allFields = new Set([
    ...Object.keys(oldRecord),
    ...Object.keys(newRecord),
  ]);

  for (const field of allFields) {
    const oldValue = getRecordEntry(oldRecord, field);
    const newValue = getRecordEntry(newRecord, field);

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
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => isEqual(val, b.at(idx)));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) =>
      isEqual(getRecordEntry(objA, key), getRecordEntry(objB, key)),
    );
  }

  return false;
}

/**
 * Format a value for display in diff output
 *
 * @param value - Value to format
 * @returns Formatted string
 */
function formatValue(value: unknown): string {
  if (value === undefined) return '<undefined>';
  if (value === null) return '<null>';
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

/**
 * Format added MCPs section
 */
function formatAddedSection(added: string[]): string[] {
  if (added.length === 0) return [];
  const lines = [`Added (${added.length}):`];
  for (const name of added) {
    lines.push(`  + ${name}`);
  }
  lines.push('');
  return lines;
}

/**
 * Format modified MCPs section
 */
function formatModifiedSection(modified: ConfigDiff['modified']): string[] {
  if (modified.length === 0) return [];
  const lines = [`Modified (${modified.length}):`];
  for (const change of modified) {
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
  return lines;
}

/**
 * Format removed MCPs section
 */
function formatRemovedSection(removed: string[]): string[] {
  if (removed.length === 0) return [];
  const lines = [`Removed (${removed.length}):`];
  for (const name of removed) {
    lines.push(`  - ${name}`);
  }
  lines.push('');
  return lines;
}

/**
 * Format diff totals
 */
function formatDiffTotals(diff: ConfigDiff): string[] {
  const total = diff.added.length + diff.modified.length + diff.removed.length;
  return [
    `Total changes: ${total} (${diff.added.length} added, ${diff.modified.length} modified, ${diff.removed.length} removed)`,
    `Unchanged: ${diff.unchanged.length}`,
  ];
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

  lines.push(...formatAddedSection(diff.added));
  lines.push(...formatModifiedSection(diff.modified));
  lines.push(...formatRemovedSection(diff.removed));
  lines.push(...formatDiffTotals(diff));

  return lines.join('\n');
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
