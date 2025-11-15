/**
 * Transport Validation Service
 *
 * Validates that MCP servers use transports supported by target clients.
 * Provides warnings and filtering capabilities for unsupported transports.
 *
 * @module core/transport-validator
 * @version 2.0
 */

import type { OvertureConfig, TransportType } from '../domain/config.types';
import type { ClientAdapter } from '../adapters/client-adapter.interface';

/**
 * Transport validation result for a single MCP
 */
export interface TransportValidation {
  mcpName: string;
  transport: TransportType;
  supported: boolean;
  clientName: string;
}

/**
 * Transport validation summary
 */
export interface TransportValidationSummary {
  total: number;
  supported: number;
  unsupported: number;
  warnings: TransportWarning[];
}

/**
 * Transport warning
 */
export interface TransportWarning {
  mcpName: string;
  transport: TransportType;
  clientName: string;
  message: string;
}

/**
 * Validate a single MCP's transport against a client
 *
 * @param mcpName - Name of the MCP
 * @param transport - Transport type
 * @param client - Client adapter
 * @returns Validation result
 */
export function validateMcpTransport(
  mcpName: string,
  transport: TransportType,
  client: ClientAdapter
): TransportValidation {
  return {
    mcpName,
    transport,
    supported: client.supportsTransport(transport),
    clientName: client.name,
  };
}

/**
 * Validate all MCPs in a configuration against a client
 *
 * @param mcps - MCP configurations
 * @param client - Client adapter
 * @returns Array of validation results
 */
export function validateAllTransports(
  mcps: OvertureConfig['mcp'],
  client: ClientAdapter
): TransportValidation[] {
  const results: TransportValidation[] = [];

  for (const [name, mcpConfig] of Object.entries(mcps)) {
    results.push(validateMcpTransport(name, mcpConfig.transport, client));
  }

  return results;
}

/**
 * Get transport warnings for unsupported MCPs
 *
 * @param mcps - MCP configurations
 * @param client - Client adapter
 * @returns Array of warnings for unsupported transports
 */
export function getTransportWarnings(
  mcps: OvertureConfig['mcp'],
  client: ClientAdapter
): TransportWarning[] {
  const warnings: TransportWarning[] = [];

  for (const [name, mcpConfig] of Object.entries(mcps)) {
    if (!client.supportsTransport(mcpConfig.transport)) {
      warnings.push({
        mcpName: name,
        transport: mcpConfig.transport,
        clientName: client.name,
        message: `MCP "${name}" uses transport "${mcpConfig.transport}" which is not supported by ${client.name}`,
      });
    }
  }

  return warnings;
}

/**
 * Filter MCPs to only those with supported transports
 *
 * @param mcps - MCP configurations
 * @param client - Client adapter
 * @returns Filtered MCP configurations
 */
export function filterByTransport(
  mcps: OvertureConfig['mcp'],
  client: ClientAdapter
): OvertureConfig['mcp'] {
  const filtered: OvertureConfig['mcp'] = {};

  for (const [name, mcpConfig] of Object.entries(mcps)) {
    if (client.supportsTransport(mcpConfig.transport)) {
      filtered[name] = mcpConfig;
    }
  }

  return filtered;
}

/**
 * Get transport validation summary
 *
 * @param mcps - MCP configurations
 * @param client - Client adapter
 * @returns Validation summary
 */
export function getTransportValidationSummary(
  mcps: OvertureConfig['mcp'],
  client: ClientAdapter
): TransportValidationSummary {
  const validations = validateAllTransports(mcps, client);
  const warnings = getTransportWarnings(mcps, client);

  return {
    total: validations.length,
    supported: validations.filter((v) => v.supported).length,
    unsupported: validations.filter((v) => !v.supported).length,
    warnings,
  };
}

/**
 * Check if any MCPs have unsupported transports
 *
 * @param mcps - MCP configurations
 * @param client - Client adapter
 * @returns True if any MCPs have unsupported transports
 */
export function hasTransportIssues(
  mcps: OvertureConfig['mcp'],
  client: ClientAdapter
): boolean {
  return getTransportWarnings(mcps, client).length > 0;
}

/**
 * Format transport warnings as human-readable text
 *
 * @param warnings - Transport warnings
 * @returns Formatted warning text
 */
export function formatTransportWarnings(warnings: TransportWarning[]): string {
  if (warnings.length === 0) {
    return 'No transport issues detected.';
  }

  const lines: string[] = [`Transport Warnings (${warnings.length}):\n`];

  for (const warning of warnings) {
    lines.push(`  ⚠ ${warning.message}`);
  }

  return lines.join('\n');
}
