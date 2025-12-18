#!/usr/bin/env node

import { createProgram } from './cli';
import { createAppDependencies } from './composition-root';
import { Logger } from '@overture/utils';
import { OvertureError } from '@overture/errors';

/**
 * Handle errors and determine exit code.
 * Exported for testing purposes.
 *
 * @param error - The error to handle
 * @returns The exit code to use
 */
export function handleError(error: unknown): number {
  // Handle known Overture errors
  if (error instanceof OvertureError) {
    Logger.error(error.message);

    // Show stack trace in debug mode
    if (process.env.DEBUG && error.stack) {
      Logger.debug(error.stack);
    }

    return error.exitCode;
  }

  // Handle unexpected errors
  if (error instanceof Error) {
    Logger.error('An unexpected error occurred');
    Logger.error(error.message);

    if (process.env.DEBUG && error.stack) {
      Logger.debug(error.stack);
    }

    return 1;
  }

  // Handle non-Error throws
  Logger.error('An unknown error occurred');
  Logger.debug(String(error));
  return 1;
}

/**
 * Main entry point for the Overture CLI.
 *
 * Creates all dependencies via composition root and initializes
 * the Commander program. Handles global error cases with appropriate
 * formatting and exit codes.
 */
export async function main(): Promise<void> {
  try {
    // Create all dependencies via composition root
    const deps = createAppDependencies();

    // Create CLI program with dependencies
    const program = createProgram(deps);
    await program.parseAsync(process.argv);
  } catch (error) {
    const exitCode = handleError(error);
    process.exit(exitCode);
  }
}

// Run the CLI when executed directly (not when imported for testing)
// Skip execution in test environment (NODE_ENV=test or when vitest is running)
/* istanbul ignore next */
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  main();
}
