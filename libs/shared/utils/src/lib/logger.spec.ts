/**
 * Logger Tests
 *
 * @module @overture/utils/logger.spec
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { Logger, logger } from './logger.js';
import type { OutputPort } from '@overture/ports-output';

describe('Logger', () => {
  let consoleSpy: MockInstance;
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    delete process.env['DEBUG'];
  });

  describe('implements OutputPort interface', () => {
    it('should implement OutputPort interface', () => {
      const loggerInstance = new Logger();

      // Verify it satisfies the OutputPort interface
      const outputPort: OutputPort = loggerInstance;
      expect(typeof outputPort.info).toBe('function');
      expect(typeof outputPort.success).toBe('function');
      expect(typeof outputPort.warn).toBe('function');
      expect(typeof outputPort.error).toBe('function');
    });

    it('should be usable as OutputPort in dependency injection', () => {
      function useOutput(output: OutputPort) {
        output.info('test');
        output.success('test');
        output.warn('test');
        output.error('test');
      }

      // Should not throw
      expect(() => useOutput(new Logger())).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledTimes(3);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('instance methods', () => {
    let loggerInstance: Logger;

    beforeEach(() => {
      loggerInstance = new Logger();
    });

    it('should log info message with blue icon', () => {
      loggerInstance.info('Test info message');
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0].join(' ');
      expect(call).toContain('Test info message');
    });

    it('should log success message with green icon', () => {
      loggerInstance.success('Test success message');
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0].join(' ');
      expect(call).toContain('Test success message');
    });

    it('should log warn message with yellow icon', () => {
      loggerInstance.warn('Test warning message');
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0].join(' ');
      expect(call).toContain('Test warning message');
    });

    it('should log error message with red icon', () => {
      loggerInstance.error('Test error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0].join(' ');
      expect(call).toContain('Test error message');
    });

    it('should log debug message only when DEBUG is set', () => {
      loggerInstance.debug('Test debug message');
      expect(consoleSpy).not.toHaveBeenCalled();

      process.env['DEBUG'] = '1';
      loggerInstance.debug('Test debug message');
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0].join(' ');
      expect(call).toContain('Test debug message');
    });

    it('should print newline for nl()', () => {
      loggerInstance.nl();
      expect(consoleSpy).toHaveBeenCalledWith();
    });

    it('should print section header with bold styling', () => {
      loggerInstance.section('Test Section');
      expect(consoleSpy).toHaveBeenCalledTimes(2);
      expect(consoleSpy.mock.calls[0][0]).toBe(undefined); // first call is newline
      const call = consoleSpy.mock.calls[1].join(' ');
      expect(call).toContain('Test Section');
    });

    it('should print skip message with gray styling', () => {
      loggerInstance.skip('Skipped item');
      expect(consoleSpy).toHaveBeenCalled();
      // Verify it was called (exact styling depends on chalk)
    });

    it('should print plain message without icon', () => {
      loggerInstance.plain('Plain message');
      expect(consoleSpy).toHaveBeenCalledWith('Plain message');
    });
  });

  describe('static methods', () => {
    it('should log info message with blue icon', () => {
      Logger.info('Test info message');
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0].join(' ');
      expect(call).toContain('Test info message');
    });

    it('should log success message with green icon', () => {
      Logger.success('Test success message');
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0].join(' ');
      expect(call).toContain('Test success message');
    });

    it('should log warn message with yellow icon', () => {
      Logger.warn('Test warning message');
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0].join(' ');
      expect(call).toContain('Test warning message');
    });

    it('should log error message with red icon', () => {
      Logger.error('Test error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
      const call = consoleErrorSpy.mock.calls[0].join(' ');
      expect(call).toContain('Test error message');
    });

    it('should log debug message only when DEBUG is set', () => {
      Logger.debug('Test debug message');
      expect(consoleSpy).not.toHaveBeenCalled();

      process.env['DEBUG'] = '1';
      Logger.debug('Test debug message');
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0].join(' ');
      expect(call).toContain('Test debug message');
    });

    it('should print newline for nl()', () => {
      Logger.nl();
      expect(consoleSpy).toHaveBeenCalledWith();
    });

    it('should print section header with bold styling', () => {
      Logger.section('Test Section');
      expect(consoleSpy).toHaveBeenCalledTimes(2);
    });

    it('should print skip message with gray styling', () => {
      Logger.skip('Skipped item');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should print plain message without icon', () => {
      Logger.plain('Plain message');
      expect(consoleSpy).toHaveBeenCalledWith('Plain message');
    });
  });

  describe('default logger export', () => {
    it('should export a pre-instantiated logger', () => {
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should work as OutputPort', () => {
      const outputPort: OutputPort = logger;
      expect(typeof outputPort.info).toBe('function');
      expect(typeof outputPort.success).toBe('function');
      expect(typeof outputPort.warn).toBe('function');
      expect(typeof outputPort.error).toBe('function');
    });
  });
});
