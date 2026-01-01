/**
 * Node.js Process Adapter
 *
 * Implements the ProcessPort interface using Node.js child_process and util APIs.
 * This is the primary adapter for production use.
 *
 * @module lib/node-process.adapter
 */

import type { ProcessPort, ExecResult } from '@overture/ports-process';
import execa from 'execa';

/**
 * Node.js implementation of ProcessPort
 *
 * Uses Node.js child_process for executing commands.
 *
 * @example
 * ```typescript
 * const process = new NodeProcessAdapter();
 *
 * // Execute a command
 * const result = await process.exec('npm', ['--version']);
 * if (result.exitCode === 0) {
 *   console.log('npm version:', result.stdout.trim());
 * }
 *
 * // Check if command exists
 * if (await process.commandExists('docker')) {
 *   console.log('Docker is available');
 * }
 * ```
 */
export class NodeProcessAdapter implements ProcessPort {
  /**
   * Execute a command with arguments
   *
   * @param command - Command to execute (e.g., 'npm', 'git')
   * @param args - Command arguments (default: [])
   * @returns Promise resolving to execution result
   *
   * @example
   * ```typescript
   * const result = await adapter.exec('npm', ['install', 'lodash']);
   * if (result.exitCode !== 0) {
   *   console.error('Install failed:', result.stderr);
   * }
   * ```
   */
  async exec(command: string, args: string[] = []): Promise<ExecResult> {
    try {
      const result = await execa(command, args, {
        reject: false, // Don't throw on non-zero exit codes
      });

      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode ?? 0,
      };
    } catch (error) {
      // Handle unexpected errors (e.g., command not found, permission denied)
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        stdout: '',
        stderr: errorMessage,
        exitCode: 1,
      };
    }
  }

  /**
   * Check if a command exists in PATH
   *
   * Uses 'which' on Unix-like systems (Linux, macOS) and 'where' on Windows.
   *
   * @param command - Command name to check
   * @returns Promise resolving to true if command exists
   *
   * @example
   * ```typescript
   * if (await adapter.commandExists('docker')) {
   *   console.log('Docker is available');
   * }
   * ```
   *
   * @deprecated Use commandExistsBatch for better performance when checking multiple commands
   */
  async commandExists(command: string): Promise<boolean> {
    const checkCommand = process.platform === 'win32' ? 'where' : 'which';

    try {
      const result = await this.exec(checkCommand, [command]);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Check if multiple commands exist in PATH (parallelized)
   *
   * This method checks multiple commands in parallel for significantly improved performance.
   * Example: Checking 8 commands sequentially takes ~8 seconds, but in parallel takes ~1 second.
   *
   * @param commands - Array of command names to check
   * @returns Promise resolving to a map of command name to existence boolean
   *
   * @example
   * ```typescript
   * const commands = ['docker', 'npm', 'git', 'npx'];
   * const results = await adapter.commandExistsBatch(commands);
   *
   * results.forEach((exists, command) => {
   *   console.log(`${command}: ${exists ? 'available' : 'not found'}`);
   * });
   * ```
   */
  async commandExistsBatch(commands: string[]): Promise<Map<string, boolean>> {
    // Run all checks in parallel - KEY PERFORMANCE OPTIMIZATION!
    // This transforms O(n) sequential time to O(1) parallel time
    const checks = commands.map(async (cmd) => ({
      command: cmd,
      exists: await this.commandExists(cmd),
    }));

    const results = await Promise.all(checks);

    return new Map(results.map((r) => [r.command, r.exists]));
  }
}
