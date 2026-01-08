/**
 * Shared Constants
 *
 * Centralized constants for the Overture CLI to eliminate magic numbers
 * and improve code maintainability.
 *
 * @module @overture/utils/constants
 */

// ============================================================================
// Table Formatting
// ============================================================================

/**
 * Constants for table formatting in CLI output
 */
export const TABLE_FORMATTING = {
  /** Minimum width for MCP server name column */
  MIN_MCP_COLUMN_WIDTH: 15,
  /** Width for source column (Global/Project) */
  SOURCE_COLUMN_WIDTH: 10,
  /** Width for client name column */
  CLIENT_COLUMN_WIDTH: 15,
  /** Column separator character sequence */
  COLUMN_SEPARATOR: ' | ',
  /** Row separator character */
  ROW_SEPARATOR: '-',
} as const;

// ============================================================================
// Timeouts
// ============================================================================

/**
 * Timeout values in milliseconds for various operations
 */
export const TIMEOUTS = {
  /** Timeout for binary/client detection (5 seconds) */
  BINARY_DETECTION_MS: 5_000,
  /** Timeout for plugin installation (30 seconds) */
  PLUGIN_INSTALL_MS: 30_000,
  /** Timeout for considering a process lock stale (10 seconds) */
  STALE_LOCK_MS: 10_000,
} as const;

// ============================================================================
// Retry Configuration
// ============================================================================

/**
 * Configuration for retry mechanisms
 */
export const RETRY_CONFIG = {
  /** Maximum number of retry attempts for lock acquisition */
  MAX_LOCK_RETRIES: 3,
  /** Initial delay between retries in milliseconds */
  INITIAL_RETRY_DELAY_MS: 100,
} as const;

// ============================================================================
// Backup Configuration
// ============================================================================

/**
 * Configuration for backup retention
 */
export const BACKUP_CONFIG = {
  /** Default number of backups to retain per client */
  DEFAULT_RETENTION_COUNT: 10,
  /** Maximum number of backups that can be retained */
  MAX_RETENTION_COUNT: 100,
} as const;

// ============================================================================
// File Limits
// ============================================================================

/**
 * File size limits in bytes
 */
export const FILE_LIMITS = {
  /** Maximum size for configuration files (1 MB) */
  MAX_CONFIG_SIZE_BYTES: 1_000_000,
  /** Maximum size for skill files (100 KB) */
  MAX_SKILL_SIZE_BYTES: 100_000,
} as const;

// ============================================================================
// YAML Formatting
// ============================================================================

/**
 * Configuration for YAML output formatting
 */
export const YAML_FORMATTING = {
  /** Default line width for YAML output */
  LINE_WIDTH: 100,
} as const;

// ============================================================================
// Time Formatting
// ============================================================================

/**
 * Time-related constants for formatting relative dates
 */
export const TIME_UNITS = {
  /** Milliseconds in one second */
  MS_PER_SECOND: 1_000,
  /** Seconds in one minute */
  SECONDS_PER_MINUTE: 60,
  /** Minutes in one hour */
  MINUTES_PER_HOUR: 60,
  /** Hours in one day */
  HOURS_PER_DAY: 24,
  /** Days considered as one month (approximate) */
  DAYS_PER_MONTH: 30,
} as const;
