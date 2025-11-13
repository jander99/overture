/**
 * Process Lock Tests
 *
 * @module core/process-lock.spec
 */

import * as fs from 'fs';
import {
  acquireLock,
  releaseLock,
  isLocked,
  getLockInfo,
  forceReleaseLock,
} from './process-lock';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock path-resolver
jest.mock('./path-resolver', () => ({
  getLockFilePath: jest.fn(() => '/home/user/.config/overture/overture.lock'),
}));

describe('Process Lock', () => {
  const mockLockPath = '/home/user/.config/overture/overture.lock';
  const mockLockDir = '/home/user/.config/overture';
  const originalPid = process.pid;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock process.pid
    Object.defineProperty(process, 'pid', { value: 12345, writable: true });
  });

  afterEach(() => {
    Object.defineProperty(process, 'pid', { value: originalPid, writable: true });
  });

  describe('acquireLock', () => {
    it('should create lock file when no lock exists', async () => {
      mockFs.existsSync.mockImplementation((p) => {
        // Lock dir doesn't exist, lock file doesn't exist
        return false;
      });
      mockFs.mkdirSync.mockReturnValue(undefined);

      const result = await acquireLock({ operation: 'test-sync' });

      expect(result).toBe(true);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockLockPath,
        expect.stringContaining('"pid": 12345'),
        'utf-8'
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockLockPath,
        expect.stringContaining('"operation": "test-sync"'),
        'utf-8'
      );
    });

    it('should create lock directory if it does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await acquireLock();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        mockLockDir,
        { recursive: true }
      );
    });

    it('should throw error if active lock exists after retries', async () => {
      const activeLock = JSON.stringify({
        pid: 99999,
        timestamp: Date.now(),
        operation: 'sync',
      });

      mockFs.existsSync.mockImplementation((p) => {
        if (p === mockLockDir) return true; // Dir exists
        return true; // Lock file exists
      });
      mockFs.readFileSync.mockReturnValue(activeLock);

      await expect(acquireLock({ maxRetries: 0, retryDelay: 10 })).rejects.toThrow(
        /Cannot acquire lock.*Another Overture process.*PID 99999/
      );
    });

    it('should remove stale lock and acquire new lock', async () => {
      const staleLock = JSON.stringify({
        pid: 99999,
        timestamp: Date.now() - 20000, // 20 seconds old
        operation: 'sync',
      });

      let lockFileExists = true;
      mockFs.existsSync.mockImplementation((p) => {
        if (p === mockLockDir) return true; // Dir always exists
        if (p === mockLockPath) return lockFileExists; // Lock file existence
        return false;
      });

      mockFs.readFileSync.mockReturnValue(staleLock);
      mockFs.unlinkSync.mockImplementation(() => {
        lockFileExists = false; // Simulate removal
      });

      const result = await acquireLock({ staleTimeout: 10000 });

      expect(result).toBe(true);
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(mockLockPath);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockLockPath,
        expect.stringContaining('"pid": 12345'),
        'utf-8'
      );
    });

    it('should retry with exponential backoff', async () => {
      const activeLock = JSON.stringify({
        pid: 99999,
        timestamp: Date.now(),
        operation: 'sync',
      });

      let attempts = 0;
      mockFs.existsSync.mockImplementation((p) => {
        if (p === mockLockDir) return true; // Dir exists
        if (p === mockLockPath) {
          attempts++;
          return attempts <= 2; // Fail first 2 attempts, succeed on 3rd
        }
        return false;
      });

      mockFs.readFileSync.mockReturnValue(activeLock);

      const result = await acquireLock({ maxRetries: 3, retryDelay: 10 });

      expect(result).toBe(true);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should use default options when not specified', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await acquireLock();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockLockPath,
        expect.stringContaining('"operation": "sync"'),
        'utf-8'
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

      releaseLock();

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

      expect(() => releaseLock()).toThrow(
        /Cannot release lock.*different process.*PID 99999/
      );
    });

    it('should not throw error if lock does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => releaseLock()).not.toThrow();
    });

    it('should not throw error if lock file was already removed', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        const error: NodeJS.ErrnoException = new Error('ENOENT');
        error.code = 'ENOENT';
        throw error;
      });

      expect(() => releaseLock()).not.toThrow();
    });
  });

  describe('isLocked', () => {
    it('should return false if lock file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(isLocked()).toBe(false);
    });

    it('should return true if lock file exists and is not stale', () => {
      const activeLock = JSON.stringify({
        pid: 99999,
        timestamp: Date.now(),
        operation: 'sync',
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(activeLock);

      expect(isLocked()).toBe(true);
    });

    it('should return false if lock file is stale', () => {
      const staleLock = JSON.stringify({
        pid: 99999,
        timestamp: Date.now() - 20000, // 20 seconds old
        operation: 'sync',
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(staleLock);

      expect(isLocked(10000)).toBe(false);
    });

    it('should return false if lock file is invalid', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');

      expect(isLocked()).toBe(false);
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

      const info = getLockInfo();

      expect(info).toEqual(lockData);
    });

    it('should return null if lock does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const info = getLockInfo();

      expect(info).toBeNull();
    });

    it('should return null if lock file is invalid', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');

      const info = getLockInfo();

      expect(info).toBeNull();
    });
  });

  describe('forceReleaseLock', () => {
    it('should remove lock file if it exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      forceReleaseLock();

      expect(mockFs.unlinkSync).toHaveBeenCalledWith(mockLockPath);
    });

    it('should not throw error if lock file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => forceReleaseLock()).not.toThrow();
      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });
  });
});
