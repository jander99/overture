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
import type { EnvironmentPort } from '@overture/ports-process';
import { AdapterRegistry } from './adapter-registry.js';
import { ClaudeCodeAdapter } from './adapters/claude-code.adapter.js';
import { OpenCodeAdapter } from './adapters/opencode.adapter.js';
import type { ClientAdapter } from './client-adapter.interface.js';
import { McpError } from '@overture/errors';

/**
 * Create adapter registry with all client adapters registered
 *
 * This factory function creates an AdapterRegistry and registers all available
 * client adapters with dependency injection.
 *
 * @param filesystem - Filesystem port implementation
 * @param environment - Environment port implementation
 * @returns Configured adapter registry with all adapters registered
 *
 * @example
 * ```typescript
 * import { createFilesystemAdapter, createEnvironmentAdapter } from '@overture/adapters-infrastructure';
 * import { createAdapterRegistry } from '@overture/client-adapters';
 *
 * const filesystem = createFilesystemAdapter();
 * const environment = createEnvironmentAdapter();
 * const registry = createAdapterRegistry(filesystem, environment);
 *
 * // Use registry
 * const adapter = registry.get('claude-code');
 * const config = await adapter.readConfig('/path/to/config');
 * ```
 */
export function createAdapterRegistry(
  filesystem: FilesystemPort,
  environment: EnvironmentPort
): AdapterRegistry {
  const registry = new AdapterRegistry();

  // Register all client adapters with DI
  registry.register(new ClaudeCodeAdapter(filesystem, environment));
  registry.register(new OpenCodeAdapter(filesystem, environment));
  // TODO: Register remaining 7 adapters when implemented
  // registry.register(new ClaudeDesktopAdapter(filesystem, environment));
  // registry.register(new VSCodeAdapter(filesystem, environment));
  // registry.register(new CursorAdapter(filesystem, environment));
  // registry.register(new WindsurfAdapter(filesystem, environment));
  // registry.register(new JetBrainsCopilotAdapter(filesystem, environment));
  // registry.register(new CopilotCliAdapter(filesystem, environment));
  // registry.register(new CodexAdapter(filesystem, environment));
  // registry.register(new GeminiCliAdapter(filesystem, environment));

  return registry;
}

/**
 * Create a single adapter instance with dependency injection
 *
 * Helper function to create individual adapters for testing or specialized use cases.
 *
 * @param adapterName - Name of the adapter to create
 * @param filesystem - Filesystem port implementation
 * @param environment - Environment port implementation
 * @returns Adapter instance
 * @throws Error if adapter name is unknown
 *
 * @example
 * ```typescript
 * const adapter = createAdapter('claude-code', filesystem, environment);
 * const config = await adapter.readConfig('/path/to/config');
 * ```
 */
export function createAdapter(
  adapterName: string,
  filesystem: FilesystemPort,
  environment: EnvironmentPort
): ClientAdapter {
  switch (adapterName) {
    case 'claude-code':
      return new ClaudeCodeAdapter(filesystem, environment);
    case 'opencode':
      return new OpenCodeAdapter(filesystem, environment);
    // TODO: Add remaining adapters
    default:
      throw new McpError(`Unknown adapter: ${adapterName}`);
  }
}
