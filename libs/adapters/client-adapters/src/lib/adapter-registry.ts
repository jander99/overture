/**
 * Adapter Registry
 *
 * Central registry for all client adapters. Manages adapter instances and provides
 * lookup and discovery functionality.
 *
 * @module adapters/adapter-registry
 * @version 3.0 - Factory Function with Dependency Injection
 */

import type { ClientAdapter } from './client-adapter.interface.js';
import type { ClientName, Platform } from '@overture/config-types';

/**
 * Adapter registry
 *
 * Manages all registered client adapters and provides discovery functionality.
 *
 * **Version 3.0 Changes:**
 * - No longer a singleton - instantiated via factory function
 * - Accepts adapters via registration methods
 * - Platform detection removed (passed as parameter to methods)
 */
export class AdapterRegistry {
  private adapters: Map<ClientName, ClientAdapter> = new Map();

  /**
   * Register a client adapter
   *
   * @param adapter - Client adapter instance to register
   *
   * @example
   * ```typescript
   * const registry = new AdapterRegistry();
   * registry.register(new ClaudeCodeAdapter(filesystemPort));
   * registry.register(new VSCodeAdapter(filesystemPort));
   * ```
   */
  register(adapter: ClientAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  /**
   * Get adapter by client name
   *
   * @param name - Client name
   * @returns Adapter instance or undefined if not registered
   *
   * @example
   * ```typescript
   * const adapter = registry.get('claude-code');
   * if (adapter) {
   *   const config = await adapter.readConfig('/path/to/config');
   * }
   * ```
   */
  get(name: ClientName): ClientAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * Get all registered adapters
   *
   * @returns Array of all adapter instances
   */
  getAll(): ClientAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get all registered client names
   *
   * @returns Array of registered client names
   */
  getAllNames(): ClientName[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Detect installed clients on the specified platform
   *
   * Checks which clients are installed by attempting to detect their config paths.
   *
   * @param platform - Target platform
   * @returns Array of installed client names
   *
   * @example
   * ```typescript
   * const installed = registry.detectInstalledClients('linux');
   * // => ['claude-code', 'vscode', 'cursor']
   * ```
   */
  detectInstalledClients(platform: Platform): ClientName[] {
    const installed: ClientName[] = [];

    for (const adapter of this.adapters.values()) {
      if (adapter.isInstalled(platform)) {
        installed.push(adapter.name);
      }
    }

    return installed;
  }

  /**
   * Get adapters for installed clients only
   *
   * @param platform - Target platform
   * @returns Array of adapters for installed clients
   */
  getInstalledAdapters(platform: Platform): ClientAdapter[] {
    const installedNames = this.detectInstalledClients(platform);
    return installedNames.map((name) => this.adapters.get(name)!).filter(Boolean);
  }

  /**
   * Check if a specific client is registered
   *
   * @param name - Client name
   * @returns True if adapter is registered
   */
  has(name: ClientName): boolean {
    return this.adapters.has(name);
  }

  /**
   * Clear all registered adapters
   *
   * Primarily for testing purposes.
   */
  clear(): void {
    this.adapters.clear();
  }

  /**
   * Get number of registered adapters
   *
   * @returns Count of registered adapters
   */
  get size(): number {
    return this.adapters.size;
  }
}

/**
 * Get adapter for a specific client
 *
 * Helper function that wraps registry.get() with error handling.
 *
 * @param registry - Adapter registry instance
 * @param clientName - Name of the client
 * @returns Client adapter instance
 * @throws Error if adapter not found
 *
 * @example
 * ```typescript
 * const adapter = getAdapterForClient(registry, 'claude-code');
 * const config = await adapter.readConfig('/path/to/config');
 * ```
 */
export function getAdapterForClient(registry: AdapterRegistry, clientName: ClientName): ClientAdapter {
  const adapter = registry.get(clientName);
  if (!adapter) {
    throw new Error(`No adapter registered for client: ${clientName}`);
  }
  return adapter;
}
