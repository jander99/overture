/**
 * MCP Exclusion System
 *
 * Filters which MCP servers should be synced to which clients based on:
 * - Platform exclusions
 * - Client include/exclude rules
 * - Transport compatibility
 * - Scope (global vs project)
 *
 * @module @overture/sync-core/exclusion-filter
 * @version 2.0
 */

import type { Platform, OvertureConfig } from '@overture/config-types';
import type { ClientAdapter } from '@overture/client-adapters';

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
 * @returns Filtered MCP configurations
 */
export function filterMcpsForClient(
  mcps: OvertureConfig['mcp'],
  client: ClientAdapter,
  platform: Platform,
): OvertureConfig['mcp'] {
  const filtered: OvertureConfig['mcp'] = {};

  for (const [name, mcpConfig] of Object.entries(mcps)) {
    // name comes from Object.entries - safe to check in mcps object
    // eslint-disable-next-line security/detect-object-injection -- name from Object.entries()
    if (Object.hasOwn(mcps, name)) {
      const result = shouldIncludeMcp(mcpConfig, client, platform);
      if (result.included) {
        // eslint-disable-next-line security/detect-object-injection -- name from Object.entries()
        filtered[name] = mcpConfig;
      }
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
 * @returns Filter result with reason
 */
export function shouldIncludeMcp(
  mcpConfig: OvertureConfig['mcp'][string],
  client: ClientAdapter,
  platform: Platform,
): FilterResult {
  // Check platform exclusions
  if (mcpConfig.platforms?.exclude?.includes(platform)) {
    return { included: false, reason: `Platform ${platform} is excluded` };
  }

  // Check client exclusions
  if (mcpConfig.clients?.exclude?.includes(client.name)) {
    return { included: false, reason: `Client ${client.name} is excluded` };
  }

  // Check client inclusions (whitelist)
  if (
    mcpConfig.clients?.include &&
    !mcpConfig.clients.include.includes(client.name)
  ) {
    return {
      included: false,
      reason: `Client ${client.name} not in include list`,
    };
  }

  // Check transport support
  if (!client.supportsTransport(mcpConfig.transport)) {
    return {
      included: false,
      reason: `Transport ${mcpConfig.transport} not supported by ${client.name}`,
    };
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
  mcps: OvertureConfig['mcp'],
  client: ClientAdapter,
  platform: Platform,
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
}

export function getFilterSummary(
  mcps: OvertureConfig['mcp'],
  client: ClientAdapter,
  platform: Platform,
): FilterSummary {
  const summary: FilterSummary = {
    total: Object.keys(mcps).length,
    included: 0,
    excluded: 0,
    excludedByPlatform: 0,
    excludedByClient: 0,
    excludedByTransport: 0,
  };

  for (const [name, mcpConfig] of Object.entries(mcps)) {
    // name comes from Object.entries - safe to check in mcps object
    // eslint-disable-next-line security/detect-object-injection -- name from Object.entries()
    if (!Object.hasOwn(mcps, name)) continue;
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
  availableMcps: OvertureConfig['mcp'],
  client: ClientAdapter,
  platform: Platform,
): ValidationResult {
  const missingMcps: string[] = [];
  const excludedMcps: Array<{ name: string; reason: string }> = [];

  for (const requiredName of requiredMcps) {
    // Check if MCP exists
    if (
      !Object.hasOwn(availableMcps, requiredName) ||
      !availableMcps[requiredName]
    ) {
      missingMcps.push(requiredName);
      continue;
    }

    // Check if MCP would be excluded
    const result = shouldIncludeMcp(
      availableMcps[requiredName],
      client,
      platform,
    );
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
