/**
 * MCP Detector
 *
 * Utilities for detecting and comparing MCPs across Overture and client configurations.
 * Provides simple read/compare operations without metadata tracking.
 *
 * @module @overture/sync-core/mcp-detector
 * @version 3.0
 */

import type { McpServerConfig } from '@overture/config-types';

/**
 * Detected MCP with source information
 */
export interface DetectedMcp {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  transport?: string; // 'stdio' | 'sse' | 'http'
  source: 'overture' | 'manual';
  scope: 'global' | 'project' | 'both';
  detectedFrom: string; // e.g., "~/.claude.json", ".mcp.json"
}

/**
 * MCP detection result
 */
export interface McpDetectionResult {
  /** All MCPs from all sources */
  all: DetectedMcp[];

  /** MCPs managed by Overture */
  managed: DetectedMcp[];

  /** MCPs manually added (not in Overture config) */
  unmanaged: DetectedMcp[];
}

/**
 * Compare Overture config with client configs
 *
 * Categorizes MCPs into:
 * - Managed: MCPs in Overture config (regardless of client presence)
 * - Unmanaged: MCPs in client config but NOT in Overture config
 *
 * @param overtureMcps - MCPs from Overture config
 * @param clientMcps - MCPs from client configs
 * @returns Detection result with categorized MCPs
 */
export function compareMcpConfigs(
  overtureMcps: Record<string, McpServerConfig>,
  clientMcps: Record<string, any>,
): McpDetectionResult {
  const overtureNames = new Set(Object.keys(overtureMcps));

  const all: DetectedMcp[] = [];
  const managed: DetectedMcp[] = [];
  const unmanaged: DetectedMcp[] = [];

  // Add Overture-managed MCPs
  for (const [name, config] of Object.entries(overtureMcps)) {
    const mcp: DetectedMcp = {
      name,
      command: config.command,
      args: config.args,
      env: config.env,
      transport: config.transport,
      source: 'overture',
      scope: 'global', // Will be determined by caller based on config location
      detectedFrom: 'overture-config',
    };

    all.push(mcp);
    managed.push(mcp);
  }

  // Add manually-added MCPs (in client but not in Overture)
  for (const [name, config] of Object.entries(clientMcps)) {
    if (overtureNames.has(name)) {
      // Already added as managed MCP
      continue;
    }

    const mcp: DetectedMcp = {
      name,
      command: config.command,
      args: config.args || [],
      env: config.env,
      transport: config.type || 'stdio', // Claude configs use 'type', not 'transport'
      source: 'manual',
      scope: 'global', // Will be refined by caller
      detectedFrom: 'client-config',
    };

    all.push(mcp);
    unmanaged.push(mcp);
  }

  return {
    all,
    managed,
    unmanaged,
  };
}

/**
 * Get list of MCPs that should be preserved during sync
 *
 * These are MCPs in the client config but NOT in Overture config.
 * They will be preserved as-is during sync.
 *
 * @param existingClientConfig - Existing client MCP config
 * @param overtureMcps - MCPs from Overture config
 * @returns Map of MCP name to config for MCPs to preserve
 */
export function getUnmanagedMcps(
  existingClientConfig: Record<string, any>,
  overtureMcps: Record<string, McpServerConfig>,
): Record<string, any> {
  const overtureNames = new Set(Object.keys(overtureMcps));
  const preserved: Record<string, any> = {};

  for (const [name, config] of Object.entries(existingClientConfig)) {
    if (!overtureNames.has(name)) {
      preserved[name] = config;
    }
  }

  return preserved;
}
