/**
 * Tests for NodeProcessAdapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeProcessAdapter } from './node-process.adapter.js';

// Mock Node.js child_process module
vi.mock('node:child_process', () => ({
  exec: vi.fn((cmd, callback) => {
    // Mock implementation will be set in tests
    callback(null, { stdout: '', stderr: '' });
  }),
}));

describe('NodeProcessAdapter', () => {
  let adapter: NodeProcessAdapter;

  beforeEach(() => {
    adapter = new NodeProcessAdapter();
    vi.clearAllMocks();
  });

  describe('exec', () => {
    it('should execute command with arguments', async () => {
      const { exec } = await import('node:child_process');
      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'v16.14.0', stderr: '' });
        return null as any;
      });

      const result = await adapter.exec('node', ['--version']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('v16.14.0');
      expect(result.stderr).toBe('');
    });

    it('should execute command without arguments', async () => {
      const { exec } = await import('node:child_process');
      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'output', stderr: '' });
        return null as any;
      });

      const result = await adapter.exec('pwd');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('output');
    });

    it('should handle command with multiple arguments', async () => {
      const { exec } = await import('node:child_process');
      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'installed lodash', stderr: '' });
        return null as any;
      });

      const result = await adapter.exec('npm', ['install', 'lodash', '--save']);

      expect(result.exitCode).toBe(0);
    });

    it('should handle command failure with non-zero exit code', async () => {
      const { exec } = await import('node:child_process');
      const error: any = new Error('Command failed');
      error.code = 1;
      error.stdout = '';
      error.stderr = 'error message';

      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(error, { stdout: '', stderr: '' });
        return null as any;
      });

      const result = await adapter.exec('invalid-command');

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('error message');
    });

    it('should handle command not found', async () => {
      const { exec } = await import('node:child_process');
      const error: any = new Error('command not found: nonexistent');
      error.code = 127;
      error.stdout = '';
      error.stderr = 'command not found: nonexistent';

      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(error, { stdout: '', stderr: '' });
        return null as any;
      });

      const result = await adapter.exec('nonexistent');

      expect(result.exitCode).toBe(127);
      expect(result.stderr).toContain('command not found');
    });

    it('should handle command with stderr output on success', async () => {
      const { exec } = await import('node:child_process');
      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'output', stderr: 'warning message' });
        return null as any;
      });

      const result = await adapter.exec('some-command');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('output');
      expect(result.stderr).toBe('warning message');
    });

    it('should handle empty stdout and stderr', async () => {
      const { exec } = await import('node:child_process');
      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return null as any;
      });

      const result = await adapter.exec('silent-command');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
    });

    it('should default to exit code 1 if error has no code', async () => {
      const { exec } = await import('node:child_process');
      const error: any = new Error('Unknown error');
      error.stdout = 'partial output';
      error.stderr = 'error';

      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(error, { stdout: '', stderr: '' });
        return null as any;
      });

      const result = await adapter.exec('failing-command');

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe('partial output');
      expect(result.stderr).toBe('error');
    });

    it('should handle error with only message (no stdout/stderr)', async () => {
      const { exec } = await import('node:child_process');
      const error: any = new Error('Execution failed');
      error.code = 2;

      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(error, { stdout: '', stderr: '' });
        return null as any;
      });

      const result = await adapter.exec('bad-command');

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('Execution failed');
    });
  });

  describe('commandExists', () => {
    beforeEach(() => {
      // Reset platform mock
      vi.stubGlobal('process', { ...process, platform: 'linux' });
    });

    it('should return true when command exists on Unix', async () => {
      const { exec } = await import('node:child_process');
      vi.stubGlobal('process', { ...process, platform: 'linux' });

      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: '/usr/bin/npm', stderr: '' });
        return null as any;
      });

      const result = await adapter.commandExists('npm');

      expect(result).toBe(true);
    });

    it('should return false when command does not exist on Unix', async () => {
      const { exec } = await import('node:child_process');
      vi.stubGlobal('process', { ...process, platform: 'darwin' });

      const error: any = new Error('command not found');
      error.code = 1;
      error.stdout = '';
      error.stderr = 'not found';

      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(error, { stdout: '', stderr: '' });
        return null as any;
      });

      const result = await adapter.commandExists('nonexistent');

      expect(result).toBe(false);
    });

    it('should use "where" command on Windows', async () => {
      const { exec } = await import('node:child_process');
      vi.stubGlobal('process', { ...process, platform: 'win32' });

      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'C:\\Program Files\\nodejs\\npm.cmd', stderr: '' });
        return null as any;
      });

      const result = await adapter.commandExists('npm');

      expect(result).toBe(true);
    });

    it('should return false when command does not exist on Windows', async () => {
      const { exec } = await import('node:child_process');
      vi.stubGlobal('process', { ...process, platform: 'win32' });

      const error: any = new Error('not found');
      error.code = 1;

      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(error, { stdout: '', stderr: '' });
        return null as any;
      });

      const result = await adapter.commandExists('missing');

      expect(result).toBe(false);
    });

    it('should return false on exception', async () => {
      const { exec } = await import('node:child_process');
      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        throw new Error('Unexpected error');
      });

      const result = await adapter.commandExists('npm');

      expect(result).toBe(false);
    });

    it('should handle macOS platform', async () => {
      const { exec } = await import('node:child_process');
      vi.stubGlobal('process', { ...process, platform: 'darwin' });

      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: '/usr/local/bin/docker', stderr: '' });
        return null as any;
      });

      const result = await adapter.commandExists('docker');

      expect(result).toBe(true);
    });
  });

  describe('ProcessPort compliance', () => {
    it('should implement all ProcessPort methods', () => {
      expect(adapter).toHaveProperty('exec');
      expect(adapter).toHaveProperty('commandExists');
    });

    it('should have all methods as functions', () => {
      expect(typeof adapter.exec).toBe('function');
      expect(typeof adapter.commandExists).toBe('function');
    });
  });
});
