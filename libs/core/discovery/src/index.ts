/**
 * @overture/discovery-core
 *
 * Discovery service for detecting AI client installations and configurations.
 * Uses hexagonal architecture with dependency injection for testability.
 *
 * @module @overture/discovery-core
 */

// Main service
export {
  DiscoveryService,
  createDiscoveryService,
} from './lib/discovery-service.js';
export type { DiscoveryServiceDeps } from './lib/discovery-service.js';

// Binary detector
export { BinaryDetector, createBinaryDetector } from './lib/binary-detector.js';

// WSL2 detector
export {
  WSL2Detector,
  createWSL2Detector,
  WINDOWS_DEFAULT_PATHS,
} from './lib/wsl2-detector.js';
