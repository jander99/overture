#!/usr/bin/env node

import { createProgram } from './cli';
import { Logger } from './utils/logger';
import { OvertureError } from './domain/errors';

/**
 * Main entry point for the Overture CLI.
 *
 * Initializes the Commander program and handles global error cases.
 * Errors are logged with appropriate formatting, and stack traces
 * are shown when DEBUG environment variable is set.
 */
async function main(): Promise<void> {
  try {
    const program = createProgram();
    await program.parseAsync(process.argv);
  } catch (error) {
    // Handle known Overture errors
    if (error instanceof OvertureError) {
      Logger.error(error.message);

      // Show stack trace in debug mode
      if (process.env.DEBUG && error.stack) {
        Logger.debug(error.stack);
      }

      process.exit(error.exitCode);
    }

    // Handle unexpected errors
    if (error instanceof Error) {
      Logger.error('An unexpected error occurred');
      Logger.error(error.message);

      if (process.env.DEBUG && error.stack) {
        Logger.debug(error.stack);
      }

      process.exit(1);
    }

    // Handle non-Error throws
    Logger.error('An unknown error occurred');
    Logger.debug(String(error));
    process.exit(1);
  }
}

// Run the CLI
main();
