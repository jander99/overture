/**
 * MCP Exclusion System
 *
 * Filters which MCP servers should be synced to which clients based on:
 * - Platform exclusions
 * - Client include/exclude rules
 * - Transport compatibility
 * - Scope (global vs project)
 *
 * @module core/exclusion-filter
 * @version 2.0
 */

import type { Platform, OvertureConfigV2 } from '../domain/config-v2.types';
import type { ClientAdapter } from '../adapters/client-adapter.interface';

/**
 * Filter result with exclusion reason
 */
export interface FilterResult {
  included: boolean;
  reason?: string;
}

/**
 * Filter MCPs for a specific client
 *
 * @param mcps - MCP configurations from Overture config
 * @param client - Target client adapter
 * @param platform - Target platform
 * @param scope - Filter by scope ('global' or 'project')
 * @returns Filtered MCP configurations
 */
export function filterMcpsForClient(
  mcps: OvertureConfigV2['mcp'],
  client: ClientAdapter,
  platform: Platform,
  scope?: 'global' | 'project'
): OvertureConfigV2['mcp'] {
  const filtered: OvertureConfigV2['mcp'] = {};

  for (const [name, mcpConfig] of Object.entries(mcps)) {
    const result = shouldIncludeMcp(mcpConfig, client, platform, scope);
    if (result.included) {
      filtered[name] = mcpConfig;
    }
  }

  return filtered;
}

/**
 * Determine if an MCP should be included for a client
 *
 * @param mcpConfig - MCP configuration
 * @param client - Target client adapter
 * @param platform - Target platform
 * @param scopeFilter - Optional scope filter
 * @returns Filter result with reason
 */
export function shouldIncludeMcp(
  mcpConfig: OvertureConfigV2['mcp'][string],
  client: ClientAdapter,
  platform: Platform,
  scopeFilter?: 'global' | 'project'
): FilterResult {
  // Check scope filter (if specified)
  if (scopeFilter && mcpConfig.scope !== scopeFilter) {
    return { included: false, reason: `Scope mismatch: expected ${scopeFilter}, got ${mcpConfig.scope}` };
  }

  // Check platform exclusions
  if (mcpConfig.platforms?.exclude?.includes(platform)) {
    return { included: false, reason: `Platform ${platform} is excluded` };
  }

  // Check client exclusions
  if (mcpConfig.clients?.exclude?.includes(client.name)) {
    return { included: false, reason: `Client ${client.name} is excluded` };
  }

  // Check client inclusions (whitelist)
  if (mcpConfig.clients?.include && !mcpConfig.clients.include.includes(client.name)) {
    return { included: false, reason: `Client ${client.name} not in include list` };
  }

  // Check transport support
  if (!client.supportsTransport(mcpConfig.transport)) {
    return { included: false, reason: `Transport ${mcpConfig.transport} not supported by ${client.name}` };
  }

  return { included: true };
}

/**
 * Get list of MCPs that would be excluded for a client
 *
 * @param mcps - MCP configurations
 * @param client - Target client adapter
 * @param platform - Target platform
 * @returns Array of excluded MCP names with reasons
 */
export function getExcludedMcps(
  mcps: OvertureConfigV2['mcp'],
  client: ClientAdapter,
  platform: Platform
): Array<{ name: string; reason: string }> {
  const excluded: Array<{ name: string; reason: string }> = [];

  for (const [name, mcpConfig] of Object.entries(mcps)) {
    const result = shouldIncludeMcp(mcpConfig, client, platform);
    if (!result.included && result.reason) {
      excluded.push({ name, reason: result.reason });
    }
  }

  return excluded;
}

/**
 * Get summary of MCP filtering for a client
 *
 * @param mcps - MCP configurations
 * @param client - Target client adapter
 * @param platform - Target platform
 * @returns Summary object
 */
export interface FilterSummary {
  total: number;
  included: number;
  excluded: number;
  excludedByPlatform: number;
  excludedByClient: number;
  excludedByTransport: number;
  excludedByScope: number;
}

export function getFilterSummary(
  mcps: OvertureConfigV2['mcp'],
  client: ClientAdapter,
  platform: Platform
): FilterSummary {
  const summary: FilterSummary = {
    total: Object.keys(mcps).length,
    included: 0,
    excluded: 0,
    excludedByPlatform: 0,
    excludedByClient: 0,
    excludedByTransport: 0,
    excludedByScope: 0,
  };

  for (const [, mcpConfig] of Object.entries(mcps)) {
    const result = shouldIncludeMcp(mcpConfig, client, platform);

    if (result.included) {
      summary.included++;
    } else {
      summary.excluded++;

      if (result.reason?.includes('Platform')) {
        summary.excludedByPlatform++;
      } else if (result.reason?.includes('Client')) {
        summary.excludedByClient++;
      } else if (result.reason?.includes('Transport')) {
        summary.excludedByTransport++;
      } else if (result.reason?.includes('Scope')) {
        summary.excludedByScope++;
      }
    }
  }

  return summary;
}

/**
 * Validate that all required MCPs are available for a client
 *
 * @param requiredMcps - List of required MCP names
 * @param availableMcps - Available MCP configurations
 * @param client - Target client adapter
 * @param platform - Target platform
 * @returns Validation result with missing MCPs
 */
export interface ValidationResult {
  valid: boolean;
  missingMcps: string[];
  excludedMcps: Array<{ name: string; reason: string }>;
}

export function validateRequiredMcps(
  requiredMcps: string[],
  availableMcps: OvertureConfigV2['mcp'],
  client: ClientAdapter,
  platform: Platform
): ValidationResult {
  const missingMcps: string[] = [];
  const excludedMcps: Array<{ name: string; reason: string }> = [];

  for (const requiredName of requiredMcps) {
    // Check if MCP exists
    if (!availableMcps[requiredName]) {
      missingMcps.push(requiredName);
      continue;
    }

    // Check if MCP would be excluded
    const result = shouldIncludeMcp(availableMcps[requiredName], client, platform);
    if (!result.included && result.reason) {
      excludedMcps.push({ name: requiredName, reason: result.reason });
    }
  }

  return {
    valid: missingMcps.length === 0 && excludedMcps.length === 0,
    missingMcps,
    excludedMcps,
  };
}
