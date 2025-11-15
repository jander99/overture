/**
 * Adapter Registry
 *
 * Central registry for all client adapters. Manages adapter instances and provides
 * lookup and discovery functionality.
 *
 * @module adapters/adapter-registry
 * @version 2.0
 */

import type { ClientAdapter } from './client-adapter.interface';
import type { ClientName, Platform } from '../domain/config.types';
import { getPlatform } from '../core/path-resolver';

/**
 * Adapter registry singleton
 *
 * Manages all registered client adapters and provides discovery functionality.
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
   * registry.register(new ClaudeCodeAdapter());
   * registry.register(new VSCodeAdapter());
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
   *   const config = adapter.readConfig('/path/to/config');
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
   * Detect installed clients on the current platform
   *
   * Checks which clients are installed by attempting to detect their config paths.
   *
   * @param platform - Target platform (defaults to current platform)
   * @returns Array of installed client names
   *
   * @example
   * ```typescript
   * const installed = registry.detectInstalledClients();
   * // => ['claude-code', 'vscode', 'cursor']
   * ```
   */
  detectInstalledClients(platform?: Platform): ClientName[] {
    const targetPlatform = platform || getPlatform();
    const installed: ClientName[] = [];

    for (const adapter of this.adapters.values()) {
      if (adapter.isInstalled(targetPlatform)) {
        installed.push(adapter.name);
      }
    }

    return installed;
  }

  /**
   * Get adapters for installed clients only
   *
   * @param platform - Target platform (defaults to current platform)
   * @returns Array of adapters for installed clients
   */
  getInstalledAdapters(platform?: Platform): ClientAdapter[] {
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
 * Global adapter registry instance
 *
 * Singleton instance used throughout the application.
 */
export const adapterRegistry = new AdapterRegistry();

/**
 * Get adapter for a specific client
 *
 * Helper function that wraps adapterRegistry.get() with error handling.
 *
 * @param clientName - Name of the client
 * @returns Client adapter instance
 * @throws Error if adapter not found
 *
 * @example
 * ```typescript
 * const adapter = getAdapterForClient('claude-code');
 * const config = adapter.readConfig('/path/to/config');
 * ```
 */
export function getAdapterForClient(clientName: ClientName): ClientAdapter {
  const adapter = adapterRegistry.get(clientName);
  if (!adapter) {
    throw new Error(`No adapter registered for client: ${clientName}`);
  }
  return adapter;
}
