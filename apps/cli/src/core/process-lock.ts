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
 * @version 3.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ConfigError } from '@overture/errors';
import { TIMEOUTS, RETRY_CONFIG } from '@overture/utils';

/**
 * Lock metadata stored in lock file
 */
export interface LockData {
  pid: number;
  timestamp: number;
  operation: string;
}

/**
 * Lock configuration
 */
export interface LockOptions {
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
  staleTimeout: TIMEOUTS.STALE_LOCK_MS,
  maxRetries: RETRY_CONFIG.MAX_LOCK_RETRIES,
  retryDelay: RETRY_CONFIG.INITIAL_RETRY_DELAY_MS,
  operation: 'sync',
};

/**
 * Function type for getting lock file path
 */
export type GetLockFilePath = () => string;

/**
 * Handle existing lock file (EEXIST error)
 */
async function handleExistingLockFile(
  lockPath: string,
  opts: LockOptions,
  attempts: number,
  delay: number,
): Promise<{
  shouldRetry: boolean;
  newAttempts: number;
  newDelay: number;
}> {
  try {
    const lockContent = fs.readFileSync(lockPath, 'utf-8');
    const existingLock: LockData = JSON.parse(lockContent);

    // Check if lock is stale
    const lockAge = Date.now() - existingLock.timestamp;
    if (lockAge > opts.staleTimeout!) {
      // Stale lock detected, remove it and retry immediately
      console.warn(
        `Removing stale lock (age: ${Math.round(lockAge / 1000)}s, PID: ${existingLock.pid})`,
      );
      fs.unlinkSync(lockPath);
      return { shouldRetry: true, newAttempts: attempts, newDelay: delay };
    }

    // Lock is active - check if we've exhausted retries
    if (attempts === opts.maxRetries!) {
      throw new ConfigError(
        `Cannot acquire lock: Another Overture process (PID ${existingLock.pid}) is running '${existingLock.operation}' operation. Please wait or remove stale lock at: ${lockPath}`,
        lockPath,
      );
    }

    // Wait and retry with exponential backoff
    return {
      shouldRetry: true,
      newAttempts: attempts + 1,
      newDelay: delay * 2,
    };
  } catch (readError) {
    // Lock file disappeared or is corrupt - retry
    if ((readError as NodeJS.ErrnoException).code === 'ENOENT') {
      return { shouldRetry: true, newAttempts: attempts, newDelay: delay };
    }
    throw readError;
  }
}

/**
 * Handle retry logic for failed lock attempts
 */
async function handleRetryableError(
  attempts: number,
  maxRetries: number,
  delay: number,
): Promise<{ shouldRetry: boolean; newAttempts: number; newDelay: number }> {
  if (attempts === maxRetries) {
    return { shouldRetry: false, newAttempts: attempts, newDelay: delay };
  }
  return {
    shouldRetry: true,
    newAttempts: attempts + 1,
    newDelay: delay * 2,
  };
}

/**
 * Acquire process lock
 *
 * @param getLockFilePath - Function that returns the lock file path
 * @param options - Lock configuration options
 * @returns true if lock acquired successfully
 * @throws Error if lock cannot be acquired after retries
 *
 * @example
 * ```typescript
 * import { acquireLock } from './process-lock.js';
 * import { PathResolver } from '@overture/config-core';
 *
 * const pathResolver = new PathResolver(environment, filesystem);
 * const getLockPath = () => pathResolver.getLockFilePath();
 *
 * const acquired = await acquireLock(getLockPath, { operation: 'sync' });
 * ```
 */
/**
 * Try to create lock file atomically
 */
function tryCreateLockFile(lockPath: string, opts: LockOptions): boolean {
  const lockData: LockData = {
    pid: process.pid,
    timestamp: Date.now(),
    operation: opts.operation!,
  };

  // Atomically create lock file using 'wx' flag (exclusive create, fails if exists)
  // This eliminates TOCTOU race condition between checking and creating
  fs.writeFileSync(lockPath, JSON.stringify(lockData, null, 2), {
    encoding: 'utf-8',
    flag: 'wx', // Exclusive create - fails with EEXIST if file exists
  });

  return true;
}

/**
 * Handle lock acquisition error
 */
async function handleLockError(
  error: NodeJS.ErrnoException,
  lockPath: string,
  opts: LockOptions,
  attempts: number,
  delay: number,
): Promise<{ shouldRetry: boolean; newAttempts: number; newDelay: number }> {
  // File already exists - check if it's stale
  if (error.code === 'EEXIST') {
    return handleExistingLockFile(lockPath, opts, attempts, delay);
  }

  // Other errors (permission denied, etc.)
  return handleRetryableError(attempts, opts.maxRetries!, delay);
}

export async function acquireLock(
  getLockFilePath: GetLockFilePath,
  options: LockOptions = {},
): Promise<boolean> {
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
      if (tryCreateLockFile(lockPath, opts)) {
        registerCleanupHandler(getLockFilePath);
        return true;
      }
    } catch (error) {
      const { shouldRetry, newAttempts, newDelay } = await handleLockError(
        error as NodeJS.ErrnoException,
        lockPath,
        opts,
        attempts,
        delay,
      );

      if (shouldRetry) {
        attempts = newAttempts;
        delay = newDelay;
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  return false;
}

/**
 * Release process lock
 *
 * @param getLockFilePath - Function that returns the lock file path
 * @throws Error if lock file does not exist or belongs to different process
 */
export function releaseLock(getLockFilePath: GetLockFilePath): void {
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
      throw new ConfigError(
        `Cannot release lock: Lock belongs to different process (PID ${lockData.pid})`,
        lockPath,
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
 * @param getLockFilePath - Function that returns the lock file path
 * @param staleTimeout - Timeout in ms to consider lock stale (default: 10000)
 * @returns true if lock file exists and is not stale
 */
export function isLocked(
  getLockFilePath: GetLockFilePath,
  staleTimeout: number = DEFAULT_OPTIONS.staleTimeout,
): boolean {
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
 * @param getLockFilePath - Function that returns the lock file path
 * @returns Lock data or null if not locked
 */
export function getLockInfo(getLockFilePath: GetLockFilePath): LockData | null {
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
 *
 * @param getLockFilePath - Function that returns the lock file path
 */
export function forceReleaseLock(getLockFilePath: GetLockFilePath): void {
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
function registerCleanupHandler(getLockFilePath: GetLockFilePath): void {
  if (cleanupRegistered) return;

  const cleanup = () => {
    try {
      releaseLock(getLockFilePath);
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
