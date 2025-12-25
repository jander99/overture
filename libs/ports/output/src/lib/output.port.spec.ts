import { describe, it, expect, vi } from 'vitest';
import type { OutputPort } from './output.port.js';

describe('Port: OutputPort Interface', () => {
  describe('Interface Contract', () => {
    describe('Method signatures', () => {
      it('should define info method accepting string', () => {
        // Arrange
        const mockOutput: OutputPort = {
          info: vi.fn(),
          success: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        };

        // Act
        mockOutput.info('Information message');

        // Assert
        expect(mockOutput.info).toHaveBeenCalledWith('Information message');
      });

      it('should define success method accepting string', () => {
        // Arrange
        const mockOutput: OutputPort = {
          info: vi.fn(),
          success: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        };

        // Act
        mockOutput.success('Success message');

        // Assert
        expect(mockOutput.success).toHaveBeenCalledWith('Success message');
      });

      it('should define warn method accepting string', () => {
        // Arrange
        const mockOutput: OutputPort = {
          info: vi.fn(),
          success: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        };

        // Act
        mockOutput.warn('Warning message');

        // Assert
        expect(mockOutput.warn).toHaveBeenCalledWith('Warning message');
      });

      it('should define error method accepting string', () => {
        // Arrange
        const mockOutput: OutputPort = {
          info: vi.fn(),
          success: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        };

        // Act
        mockOutput.error('Error message');

        // Assert
        expect(mockOutput.error).toHaveBeenCalledWith('Error message');
      });
    });

    describe('Return values', () => {
      it('should have void return type for info method', () => {
        // Arrange
        const mockOutput: OutputPort = {
          info: vi.fn(),
          success: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        };

        // Act
        const result = mockOutput.info('test');

        // Assert
        expect(result).toBeUndefined();
      });

      it('should have void return type for success method', () => {
        // Arrange
        const mockOutput: OutputPort = {
          info: vi.fn(),
          success: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        };

        // Act
        const result = mockOutput.success('test');

        // Assert
        expect(result).toBeUndefined();
      });

      it('should have void return type for warn method', () => {
        // Arrange
        const mockOutput: OutputPort = {
          info: vi.fn(),
          success: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        };

        // Act
        const result = mockOutput.warn('test');

        // Assert
        expect(result).toBeUndefined();
      });

      it('should have void return type for error method', () => {
        // Arrange
        const mockOutput: OutputPort = {
          info: vi.fn(),
          success: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        };

        // Act
        const result = mockOutput.error('test');

        // Assert
        expect(result).toBeUndefined();
      });
    });
  });

  describe('Implementation Examples', () => {
    describe('Console-based implementation', () => {
      it('should work with console.log-based implementation', () => {
        // Arrange
        const messages: string[] = [];
        const consoleOutput: OutputPort = {
          info: (message: string) => messages.push(`INFO: ${message}`),
          success: (message: string) => messages.push(`SUCCESS: ${message}`),
          warn: (message: string) => messages.push(`WARN: ${message}`),
          error: (message: string) => messages.push(`ERROR: ${message}`),
        };

        // Act
        consoleOutput.info('Starting operation');
        consoleOutput.success('Operation completed');
        consoleOutput.warn('Minor issue detected');
        consoleOutput.error('Critical failure');

        // Assert
        expect(messages).toEqual([
          'INFO: Starting operation',
          'SUCCESS: Operation completed',
          'WARN: Minor issue detected',
          'ERROR: Critical failure',
        ]);
      });

      it('should work with prefixed output', () => {
        // Arrange
        const messages: string[] = [];
        const prefixedOutput: OutputPort = {
          info: (message: string) => messages.push(`[i] ${message}`),
          success: (message: string) => messages.push(`[✓] ${message}`),
          warn: (message: string) => messages.push(`[!] ${message}`),
          error: (message: string) => messages.push(`[✗] ${message}`),
        };

        // Act
        prefixedOutput.info('Info message');
        prefixedOutput.success('Success message');
        prefixedOutput.warn('Warning message');
        prefixedOutput.error('Error message');

        // Assert
        expect(messages).toEqual([
          '[i] Info message',
          '[✓] Success message',
          '[!] Warning message',
          '[✗] Error message',
        ]);
      });
    });

    describe('Buffer-based implementation', () => {
      it('should work with buffered output', () => {
        // Arrange
        const buffer: Array<{ level: string; message: string }> = [];
        const bufferOutput: OutputPort = {
          info: (message: string) => buffer.push({ level: 'info', message }),
          success: (message: string) =>
            buffer.push({ level: 'success', message }),
          warn: (message: string) => buffer.push({ level: 'warn', message }),
          error: (message: string) => buffer.push({ level: 'error', message }),
        };

        // Act
        bufferOutput.info('First message');
        bufferOutput.warn('Second message');
        bufferOutput.error('Third message');

        // Assert
        expect(buffer).toHaveLength(3);
        expect(buffer[0]).toEqual({ level: 'info', message: 'First message' });
        expect(buffer[1]).toEqual({ level: 'warn', message: 'Second message' });
        expect(buffer[2]).toEqual({
          level: 'error',
          message: 'Third message',
        });
      });

      it('should allow filtering by level', () => {
        // Arrange
        const buffer: Array<{ level: string; message: string }> = [];
        const bufferOutput: OutputPort = {
          info: (message: string) => buffer.push({ level: 'info', message }),
          success: (message: string) =>
            buffer.push({ level: 'success', message }),
          warn: (message: string) => buffer.push({ level: 'warn', message }),
          error: (message: string) => buffer.push({ level: 'error', message }),
        };

        // Act
        bufferOutput.info('Info 1');
        bufferOutput.error('Error 1');
        bufferOutput.info('Info 2');
        bufferOutput.warn('Warn 1');

        const errors = buffer.filter((entry) => entry.level === 'error');
        const infos = buffer.filter((entry) => entry.level === 'info');

        // Assert
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('Error 1');
        expect(infos).toHaveLength(2);
        expect(infos.map((e) => e.message)).toEqual(['Info 1', 'Info 2']);
      });
    });

    describe('Silent/no-op implementation', () => {
      it('should work with silent implementation', () => {
        // Arrange
        const silentOutput: OutputPort = {
          info: () => {},
          success: () => {},
          warn: () => {},
          error: () => {},
        };

        // Act & Assert - should not throw
        expect(() => {
          silentOutput.info('test');
          silentOutput.success('test');
          silentOutput.warn('test');
          silentOutput.error('test');
        }).not.toThrow();
      });
    });

    describe('Counting implementation', () => {
      it('should work with message counter', () => {
        // Arrange
        let infoCount = 0;
        let successCount = 0;
        let warnCount = 0;
        let errorCount = 0;

        const countingOutput: OutputPort = {
          info: () => infoCount++,
          success: () => successCount++,
          warn: () => warnCount++,
          error: () => errorCount++,
        };

        // Act
        countingOutput.info('message 1');
        countingOutput.info('message 2');
        countingOutput.success('message 3');
        countingOutput.warn('message 4');
        countingOutput.error('message 5');
        countingOutput.error('message 6');

        // Assert
        expect(infoCount).toBe(2);
        expect(successCount).toBe(1);
        expect(warnCount).toBe(1);
        expect(errorCount).toBe(2);
      });
    });
  });

  describe('Message Content', () => {
    describe('Empty messages', () => {
      it('should handle empty string messages', () => {
        // Arrange
        const mockOutput: OutputPort = {
          info: vi.fn(),
          success: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        };

        // Act
        mockOutput.info('');
        mockOutput.success('');
        mockOutput.warn('');
        mockOutput.error('');

        // Assert
        expect(mockOutput.info).toHaveBeenCalledWith('');
        expect(mockOutput.success).toHaveBeenCalledWith('');
        expect(mockOutput.warn).toHaveBeenCalledWith('');
        expect(mockOutput.error).toHaveBeenCalledWith('');
      });
    });

    describe('Special characters', () => {
      it('should handle messages with newlines', () => {
        // Arrange
        const messages: string[] = [];
        const output: OutputPort = {
          info: (msg) => messages.push(msg),
          success: (msg) => messages.push(msg),
          warn: (msg) => messages.push(msg),
          error: (msg) => messages.push(msg),
        };

        // Act
        output.info('Line 1\nLine 2\nLine 3');

        // Assert
        expect(messages[0]).toBe('Line 1\nLine 2\nLine 3');
      });

      it('should handle messages with special characters', () => {
        // Arrange
        const messages: string[] = [];
        const output: OutputPort = {
          info: (msg) => messages.push(msg),
          success: (msg) => messages.push(msg),
          warn: (msg) => messages.push(msg),
          error: (msg) => messages.push(msg),
        };

        // Act
        output.error('Error: File not found at /path/to/file.txt!');
        output.warn('Warning: Config missing "plugins" field');

        // Assert
        expect(messages[0]).toContain('/path/to/file.txt');
        expect(messages[1]).toContain('"plugins"');
      });

      it('should handle Unicode characters', () => {
        // Arrange
        const messages: string[] = [];
        const output: OutputPort = {
          info: (msg) => messages.push(msg),
          success: (msg) => messages.push(msg),
          warn: (msg) => messages.push(msg),
          error: (msg) => messages.push(msg),
        };

        // Act
        output.success('✓ Operation successful');
        output.error('✗ Operation failed');
        output.info('ℹ Information');

        // Assert
        expect(messages).toEqual([
          '✓ Operation successful',
          '✗ Operation failed',
          'ℹ Information',
        ]);
      });
    });

    describe('Long messages', () => {
      it('should handle very long messages', () => {
        // Arrange
        const longMessage = 'A'.repeat(1000);
        const messages: string[] = [];
        const output: OutputPort = {
          info: (msg) => messages.push(msg),
          success: (msg) => messages.push(msg),
          warn: (msg) => messages.push(msg),
          error: (msg) => messages.push(msg),
        };

        // Act
        output.info(longMessage);

        // Assert
        expect(messages[0]).toHaveLength(1000);
        expect(messages[0]).toBe(longMessage);
      });
    });
  });

  describe('Mock Verification', () => {
    describe('Call tracking', () => {
      it('should track info method calls', () => {
        // Arrange
        const mockOutput: OutputPort = {
          info: vi.fn(),
          success: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        };

        // Act
        mockOutput.info('First call');
        mockOutput.info('Second call');

        // Assert
        expect(mockOutput.info).toHaveBeenCalledTimes(2);
        expect(mockOutput.info).toHaveBeenNthCalledWith(1, 'First call');
        expect(mockOutput.info).toHaveBeenNthCalledWith(2, 'Second call');
      });

      it('should track all method calls independently', () => {
        // Arrange
        const mockOutput: OutputPort = {
          info: vi.fn(),
          success: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        };

        // Act
        mockOutput.info('Info 1');
        mockOutput.success('Success 1');
        mockOutput.warn('Warn 1');
        mockOutput.error('Error 1');
        mockOutput.info('Info 2');

        // Assert
        expect(mockOutput.info).toHaveBeenCalledTimes(2);
        expect(mockOutput.success).toHaveBeenCalledTimes(1);
        expect(mockOutput.warn).toHaveBeenCalledTimes(1);
        expect(mockOutput.error).toHaveBeenCalledTimes(1);
      });
    });

    describe('Call order', () => {
      it('should verify call order across methods', () => {
        // Arrange
        const calls: string[] = [];
        const mockOutput: OutputPort = {
          info: (msg) => calls.push(`info:${msg}`),
          success: (msg) => calls.push(`success:${msg}`),
          warn: (msg) => calls.push(`warn:${msg}`),
          error: (msg) => calls.push(`error:${msg}`),
        };

        // Act
        mockOutput.info('Starting');
        mockOutput.warn('Warning detected');
        mockOutput.error('Error occurred');
        mockOutput.success('Recovered');

        // Assert
        expect(calls).toEqual([
          'info:Starting',
          'warn:Warning detected',
          'error:Error occurred',
          'success:Recovered',
        ]);
      });
    });
  });

  describe('Integration with Use Cases', () => {
    describe('CLI output scenario', () => {
      it('should support typical CLI workflow', () => {
        // Arrange
        const messages: string[] = [];
        const cliOutput: OutputPort = {
          info: (msg) => messages.push(`[INFO] ${msg}`),
          success: (msg) => messages.push(`[SUCCESS] ${msg}`),
          warn: (msg) => messages.push(`[WARN] ${msg}`),
          error: (msg) => messages.push(`[ERROR] ${msg}`),
        };

        // Act - simulate overture sync workflow
        cliOutput.info('Reading configuration from .overture/config.yaml');
        cliOutput.info('Validating configuration schema');
        cliOutput.success('Configuration validated successfully');
        cliOutput.info('Installing plugins');
        cliOutput.warn('Plugin python-development already installed');
        cliOutput.success('All plugins synchronized');
        cliOutput.info('Generating .mcp.json');
        cliOutput.success('Sync completed successfully');

        // Assert
        expect(messages).toHaveLength(8);
        expect(messages.filter((m) => m.startsWith('[INFO]'))).toHaveLength(4);
        expect(messages.filter((m) => m.startsWith('[SUCCESS]'))).toHaveLength(
          3,
        );
        expect(messages.filter((m) => m.startsWith('[WARN]'))).toHaveLength(1);
      });

      it('should support error reporting workflow', () => {
        // Arrange
        const messages: string[] = [];
        const cliOutput: OutputPort = {
          info: (msg) => messages.push(`[INFO] ${msg}`),
          success: (msg) => messages.push(`[SUCCESS] ${msg}`),
          warn: (msg) => messages.push(`[WARN] ${msg}`),
          error: (msg) => messages.push(`[ERROR] ${msg}`),
        };

        // Act - simulate validation failure
        cliOutput.info('Validating configuration');
        cliOutput.error('Validation failed');
        cliOutput.error('  - "plugins" field is required');
        cliOutput.error('  - "mcp" field must be an object');

        // Assert
        expect(messages.filter((m) => m.startsWith('[ERROR]'))).toHaveLength(3);
      });
    });

    describe('Testing scenario', () => {
      it('should work as test spy', () => {
        // Arrange
        const infoSpy = vi.fn();
        const successSpy = vi.fn();
        const testOutput: OutputPort = {
          info: infoSpy,
          success: successSpy,
          warn: vi.fn(),
          error: vi.fn(),
        };

        // Act
        testOutput.info('Test starting');
        testOutput.success('Test passed');

        // Assert
        expect(infoSpy).toHaveBeenCalledOnce();
        expect(successSpy).toHaveBeenCalledOnce();
        expect(infoSpy).toHaveBeenCalledWith('Test starting');
        expect(successSpy).toHaveBeenCalledWith('Test passed');
      });
    });
  });

  describe('Type Safety', () => {
    describe('Compilation checks', () => {
      it('should enforce string parameter types', () => {
        // Arrange
        const output: OutputPort = {
          info: vi.fn(),
          success: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        };

        // Act & Assert - these should compile
        output.info('string message');
        output.success('string message');
        output.warn('string message');
        output.error('string message');

        // @ts-expect-error - number is not assignable to string
        output.info(123);
        // @ts-expect-error - object is not assignable to string
        output.success({ message: 'test' });
        // @ts-expect-error - null is not assignable to string
        output.warn(null);
        // @ts-expect-error - undefined is not assignable to string
        output.error(undefined);
      });

      it('should enforce all methods are implemented', () => {
        // @ts-expect-error - missing success, warn, error methods
        const _incomplete1: OutputPort = {
          info: vi.fn(),
        };

        // @ts-expect-error - missing info method
        const _incomplete2: OutputPort = {
          success: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        };

        // Act & Assert - complete implementation should compile
        const complete: OutputPort = {
          info: vi.fn(),
          success: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        };

        expect(complete).toBeDefined();
      });

      it('should enforce void return type', () => {
        // Arrange - valid implementation with void return
        const validOutput: OutputPort = {
          info: (msg: string): void => {
            console.log(msg);
          },
          success: (msg: string): void => {
            console.log(msg);
          },
          warn: (msg: string): void => {
            console.log(msg);
          },
          error: (msg: string): void => {
            console.log(msg);
          },
        };

        // Assert
        expect(validOutput).toBeDefined();
      });
    });
  });
});
