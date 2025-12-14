/**
 * @overture/ports-filesystem
 *
 * Hexagonal architecture port for filesystem operations.
 *
 * This library defines the contract (interface) for filesystem operations
 * without providing any implementation. Implementations (adapters) should
 * be provided by infrastructure libraries.
 *
 * @module @overture/ports-filesystem
 */

export type { FilesystemPort, Stats } from './lib/filesystem.port.js';
