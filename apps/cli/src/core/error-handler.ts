/**
 * Centralized error handling system with user-friendly messages and contextual suggestions.
 *
 * Provides consistent error handling across all CLI commands with:
 * - Error categorization (configuration, validation, filesystem, network, etc.)
 * - User-friendly error messages with context
 * - Contextual suggestions for fixing errors
 * - Proper exit codes
 * - Stack trace control (hidden by default, shown with --verbose)
 *
 * @module core/error-handler
 */

import chalk from 'chalk';
import { Logger } from '../utils/logger';
import {
  OvertureError,
  ConfigError,
  ValidationError as DomainValidationError,
  PluginError,
  McpError,
} from '../domain/errors';

/**
 * Exit codes for different error categories
 */
export enum ExitCode {
  /** Success */
  SUCCESS = 0,
  /** General command error */
  GENERAL_ERROR = 1,
  /** Configuration error */
  CONFIG_ERROR = 2,
  /** Validation error */
  VALIDATION_ERROR = 3,
  /** File system error */
  FILESYSTEM_ERROR = 4,
  /** User cancelled operation */
  USER_CANCELLED = 5,
  /** Unknown error */
  UNKNOWN_ERROR = 99,
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  CONFIGURATION = 'configuration',
  VALIDATION = 'validation',
  FILESYSTEM = 'filesystem',
  NETWORK = 'network',
  USER_CANCELLED = 'user_cancelled',
  DEPENDENCY = 'dependency',
  UNKNOWN = 'unknown',
}

/**
 * Configuration error types
 */
export class ConfigurationError extends Error {
  public path?: string;
  public override cause?: Error;

  constructor(message: string, path?: string, cause?: Error) {
    super(message);
    this.name = 'ConfigurationError';
    this.path = path;
    this.cause = cause;
  }
}

/**
 * File system error types
 */
export class FileSystemError extends Error {
  public path?: string;
  public operation?: string;
  public override cause?: Error;

  constructor(message: string, path?: string, operation?: string, cause?: Error) {
    super(message);
    this.name = 'FileSystemError';
    this.path = path;
    this.operation = operation;
    this.cause = cause;
  }
}

/**
 * Network error types
 */
export class NetworkError extends Error {
  public url?: string;
  public statusCode?: number;
  public override cause?: Error;

