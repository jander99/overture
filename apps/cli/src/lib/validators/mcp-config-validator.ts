/**
 * MCP Configuration Validators
 *
 * Extracted from validate.ts for better modularity.
 * Validates MCP server configurations for platforms, clients, and duplicates.
 *
 * @module lib/validators/mcp-config-validator
 */

import type {
  Platform,
  KnownClientName,
  OvertureConfig,
} from '@overture/config-types';
import { ALL_KNOWN_CLIENTS } from '@overture/config-types';

/**
 * Valid platform names
 */
const VALID_PLATFORMS: Platform[] = ['darwin', 'linux', 'win32'];

/**
 * Valid client names (imported from centralized constants)
 * Includes all known clients for validation purposes
 */
const VALID_CLIENT_NAMES: readonly KnownClientName[] = ALL_KNOWN_CLIENTS;

/**
 * Safely extracts a string array from an unknown value
 */
function extractStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string');
  }
  return [];
}

/**
 * Validates a list of items from MCP config against valid values
 */
function validateConfigItems(
  items: string[],
  validItems: readonly string[],
  mcpName: string,
  section: string,
  itemType: string,
  errors: string[],
): void {
  for (const item of items) {
    if (!validItems.includes(item)) {
      errors.push(
        `MCP "${mcpName}": invalid ${itemType} in ${section}: "${item}". Valid ${itemType}s: ${validItems.join(', ')}`,
      );
    }
  }
}

/**
 * Validates platform configuration for a single MCP
 */
export function validateMcpPlatforms(
  mcpName: string,
  platforms: Record<string, unknown> | undefined,
  errors: string[],
): void {
  if (!platforms) return;

  if (platforms.exclude) {
    validateConfigItems(
      extractStringArray(platforms.exclude),
      VALID_PLATFORMS,
      mcpName,
      'exclusion list',
      'platform',
      errors,
    );
  }

  if (
    platforms.commandOverrides &&
    typeof platforms.commandOverrides === 'object'
  ) {
    validateConfigItems(
      Object.keys(platforms.commandOverrides),
      VALID_PLATFORMS,
      mcpName,
      'commandOverrides',
      'platform',
      errors,
    );
  }

  if (platforms.argsOverrides && typeof platforms.argsOverrides === 'object') {
    validateConfigItems(
      Object.keys(platforms.argsOverrides),
      VALID_PLATFORMS,
      mcpName,
      'argsOverrides',
      'platform',
      errors,
    );
  }
}

/**
 * Validates client configuration for a single MCP
 */
export function validateMcpClients(
  mcpName: string,
  clients: Record<string, unknown> | undefined,
  errors: string[],
): void {
  if (!clients) return;

  if (clients.exclude) {
    validateConfigItems(
      extractStringArray(clients.exclude),
      VALID_CLIENT_NAMES,
      mcpName,
      'exclusion list',
      'client',
      errors,
    );
  }

  if (clients.include) {
    validateConfigItems(
      extractStringArray(clients.include),
      VALID_CLIENT_NAMES,
      mcpName,
      'include list',
      'client',
      errors,
    );
  }

  if (clients.overrides && typeof clients.overrides === 'object') {
    validateConfigItems(
      Object.keys(clients.overrides),
      VALID_CLIENT_NAMES,
      mcpName,
      'overrides',
      'client',
      errors,
    );
  }
}

/**
 * Validates MCP configuration fields (command, transport, platforms, clients)
 */
export function validateMcpConfigs(
  config: OvertureConfig,
  errors: string[],
): void {
  for (const [mcpName, mcpConfig] of Object.entries(config.mcp)) {
    // Validate required fields
    if (!mcpConfig.command || mcpConfig.command.trim() === '') {
      errors.push(`MCP "${mcpName}": command is required and cannot be empty`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!mcpConfig.transport) {
      errors.push(`MCP "${mcpName}": transport is required`);
    }

    // Validate platform configuration
    validateMcpPlatforms(mcpName, mcpConfig.platforms, errors);

    // Validate client configuration
    validateMcpClients(mcpName, mcpConfig.clients, errors);
  }
}

/**
 * Checks for duplicate MCP names (case-insensitive)
 */
export function checkDuplicateMcpNames(
  config: OvertureConfig,
  errors: string[],
): void {
  const mcpNames = Object.keys(config.mcp);
  const lowerCaseNames = new Map<string, string>();
  for (const name of mcpNames) {
    const lower = name.toLowerCase();
    if (lowerCaseNames.has(lower)) {
      errors.push(
        `Duplicate MCP name (case-insensitive): "${name}" and "${lowerCaseNames.get(lower)}"`,
      );
    } else {
      lowerCaseNames.set(lower, name);
    }
  }
}
