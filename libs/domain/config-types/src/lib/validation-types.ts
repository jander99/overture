/**
 * @module validation-types
 */

/**
 * Validation Result
 *
 * Result of configuration validation.
 */
export interface ValidationResult {
  /**
   * Whether validation passed
   */
  valid: boolean;

  /**
   * Validation errors
   */
  errors: ValidationError[];

  /**
   * Validation warnings
   */
  warnings: ValidationWarning[];
}

/**
 * Validation Error
 */
export interface ValidationError {
  /**
   * Error message
   */
  message: string;

  /**
   * Field path (e.g., "mcp.github.transport")
   */
  path: string;

  /**
   * Error code
   */
  code: string;
}

/**
 * Validation Warning
 */
export interface ValidationWarning {
  /**
   * Warning message
   */
  message: string;

  /**
   * Field path
   */
  path: string;

  /**
   * Suggested fix
   */
  suggestion?: string;
}
