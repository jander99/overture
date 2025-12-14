/**
 * @overture/ports-process
 *
 * Hexagonal architecture ports for process execution and environment.
 * Pure TypeScript interfaces with ZERO runtime dependencies.
 *
 * @module @overture/ports-process
 */

// Process port
export type { ProcessPort, ExecResult } from './lib/process.port.js';

// Environment port
export type { EnvironmentPort, Platform } from './lib/environment.port.js';
