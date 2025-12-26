/**
 * @overture/ports-output
 *
 * Output Port interface for hexagonal architecture.
 * Defines the contract for outputting messages at different severity levels.
 *
 * @module @overture/ports-output
 */

/**
 * OutputPort defines the interface for outputting messages.
 * Implementations can be console-based, file-based, or any other output mechanism.
 */
export interface OutputPort {
  /**
   * Output an informational message.
   * @param message - The message to output
   */
  info(message: string): void;

  /**
   * Output a success message.
   * @param message - The message to output
   */
  success(message: string): void;

  /**
   * Output a warning message.
   * @param message - The message to output
   */
  warn(message: string): void;

  /**
   * Output an error message.
   * @param message - The message to output
   */
  error(message: string): void;

  /**
   * Output a debug message (only when DEBUG env var is set).
   * @param message - The message to output
   */
  debug?(message: string): void;

  /**
   * Print a blank line for spacing.
   */
  nl?(): void;

  /**
   * Output a section header.
   * @param message - The section header text
   */
  section?(message: string): void;

  /**
   * Output a skipped item message.
   * @param message - The skip message
   */
  skip?(message: string): void;

  /**
   * Output plain text without formatting.
   * @param message - The message to display
   */
  plain?(message: string): void;
}
