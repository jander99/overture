/**
 * Tests for ConfigRepoChecker
 *
 * Verifies:
 * - Config repository detection
 * - Git repository validation
 * - Remote/local hash comparison
 * - Error handling (never throws)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigRepoChecker } from './config-repo-checker.js';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type {
  ProcessPort,
  ExecResult,
  EnvironmentPort,
} from '@overture/ports-process';

describe('ConfigRepoChecker', () => {
  let checker: ConfigRepoChecker;
  let mockFilesystem: FilesystemPort;
  let mockProcess: ProcessPort;
  let mockEnvironment: EnvironmentPort;

  beforeEach(() => {
    mockFilesystem = {
      exists: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      rm: vi.fn(),
    };

    mockProcess = {
      exec: vi.fn(),
      commandExists: vi.fn(),
    };

    mockEnvironment = {
      platform: vi.fn(() => 'linux' as const),
      homedir: vi.fn(() => '/home/testuser'),
      env: {},
    };

    checker = new ConfigRepoChecker(
      mockFilesystem,
      mockProcess,
      mockEnvironment,
    );
  });

  describe('checkConfigRepository', () => {
    it('should return config repo info when both directories exist', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const result = await checker.checkConfigRepository();

      expect(result).toEqual({
        configRepoPath: '/home/testuser/.config/overture',
        skillsPath: '/home/testuser/.config/overture/skills',
        configRepoExists: true,
        skillsDirExists: true,
      });
      expect(mockFilesystem.exists).toHaveBeenCalledWith(
        '/home/testuser/.config/overture',
      );
      expect(mockFilesystem.exists).toHaveBeenCalledWith(
        '/home/testuser/.config/overture/skills',
      );
    });

    it('should return false when config repo does not exist', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValueOnce(false);
      vi.mocked(mockFilesystem.exists).mockResolvedValueOnce(false);

      const result = await checker.checkConfigRepository();

      expect(result).toEqual({
        configRepoPath: '/home/testuser/.config/overture',
        skillsPath: '/home/testuser/.config/overture/skills',
        configRepoExists: false,
        skillsDirExists: false,
      });
    });

    it('should return false for skills when only config repo exists', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValueOnce(true);
      vi.mocked(mockFilesystem.exists).mockResolvedValueOnce(false);

      const result = await checker.checkConfigRepository();

      expect(result).toEqual({
        configRepoPath: '/home/testuser/.config/overture',
        skillsPath: '/home/testuser/.config/overture/skills',
        configRepoExists: true,
        skillsDirExists: false,
      });
    });

    it('should handle errors gracefully and return default values', async () => {
      vi.mocked(mockFilesystem.exists).mockRejectedValue(
        new Error('Filesystem error'),
      );

      const result = await checker.checkConfigRepository();

      expect(result).toEqual({
        configRepoPath: '/home/testuser/.config/overture',
        skillsPath: '/home/testuser/.config/overture/skills',
        configRepoExists: false,
        skillsDirExists: false,
      });
    });

    it('should use correct home directory on different platforms', async () => {
      vi.mocked(mockEnvironment.homedir).mockReturnValue('/Users/testuser');
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const result = await checker.checkConfigRepository();

      expect(result.configRepoPath).toBe('/Users/testuser/.config/overture');
      expect(result.skillsPath).toBe('/Users/testuser/.config/overture/skills');
    });
  });

  describe('checkGitRepository', () => {
    it('should return false for all git checks when config repo does not exist', async () => {
      const result = await checker.checkGitRepository(
        '/home/testuser/.config/overture',
        false,
      );

      expect(result).toEqual({
        isGitRepo: false,
        gitRemote: null,
        localHash: null,
        remoteHash: null,
        gitInSync: false,
      });
      expect(mockFilesystem.exists).not.toHaveBeenCalled();
    });

    it('should return false when .git directory does not exist', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const result = await checker.checkGitRepository(
        '/home/testuser/.config/overture',
        true,
      );

      expect(result).toEqual({
        isGitRepo: false,
        gitRemote: null,
        localHash: null,
        remoteHash: null,
        gitInSync: false,
      });
      expect(mockFilesystem.exists).toHaveBeenCalledWith(
        '/home/testuser/.config/overture/.git',
      );
    });

    it('should return complete git info when repository is valid and in sync', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const gitRemoteResult: ExecResult = {
        exitCode: 0,
        stdout: 'https://github.com/user/config.git\n',
        stderr: '',
      };

      const localHashResult: ExecResult = {
        exitCode: 0,
        stdout: 'abc123def456\n',
        stderr: '',
      };

      const remoteHashResult: ExecResult = {
        exitCode: 0,
        stdout: 'abc123def456\tHEAD\n',
        stderr: '',
      };

      vi.mocked(mockProcess.exec)
        .mockResolvedValueOnce(gitRemoteResult) // git remote get-url origin
        .mockResolvedValueOnce(localHashResult) // git rev-parse HEAD
        .mockResolvedValueOnce(remoteHashResult); // git ls-remote origin HEAD

      const result = await checker.checkGitRepository(
        '/home/testuser/.config/overture',
        true,
      );

      expect(result).toEqual({
        isGitRepo: true,
        gitRemote: 'https://github.com/user/config.git',
        localHash: 'abc123def456',
        remoteHash: 'abc123def456',
        gitInSync: true,
      });
    });

    it('should detect when local and remote are out of sync', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const gitRemoteResult: ExecResult = {
        exitCode: 0,
        stdout: 'https://github.com/user/config.git\n',
        stderr: '',
      };

      const localHashResult: ExecResult = {
        exitCode: 0,
        stdout: 'abc123def456\n',
        stderr: '',
      };

      const remoteHashResult: ExecResult = {
        exitCode: 0,
        stdout: 'xyz789uvw012\tHEAD\n',
        stderr: '',
      };

      vi.mocked(mockProcess.exec)
        .mockResolvedValueOnce(gitRemoteResult)
        .mockResolvedValueOnce(localHashResult)
        .mockResolvedValueOnce(remoteHashResult);

      const result = await checker.checkGitRepository(
        '/home/testuser/.config/overture',
        true,
      );

      expect(result).toEqual({
        isGitRepo: true,
        gitRemote: 'https://github.com/user/config.git',
        localHash: 'abc123def456',
        remoteHash: 'xyz789uvw012',
        gitInSync: false,
      });
    });

    it('should handle missing git remote gracefully', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const gitRemoteResult: ExecResult = {
        exitCode: 128,
        stdout: '',
        stderr: 'fatal: No remote named origin',
      };

      const localHashResult: ExecResult = {
        exitCode: 0,
        stdout: 'abc123def456\n',
        stderr: '',
      };

      vi.mocked(mockProcess.exec)
        .mockResolvedValueOnce(gitRemoteResult)
        .mockResolvedValueOnce(localHashResult);

      const result = await checker.checkGitRepository(
        '/home/testuser/.config/overture',
        true,
      );

      expect(result).toEqual({
        isGitRepo: true,
        gitRemote: null,
        localHash: 'abc123def456',
        remoteHash: null,
        gitInSync: false,
      });
    });

    it('should handle git command failures gracefully', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      vi.mocked(mockProcess.exec).mockRejectedValue(
        new Error('git command not found'),
      );

      const result = await checker.checkGitRepository(
        '/home/testuser/.config/overture',
        true,
      );

      expect(result).toEqual({
        isGitRepo: true,
        gitRemote: null,
        localHash: null,
        remoteHash: null,
        gitInSync: false,
      });
    });

    it('should not attempt to get remote hash if local hash is missing', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const gitRemoteResult: ExecResult = {
        exitCode: 0,
        stdout: 'https://github.com/user/config.git\n',
        stderr: '',
      };

      const localHashResult: ExecResult = {
        exitCode: 128,
        stdout: '',
        stderr: 'fatal: not a git repository',
      };

      vi.mocked(mockProcess.exec)
        .mockResolvedValueOnce(gitRemoteResult)
        .mockResolvedValueOnce(localHashResult);

      const result = await checker.checkGitRepository(
        '/home/testuser/.config/overture',
        true,
      );

      expect(result).toEqual({
        isGitRepo: true,
        gitRemote: 'https://github.com/user/config.git',
        localHash: null,
        remoteHash: null,
        gitInSync: false,
      });

      // Should only call exec twice (remote and local), not three times
      expect(mockProcess.exec).toHaveBeenCalledTimes(2);
    });

    it('should handle empty git remote output', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const gitRemoteResult: ExecResult = {
        exitCode: 0,
        stdout: '  \n  ',
        stderr: '',
      };

      vi.mocked(mockProcess.exec).mockResolvedValueOnce(gitRemoteResult);

      const result = await checker.checkGitRepository(
        '/home/testuser/.config/overture',
        true,
      );

      expect(result.gitRemote).toBeNull();
    });

    it('should handle malformed ls-remote output', async () => {
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);

      const gitRemoteResult: ExecResult = {
        exitCode: 0,
        stdout: 'https://github.com/user/config.git\n',
        stderr: '',
      };

      const localHashResult: ExecResult = {
        exitCode: 0,
        stdout: 'abc123def456\n',
        stderr: '',
      };

      const remoteHashResult: ExecResult = {
        exitCode: 0,
        stdout: '', // Empty output
        stderr: '',
      };

      vi.mocked(mockProcess.exec)
        .mockResolvedValueOnce(gitRemoteResult)
        .mockResolvedValueOnce(localHashResult)
        .mockResolvedValueOnce(remoteHashResult);

      const result = await checker.checkGitRepository(
        '/home/testuser/.config/overture',
        true,
      );

      expect(result).toEqual({
        isGitRepo: true,
        gitRemote: 'https://github.com/user/config.git',
        localHash: 'abc123def456',
        remoteHash: null,
        gitInSync: false,
      });
    });
  });
});
