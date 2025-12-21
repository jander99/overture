/**
 * Process Execution Mock Utilities
 *
 * Factory functions for creating process execution mocks.
 * Used for testing command execution without running actual processes.
 *
 * @module lib/mocks/process.mock
 */

/**
 * Process execution result
 */
export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Mock process executor for testing
 */
export interface MockProcessExecutor {
  /**
   * Queue of results to return for successive execute calls
   */
  results: ExecResult[];

  /**
   * History of executed commands
   */
  history: Array<{ command: string; args: string[] }>;

  /**
   * Current result index
   */
  currentIndex: number;

  /**
   * Mock execute function
   */
  execute: (command: string, args: string[]) => Promise<ExecResult>;
}

/**
 * Build a process execution result
 *
 * @param stdout - Standard output (default: '')
 * @param stderr - Standard error (default: '')
 * @param exitCode - Exit code (default: 0)
 * @returns ExecResult
 *
 * @example
 * ```typescript
 * const success = buildExecResult('Success\n');
 * const failure = buildExecResult('', 'Error\n', 1);
 * ```
 */
export function buildExecResult(
  stdout = '',
  stderr = '',
  exitCode = 0,
): ExecResult {
  return { stdout, stderr, exitCode };
}

/**
 * Create a mock process executor
 *
 * Returns results from the queue in order. Throws if queue is exhausted.
 *
 * @param results - Queue of results to return
 * @returns MockProcessExecutor
 *
 * @example
 * ```typescript
 * const mockProcess = createMockProcess([
 *   buildExecResult('Plugin installed\n'),
 *   buildExecResult('', 'Error\n', 1)
 * ]);
 *
 * const result1 = await mockProcess.execute('claude', ['plugin', 'install']);
 * // Returns: { stdout: 'Plugin installed\n', stderr: '', exitCode: 0 }
 *
 * const result2 = await mockProcess.execute('claude', ['plugin', 'list']);
 * // Returns: { stdout: '', stderr: 'Error\n', exitCode: 1 }
 * ```
 */
export function createMockProcess(
  results: ExecResult[] = [],
): MockProcessExecutor {
  const executor: MockProcessExecutor = {
    results,
    history: [],
    currentIndex: 0,

    execute: async (command: string, args: string[]): Promise<ExecResult> => {
      // Record command execution
      executor.history.push({ command, args });

      // Return next result from queue
      if (executor.currentIndex >= executor.results.length) {
        throw new Error(
          `No more mock results available. Executed: ${command} ${args.join(' ')}`,
        );
      }

      const result = executor.results[executor.currentIndex];
      executor.currentIndex++;
      return result;
    },
  };

  return executor;
}

/**
 * Create a mock process that always succeeds
 *
 * @param output - Output to return (default: '')
 * @returns MockProcessExecutor
 *
 * @example
 * ```typescript
 * const mockProcess = createSuccessProcess('Plugin installed\n');
 * const result = await mockProcess.execute('claude', ['plugin', 'install']);
 * // Always returns: { stdout: 'Plugin installed\n', stderr: '', exitCode: 0 }
 * ```
 */
export function createSuccessProcess(output = ''): MockProcessExecutor {
  return createMockProcess([buildExecResult(output)]);
}

/**
 * Create a mock process that always fails
 *
 * @param error - Error message (default: 'Command failed')
 * @param exitCode - Exit code (default: 1)
 * @returns MockProcessExecutor
 *
 * @example
 * ```typescript
 * const mockProcess = createFailureProcess('Plugin not found\n', 1);
 * const result = await mockProcess.execute('claude', ['plugin', 'install']);
 * // Always returns: { stdout: '', stderr: 'Plugin not found\n', exitCode: 1 }
 * ```
 */
export function createFailureProcess(
  error = 'Command failed',
  exitCode = 1,
): MockProcessExecutor {
  return createMockProcess([buildExecResult('', error, exitCode)]);
}

/**
 * Reset a mock process executor
 *
 * Clears history and resets result index
 *
 * @param executor - The mock executor to reset
 *
 * @example
 * ```typescript
 * const mockProcess = createMockProcess([...]);
 * // ... use executor ...
 * resetMockProcess(mockProcess);
 * // executor.history is now empty, currentIndex is 0
 * ```
 */
export function resetMockProcess(executor: MockProcessExecutor): void {
  executor.history = [];
  executor.currentIndex = 0;
}

/**
 * Add more results to a mock process executor
 *
 * @param executor - The mock executor
 * @param results - Additional results to add to queue
 *
 * @example
 * ```typescript
 * const mockProcess = createMockProcess([buildExecResult('First\n')]);
 * addMockResults(mockProcess, [buildExecResult('Second\n')]);
 * ```
 */
export function addMockResults(
  executor: MockProcessExecutor,
  results: ExecResult[],
): void {
  executor.results.push(...results);
}
