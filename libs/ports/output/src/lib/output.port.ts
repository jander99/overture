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
}
