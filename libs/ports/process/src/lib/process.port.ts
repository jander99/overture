/**
 * Process Execution Port
 *
 * Hexagonal architecture port for process execution.
 * Abstracts command execution and process management from infrastructure details.
 *
 * @module lib/process.port
 */

/**
 * Result of a command execution
 */
export interface ExecResult {
  /**
   * Standard output from the command
   */
  stdout: string;

  /**
   * Standard error from the command
   */
  stderr: string;

  /**
   * Exit code (0 = success, non-zero = failure)
   */
  exitCode: number;
}

/**
 * Port interface for process execution
 *
 * Provides abstraction for running external commands and checking command availability.
 * Implementations might use child_process, shell execution, or mocked execution for testing.
 *
 * @example
 * ```typescript
 * // Check if a command exists
 * const hasNpm = await processPort.commandExists('npm');
 *
 * // Execute a command
 * const result = await processPort.exec('npm', ['--version']);
 * if (result.exitCode === 0) {
 *   console.log('npm version:', result.stdout.trim());
 * }
 * ```
 */
export interface ProcessPort {
  /**
   * Execute a command with arguments
   *
   * @param command - Command to execute (e.g., 'npm', 'git')
   * @param args - Command arguments (default: [])
   * @returns Promise resolving to execution result
   *
   * @example
   * ```typescript
   * const result = await processPort.exec('npm', ['install', 'lodash']);
   * if (result.exitCode !== 0) {
   *   console.error('Install failed:', result.stderr);
   * }
   * ```
   */
  exec(command: string, args?: string[]): Promise<ExecResult>;

  /**
   * Check if a command exists in PATH
   *
   * @param command - Command name to check
   * @returns Promise resolving to true if command exists
   *
   * @example
   * ```typescript
   * if (await processPort.commandExists('docker')) {
   *   console.log('Docker is available');
   * }
   * ```
   */
  commandExists(command: string): Promise<boolean>;
}
