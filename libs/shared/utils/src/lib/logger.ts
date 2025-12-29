/**
 * Logger Implementation
 *
 * Provides a console-based logger that implements the OutputPort interface
 * from hexagonal architecture. Includes colored output via chalk.
 *
 * @module @overture/utils/logger
 */

import chalk from 'chalk';
import type { OutputPort } from '@overture/ports-output';

/**
 * Console-based logger implementation of OutputPort.
 *
 * Provides structured logging with colored output for CLI operations.
 * Implements the OutputPort interface for hexagonal architecture compliance.
 *
 * @example
 * ```typescript
 * // Use as OutputPort implementation
 * const logger = new Logger();
 * logger.info('Starting operation...');
 * logger.success('Operation completed!');
 *
 * // Use static methods for convenience
 * Logger.info('Starting operation...');
 * Logger.success('Operation completed!');
 * ```
 */
export class Logger implements OutputPort {
  /**
   * Log an informational message (blue icon).
   * @param message - The message to log
   */
  info(message: string): void {
    console.log(chalk.blue('\u2139'), message);
  }

  /**
   * Log a success message (green checkmark).
   * @param message - The message to log
   */
  success(message: string): void {
    console.log(chalk.green('\u2713'), message);
  }

  /**
   * Log a warning message (yellow warning icon).
   * @param message - The message to log
   */
  warn(message: string): void {
    console.log(chalk.yellow('\u26A0'), message);
  }

  /**
   * Log an error message (red X icon).
   * @param message - The message to log
   */
  error(message: string): void {
    console.error(chalk.red('\u2717'), message);
  }

  /**
   * Log a debug message (gray arrow icon).
   * Only logs when DEBUG environment variable is set.
   * @param message - The message to log
   */
  debug(message: string): void {
    Logger.debug(message);
  }

  /**
   * Print a blank line for spacing.
   */
  nl(): void {
    Logger.nl();
  }

  /**
   * Log a section header (bold text with spacing)
   *
   * @param message - The section header text
   *
   * @example
   * logger.section('Client Detection:');
   */
  section(message: string): void {
    Logger.section(message);
  }

  /**
   * Log a skipped item (gray with skip icon)
   *
   * @param message - The skip message
   *
   * @example
   * logger.skip('cursor - not detected, skipped');
   */
  skip(message: string): void {
    Logger.skip(message);
  }

  /**
   * Log without icon (for plain data display)
   *
   * @param message - The message to display
   *
   * @example
   * logger.plain('Additional information here');
   */
  plain(message: string): void {
    Logger.plain(message);
  }

  // Static methods for backward compatibility

  /**
   * Log an informational message (blue icon).
   * @param message - The message to log
   */
  static info(message: string): void {
    console.log(chalk.blue('\u2139'), message);
  }

  /**
   * Log a success message (green checkmark).
   * @param message - The message to log
   */
  static success(message: string): void {
    console.log(chalk.green('\u2713'), message);
  }

  /**
   * Log a warning message (yellow warning icon).
   * @param message - The message to log
   */
  static warn(message: string): void {
    console.log(chalk.yellow('\u26A0'), message);
  }

  /**
   * Log an error message (red X icon).
   * @param message - The message to log
   */
  static error(message: string): void {
    console.error(chalk.red('\u2717'), message);
  }

  /**
   * Log a debug message (gray arrow icon).
   * Only logs when DEBUG environment variable is set.
   * @param message - The message to log
   */
  static debug(message: string): void {
    if (process.env['DEBUG']) {
      console.log(chalk.gray('\u2192'), message);
    }
  }

  /**
   * Print a blank line for spacing.
   */
  static nl(): void {
    console.log();
  }

  /**
   * Log a section header (bold text with spacing)
   *
   * @param message - The section header text
   *
   * @example
   * Logger.section('Client Detection:');
   */
  static section(message: string): void {
    console.log();
    console.log(chalk.bold(message));
  }

  /**
   * Log a skipped item (gray with skip icon)
   *
   * @param message - The skip message
   *
   * @example
   * Logger.skip('cursor - not detected, skipped');
   */
  static skip(message: string): void {
    console.log(chalk.gray('\u2298'), chalk.gray(message));
  }

  /**
   * Log without icon (for plain data display)
   *
   * @param message - The message to display
   *
   * @example
   * Logger.plain('Additional information here');
   */
  static plain(message: string): void {
    console.log(message);
  }
}

/**
 * Default logger instance for convenience.
 */
export const logger = new Logger();
