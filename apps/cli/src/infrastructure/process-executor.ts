import execa, { type ExecaChildProcess } from 'execa';
import { PluginError } from '../domain/errors';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class ProcessExecutor {
  /**
   * Execute command and return result
   */
  static async exec(
    command: string,
    args: string[] = [],
    options: { cwd?: string; env?: Record<string, string> } = {}
  ): Promise<ExecResult> {
    try {
      const result = await execa(command, args, {
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
        reject: false, // Don't throw on non-zero exit
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode ?? 0,
      };
    } catch (error) {
      throw new PluginError(
        `Command execution failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Check if command exists on PATH
   */
  static async commandExists(command: string): Promise<boolean> {
    try {
      const result = await this.exec(
        process.platform === 'win32' ? 'where' : 'which',
        [command]
      );
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Execute with real-time output streaming
   */
  static spawn(
    command: string,
    args: string[] = [],
    options: { cwd?: string; env?: Record<string, string> } = {}
  ): ExecaChildProcess {
    return execa(command, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: 'inherit', // Stream output to terminal
    });
  }
}
