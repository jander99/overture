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
   *
   * @deprecated Use commandExistsBatch for better performance when checking multiple commands
   */
  commandExists(command: string): Promise<boolean>;

  /**
   * Check if multiple commands exist in PATH (parallelized)
   *
   * This method checks multiple commands in parallel for improved performance.
   * Prefer this over calling commandExists() multiple times sequentially.
   *
   * @param commands - Array of command names to check
   * @returns Promise resolving to a map of command name to existence boolean
   *
   * @example
   * ```typescript
   * const commands = ['docker', 'npm', 'git'];
   * const results = await processPort.commandExistsBatch(commands);
   *
   * if (results.get('docker')) {
   *   console.log('Docker is available');
   * }
   * if (results.get('npm')) {
   *   console.log('npm is available');
   * }
   * ```
   */
  commandExistsBatch(commands: string[]): Promise<Map<string, boolean>>;
}
