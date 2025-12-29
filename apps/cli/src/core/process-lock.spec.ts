/**
 * Process Lock Tests
 *
 * @module core/process-lock.spec
 */

import type { Mocked } from 'vitest';
import * as fs from 'fs';
import {
  acquireLock,
  releaseLock,
  isLocked,
  getLockInfo,
  forceReleaseLock,
  type GetLockFilePath,
} from './process-lock';

// Mock fs module
vi.mock('fs');
const mockFs = fs as Mocked<typeof fs>;

describe('Process Lock', () => {
  const mockLockPath = '/home/user/.config/overture/overture.lock';
  const mockLockDir = '/home/user/.config/overture';
  const originalPid = process.pid;

  // Mock getLockFilePath function
  const mockGetLockFilePath: GetLockFilePath = () => mockLockPath;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock process.pid
    Object.defineProperty(process, 'pid', { value: 12345, writable: true });
  });

  afterEach(() => {
    Object.defineProperty(process, 'pid', {
      value: originalPid,
      writable: true,
    });
  });

  describe('acquireLock', () => {
    it('should create lock file when no lock exists', async () => {
      mockFs.existsSync.mockImplementation(() => {
        // Lock dir doesn't exist, lock file doesn't exist
        return false;
      });
      mockFs.mkdirSync.mockReturnValue(undefined);

      const result = await acquireLock(mockGetLockFilePath, {
        operation: 'test-sync',
      });

      expect(result).toBe(true);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockLockPath,
        expect.stringContaining('"pid": 12345'),
        { encoding: 'utf-8', flag: 'wx' },
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockLockPath,
        expect.stringContaining('"operation": "test-sync"'),
        { encoding: 'utf-8', flag: 'wx' },
      );
    });

    it('should create lock directory if it does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await acquireLock(mockGetLockFilePath);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(mockLockDir, {
        recursive: true,
      });
    });

    it('should throw error if active lock exists after retries', async () => {
      const activeLock = JSON.stringify({
        pid: 99999,
        timestamp: Date.now(),
        operation: 'sync',
      });

      mockFs.existsSync.mockImplementation((p) => {
        // Lock existence determined by writeFileSync failure
        return p === mockLockDir; // Dir exists
      });

      // Always fail with EEXIST (active lock)
      mockFs.writeFileSync.mockImplementation(() => {
        const err: NodeJS.ErrnoException = new Error('EEXIST');
        err.code = 'EEXIST';
        throw err;
      });

      mockFs.readFileSync.mockReturnValue(activeLock);

      await expect(
        acquireLock(mockGetLockFilePath, { maxRetries: 0, retryDelay: 10 }),
      ).rejects.toThrow(
        /Cannot acquire lock.*Another Overture process.*PID 99999/,
      );
    });

    it('should remove stale lock and acquire new lock', async () => {
      const staleLock = JSON.stringify({
        pid: 99999,
        timestamp: Date.now() - 20000, // 20 seconds old
        operation: 'sync',
      });

      let lockFileRemoved = false;
      mockFs.existsSync.mockImplementation((p) => {
        // Lock dir check returns true, but we handle via writeFileSync
        return p === mockLockDir; // Dir always exists
      });

      // First write fails with EEXIST (lock exists), then succeeds after stale lock removal
      let writeAttempt = 0;
      mockFs.writeFileSync.mockImplementation(() => {
        writeAttempt++;
        if (writeAttempt === 1 && !lockFileRemoved) {
          const err: NodeJS.ErrnoException = new Error('EEXIST');
          err.code = 'EEXIST';
          throw err;
        }
        // Second attempt succeeds after stale lock is removed
      });

      mockFs.readFileSync.mockReturnValue(staleLock);
      mockFs.unlinkSync.mockImplementation(() => {
        lockFileRemoved = true;
      });

      const result = await acquireLock(mockGetLockFilePath, {
        staleTimeout: 10000,
      });

      expect(result).toBe(true);
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(mockLockPath);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockLockPath,
        expect.stringContaining('"pid": 12345'),
        { encoding: 'utf-8', flag: 'wx' },
      );
    });

    it('should retry with exponential backoff', async () => {
      const activeLock = JSON.stringify({
        pid: 99999,
        timestamp: Date.now(),
        operation: 'sync',
      });

      mockFs.existsSync.mockImplementation((p) => {
        return p === mockLockDir; // Dir exists
      });

      let writeAttempts = 0;
      mockFs.writeFileSync.mockImplementation(() => {
        writeAttempts++;
        if (writeAttempts <= 2) {
          // First 2 attempts fail with EEXIST
          const err: NodeJS.ErrnoException = new Error('EEXIST');
          err.code = 'EEXIST';
          throw err;
        }
        // 3rd attempt succeeds
      });

      mockFs.readFileSync.mockReturnValue(activeLock);

      const result = await acquireLock(mockGetLockFilePath, {
        maxRetries: 3,
        retryDelay: 10,
      });

      expect(result).toBe(true);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      expect(writeAttempts).toBe(3);
    });

    it('should use default options when not specified', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await acquireLock(mockGetLockFilePath);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockLockPath,
        expect.stringContaining('"operation": "sync"'),
        { encoding: 'utf-8', flag: 'wx' },
      );
    });
  });

  describe('releaseLock', () => {
    it('should remove lock file if owned by current process', () => {
      const ownLock = JSON.stringify({
        pid: 12345,
        timestamp: Date.now(),
        operation: 'sync',
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(ownLock);

      releaseLock(mockGetLockFilePath);

      expect(mockFs.unlinkSync).toHaveBeenCalledWith(mockLockPath);
    });

    it('should throw error if lock belongs to different process', () => {
      const otherLock = JSON.stringify({
        pid: 99999,
        timestamp: Date.now(),
        operation: 'sync',
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(otherLock);

      expect(() => releaseLock(mockGetLockFilePath)).toThrow(
        /Cannot release lock.*different process.*PID 99999/,
      );
    });

    it('should not throw error if lock does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => releaseLock(mockGetLockFilePath)).not.toThrow();
    });

    it('should not throw error if lock file was already removed', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        const error: NodeJS.ErrnoException = new Error('ENOENT');
        error.code = 'ENOENT';
        throw error;
      });

      expect(() => releaseLock(mockGetLockFilePath)).not.toThrow();
    });
  });

  describe('isLocked', () => {
    it('should return false if lock file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(isLocked(mockGetLockFilePath)).toBe(false);
    });

    it('should return true if lock file exists and is not stale', () => {
      const activeLock = JSON.stringify({
        pid: 99999,
        timestamp: Date.now(),
        operation: 'sync',
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(activeLock);

      expect(isLocked(mockGetLockFilePath)).toBe(true);
    });

    it('should return false if lock file is stale', () => {
      const staleLock = JSON.stringify({
        pid: 99999,
        timestamp: Date.now() - 20000, // 20 seconds old
        operation: 'sync',
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(staleLock);

      expect(isLocked(mockGetLockFilePath, 10000)).toBe(false);
    });

    it('should return false if lock file is invalid', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');

      expect(isLocked(mockGetLockFilePath)).toBe(false);
    });
  });

  describe('getLockInfo', () => {
    it('should return lock data if lock exists', () => {
      const lockData = {
        pid: 99999,
        timestamp: 1234567890,
        operation: 'sync',
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(lockData));

      const info = getLockInfo(mockGetLockFilePath);

      expect(info).toEqual(lockData);
    });

    it('should return null if lock does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const info = getLockInfo(mockGetLockFilePath);

      expect(info).toBeNull();
    });

    it('should return null if lock file is invalid', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');

      const info = getLockInfo(mockGetLockFilePath);

      expect(info).toBeNull();
    });
  });

  describe('forceReleaseLock', () => {
    it('should remove lock file if it exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      forceReleaseLock(mockGetLockFilePath);

      expect(mockFs.unlinkSync).toHaveBeenCalledWith(mockLockPath);
    });

    it('should not throw error if lock file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => forceReleaseLock(mockGetLockFilePath)).not.toThrow();
      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });
  });
});
