/**
 * @overture/adapters-infrastructure
 *
 * Node.js-based infrastructure adapters for hexagonal architecture ports.
 *
 * This library provides concrete implementations of port interfaces using Node.js built-in modules.
 * These are the ONLY modules in Overture that should directly import Node.js built-ins (fs, os, child_process).
 *
 * @module @overture/adapters-infrastructure
 *
 * @example
 * ```typescript
 * import {
 *   NodeFilesystemAdapter,
 *   NodeProcessAdapter,
 *   NodeEnvironmentAdapter,
 *   FsUtils,
 *   TemplateLoader
 * } from '@overture/adapters-infrastructure';
 *
 * // Use port implementations
 * const filesystem = new NodeFilesystemAdapter();
 * await filesystem.readFile('config.yml');
 *
 * // Use legacy utilities (being phased out)
 * const config = await FsUtils.readFile('config.yml');
 * ```
 */

// Port Implementations (Hexagonal Architecture)
export { NodeFilesystemAdapter } from './lib/node-filesystem.adapter.js';
export { NodeProcessAdapter } from './lib/node-process.adapter.js';
export { NodeEnvironmentAdapter } from './lib/node-environment.adapter.js';

// Legacy Utilities (TODO: Phase out in favor of port-based architecture)
export { FsUtils } from './lib/fs-utils.js';
export { TemplateLoader } from './lib/template-loader.js';

// Re-export types from ports for convenience
export type { FilesystemPort, Stats } from '@overture/ports-filesystem';

export type { ProcessPort, ExecResult } from '@overture/ports-process';

export type { EnvironmentPort, Platform } from '@overture/ports-process';

export type { OutputPort } from '@overture/ports-output';
