/**
 * @overture/utils
 *
 * Shared utilities for Overture CLI including logging, formatting,
 * prompts, error handling, and validation formatting.
 *
 * @module @overture/utils
 */

// Logger
export { Logger, logger } from './lib/logger.js';

// Formatting utilities
export {
  formatList,
  formatKeyValue,
  formatTable,
  formatSection,
  formatHeading,
  formatDivider,
  indent,
} from './lib/format.js';

// User prompts
export { Prompts } from './lib/prompts.js';

// Error handling
export {
  ErrorHandler,
  ExitCode,
  ErrorCategory,
  ConfigurationError,
  FileSystemError,
  NetworkError,
  UserCancelledError,
  DependencyError,
} from './lib/error-handler.js';
export type { ErrorContext, FormattedError } from './lib/error-handler.js';

// Validation formatting
export {
  parseZodErrors,
  formatError,
  formatErrors,
  formatValidationSummary,
  formatValidationReport,
  createValidationSummary,
} from './lib/validation-formatter.js';
export type {
  ValidationError,
  ValidationSummary,
  ValidationReport,
} from './lib/validation-formatter.js';

// Path utilities
export { getDirname } from './lib/path-utils.js';

// User-facing messages
export * from './lib/messages.js';

// Constants
export {
  TABLE_FORMATTING,
  TIMEOUTS,
  RETRY_CONFIG,
  BACKUP_CONFIG,
  FILE_LIMITS,
  YAML_FORMATTING,
  TIME_UNITS,
} from './lib/constants.js';
