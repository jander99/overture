/**
 * Validation Formatter Tests
 *
 * @module core/validation-formatter.spec
 */

import { ZodIssue } from 'zod';
import {
  parseZodErrors,
  formatError,
  formatErrors,
  formatValidationSummary,
  formatValidationReport,
  createValidationSummary,
  ValidationError,
} from './validation-formatter';

describe('Validation Formatter', () => {
  describe('parseZodErrors', () => {
    it('should parse required field error', () => {
      const issues: ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['mcp', 'github', 'transport'],
          message: 'Required',
        },
      ];

      const errors = parseZodErrors(issues);

      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe('mcp.github.transport');
      expect(errors[0].type).toBe('required');
      expect(errors[0].suggestion).toContain('Add missing field');
    });

    it('should parse invalid type error', () => {
      const issues: ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['mcp', 'github', 'command'],
          message: 'Expected string, received number',
        },
      ];

      const errors = parseZodErrors(issues);

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe('invalid_type');
      expect(errors[0].suggestion).toContain('Change type from number to string');
    });

    it('should parse invalid enum error', () => {
      const issues: ZodIssue[] = [
        {
          code: 'invalid_enum_value',
          options: ['stdio', 'http', 'sse'],
          received: 'websocket',
          path: ['mcp', 'github', 'transport'],
          message: 'Invalid enum value',
        },
      ];

      const errors = parseZodErrors(issues);

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe('invalid_enum');
      expect(errors[0].suggestion).toContain('stdio, http, sse');
    });

    it('should parse unrecognized keys error', () => {
      const issues: ZodIssue[] = [
        {
          code: 'unrecognized_keys',
          keys: ['scope'],
          path: ['mcp', 'github'],
          message: 'Unrecognized key(s) in object',
        },
      ];

      const errors = parseZodErrors(issues);

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe('unrecognized_keys');
      expect(errors[0].suggestion).toContain('scope');
      expect(errors[0].suggestion).toContain('deprecated');
    });

    it('should parse multiple unrecognized keys', () => {
      const issues: ZodIssue[] = [
        {
          code: 'unrecognized_keys',
          keys: ['foo', 'bar'],
          path: ['mcp', 'github'],
          message: 'Unrecognized key(s) in object',
        },
      ];

      const errors = parseZodErrors(issues);

      expect(errors).toHaveLength(1);
      expect(errors[0].suggestion).toContain('foo, bar');
    });

    it('should handle empty path', () => {
      const issues: ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'object',
          received: 'string',
          path: [],
          message: 'Expected object, received string',
        },
      ];

      const errors = parseZodErrors(issues);

      expect(errors[0].path).toBe('config');
    });

    it('should handle nested paths', () => {
      const issues: ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['mcp', 'github', 'commandOverrides', 'darwin', 'command'],
          message: 'Required',
        },
      ];

      const errors = parseZodErrors(issues);

      expect(errors[0].path).toBe('mcp.github.commandOverrides.darwin.command');
    });
  });

  describe('formatError', () => {
    it('should format error without suggestion', () => {
      const error: ValidationError = {
        path: 'mcp.github.transport',
        message: 'Required',
        type: 'required',
      };

      const formatted = formatError(error);

      expect(formatted).toContain('✗');
      expect(formatted).toContain('mcp.github.transport');
      expect(formatted).toContain('Required');
      expect(formatted).not.toContain('→');
    });

    it('should format error with suggestion', () => {
      const error: ValidationError = {
        path: 'mcp.github.transport',
        message: 'Required',
        suggestion: 'Add: transport: stdio',
        type: 'required',
      };

      const formatted = formatError(error);

      expect(formatted).toContain('✗');
      expect(formatted).toContain('mcp.github.transport');
      expect(formatted).toContain('Required');
      expect(formatted).toContain('→');
      expect(formatted).toContain('Add: transport: stdio');
    });
  });

  describe('formatErrors', () => {
    it('should format multiple errors', () => {
      const errors: ValidationError[] = [
        {
          path: 'mcp.github.transport',
          message: 'Required',
          suggestion: 'Add: transport: stdio',
          type: 'required',
        },
        {
          path: 'mcp.github.command',
          message: 'Expected string, received number',
          suggestion: 'Change type from number to string',
          type: 'invalid_type',
        },
      ];

      const formatted = formatErrors(errors);

      expect(formatted).toContain('Schema Errors (2)');
      expect(formatted).toContain('mcp.github.transport');
      expect(formatted).toContain('mcp.github.command');
      expect(formatted).toContain('Add: transport: stdio');
      expect(formatted).toContain('Change type from number to string');
    });

    it('should return empty string for no errors', () => {
      const formatted = formatErrors([]);
      expect(formatted).toBe('');
    });

    it('should support custom title', () => {
      const errors: ValidationError[] = [
        {
          path: 'mcp.github.transport',
          message: 'Required',
          type: 'required',
        },
      ];

      const formatted = formatErrors(errors, 'Custom Errors');
      expect(formatted).toContain('Custom Errors (1)');
    });
  });

  describe('createValidationSummary', () => {
    it('should create summary with errors', () => {
      const errors: ValidationError[] = [
        { path: 'test', message: 'error', type: 'other' },
      ];

      const summary = createValidationSummary(errors);

      expect(summary.totalErrors).toBe(1);
      expect(summary.totalWarnings).toBe(0);
      expect(summary.isValid).toBe(false);
      expect(summary.errors).toEqual(errors);
    });

    it('should create summary with warnings', () => {
      const warnings: ValidationError[] = [
        { path: 'test', message: 'warning', type: 'custom' },
      ];

      const summary = createValidationSummary([], warnings);

      expect(summary.totalErrors).toBe(0);
      expect(summary.totalWarnings).toBe(1);
      expect(summary.isValid).toBe(true);
      expect(summary.warnings).toEqual(warnings);
    });

    it('should create summary with passed checks', () => {
      const passed = ['Platform validation', 'Client validation'];

      const summary = createValidationSummary([], [], passed);

      expect(summary.passed).toEqual(passed);
      expect(summary.isValid).toBe(true);
    });
  });

  describe('formatValidationSummary', () => {
    it('should format valid config with no warnings', () => {
      const summary = createValidationSummary([]);

      const formatted = formatValidationSummary(summary);

      expect(formatted).toContain('✓ Configuration is valid');
      expect(formatted).toContain('No errors or warnings');
    });

    it('should format valid config with warnings', () => {
      const warnings: ValidationError[] = [
        {
          path: 'mcp.github.scope',
          message: 'Deprecated field',
          suggestion: "Remove 'scope' field",
          type: 'custom',
        },
      ];

      const summary = createValidationSummary([], warnings);
      const formatted = formatValidationSummary(summary);

      expect(formatted).toContain('✓ Configuration is valid');
      expect(formatted).toContain('Warnings (1)');
      expect(formatted).toContain('1 warning');
    });

    it('should format invalid config with errors', () => {
      const errors: ValidationError[] = [
        {
          path: 'mcp.github.transport',
          message: 'Required',
          suggestion: 'Add: transport: stdio',
          type: 'required',
        },
        {
          path: 'mcp.github.command',
          message: 'Required',
          type: 'required',
        },
      ];

      const summary = createValidationSummary(errors);
      const formatted = formatValidationSummary(summary);

      expect(formatted).toContain('✗ Configuration validation failed');
      expect(formatted).toContain('Schema Errors (2)');
      expect(formatted).toContain('2 errors');
    });

    it('should format invalid config with errors and warnings', () => {
      const errors: ValidationError[] = [
        { path: 'mcp.github.transport', message: 'Required', type: 'required' },
      ];
      const warnings: ValidationError[] = [
        { path: 'mcp.github.scope', message: 'Deprecated', type: 'custom' },
      ];

      const summary = createValidationSummary(errors, warnings);
      const formatted = formatValidationSummary(summary);

      expect(formatted).toContain('✗ Configuration validation failed');
      expect(formatted).toContain('1 error');
      expect(formatted).toContain('1 warning');
    });
  });

  describe('formatValidationReport', () => {
    it('should format report with all sections passing', () => {
      const report = {
        sections: [
          {
            title: 'Schema Validation',
            passed: true,
            errors: [],
            warnings: [],
          },
          {
            title: 'Platform Validation',
            passed: true,
            errors: [],
            warnings: [],
          },
        ],
      };

      const formatted = formatValidationReport(report);

      expect(formatted).toContain('Configuration Validation Results');
      expect(formatted).toContain('✓ Schema Validation');
      expect(formatted).toContain('✓ Platform Validation');
      expect(formatted).toContain('All validations passed');
    });

    it('should format report with errors', () => {
      const report = {
        sections: [
          {
            title: 'Schema Validation',
            passed: false,
            errors: [
              {
                path: 'mcp.github.transport',
                message: 'Required',
                suggestion: 'Add: transport: stdio',
                type: 'required' as const,
              },
            ],
            warnings: [],
          },
        ],
      };

      const formatted = formatValidationReport(report);

      expect(formatted).toContain('✗ Schema Validation (1 error)');
      expect(formatted).toContain('mcp.github.transport');
      expect(formatted).toContain('✗ 1 error');
    });

    it('should format report with warnings', () => {
      const report = {
        sections: [
          {
            title: 'Schema Validation',
            passed: true,
            errors: [],
            warnings: [
              {
                path: 'mcp.github.scope',
                message: 'Deprecated field',
                type: 'custom' as const,
              },
            ],
          },
        ],
      };

      const formatted = formatValidationReport(report);

      expect(formatted).toContain('⚠ Schema Validation (1 warning)');
      expect(formatted).toContain('mcp.github.scope');
      expect(formatted).toContain('⚠ 1 warning');
    });

    it('should format report with mixed results', () => {
      const report = {
        sections: [
          {
            title: 'Schema Validation',
            passed: false,
            errors: [
              {
                path: 'mcp.github.transport',
                message: 'Required',
                type: 'required' as const,
              },
            ],
            warnings: [],
          },
          {
            title: 'Platform Validation',
            passed: true,
            errors: [],
            warnings: [
              {
                path: 'platforms.exclude',
                message: 'Deprecated pattern',
                type: 'custom' as const,
              },
            ],
          },
          {
            title: 'Client Validation',
            passed: true,
            errors: [],
            warnings: [],
          },
        ],
      };

      const formatted = formatValidationReport(report);

      expect(formatted).toContain('✗ Schema Validation (1 error)');
      expect(formatted).toContain('⚠ Platform Validation (1 warning)');
      expect(formatted).toContain('✓ Client Validation');
      expect(formatted).toContain('✗ 1 error');
      expect(formatted).toContain('⚠ 1 warning');
    });
  });
});
