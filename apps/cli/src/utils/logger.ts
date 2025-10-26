import chalk from 'chalk';

/**
 * Structured logger with colored output for CLI operations.
 * Provides consistent formatting for info, success, warning, error, and debug messages.
 */
export class Logger {
  /**
   * Log an informational message (blue icon).
   * @param message - The message to log
   */
  static info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  /**
   * Log a success message (green checkmark).
   * @param message - The message to log
   */
  static success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  /**
   * Log a warning message (yellow warning icon).
   * @param message - The message to log
   */
  static warn(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  /**
   * Log an error message (red X icon).
   * @param message - The message to log
   */
  static error(message: string): void {
    console.error(chalk.red('✗'), message);
  }

  /**
   * Log a debug message (gray arrow icon).
   * Only logs when DEBUG environment variable is set.
   * @param message - The message to log
   */
  static debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(chalk.gray('→'), message);
    }
  }

  /**
   * Print a blank line for spacing.
   */
  static nl(): void {
    console.log();
  }
}
