/**
 * Base Type Definitions
 *
 * Primitive types and enumerations used throughout Overture configuration.
 *
 * @module @overture/config-types/base-types
 */

export type Platform = 'darwin' | 'linux' | 'win32';

export type TransportType = 'stdio' | 'http' | 'sse';

export type McpTransport = TransportType;

export type Scope = 'global' | 'project';

export type ClientName = 'claude-code' | 'copilot-cli' | 'opencode';

export type DetectionEnvironment = 'darwin' | 'linux' | 'win32' | 'wsl2';

export type MergeStrategy = 'append' | 'replace';

export type BinaryDetectionStatus = 'found' | 'not-found' | 'skipped';

export interface BinaryDetectionResult {
  status: BinaryDetectionStatus;
  binaryPath?: string;
  version?: string;
  appBundlePath?: string;
  configPath?: string;
  configValid?: boolean;
  warnings: string[];
}