  constructor(message: string, url?: string, statusCode?: number, cause?: Error) {
    super(message);
    this.name = 'NetworkError';
    this.url = url;
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

/**
 * User cancelled error
 */
export class UserCancelledError extends Error {
  constructor(message = 'Operation cancelled by user') {
    super(message);
    this.name = 'UserCancelledError';
  }
}

/**
 * Dependency error types
 */
export class DependencyError extends Error {
  public dependency?: string;
  public override cause?: Error;

  constructor(message: string, dependency?: string, cause?: Error) {
    super(message);
    this.name = 'DependencyError';
    this.dependency = dependency;
    this.cause = cause;
  }
}

/**
 * Error context for generating suggestions
 */
export interface ErrorContext {
  /** The command being executed */
  command?: string;
  /** File path related to the error */
  path?: string;
  /** Additional context data */
  data?: Record<string, unknown>;
}

/**
 * Formatted error output
 */
export interface FormattedError {
  /** Brief error message */
  message: string;
  /** Detailed explanation */
  details?: string;
  /** Suggestion for fixing the error */
  suggestion?: string;
  /** Stack trace (if verbose) */
  stack?: string;
  /** Exit code */
  exitCode: number;
}

/**
 * Centralized error handler for CLI commands
 */
export class ErrorHandler {
  /**
   * Handle a command error and exit with appropriate code
   *
   * @param error - The error to handle
   * @param commandName - Name of the command that failed
   * @param verbose - Whether to show stack traces
   */
  static handleCommandError(
    error: unknown,
    commandName?: string,
    verbose = false
  ): never {
    const formatted = this.formatError(error, verbose);
    const context: ErrorContext = { command: commandName };
    const suggestion = this.getErrorSuggestion(error, context);

    // Display error
    this.logError(formatted, suggestion, verbose);

    // Exit with appropriate code
    process.exit(formatted.exitCode);
  }

  /**
   * Format an error for display
   *
   * @param error - The error to format
   * @param verbose - Whether to include stack trace
   * @returns Formatted error
   */
  static formatError(error: unknown, verbose = false): FormattedError {
    // Handle known Overture errors
    if (error instanceof OvertureError) {
      return {
        message: error.message,
        details: this.getErrorDetails(error),
        exitCode: error.exitCode,
        stack: verbose && error.stack ? error.stack : undefined,
      };
    }

    // Handle custom error types
    if (error instanceof ConfigurationError) {
      return {
        message: error.message,
        details: error.path ? `Configuration file: ${error.path}` : undefined,
        exitCode: ExitCode.CONFIG_ERROR,
        stack: verbose && error.stack ? error.stack : undefined,
      };
    }

    if (error instanceof FileSystemError) {
      return {
        message: error.message,
        details: this.getFileSystemErrorDetails(error),
        exitCode: ExitCode.FILESYSTEM_ERROR,
        stack: verbose && error.stack ? error.stack : undefined,
      };
    }

    if (error instanceof NetworkError) {
      return {
        message: error.message,
        details: this.getNetworkErrorDetails(error),
        exitCode: ExitCode.GENERAL_ERROR,
        stack: verbose && error.stack ? error.stack : undefined,
      };
    }

    if (error instanceof UserCancelledError) {
      return {
        message: error.message,
        exitCode: ExitCode.USER_CANCELLED,
        stack: verbose && error.stack ? error.stack : undefined,
      };
    }

    if (error instanceof DependencyError) {
      return {
        message: error.message,
        details: error.dependency
          ? `Missing dependency: ${error.dependency}`
          : undefined,
        exitCode: ExitCode.GENERAL_ERROR,
        stack: verbose && error.stack ? error.stack : undefined,
      };
    }

    // Handle standard Error
    if (error instanceof Error) {
      return {
        message: error.message || 'An unexpected error occurred',
        exitCode: ExitCode.GENERAL_ERROR,
        stack: verbose && error.stack ? error.stack : undefined,
      };
    }

    // Handle non-Error throws
    return {
      message: 'An unknown error occurred',
      details: String(error),
      exitCode: ExitCode.UNKNOWN_ERROR,
    };
  }

  /**
   * Get contextual suggestions for fixing an error
   *
   * @param error - The error to generate suggestions for
   * @param context - Error context
   * @returns Suggestion string or undefined
   */
  static getErrorSuggestion(
    error: unknown,
    context: ErrorContext
  ): string | undefined {
    // Config not found errors
    if (
      error instanceof Error &&
      (error.message.includes('Configuration not found') ||
        error.message.includes('No configuration found') ||
        error.message.includes('Config file not found') ||
        error.message.includes('ENOENT'))
    ) {
      // Determine which config is missing from context
      if (context.path && context.path.includes('.config/overture')) {
        return 'Run `overture user init` to create global configuration at ~/.config/overture/config.yaml';
      }
      return 'Run `overture init` to create project configuration at .overture/config.yaml\nFor global config, use `overture user init`';
    }

    // Invalid YAML errors
    if (
      error instanceof Error &&
      (error.message.includes('invalid yaml') ||
        error.message.includes('YAMLException') ||
        error.message.includes('bad indentation') ||
        error.message.includes('unexpected token'))
    ) {
      return 'Check YAML syntax:\n  - Use 2 spaces for indentation (not tabs)\n  - Ensure colons have space after them\n  - Quote strings with special characters\n  - Validate at: https://www.yamllint.com/';
    }

    // Permission errors
    if (
      error instanceof Error &&
      (error.message.includes('EACCES') ||
        error.message.includes('permission denied') ||
        error.message.includes('EPERM'))
    ) {
      if (process.platform === 'win32') {
        return 'Permission denied. Try:\n  1. Run Command Prompt as Administrator\n  2. Check file permissions in Properties > Security';
      }
      return 'Permission denied. Try:\n  1. Check file permissions: ls -la ~/.config/overture/\n  2. Fix permissions: chmod 644 <file>\n  3. Avoid using sudo if possible';
    }

    // Validation errors
    if (error instanceof DomainValidationError) {
      const issueCount = error.issues.length;
      return `Found ${issueCount} validation ${issueCount === 1 ? 'error' : 'errors'}. Fix them in your configuration:\n  1. Review each error above\n  2. Edit .overture/config.yaml\n  3. Run \`overture validate\` to verify\nSee docs/error-messages.md for detailed troubleshooting`;
    }

    // Config validation errors with specific field issues
    if (
      error instanceof Error &&
      error.message.includes('Configuration validation failed')
    ) {
      if (error.message.includes('transport')) {
        return 'Add "transport" field to MCP configuration:\n  transport: stdio  # or stdio+stderr, sse\nSee docs/overture-schema.md for valid transport types';
      }
      if (error.message.includes('command')) {
        return 'Add "command" field to MCP configuration:\n  command: uvx  # or npx, node, python3, etc.';
      }
      return 'Configuration validation failed. Run `overture validate` for detailed error list';
    }

    // Transport compatibility warnings
    if (
      error instanceof Error &&
      (error.message.includes('transport') ||
        error.message.includes('Transport issues'))
    ) {
      return 'Transport compatibility issue detected:\n  1. Change transport to "stdio" (most widely supported)\n  2. Or use --force to sync anyway: `overture sync --force`\n  3. Check client compatibility: `overture validate --verbose`';
    }

    // Missing dependency errors
    if (
      error instanceof DependencyError ||
      (error instanceof Error &&
        (error.message.includes('command not found') ||
          error.message.includes('not installed')))
    ) {
      if (error instanceof DependencyError && error.dependency) {
        // Try to be smart about installation method
        if (error.dependency.includes('uvx') || error.dependency.includes('pipx')) {
          return `Install ${error.dependency}:\n  pip install ${error.dependency}\n  # Or with pipx:\n  pipx install ${error.dependency}`;
        }
        if (error.dependency.startsWith('@') || error.dependency.includes('npm')) {
          return `Install ${error.dependency}:\n  npm install -g ${error.dependency}`;
        }
        return `Install ${error.dependency} and ensure it's on your PATH`;
      }
      return 'Required dependency not found. Check that all MCP commands are installed and on your PATH';
    }

    // User cancelled
    if (error instanceof UserCancelledError) {
      return undefined; // No suggestion needed for user cancellation
    }

    // Disk full errors
    if (
      error instanceof Error &&
      (error.message.includes('ENOSPC') ||
        error.message.includes('no space left'))
    ) {
      return 'No space left on device:\n  1. Check disk space: df -h (Linux/macOS) or wmic logicaldisk (Windows)\n  2. Delete unnecessary files\n  3. Clear temp files\n  4. Retry operation';
    }

    // File already exists
    if (
      error instanceof Error &&
      (error.message.includes('already exists') ||
        error.message.includes('EEXIST'))
    ) {
      if (context.command === 'init') {
        return 'Configuration already exists. Use --force to overwrite:\n  overture init --force';
      }
      return 'File already exists. Use --force flag to overwrite, or choose a different location';
    }

    // Network errors
    if (error instanceof NetworkError) {
      if (error.statusCode === 404) {
        return 'Resource not found (404). Check the URL or endpoint configuration';
      }
      if (error.statusCode === 401 || error.statusCode === 403) {
        return 'Authentication failed. Check your credentials or API tokens';
      }
      return 'Network error. Check your internet connection and try again';
    }

    // Process lock errors
    if (
      error instanceof Error &&
      (error.message.includes('process lock') ||
        error.message.includes('lock file'))
    ) {
      return 'Another Overture process is running or lock is stale:\n  1. Wait for other operation to complete\n  2. Check running processes: ps aux | grep overture\n  3. Remove stale lock: rm /tmp/overture.lock\n  4. Retry operation';
    }

    // No clients installed
    if (
      error instanceof Error &&
      (error.message.includes('No clients') ||
        error.message.includes('no installed clients'))
    ) {
      return 'No AI clients detected. Install at least one:\n  - Claude Code: https://claude.ai/code\n  - Claude Desktop: https://claude.ai/download\n  - VS Code with GitHub Copilot\n  - Cursor: https://cursor.sh\n  - Windsurf: https://codeium.com/windsurf';
    }

    // Invalid project type
    if (
      error instanceof Error &&
      error.message.includes('Invalid project type')
    ) {
      return 'Use a valid project type:\n  - python-backend\n  - node-api\n  - typescript-tooling\n  - fullstack-web\nOr run `overture init` without --type for interactive selection';
    }

    // MCP not found
    if (
      error instanceof Error &&
      error.message.includes('MCP server') &&
      error.message.includes('not found')
    ) {
      return 'MCP server not found in configuration:\n  1. List available MCPs: `overture mcp list`\n  2. Check spelling\n  3. Add to .overture/config.yaml if missing';
    }

    // Command-specific suggestions
    if (context.command === 'init' && error instanceof Error) {
      return 'Failed to initialize configuration:\n  - Use --force to overwrite existing config\n  - Check directory permissions\n  - Manually edit .overture/config.yaml if needed';
    }

    if (context.command === 'sync' && error instanceof Error) {
      return 'Sync failed. Troubleshooting steps:\n  1. Validate configuration: `overture validate`\n  2. Check client installation\n  3. Review error details above\n  4. Try dry-run: `overture sync --dry-run`';
    }

    if (context.command === 'validate' && error instanceof Error) {
      return 'Fix validation errors in .overture/config.yaml:\n  1. Review each error above\n  2. See docs/error-messages.md for details\n  3. Validate YAML syntax at https://www.yamllint.com/\n  4. Re-run `overture validate` after fixes';
    }

    if (context.command === 'mcp list' && error instanceof Error) {
      return 'Failed to list MCPs:\n  - Ensure configuration exists (run `overture init`)\n  - Check config file syntax\n  - Verify file permissions';
    }

    if (context.command === 'mcp enable' && error instanceof Error) {
      return 'Failed to enable MCP:\n  - Verify MCP name is correct: `overture mcp list`\n  - Check configuration file permissions\n  - Manually edit .overture/config.yaml if needed';
    }

    // Generic suggestion with reference to docs
    return 'For detailed troubleshooting, see docs/error-messages.md\nRun with DEBUG=1 for verbose output: DEBUG=1 overture <command>';
  }

  /**
   * Log an error with formatting
   *
   * @param formatted - Formatted error
   * @param suggestion - Optional suggestion
   * @param verbose - Whether to show stack trace
   */
  static logError(
    formatted: FormattedError,
    suggestion?: string,
    verbose = false
  ): void {
    Logger.nl();
    Logger.error(chalk.bold(formatted.message));

    if (formatted.details) {
      Logger.nl();
      Logger.info(chalk.gray('Details:'));
      Logger.info(`  ${formatted.details}`);
    }

    if (suggestion) {
      Logger.nl();
      Logger.info(chalk.cyan('Suggestion:'));
      Logger.info(`  ${suggestion}`);
    }

    if (verbose && formatted.stack) {
      Logger.nl();
      Logger.debug(chalk.gray('Stack trace:'));
      Logger.debug(formatted.stack);
    }

    Logger.nl();
  }

  /**
   * Get category for an error
   *
   * @param error - The error to categorize
   * @returns Error category
   */
  static getErrorCategory(error: unknown): ErrorCategory {
    if (
      error instanceof ConfigurationError ||
      error instanceof ConfigError
    ) {
      return ErrorCategory.CONFIGURATION;
    }

    if (
      error instanceof DomainValidationError ||
      (error instanceof Error && error.message.includes('validation'))
    ) {
      return ErrorCategory.VALIDATION;
    }

    if (error instanceof FileSystemError) {
      return ErrorCategory.FILESYSTEM;
    }

    if (error instanceof NetworkError) {
      return ErrorCategory.NETWORK;
    }

    if (error instanceof UserCancelledError) {
      return ErrorCategory.USER_CANCELLED;
    }

    if (error instanceof DependencyError) {
      return ErrorCategory.DEPENDENCY;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Get detailed error information for known error types
   */
  private static getErrorDetails(error: OvertureError): string | undefined {
    if (error instanceof ConfigError && error.filePath) {
      return `File: ${error.filePath}`;
    }

    if (error instanceof DomainValidationError && error.issues.length > 0) {
      return `Issues:\n${error.issues.map((issue) => `  - ${issue}`).join('\n')}`;
    }

    if (error instanceof PluginError && error.pluginName) {
      return `Plugin: ${error.pluginName}`;
    }

    if (error instanceof McpError && error.mcpName) {
      return `MCP Server: ${error.mcpName}`;
    }

    return undefined;
  }

  /**
   * Get filesystem error details
   */
  private static getFileSystemErrorDetails(
    error: FileSystemError
  ): string | undefined {
    const parts: string[] = [];

    if (error.operation) {
      parts.push(`Operation: ${error.operation}`);
    }

    if (error.path) {
      parts.push(`Path: ${error.path}`);
    }

    return parts.length > 0 ? parts.join('\n') : undefined;
  }

  /**
   * Get network error details
   */
  private static getNetworkErrorDetails(
    error: NetworkError
  ): string | undefined {
    const parts: string[] = [];

    if (error.url) {
      parts.push(`URL: ${error.url}`);
    }

    if (error.statusCode) {
      parts.push(`Status Code: ${error.statusCode}`);
    }

    return parts.length > 0 ? parts.join('\n') : undefined;
  }
}
