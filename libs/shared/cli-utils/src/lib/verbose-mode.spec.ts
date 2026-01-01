/**
 * Tests for verbose mode utility
 */

import { describe, it, expect, afterEach } from 'vitest';
import { isVerboseMode } from './verbose-mode.js';

describe('verbose-mode', () => {
  const originalDebug = process.env.DEBUG;

  afterEach(() => {
    // Restore original value
    if (originalDebug !== undefined) {
      process.env.DEBUG = originalDebug;
    } else {
      delete process.env.DEBUG;
    }
  });

  describe('isVerboseMode', () => {
    it('should return true when DEBUG is "1"', () => {
      process.env.DEBUG = '1';
      expect(isVerboseMode()).toBe(true);
    });

    it('should return true when DEBUG is "true"', () => {
      process.env.DEBUG = 'true';
      expect(isVerboseMode()).toBe(true);
    });

    it('should return false when DEBUG is undefined', () => {
      delete process.env.DEBUG;
      expect(isVerboseMode()).toBe(false);
    });

    it('should return false when DEBUG is "0"', () => {
      process.env.DEBUG = '0';
      expect(isVerboseMode()).toBe(false);
    });

    it('should return false when DEBUG is "false"', () => {
      process.env.DEBUG = 'false';
      expect(isVerboseMode()).toBe(false);
    });

    it('should return false when DEBUG is any other string', () => {
      process.env.DEBUG = 'yes';
      expect(isVerboseMode()).toBe(false);
    });

    it('should return false when DEBUG is empty string', () => {
      process.env.DEBUG = '';
      expect(isVerboseMode()).toBe(false);
    });
  });
});
