/**
 * Adapter Factory
 *
 * Factory functions to create adapter registry with all client adapters registered.
 * Handles dependency injection for all adapters.
 *
 * @module adapters/adapter-factory
 * @version 3.0 - Hexagonal Architecture with Dependency Injection
 */

import type { FilesystemPort } from '@overture/ports-filesystem';
import { AdapterRegistry } from './adapter-registry.js';
import { ClaudeCodeAdapter } from './adapters/claude-code.adapter.js';
import type { ClientAdapter } from './client-adapter.interface.js';

/**
 * Create adapter registry with all client adapters registered
 *
 * This factory function creates an AdapterRegistry and registers all available
 * client adapters with dependency injection.
 *
 * @param filesystem - Filesystem port implementation
 * @returns Configured adapter registry with all adapters registered
 *
 * @example
 * ```typescript
 * import { createFilesystemAdapter } from '@overture/adapters-filesystem';
 * import { createAdapterRegistry } from '@overture/client-adapters';
 *
 * const filesystem = createFilesystemAdapter();
 * const registry = createAdapterRegistry(filesystem);
 *
 * // Use registry
 * const adapter = registry.get('claude-code');
 * const config = await adapter.readConfig('/path/to/config');
 * ```
 */
export function createAdapterRegistry(filesystem: FilesystemPort): AdapterRegistry {
  const registry = new AdapterRegistry();

  // Register all client adapters with DI
  registry.register(new ClaudeCodeAdapter(filesystem));
  // TODO: Register remaining 8 adapters when implemented
  // registry.register(new ClaudeDesktopAdapter(filesystem));
  // registry.register(new VSCodeAdapter(filesystem));
  // registry.register(new CursorAdapter(filesystem));
  // registry.register(new WindsurfAdapter(filesystem));
  // registry.register(new JetBrainsCopilotAdapter(filesystem));
  // registry.register(new CopilotCliAdapter(filesystem));
  // registry.register(new CodexAdapter(filesystem));
  // registry.register(new GeminiCliAdapter(filesystem));

  return registry;
}

/**
 * Create a single adapter instance with dependency injection
 *
 * Helper function to create individual adapters for testing or specialized use cases.
 *
 * @param adapterName - Name of the adapter to create
 * @param filesystem - Filesystem port implementation
 * @returns Adapter instance
 * @throws Error if adapter name is unknown
 *
 * @example
 * ```typescript
 * const adapter = createAdapter('claude-code', filesystem);
 * const config = await adapter.readConfig('/path/to/config');
 * ```
 */
export function createAdapter(
  adapterName: string,
  filesystem: FilesystemPort
): ClientAdapter {
  switch (adapterName) {
    case 'claude-code':
      return new ClaudeCodeAdapter(filesystem);
    // TODO: Add remaining adapters
    default:
      throw new Error(`Unknown adapter: ${adapterName}`);
  }
}
