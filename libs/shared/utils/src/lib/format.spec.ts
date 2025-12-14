/**
 * Format Utilities Tests
 *
 * @module @overture/utils/format.spec
 */

import { describe, it, expect } from 'vitest';
import {
  formatList,
  formatKeyValue,
  formatTable,
  formatSection,
  formatHeading,
  formatDivider,
  indent,
} from './format.js';
import chalk from 'chalk';

describe('Format Utilities', () => {
  describe('formatList', () => {
    it('should format items with default bullet', () => {
      const result = formatList(['item1', 'item2', 'item3']);
      expect(result).toContain('\u2022 item1');
      expect(result).toContain('\u2022 item2');
      expect(result).toContain('\u2022 item3');
    });

    it('should format items with custom bullet', () => {
      const result = formatList(['item1', 'item2'], '-');
      expect(result).toContain('- item1');
      expect(result).toContain('- item2');
    });

    it('should return empty string for empty array', () => {
      const result = formatList([]);
      expect(result).toBe('');
    });

    it('should indent items with 2 spaces', () => {
      const result = formatList(['item']);
      expect(result.startsWith('  ')).toBe(true);
    });
  });

  describe('formatKeyValue', () => {
    it('should format key-value pair with default width', () => {
      const result = formatKeyValue('Name', 'test-project');
      expect(result).toContain('Name');
      expect(result).toContain('test-project');
    });

    it('should pad key to specified width', () => {
      const result = formatKeyValue('Key', 'value', 10);
      // Key should be padded to 10 characters
      expect(result).toContain('Key       ');
    });

    it('should include colon separator', () => {
      const result = formatKeyValue('Key', 'value');
      expect(result).toContain(':');
    });
  });

  describe('formatTable', () => {
    it('should format multiple key-value pairs', () => {
      const result = formatTable({
        Name: 'my-project',
        Type: 'app',
        Version: '1.0.0',
      });

      expect(result).toContain('Name');
      expect(result).toContain('my-project');
      expect(result).toContain('Type');
      expect(result).toContain('app');
      expect(result).toContain('Version');
      expect(result).toContain('1.0.0');
    });

    it('should separate rows with newlines', () => {
      const result = formatTable({
        Key1: 'value1',
        Key2: 'value2',
      });

      const lines = result.split('\n');
      expect(lines.length).toBe(2);
    });

    it('should return empty string for empty object', () => {
      const result = formatTable({});
      expect(result).toBe('');
    });

    it('should use custom key width', () => {
      const result = formatTable({ Key: 'value' }, 30);
      // Key should be padded to 30 characters
      expect(result.indexOf('Key') < result.indexOf('value')).toBe(true);
    });
  });

  describe('formatSection', () => {
    it('should include bold header', () => {
      const result = formatSection('Section Title', 'content');
      expect(result).toContain('Section Title');
      expect(result).toContain('content');
    });

    it('should separate header and content with newline', () => {
      const result = formatSection('Header', 'Content');
      expect(result).toContain('\n');
    });
  });

  describe('formatHeading', () => {
    it('should format heading with default bold', () => {
      const result = formatHeading('Title');
      expect(result).toContain('Title');
    });

    it('should use custom color function', () => {
      const result = formatHeading('Title', chalk.cyan);
      expect(result).toContain('Title');
      // Chalk will add color codes
    });
  });

  describe('formatDivider', () => {
    it('should create divider with default character and width', () => {
      const result = formatDivider();
      // Default is 50 \u2500 characters
      expect(result.length).toBeGreaterThan(0);
    });

    it('should use custom character', () => {
      const result = formatDivider('=', 10);
      // Contains 10 = characters (with possible ANSI codes)
      expect(result).toContain('=');
    });

    it('should use custom width', () => {
      const result = formatDivider('-', 20);
      // Contains 20 - characters (with possible ANSI codes)
      expect(result).toContain('-');
    });
  });

  describe('indent', () => {
    it('should indent single line with default spaces', () => {
      const result = indent('line');
      expect(result).toBe('  line');
    });

    it('should indent multiple lines', () => {
      const result = indent('line1\nline2\nline3');
      const lines = result.split('\n');
      expect(lines[0]).toBe('  line1');
      expect(lines[1]).toBe('  line2');
      expect(lines[2]).toBe('  line3');
    });

    it('should use custom space count', () => {
      const result = indent('line', 4);
      expect(result).toBe('    line');
    });

    it('should handle empty string', () => {
      const result = indent('');
      expect(result).toBe('  ');
    });

    it('should preserve empty lines with indentation', () => {
      const result = indent('line1\n\nline3');
      const lines = result.split('\n');
      expect(lines[0]).toBe('  line1');
      expect(lines[1]).toBe('  ');
      expect(lines[2]).toBe('  line3');
    });
  });
});
