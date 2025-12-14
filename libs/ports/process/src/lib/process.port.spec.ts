/**
 * Tests for ProcessPort interface
 *
 * Validates type definitions and interface contracts.
 */

import { describe, it, expect } from 'vitest';
import type { ProcessPort, ExecResult } from './process.port.js';

describe('ProcessPort', () => {
  describe('interface contract', () => {
    it('should define exec method that accepts command and optional args', () => {
      // Type-only test: ensures the interface is correctly defined
      const mockPort: ProcessPort = {
        exec: async (command: string, args?: string[]): Promise<ExecResult> => {
          return {
            stdout: `Executed: ${command} ${args?.join(' ') ?? ''}`,
            stderr: '',
            exitCode: 0,
          };
        },
        commandExists: async (): Promise<boolean> => {
          return true;
        },
      };

      expect(mockPort).toBeDefined();
      expect(typeof mockPort.exec).toBe('function');
      expect(typeof mockPort.commandExists).toBe('function');
    });

    it('should allow exec to be called with just command', async () => {
      const mockPort: ProcessPort = {
        exec: async (command: string): Promise<ExecResult> => {
          return {
            stdout: command,
            stderr: '',
            exitCode: 0,
          };
        },
        commandExists: async (): Promise<boolean> => true,
      };

      const result = await mockPort.exec('npm');
      expect(result).toEqual({
        stdout: 'npm',
        stderr: '',
        exitCode: 0,
      });
    });

    it('should allow exec to be called with command and args', async () => {
      const mockPort: ProcessPort = {
        exec: async (command: string, args?: string[]): Promise<ExecResult> => {
          return {
            stdout: `${command} ${args?.join(' ') ?? ''}`,
            stderr: '',
            exitCode: 0,
          };
        },
        commandExists: async (): Promise<boolean> => true,
      };

      const result = await mockPort.exec('npm', ['install', 'lodash']);
      expect(result).toEqual({
        stdout: 'npm install lodash',
        stderr: '',
        exitCode: 0,
      });
    });

    it('should define commandExists method that returns boolean', async () => {
      const mockPort: ProcessPort = {
        exec: async (): Promise<ExecResult> => ({
          stdout: '',
          stderr: '',
          exitCode: 0,
        }),
        commandExists: async (command: string): Promise<boolean> => {
          return command === 'npm';
        },
      };

      expect(await mockPort.commandExists('npm')).toBe(true);
      expect(await mockPort.commandExists('invalid')).toBe(false);
    });
  });

  describe('ExecResult', () => {
    it('should have stdout, stderr, and exitCode properties', () => {
      const result: ExecResult = {
        stdout: 'output text',
        stderr: 'error text',
        exitCode: 1,
      };

      expect(result.stdout).toBe('output text');
      expect(result.stderr).toBe('error text');
      expect(result.exitCode).toBe(1);
    });

    it('should allow empty stdout and stderr', () => {
      const result: ExecResult = {
        stdout: '',
        stderr: '',
        exitCode: 0,
      };

      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
    });

    it('should allow different exit codes', () => {
      const success: ExecResult = {
        stdout: 'success',
        stderr: '',
        exitCode: 0,
      };

      const failure: ExecResult = {
        stdout: '',
        stderr: 'command not found',
        exitCode: 127,
      };

      expect(success.exitCode).toBe(0);
      expect(failure.exitCode).toBe(127);
    });
  });

  describe('mock implementations', () => {
    it('should be easy to create mock implementations for testing', async () => {
      const commandHistory: Array<{ command: string; args?: string[] }> = [];

      const mockPort: ProcessPort = {
        exec: async (
          command: string,
          args?: string[]
        ): Promise<ExecResult> => {
          commandHistory.push({ command, args });
          return {
            stdout: 'mocked output',
            stderr: '',
            exitCode: 0,
          };
        },
        commandExists: async (command: string): Promise<boolean> => {
          return ['npm', 'node', 'git'].includes(command);
        },
      };

      await mockPort.exec('npm', ['install']);
      await mockPort.exec('git', ['status']);

      expect(commandHistory).toHaveLength(2);
      expect(commandHistory[0]).toEqual({ command: 'npm', args: ['install'] });
      expect(commandHistory[1]).toEqual({ command: 'git', args: ['status'] });

      expect(await mockPort.commandExists('npm')).toBe(true);
      expect(await mockPort.commandExists('invalid')).toBe(false);
    });

    it('should support error scenarios', async () => {
      const mockPort: ProcessPort = {
        exec: async (command: string): Promise<ExecResult> => {
          if (command === 'invalid') {
            return {
              stdout: '',
              stderr: 'command not found: invalid',
              exitCode: 127,
            };
          }
          return {
            stdout: 'success',
            stderr: '',
            exitCode: 0,
          };
        },
        commandExists: async (): Promise<boolean> => false,
      };

      const errorResult = await mockPort.exec('invalid');
      expect(errorResult.exitCode).toBe(127);
      expect(errorResult.stderr).toContain('command not found');

      const successResult = await mockPort.exec('valid');
      expect(successResult.exitCode).toBe(0);
      expect(successResult.stdout).toBe('success');
    });
  });
});
