/**
 * Process Locking
 *
 * Implements file-based process locking to prevent concurrent sync operations.
 * Uses ~/.config/overture/overture.lock as the lock file.
 *
 * Features:
 * - Stale lock detection (10s timeout)
 * - Retry mechanism with exponential backoff
 * - Automatic cleanup on process exit
 *
 * @module core/process-lock
 * @version 2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { getLockFilePath } from './path-resolver';

/**
 * Lock metadata stored in lock file
 */
interface LockData {
  pid: number;
  timestamp: number;
  operation: string;
}

/**
 * Lock configuration
 */
interface LockOptions {
  /**
   * Maximum age of lock file in milliseconds before considering it stale
   * Default: 10000 (10 seconds)
   */
  staleTimeout?: number;

  /**
   * Maximum number of retry attempts
   * Default: 3
   */
  maxRetries?: number;

  /**
   * Initial retry delay in milliseconds
   * Default: 100
   */
  retryDelay?: number;

  /**
   * Operation description (for debugging)
   * Default: 'sync'
   */
  operation?: string;
}

const DEFAULT_OPTIONS: Required<LockOptions> = {
  staleTimeout: 10000, // 10 seconds
  maxRetries: 3,
  retryDelay: 100, // 100ms initial
  operation: 'sync',
};

/**
 * Acquire process lock
 *
 * @param options - Lock configuration options
 * @returns true if lock acquired successfully
 * @throws Error if lock cannot be acquired after retries
 */
export async function acquireLock(options: LockOptions = {}): Promise<boolean> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lockPath = getLockFilePath();
  const lockDir = path.dirname(lockPath);

  // Ensure lock directory exists
  if (!fs.existsSync(lockDir)) {
    fs.mkdirSync(lockDir, { recursive: true });
  }

  let attempts = 0;
  let delay = opts.retryDelay;

  while (attempts <= opts.maxRetries) {
    try {
      // Check if lock file exists
      if (fs.existsSync(lockPath)) {
        // Read existing lock
        const lockContent = fs.readFileSync(lockPath, 'utf-8');
        const lockData: LockData = JSON.parse(lockContent);

        // Check if lock is stale
        const lockAge = Date.now() - lockData.timestamp;
        if (lockAge > opts.staleTimeout) {
          // Stale lock detected, remove it
          console.warn(
            `Removing stale lock (age: ${Math.round(lockAge / 1000)}s, PID: ${lockData.pid})`
          );
          fs.unlinkSync(lockPath);
        } else {
          // Lock is active
          if (attempts === opts.maxRetries) {
            throw new Error(
              `Cannot acquire lock: Another Overture process (PID ${lockData.pid}) is running '${lockData.operation}' operation. Please wait or remove stale lock at: ${lockPath}`
            );
          }

          // Retry with exponential backoff
          attempts++;
          await sleep(delay);
          delay *= 2; // Exponential backoff
          continue;
        }
      }

      // Create lock file
      const lockData: LockData = {
        pid: process.pid,
        timestamp: Date.now(),
        operation: opts.operation,
      };

      fs.writeFileSync(lockPath, JSON.stringify(lockData, null, 2), 'utf-8');

      // Register cleanup handler
      registerCleanupHandler(lockPath);

      return true;
    } catch (error) {
      if (attempts === opts.maxRetries) {
        throw error;
      }
      attempts++;
      await sleep(delay);
      delay *= 2;
    }
  }

  return false;
}

/**
 * Release process lock
 *
 * @throws Error if lock file does not exist or belongs to different process
 */
export function releaseLock(): void {
  const lockPath = getLockFilePath();

  if (!fs.existsSync(lockPath)) {
    // Lock already released or never acquired
    return;
  }

  try {
    // Read lock data to verify ownership
    const lockContent = fs.readFileSync(lockPath, 'utf-8');
    const lockData: LockData = JSON.parse(lockContent);

    if (lockData.pid !== process.pid) {
      throw new Error(
        `Cannot release lock: Lock belongs to different process (PID ${lockData.pid})`
      );
    }

    // Remove lock file
    fs.unlinkSync(lockPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Lock file was already removed
      return;
    }
    throw error;
  }
}

/**
 * Check if lock is currently held
 *
 * @returns true if lock file exists and is not stale
 */
export function isLocked(staleTimeout: number = DEFAULT_OPTIONS.staleTimeout): boolean {
  const lockPath = getLockFilePath();

  if (!fs.existsSync(lockPath)) {
    return false;
  }

  try {
    const lockContent = fs.readFileSync(lockPath, 'utf-8');
    const lockData: LockData = JSON.parse(lockContent);

    const lockAge = Date.now() - lockData.timestamp;
    return lockAge <= staleTimeout;
  } catch {
    // Invalid lock file
    return false;
  }
}

/**
 * Get current lock information
 *
 * @returns Lock data or null if not locked
 */
export function getLockInfo(): LockData | null {
  const lockPath = getLockFilePath();

  if (!fs.existsSync(lockPath)) {
    return null;
  }

  try {
    const lockContent = fs.readFileSync(lockPath, 'utf-8');
    return JSON.parse(lockContent);
  } catch {
    return null;
  }
}

/**
 * Force remove lock file (use with caution!)
 *
 * Only use this if you're certain the lock is stale and can't be released normally.
 */
export function forceReleaseLock(): void {
  const lockPath = getLockFilePath();
  if (fs.existsSync(lockPath)) {
    fs.unlinkSync(lockPath);
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Register cleanup handlers to release lock on process exit
 */
let cleanupRegistered = false;
function registerCleanupHandler(lockPath: string): void {
  if (cleanupRegistered) return;

  const cleanup = () => {
    try {
      releaseLock();
    } catch {
      // Ignore errors during cleanup
    }
  };

  // Handle normal exit
  process.on('exit', cleanup);

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130); // Standard exit code for SIGINT
  });

  // Handle termination signal
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(143); // Standard exit code for SIGTERM
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    cleanup();
    console.error('Uncaught exception:', error);
    process.exit(1);
  });

  cleanupRegistered = true;
}
