/**
 * Unit tests for error-handler
 *
 * @group unit/core/error-handler
 */

import {
  ErrorHandler,
  ExitCode,
  ErrorCategory,
  ConfigurationError,
  FileSystemError,
  NetworkError,
  UserCancelledError,
  DependencyError,
} from './error-handler';
import {
  OvertureError,
  ConfigError,
  ValidationError as DomainValidationError,
  PluginError,
  McpError,
} from '../domain/errors';
import { Logger } from '../utils/logger';

// Mock Logger
jest.mock('../utils/logger');

describe('ErrorHandler', () => {
  let mockExit: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;

  beforeEach(() => {
    // Mock process.exit
    mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    // Mock console.error
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

    // Clear logger mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('formatError', () => {
    it('should format OvertureError', () => {
      const error = new OvertureError('Test error', 'TEST_CODE', 2);
      const formatted = ErrorHandler.formatError(error);

      expect(formatted.message).toBe('Test error');
      expect(formatted.exitCode).toBe(2);
    });

    it('should format ConfigError with file path', () => {
      const error = new ConfigError('Invalid config', '/path/to/config.yaml');
      const formatted = ErrorHandler.formatError(error);

      expect(formatted.message).toBe('Invalid config');
      expect(formatted.details).toContain('/path/to/config.yaml');
      expect(formatted.exitCode).toBe(2);
    });

    it('should format ValidationError with issues', () => {
      const error = new DomainValidationError('Validation failed', [
        'Missing field: command',
        'Invalid transport',
      ]);
      const formatted = ErrorHandler.formatError(error);

      expect(formatted.message).toBe('Validation failed');
      expect(formatted.details).toContain('Missing field: command');
      expect(formatted.details).toContain('Invalid transport');
      expect(formatted.exitCode).toBe(3);
    });

    it('should format ConfigurationError', () => {
      const error = new ConfigurationError(
        'Config not found',
        '/path/to/config.yaml'
      );
      const formatted = ErrorHandler.formatError(error);

      expect(formatted.message).toBe('Config not found');
      expect(formatted.details).toContain('/path/to/config.yaml');
      expect(formatted.exitCode).toBe(ExitCode.CONFIG_ERROR);
    });

    it('should format FileSystemError with operation and path', () => {
      const error = new FileSystemError(
        'Permission denied',
        '/path/to/file',
        'write'
      );
      const formatted = ErrorHandler.formatError(error);

      expect(formatted.message).toBe('Permission denied');
      expect(formatted.details).toContain('Operation: write');
      expect(formatted.details).toContain('Path: /path/to/file');
      expect(formatted.exitCode).toBe(ExitCode.FILESYSTEM_ERROR);
    });

    it('should format NetworkError with URL and status', () => {
      const error = new NetworkError(
        'Request failed',
        'https://api.example.com',
        404
      );
      const formatted = ErrorHandler.formatError(error);

      expect(formatted.message).toBe('Request failed');
      expect(formatted.details).toContain('URL: https://api.example.com');
      expect(formatted.details).toContain('Status Code: 404');
      expect(formatted.exitCode).toBe(ExitCode.GENERAL_ERROR);
    });

    it('should format UserCancelledError', () => {
      const error = new UserCancelledError();
      const formatted = ErrorHandler.formatError(error);

      expect(formatted.message).toBe('Operation cancelled by user');
      expect(formatted.exitCode).toBe(ExitCode.USER_CANCELLED);
    });

    it('should format DependencyError', () => {
      const error = new DependencyError('Missing npm', 'npm');
      const formatted = ErrorHandler.formatError(error);

      expect(formatted.message).toBe('Missing npm');
      expect(formatted.details).toContain('Missing dependency: npm');
      expect(formatted.exitCode).toBe(ExitCode.GENERAL_ERROR);
    });

    it('should format standard Error', () => {
      const error = new Error('Something went wrong');
      const formatted = ErrorHandler.formatError(error);

      expect(formatted.message).toBe('Something went wrong');
      expect(formatted.exitCode).toBe(ExitCode.GENERAL_ERROR);
    });

    it('should format unknown error type', () => {
      const error = 'string error';
      const formatted = ErrorHandler.formatError(error);

      expect(formatted.message).toBe('An unknown error occurred');
      expect(formatted.details).toBe('string error');
      expect(formatted.exitCode).toBe(ExitCode.UNKNOWN_ERROR);
    });

    it('should include stack trace when verbose is true', () => {
      const error = new Error('Test error');
      const formatted = ErrorHandler.formatError(error, true);

      expect(formatted.stack).toBeDefined();
      expect(formatted.stack).toContain('Test error');
    });

    it('should not include stack trace when verbose is false', () => {
      const error = new Error('Test error');
      const formatted = ErrorHandler.formatError(error, false);

      expect(formatted.stack).toBeUndefined();
    });
  });

  describe('getErrorSuggestion', () => {
    it('should suggest running init for config not found', () => {
      const error = new Error('Configuration not found');
      const suggestion = ErrorHandler.getErrorSuggestion(error, {});

      expect(suggestion).toContain('overture init');
    });

    it('should suggest checking YAML syntax for invalid YAML', () => {
      const error = new Error('invalid yaml syntax');
      const suggestion = ErrorHandler.getErrorSuggestion(error, {});

      expect(suggestion).toContain('YAML syntax');
      expect(suggestion).toContain('indentation');
    });

    it('should suggest checking permissions for EACCES error', () => {
      const error = new Error('EACCES: permission denied');
      const suggestion = ErrorHandler.getErrorSuggestion(error, {});

      expect(suggestion).toContain('permission');
    });

    it('should suggest reviewing validation errors', () => {
      const error = new DomainValidationError('Validation failed');
      const suggestion = ErrorHandler.getErrorSuggestion(error, {});

      expect(suggestion).toContain('validation errors');
    });

    it('should suggest installing dependency', () => {
      const error = new DependencyError('Missing npm', 'npm');
      const suggestion = ErrorHandler.getErrorSuggestion(error, {});

      expect(suggestion).toContain('npm install -g npm');
    });

    it('should return undefined for user cancelled', () => {
      const error = new UserCancelledError();
      const suggestion = ErrorHandler.getErrorSuggestion(error, {});

      expect(suggestion).toBeUndefined();
    });

    it('should suggest freeing disk space for ENOSPC', () => {
      const error = new Error('ENOSPC: no space left on device');
      const suggestion = ErrorHandler.getErrorSuggestion(error, {});

      expect(suggestion).toContain('disk space');
    });

    it('should suggest using --force for file already exists', () => {
      const error = new Error('Configuration already exists');
      const suggestion = ErrorHandler.getErrorSuggestion(error, {});

      expect(suggestion).toContain('--force');
    });

    it('should suggest checking network for network errors', () => {
      const error = new NetworkError('Connection timeout');
      const suggestion = ErrorHandler.getErrorSuggestion(error, {});

      expect(suggestion).toContain('internet connection');
    });

    it('should provide command-specific suggestion for init', () => {
      const error = new Error('Some error');
      const suggestion = ErrorHandler.getErrorSuggestion(error, {
        command: 'init',
      });

      expect(suggestion).toContain('--force');
    });

    it('should provide command-specific suggestion for sync', () => {
      const error = new Error('Some error');
      const suggestion = ErrorHandler.getErrorSuggestion(error, {
        command: 'sync',
      });

      expect(suggestion).toContain('overture validate');
    });

    it('should provide generic suggestion for unknown errors', () => {
      const error = new Error('Unknown error');
      const suggestion = ErrorHandler.getErrorSuggestion(error, {});

      expect(suggestion).toContain('DEBUG=1');
    });
  });

  describe('getErrorCategory', () => {
    it('should categorize ConfigurationError', () => {
      const error = new ConfigurationError('Config error');
      const category = ErrorHandler.getErrorCategory(error);

      expect(category).toBe(ErrorCategory.CONFIGURATION);
    });

    it('should categorize ConfigError', () => {
      const error = new ConfigError('Config error');
      const category = ErrorHandler.getErrorCategory(error);

      expect(category).toBe(ErrorCategory.CONFIGURATION);
    });

    it('should categorize ValidationError', () => {
      const error = new DomainValidationError('Validation error');
      const category = ErrorHandler.getErrorCategory(error);

      expect(category).toBe(ErrorCategory.VALIDATION);
    });

    it('should categorize FileSystemError', () => {
      const error = new FileSystemError('FS error');
      const category = ErrorHandler.getErrorCategory(error);

      expect(category).toBe(ErrorCategory.FILESYSTEM);
    });

    it('should categorize NetworkError', () => {
      const error = new NetworkError('Network error');
      const category = ErrorHandler.getErrorCategory(error);

      expect(category).toBe(ErrorCategory.NETWORK);
    });

    it('should categorize UserCancelledError', () => {
      const error = new UserCancelledError();
      const category = ErrorHandler.getErrorCategory(error);

      expect(category).toBe(ErrorCategory.USER_CANCELLED);
    });

    it('should categorize DependencyError', () => {
      const error = new DependencyError('Dependency error');
      const category = ErrorHandler.getErrorCategory(error);

      expect(category).toBe(ErrorCategory.DEPENDENCY);
    });

    it('should categorize unknown errors', () => {
      const error = new Error('Unknown error');
      const category = ErrorHandler.getErrorCategory(error);

      expect(category).toBe(ErrorCategory.UNKNOWN);
    });
  });

  describe('logError', () => {
    it('should log error message', () => {
      const formatted = {
        message: 'Test error',
        exitCode: 1,
      };

      ErrorHandler.logError(formatted);

      expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Test error'));
    });

    it('should log error details', () => {
      const formatted = {
        message: 'Test error',
        details: 'Additional details',
        exitCode: 1,
      };

      ErrorHandler.logError(formatted);

      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('Details:'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('Additional details'));
    });

    it('should log suggestion', () => {
      const formatted = {
        message: 'Test error',
        exitCode: 1,
      };
      const suggestion = 'Try this fix';

      ErrorHandler.logError(formatted, suggestion);

      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('Suggestion:'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('Try this fix'));
    });

    it('should log stack trace when verbose', () => {
      const formatted = {
        message: 'Test error',
        stack: 'Error: Test error\n  at ...',
        exitCode: 1,
      };

      ErrorHandler.logError(formatted, undefined, true);

      expect(Logger.debug).toHaveBeenCalledWith(expect.stringContaining('Stack trace:'));
      expect(Logger.debug).toHaveBeenCalledWith(expect.stringContaining('Error: Test error'));
    });

    it('should not log stack trace when not verbose', () => {
      const formatted = {
        message: 'Test error',
        stack: 'Error: Test error\n  at ...',
        exitCode: 1,
      };

      ErrorHandler.logError(formatted, undefined, false);

      expect(Logger.debug).not.toHaveBeenCalled();
    });
  });

  describe('handleCommandError', () => {
    it('should format, log, and exit with correct code', () => {
      const error = new ConfigError('Config error');

      try {
        ErrorHandler.handleCommandError(error, 'init');
      } catch (e) {
        // Catch the mock process.exit throw
      }

      expect(Logger.error).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(2);
    });

    it('should include command name in context', () => {
      const error = new Error('Some error');

      try {
        ErrorHandler.handleCommandError(error, 'sync');
      } catch (e) {
        // Catch the mock process.exit throw
      }

      expect(Logger.error).toHaveBeenCalled();
      // Suggestion should include "overture validate" for sync command
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('overture validate')
      );
    });

    it('should show stack trace when verbose', () => {
      const error = new Error('Test error');

      try {
        ErrorHandler.handleCommandError(error, 'test', true);
      } catch (e) {
        // Catch the mock process.exit throw
      }

      expect(Logger.debug).toHaveBeenCalled();
    });

    it('should not show stack trace when not verbose', () => {
      const error = new Error('Test error');

      try {
        ErrorHandler.handleCommandError(error, 'test', false);
      } catch (e) {
        // Catch the mock process.exit throw
      }

      expect(Logger.debug).not.toHaveBeenCalled();
    });
  });

  describe('Custom error classes', () => {
    it('should create ConfigurationError with path', () => {
      const error = new ConfigurationError('Config error', '/path/to/config');

      expect(error.message).toBe('Config error');
      expect(error.path).toBe('/path/to/config');
      expect(error.name).toBe('ConfigurationError');
    });

    it('should create FileSystemError with all properties', () => {
      const error = new FileSystemError(
        'FS error',
        '/path/to/file',
        'write'
      );

      expect(error.message).toBe('FS error');
      expect(error.path).toBe('/path/to/file');
      expect(error.operation).toBe('write');
      expect(error.name).toBe('FileSystemError');
    });

    it('should create NetworkError with all properties', () => {
      const error = new NetworkError(
        'Network error',
        'https://example.com',
        404
      );

      expect(error.message).toBe('Network error');
      expect(error.url).toBe('https://example.com');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('NetworkError');
    });

    it('should create UserCancelledError with default message', () => {
      const error = new UserCancelledError();

      expect(error.message).toBe('Operation cancelled by user');
      expect(error.name).toBe('UserCancelledError');
    });

    it('should create DependencyError with dependency name', () => {
      const error = new DependencyError('Missing npm', 'npm');

      expect(error.message).toBe('Missing npm');
      expect(error.dependency).toBe('npm');
      expect(error.name).toBe('DependencyError');
    });
  });

  describe('Error details', () => {
    it('should get details for PluginError', () => {
      const error = new PluginError('Plugin failed', 'test-plugin');
      const formatted = ErrorHandler.formatError(error);

      expect(formatted.details).toContain('Plugin: test-plugin');
    });

    it('should get details for McpError', () => {
      const error = new McpError('MCP failed', 'test-mcp');
      const formatted = ErrorHandler.formatError(error);

      expect(formatted.details).toContain('MCP Server: test-mcp');
    });
  });

  describe('Platform-specific suggestions', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
      });
    });

    it('should suggest Administrator for Windows permission errors', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
      });

      const error = new Error('EACCES: permission denied');
      const suggestion = ErrorHandler.getErrorSuggestion(error, {});

      expect(suggestion).toContain('Administrator');
    });

    it('should suggest sudo for Unix permission errors', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
      });

      const error = new Error('EACCES: permission denied');
      const suggestion = ErrorHandler.getErrorSuggestion(error, {});

      expect(suggestion).toContain('sudo');
    });
  });
});
