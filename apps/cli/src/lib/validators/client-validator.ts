/**
 * Client Validators
 *
 * Extracted from validate.ts for better modularity.
 * Validates client options, enabled clients, and transport/env configurations.
 *
 * @module lib/validators/client-validator
 */

import type {
  ClientName,
  KnownClientName,
  OvertureConfig,
} from '@overture/config-types';
import { ALL_KNOWN_CLIENTS } from '@overture/config-types';
import type { AdapterRegistry } from '@overture/client-adapters';
import {
  getTransportWarnings,
  getEnvVarErrors,
  getEnvVarWarnings,
  type TransportWarning,
} from '@overture/sync-core';

/**
 * Valid client names (imported from centralized constants)
 * Includes all known clients for validation purposes
 */
const VALID_CLIENT_NAMES: readonly KnownClientName[] = ALL_KNOWN_CLIENTS;

/**
 * Validates --client option if provided
 */
export function validateClientOption(
  options: { client?: string },
  adapterRegistry: AdapterRegistry,
  errors: string[],
): void {
  if (options.client) {
    if (!VALID_CLIENT_NAMES.includes(options.client as ClientName)) {
      errors.push(
        `Invalid --client option: "${options.client}". Valid clients: ${VALID_CLIENT_NAMES.join(', ')}`,
      );
    } else {
      // Check if client adapter exists
      const adapter = adapterRegistry.get(options.client as ClientName);
      if (!adapter) {
        errors.push(`No adapter registered for client: "${options.client}"`);
      }
    }
  }
}

/**
 * Validates sync.enabledClients configuration
 */
export function validateEnabledClients(
  config: OvertureConfig,
  errors: string[],
): void {
  if (config.sync?.enabledClients) {
    for (const client of config.sync.enabledClients) {
      if (!VALID_CLIENT_NAMES.includes(client)) {
        errors.push(
          `Invalid client in sync.enabledClients: "${client}". Valid clients: ${VALID_CLIENT_NAMES.join(', ')}`,
        );
      }
    }
  }
}

/**
 * Determines which clients to validate based on options and config
 */
export function determineClientsToValidate(
  options: { client?: string },
  config: OvertureConfig,
  _adapterRegistry: AdapterRegistry,
): ClientName[] {
  const clientsToValidate: ClientName[] = [];
  if (options.client) {
    clientsToValidate.push(options.client as ClientName);
  } else if (config.sync?.enabledClients) {
    clientsToValidate.push(...config.sync.enabledClients);
  } else if (config.clients) {
    for (const [clientName, clientConfig] of Object.entries(config.clients)) {
      if (
        typeof clientConfig === 'object' &&
        (!('enabled' in clientConfig) || clientConfig.enabled === true)
      ) {
        clientsToValidate.push(clientName as ClientName);
      }
    }
  }
  return clientsToValidate;
}

/**
 * Validates transport and environment variables for specified clients
 */
export function validateTransportAndEnv(
  clientsToValidate: ClientName[],
  config: OvertureConfig,
  adapterRegistry: AdapterRegistry,
): {
  allTransportWarnings: TransportWarning[];
  allEnvErrors: Array<{
    client: string;
    error: string;
    suggestion?: string;
  }>;
  allEnvWarnings: Array<{ client: string; warning: string }>;
} {
  const allTransportWarnings: TransportWarning[] = [];
  const allEnvErrors: Array<{
    client: string;
    error: string;
    suggestion?: string;
  }> = [];
  const allEnvWarnings: Array<{ client: string; warning: string }> = [];

  for (const clientName of clientsToValidate) {
    const adapter = adapterRegistry.get(clientName);
    if (adapter) {
      const warnings = getTransportWarnings(config.mcp, adapter);
      allTransportWarnings.push(...warnings);

      const envErrors = getEnvVarErrors(config, adapter);
      const envWarnings = getEnvVarWarnings(config, adapter);

      // Collect errors with client context
      for (const error of envErrors) {
        allEnvErrors.push({
          client: clientName,
          error: `[${error.mcpName}] ${error.envKey}: ${error.message}`,
          suggestion: error.suggestion,
        });
      }

      // Collect warnings with client context
      for (const warning of envWarnings) {
        allEnvWarnings.push({
          client: clientName,
          warning: `[${warning.mcpName}] ${warning.envKey}: ${warning.message}`,
        });
      }
    }
  }

  return { allTransportWarnings, allEnvErrors, allEnvWarnings };
}
