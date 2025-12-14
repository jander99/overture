/**
 * @overture/plugin-core
 *
 * Core plugin management services for Overture.
 * Implements hexagonal architecture with dependency injection.
 *
 * @module @overture/plugin-core
 * @version 3.0.0
 *
 * @example
 * ```typescript
 * import { PluginDetector, PluginInstaller, PluginExporter } from '@overture/plugin-core';
 * import {
 *   NodeFilesystemAdapter,
 *   NodeEnvironmentAdapter,
 *   NodeProcessAdapter,
 *   ConsoleOutputAdapter
 * } from '@overture/adapters-node';
 *
 * // Create adapters
 * const filesystem = new NodeFilesystemAdapter();
 * const environment = new NodeEnvironmentAdapter();
 * const process = new NodeProcessAdapter();
 * const output = new ConsoleOutputAdapter();
 *
 * // Create services with dependency injection
 * const detector = new PluginDetector(filesystem, environment);
 * const installer = new PluginInstaller(process, output);
 * const exporter = new PluginExporter(filesystem, output, detector, pathResolver);
 *
 * // Use services
 * const plugins = await detector.detectInstalledPlugins();
 * const result = await installer.installPlugin('python-development', 'claude-code-workflows');
 * await exporter.exportPlugins({ interactive: false, pluginNames: ['python-development'] });
 * ```
 */

// Services
export { PluginDetector } from './lib/plugin-detector.js';
export { PluginInstaller } from './lib/plugin-installer.js';
export { PluginExporter } from './lib/plugin-exporter.js';

// Types (re-exported from config-types for convenience)
export type { PluginSelection } from './lib/plugin-exporter.js';
