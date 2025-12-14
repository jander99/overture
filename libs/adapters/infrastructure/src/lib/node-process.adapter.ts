/**
 * Node.js Process Adapter
 *
 * Implements the ProcessPort interface using Node.js child_process and util APIs.
 * This is the primary adapter for production use.
 *
 * @module lib/node-process.adapter
 */

import type { ProcessPort, ExecResult } from '@overture/ports-process';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

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
    const cmd = args.length > 0 ? `${command} ${args.join(' ')}` : command;

    try {
      const { stdout, stderr } = await execAsync(cmd);
      return {
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: 0,
      };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || '',
        exitCode: error.code || 1,
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
}
