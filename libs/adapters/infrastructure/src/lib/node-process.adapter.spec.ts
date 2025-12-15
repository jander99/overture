/**
 * Tests for NodeProcessAdapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeProcessAdapter } from './node-process.adapter.js';

// Mock execa module
vi.mock('execa', () => ({
  default: vi.fn(async (command: string, args: string[]) => {
    // Default mock implementation - will be overridden in tests
    return {
      stdout: '',
      stderr: '',
      exitCode: 0,
    };
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
      const execa = (await import('execa')).default;
      vi.mocked(execa).mockResolvedValue({
        stdout: 'v16.14.0',
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await adapter.exec('node', ['--version']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('v16.14.0');
      expect(result.stderr).toBe('');
    });

    it('should execute command without arguments', async () => {
      const execa = (await import('execa')).default;
      vi.mocked(execa).mockResolvedValue({
        stdout: 'output',
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await adapter.exec('pwd');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('output');
    });

    it('should handle command with multiple arguments', async () => {
      const execa = (await import('execa')).default;
      vi.mocked(execa).mockResolvedValue({
        stdout: 'installed lodash',
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await adapter.exec('npm', ['install', 'lodash', '--save']);

      expect(result.exitCode).toBe(0);
    });

    it('should handle command failure with non-zero exit code', async () => {
      const execa = (await import('execa')).default;
      vi.mocked(execa).mockResolvedValue({
        stdout: '',
        stderr: 'error message',
        exitCode: 1,
      } as any);

      const result = await adapter.exec('invalid-command');

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('error message');
    });

    it('should handle command not found', async () => {
      const execa = (await import('execa')).default;
      vi.mocked(execa).mockResolvedValue({
        stdout: '',
        stderr: 'command not found: nonexistent',
        exitCode: 127,
      } as any);

      const result = await adapter.exec('nonexistent');

      expect(result.exitCode).toBe(127);
      expect(result.stderr).toContain('command not found');
    });

    it('should handle command with stderr output on success', async () => {
      const execa = (await import('execa')).default;
      vi.mocked(execa).mockResolvedValue({
        stdout: 'output',
        stderr: 'warning message',
        exitCode: 0,
      } as any);

      const result = await adapter.exec('some-command');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('output');
      expect(result.stderr).toBe('warning message');
    });

    it('should handle empty stdout and stderr', async () => {
      const execa = (await import('execa')).default;
      vi.mocked(execa).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await adapter.exec('silent-command');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
    });

    it('should handle unexpected errors', async () => {
      const execa = (await import('execa')).default;
      const error = new Error('Unexpected error occurred');
      vi.mocked(execa).mockRejectedValue(error);

      const result = await adapter.exec('failing-command');

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('Unexpected error occurred');
    });

    it('should handle errors with custom messages', async () => {
      const execa = (await import('execa')).default;
      const error = new Error('Execution failed');
      vi.mocked(execa).mockRejectedValue(error);

      const result = await adapter.exec('bad-command');

      expect(result.exitCode).toBe(1);
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
      const execa = (await import('execa')).default;
      vi.stubGlobal('process', { ...process, platform: 'linux' });

      vi.mocked(execa).mockResolvedValue({
        stdout: '/usr/bin/npm',
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await adapter.commandExists('npm');

      expect(result).toBe(true);
    });

    it('should return false when command does not exist on Unix', async () => {
      const execa = (await import('execa')).default;
      vi.stubGlobal('process', { ...process, platform: 'darwin' });

      vi.mocked(execa).mockResolvedValue({
        stdout: '',
        stderr: 'not found',
        exitCode: 1,
      } as any);

      const result = await adapter.commandExists('nonexistent');

      expect(result).toBe(false);
    });

    it('should use "where" command on Windows', async () => {
      const execa = (await import('execa')).default;
      vi.stubGlobal('process', { ...process, platform: 'win32' });

      vi.mocked(execa).mockResolvedValue({
        stdout: 'C:\\Program Files\\nodejs\\npm.cmd',
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await adapter.commandExists('npm');

      expect(result).toBe(true);
    });

    it('should return false when command does not exist on Windows', async () => {
      const execa = (await import('execa')).default;
      vi.stubGlobal('process', { ...process, platform: 'win32' });

      vi.mocked(execa).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 1,
      } as any);

      const result = await adapter.commandExists('missing');

      expect(result).toBe(false);
    });

    it('should return false on exception', async () => {
      const execa = (await import('execa')).default;
      vi.mocked(execa).mockRejectedValue(new Error('Unexpected error'));

      const result = await adapter.commandExists('npm');

      expect(result).toBe(false);
    });

    it('should handle macOS platform', async () => {
      const execa = (await import('execa')).default;
      vi.stubGlobal('process', { ...process, platform: 'darwin' });

      vi.mocked(execa).mockResolvedValue({
        stdout: '/usr/local/bin/docker',
        stderr: '',
        exitCode: 0,
      } as any);

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

  describe('security - command injection prevention', () => {
    // These tests verify that execa properly prevents shell injection
    // by treating arguments as literals, not shell commands

    it('should prevent semicolon command injection', async () => {
      const execa = (await import('execa')).default;
      // Mock to verify arguments are passed correctly (not executed as shell)
      vi.mocked(execa).mockResolvedValue({
        stdout: 'hello; echo pwned', // Echo would output the literal string
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await adapter.exec('echo', ['hello; echo pwned']);

      // Verify execa was called with array args (preventing shell interpretation)
      expect(execa).toHaveBeenCalledWith('echo', ['hello; echo pwned'], expect.any(Object));
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hello; echo pwned');
    });

    it('should prevent backtick command substitution', async () => {
      const execa = (await import('execa')).default;
      vi.mocked(execa).mockResolvedValue({
        stdout: '`whoami`',
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await adapter.exec('echo', ['`whoami`']);

      expect(execa).toHaveBeenCalledWith('echo', ['`whoami`'], expect.any(Object));
      expect(result.stdout).toBe('`whoami`');
    });

    it('should prevent dollar-parenthesis command substitution', async () => {
      const execa = (await import('execa')).default;
      vi.mocked(execa).mockResolvedValue({
        stdout: '$(pwd)',
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await adapter.exec('echo', ['$(pwd)']);

      expect(execa).toHaveBeenCalledWith('echo', ['$(pwd)'], expect.any(Object));
      expect(result.stdout).toBe('$(pwd)');
    });

    it('should prevent environment variable expansion', async () => {
      const execa = (await import('execa')).default;
      vi.mocked(execa).mockResolvedValue({
        stdout: '$HOME',
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await adapter.exec('echo', ['$HOME']);

      expect(execa).toHaveBeenCalledWith('echo', ['$HOME'], expect.any(Object));
      expect(result.stdout).toBe('$HOME');
    });

    it('should prevent pipe command execution', async () => {
      const execa = (await import('execa')).default;
      vi.mocked(execa).mockResolvedValue({
        stdout: 'hello | cat',
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await adapter.exec('echo', ['hello | cat']);

      expect(execa).toHaveBeenCalledWith('echo', ['hello | cat'], expect.any(Object));
      expect(result.stdout).toBe('hello | cat');
    });

    it('should safely handle malicious plugin names', async () => {
      const execa = (await import('execa')).default;
      const maliciousName = 'evil-plugin; rm -rf /';

      vi.mocked(execa).mockResolvedValue({
        stdout: maliciousName,
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await adapter.exec('echo', [maliciousName]);

      // The entire malicious string should be a single argument
      expect(execa).toHaveBeenCalledWith('echo', [maliciousName], expect.any(Object));
      expect(result.stdout).toBe(maliciousName);
    });

    it('should prevent background execution with ampersand', async () => {
      const execa = (await import('execa')).default;
      vi.mocked(execa).mockResolvedValue({
        stdout: 'hello &',
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await adapter.exec('echo', ['hello &']);

      expect(execa).toHaveBeenCalledWith('echo', ['hello &'], expect.any(Object));
      expect(result.stdout).toBe('hello &');
    });

    it('should prevent file redirection', async () => {
      const execa = (await import('execa')).default;
      vi.mocked(execa).mockResolvedValue({
        stdout: 'test > /tmp/pwned.txt',
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await adapter.exec('echo', ['test > /tmp/pwned.txt']);

      expect(execa).toHaveBeenCalledWith('echo', ['test > /tmp/pwned.txt'], expect.any(Object));
      expect(result.stdout).toBe('test > /tmp/pwned.txt');
    });
  });
});
