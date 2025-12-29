/**
 * Client-Aware Environment Variable Expansion Service
 *
 * Provides environment variable expansion based on client capabilities.
 * Some clients (Claude Code, Cursor, Windsurf) have native ${VAR} support,
 * while others (VS Code, JetBrains) require Overture to expand variables.
 *
 * @module @overture/sync-core/client-env-service
 * @version 3.0
 */

import type {
  ClientAdapter,
  ClientMcpConfig,
  ClientMcpServerDef,
} from '@overture/client-adapters';
import {
  expandEnvVars,
  expandEnvVarsInObject,
  expandEnvVarsInArgs,
} from './env-expander.js';

/**
 * Determine if environment variables should be expanded for a client
 *
 * Uses the adapter's needsEnvVarExpansion() method to determine if
 * the client requires Overture to expand environment variables.
 *
 * @param client - Client adapter
 * @returns True if env vars should be expanded, false if client handles natively
 */
export function shouldExpandEnvVars(client: ClientAdapter): boolean {
  return client.needsEnvVarExpansion();
}

/**
 * Expand environment variables in a single MCP configuration
 *
 * Expands env vars in command, args, and env fields based on client needs.
 *
 * @param mcpConfig - MCP server configuration
 * @param client - Client adapter
 * @param env - Environment object (defaults to process.env)
 * @returns MCP config with expanded env vars (if needed)
 */
export function expandEnvVarsInMcpConfig(
  mcpConfig: unknown,
  client: ClientAdapter,
  env: Record<string, string | undefined> = process.env,
): unknown {
  if (!shouldExpandEnvVars(client)) {
    return mcpConfig; // Client handles expansion natively
  }

  if (typeof mcpConfig !== 'object' || mcpConfig === null) {
    return mcpConfig;
  }

  const result = { ...mcpConfig } as Record<string, unknown>;

  // Expand command if it contains env vars
  if (typeof result.command === 'string') {
    result.command = expandEnvVars(result.command, env);
  }

  // Expand args array
  if (Array.isArray(result.args)) {
    result.args = expandEnvVarsInArgs(result.args, env);
  }

  // Expand env object
  if (result.env && typeof result.env === 'object') {
    result.env = expandEnvVarsInObject(
      result.env as Record<string, unknown>,
      env,
    );
  }

  return result;
}

/**
 * Expand environment variables in entire client configuration
 *
 * Applies expansion to all MCP server configs in a client configuration
 * based on whether the client needs Overture to expand variables.
 *
 * @param config - Client MCP configuration
 * @param client - Client adapter
 * @param env - Environment object (defaults to process.env)
 * @returns Client config with expanded env vars (if needed)
 */
export function expandEnvVarsInClientConfig(
  config: ClientMcpConfig,
  client: ClientAdapter,
  env: Record<string, string | undefined> = process.env,
): ClientMcpConfig {
  if (!shouldExpandEnvVars(client)) {
    return config; // Client handles expansion natively
  }

  const rootKey = client.schemaRootKey;
  // rootKey comes from client.schemaRootKey - validated with Object.hasOwn
  // eslint-disable-next-line security/detect-object-injection -- rootKey from client schema
  const servers = (Object.hasOwn(config, rootKey) ? config[rootKey] : {}) || {};
  const expandedServers: Record<string, ClientMcpServerDef> = {};

  for (const [name, mcpConfig] of Object.entries(
    servers as Record<string, unknown>,
  )) {
    expandedServers[name] = expandEnvVarsInMcpConfig(
      mcpConfig,
      client,
      env,
    ) as ClientMcpServerDef;
  }

  return {
    ...config,
    [rootKey]: expandedServers,
  };
}

/**
 * Get list of clients that require Overture to expand env vars
 *
 * @param clients - Array of client adapters
 * @returns Array of client names that need expansion
 */
export function getClientsNeedingExpansion(clients: ClientAdapter[]): string[] {
  return clients
    .filter((client) => shouldExpandEnvVars(client))
    .map((client) => client.name);
}

/**
 * Get list of clients with native env var expansion support
 *
 * @param clients - Array of client adapters
 * @returns Array of client names with native support
 */
export function getClientsWithNativeSupport(
  clients: ClientAdapter[],
): string[] {
  return clients
    .filter((client) => !shouldExpandEnvVars(client))
    .map((client) => client.name);
}
