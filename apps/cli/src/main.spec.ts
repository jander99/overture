import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleError, main } from './main';
import { OvertureError } from './domain/errors';
import { Logger } from './utils/logger';

// Mock the Logger
vi.mock('./utils/logger', () => ({
  Logger: {
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock the CLI and adapters for main() tests
vi.mock('./cli', () => ({
  createProgram: vi.fn(),
}));

vi.mock('./adapters', () => ({
  initializeAdapters: vi.fn(),
}));

describe('main.ts', () => {
  let originalDebug: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalDebug = process.env.DEBUG;
    delete process.env.DEBUG;
  });

  afterEach(() => {
    if (originalDebug !== undefined) {
      process.env.DEBUG = originalDebug;
    } else {
      delete process.env.DEBUG;
    }
  });

  describe('handleError', () => {
    describe('OvertureError handling', () => {
      it('should log error message and return OvertureError exitCode', () => {
        // Arrange
        const testError = new OvertureError('Test overture error', 'TEST_CODE', 42);

        // Act
        const exitCode = handleError(testError);

        // Assert
        expect(Logger.error).toHaveBeenCalledWith('Test overture error');
        expect(exitCode).toBe(42);
      });

      it('should show stack trace in DEBUG mode for OvertureError', () => {
        // Arrange
        process.env.DEBUG = '1';
        const testError = new OvertureError('Debug error', 'DEBUG_CODE', 5);

        // Act
        const exitCode = handleError(testError);

        // Assert
        expect(Logger.error).toHaveBeenCalledWith('Debug error');
        expect(Logger.debug).toHaveBeenCalledWith(expect.stringContaining('OvertureError'));
        expect(exitCode).toBe(5);
      });

      it('should not show stack trace when DEBUG is not set', () => {
        // Arrange
        const testError = new OvertureError('No debug', 'NO_DEBUG', 3);

        // Act
        handleError(testError);

        // Assert
        expect(Logger.debug).not.toHaveBeenCalled();
      });

      it('should use default exit code 1 when not specified', () => {
        // Arrange
        const testError = new OvertureError('Default exit', 'DEFAULT');

        // Act
        const exitCode = handleError(testError);

        // Assert
        expect(exitCode).toBe(1);
      });
    });

    describe('Unexpected Error handling', () => {
      it('should handle unexpected Error instances with exit code 1', () => {
        // Arrange
        const unexpectedError = new Error('Unexpected failure');

        // Act
        const exitCode = handleError(unexpectedError);

        // Assert
        expect(Logger.error).toHaveBeenCalledWith('An unexpected error occurred');
        expect(Logger.error).toHaveBeenCalledWith('Unexpected failure');
        expect(exitCode).toBe(1);
      });

      it('should show stack trace in DEBUG mode for unexpected errors', () => {
        // Arrange
        process.env.DEBUG = '1';
        const unexpectedError = new Error('Debug unexpected');
        unexpectedError.stack = 'Error: Debug unexpected\n    at test.js:1:1';

        // Act
        handleError(unexpectedError);

        // Assert
        expect(Logger.debug).toHaveBeenCalledWith(unexpectedError.stack);
      });

      it('should not show stack trace for unexpected errors when DEBUG is not set', () => {
        // Arrange
        const unexpectedError = new Error('No debug trace');

        // Act
        handleError(unexpectedError);

        // Assert
        expect(Logger.debug).not.toHaveBeenCalled();
      });
    });

    describe('Non-Error throw handling', () => {
      it('should handle string throws with exit code 1', () => {
        // Arrange
        const stringError = 'string error';

        // Act
        const exitCode = handleError(stringError);

        // Assert
        expect(Logger.error).toHaveBeenCalledWith('An unknown error occurred');
        expect(Logger.debug).toHaveBeenCalledWith('string error');
        expect(exitCode).toBe(1);
      });

      it('should handle null throws', () => {
        // Act
        const exitCode = handleError(null);

        // Assert
        expect(Logger.error).toHaveBeenCalledWith('An unknown error occurred');
        expect(Logger.debug).toHaveBeenCalledWith('null');
        expect(exitCode).toBe(1);
      });

      it('should handle undefined throws', () => {
        // Act
        const exitCode = handleError(undefined);

        // Assert
        expect(Logger.error).toHaveBeenCalledWith('An unknown error occurred');
        expect(Logger.debug).toHaveBeenCalledWith('undefined');
        expect(exitCode).toBe(1);
      });

      it('should handle number throws', () => {
        // Act
        const exitCode = handleError(42);

        // Assert
        expect(Logger.error).toHaveBeenCalledWith('An unknown error occurred');
        expect(Logger.debug).toHaveBeenCalledWith('42');
        expect(exitCode).toBe(1);
      });

      it('should handle object throws', () => {
        // Arrange
        const objError = { code: 'ERR', message: 'Object error' };

        // Act
        const exitCode = handleError(objError);

        // Assert
        expect(Logger.error).toHaveBeenCalledWith('An unknown error occurred');
        expect(Logger.debug).toHaveBeenCalledWith('[object Object]');
        expect(exitCode).toBe(1);
      });
    });
  });

  describe('main function', () => {
    it('should initialize adapters before creating program', async () => {
      // Arrange
      const { createProgram } = await import('./cli');
      const { initializeAdapters } = await import('./adapters');
      const initOrder: string[] = [];

      vi.mocked(initializeAdapters).mockImplementation(() => {
        initOrder.push('initializeAdapters');
      });
      vi.mocked(createProgram).mockImplementation(() => {
        initOrder.push('createProgram');
        return {
          parseAsync: vi.fn().mockResolvedValue(undefined),
        } as any;
      });

      // Act
      await main();

      // Assert
      expect(initOrder).toEqual(['initializeAdapters', 'createProgram']);
    });

    it('should call parseAsync with process.argv', async () => {
      // Arrange
      const { createProgram } = await import('./cli');
      const mockParseAsync = vi.fn().mockResolvedValue(undefined);
      vi.mocked(createProgram).mockReturnValue({
        parseAsync: mockParseAsync,
      } as any);

      // Act
      await main();

      // Assert
      expect(mockParseAsync).toHaveBeenCalledWith(process.argv);
    });

    it('should call process.exit with correct code on OvertureError', async () => {
      // Arrange
      const { createProgram } = await import('./cli');
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const testError = new OvertureError('CLI error', 'CLI_ERR', 7);

      vi.mocked(createProgram).mockReturnValue({
        parseAsync: vi.fn().mockRejectedValue(testError),
      } as any);

      // Act
      await main();

      // Assert
      expect(mockExit).toHaveBeenCalledWith(7);
      mockExit.mockRestore();
    });

    it('should call process.exit with 1 on unexpected error', async () => {
      // Arrange
      const { createProgram } = await import('./cli');
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      vi.mocked(createProgram).mockReturnValue({
        parseAsync: vi.fn().mockRejectedValue(new Error('Unexpected')),
      } as any);

      // Act
      await main();

      // Assert
      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });
});
