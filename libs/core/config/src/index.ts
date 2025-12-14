/**
 * @overture/config-core
 *
 * Core configuration loading and path resolution for Overture.
 * Uses hexagonal architecture with dependency injection.
 *
 * @module @overture/config-core
 * @version 3.0
 *
 * @example
 * ```typescript
 * import { ConfigLoader, PathResolver } from '@overture/config-core';
 * import { NodeFilesystemAdapter, NodeEnvironmentAdapter } from '@overture/adapters-node';
 *
 * // Create adapters
 * const filesystem = new NodeFilesystemAdapter();
 * const environment = new NodeEnvironmentAdapter();
 *
 * // Create services with dependency injection
 * const pathResolver = new PathResolver(environment, filesystem);
 * const configLoader = new ConfigLoader(filesystem, pathResolver);
 *
 * // Load configuration
 * const config = await configLoader.loadConfig();
 * ```
 */

// Services
export { ConfigLoader } from './lib/config-loader.js';
export { PathResolver } from './lib/path-resolver.js';

// Constants
export * from './lib/constants.js';
