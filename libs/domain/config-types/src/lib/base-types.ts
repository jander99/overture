/**
 * Base Type Definitions
 *
 * Primitive types and enumerations used throughout Overture configuration.
 *
 * @module @overture/config-types/base-types
 */

/**
 * Supported host platforms.
 * - `darwin` — macOS
 * - `linux` — Linux distributions
 * - `win32` — Windows
 */
export type Platform = 'darwin' | 'linux' | 'win32';

/**
 * Transport mechanisms for MCP server communication.
 * - `stdio` — Standard input/output streams
 * - `http` — HTTP request/response
 * - `sse` — Server-Sent Events
 */
export type TransportType = 'stdio' | 'http' | 'sse';

/** MCP transport type alias */
export type McpTransport = TransportType;

/**
 * Configuration scope.
 * - `global` — User-wide settings
 * - `project` — Project-specific settings
 */
export type Scope = 'global' | 'project';

/**
 * Supported AI client integrations.
 * - `claude-code` — Anthropic Claude Code
 * - `copilot-cli` — GitHub Copilot CLI
 * - `opencode` — OpenCode client
 */
export type ClientName = 'claude-code' | 'copilot-cli' | 'opencode';

/**
 * Binary detection environments.
 * Extends Platform with WSL2 support.
 */
export type DetectionEnvironment = 'darwin' | 'linux' | 'win32' | 'wsl2';

/**
 * Configuration merge strategy.
 * - `append` — Extend existing configuration
 * - `replace` — Replace existing configuration
 */
export type MergeStrategy = 'append' | 'replace';

/**
 * Binary detection outcome.
 * - `found` — Binary located successfully
 * - `not-found` — Binary not found
 * - `skipped` — Detection intentionally skipped
 */
export type BinaryDetectionStatus = 'found' | 'not-found' | 'skipped';

/**
 * Result of binary detection for an AI client.
 */
export interface BinaryDetectionResult {
  /** Detection outcome */
  status: BinaryDetectionStatus;
  /** Path to the detected binary */
  binaryPath?: string;
  /** Detected version string */
  version?: string;
  /** Path to app bundle (macOS) */
  appBundlePath?: string;
  /** Path to configuration file */
  configPath?: string;
  /** Whether config file is valid */
  configValid?: boolean;
  /** Non-fatal warnings */
  warnings: string[];
}
