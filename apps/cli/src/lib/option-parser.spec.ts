import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  parseOptions,
  parseSyncOptions,
  SyncOptionsSchema,
  ValidateOptionsSchema,
  McpListOptionsSchema,
  McpEnableOptionsSchema,
  AuditOptionsSchema,
} from './option-parser.js';

describe('parseOptions', () => {
  describe('basic functionality', () => {
    it('should parse valid options matching schema', () => {
      const schema = z.object({
        name: z.string(),
        count: z.number(),
      });

      const result = parseOptions(schema, {
        name: 'test',
        count: 42,
      });

      expect(result).toEqual({ name: 'test', count: 42 });
    });

    it('should apply default values for missing options', () => {
      const schema = z.object({
        enabled: z.boolean().default(false),
        name: z.string().default('default-name'),
      });

      const result = parseOptions(schema, {});

      expect(result).toEqual({ enabled: false, name: 'default-name' });
    });

    it('should override defaults with provided values', () => {
      const schema = z.object({
        enabled: z.boolean().default(false),
      });

      const result = parseOptions(schema, { enabled: true });

      expect(result).toEqual({ enabled: true });
    });
  });

  describe('boolean coercion', () => {
    it('should coerce string "true" to boolean true', () => {
      const schema = z.object({
        flag: z.boolean().default(false),
      });

      const result = parseOptions(schema, { flag: 'true' });

      expect(result.flag).toBe(true);
    });

    it('should coerce string "false" to boolean false', () => {
      const schema = z.object({
        flag: z.boolean().default(false),
      });

      const result = parseOptions(schema, { flag: 'false' });

      expect(result.flag).toBe(false);
    });

    it('should handle boolean true directly', () => {
      const schema = z.object({
        flag: z.boolean().default(false),
      });

      const result = parseOptions(schema, { flag: true });

      expect(result.flag).toBe(true);
    });

    it('should handle boolean false directly', () => {
      const schema = z.object({
        flag: z.boolean().default(false),
      });

      const result = parseOptions(schema, { flag: false });

      expect(result.flag).toBe(false);
    });
  });

  describe('string array handling', () => {
    it('should handle string array directly', () => {
      const schema = z.object({
        items: z.array(z.string()).default([]),
      });

      const result = parseOptions(schema, { items: ['a', 'b', 'c'] });

      expect(result.items).toEqual(['a', 'b', 'c']);
    });

    it('should apply empty array default when missing', () => {
      const schema = z.object({
        items: z.array(z.string()).default([]),
      });

      const result = parseOptions(schema, {});

      expect(result.items).toEqual([]);
    });

    it('should reject single string as array (not coerced)', () => {
      const schema = z.object({
        items: z.array(z.string()).default([]),
      });

      expect(() => {
        parseOptions(schema, { items: 'single' });
      }).toThrow();
    });
  });

  describe('enum validation', () => {
    it('should validate enum values', () => {
      const schema = z.object({
        client: z.enum(['claude-code', 'copilot-cli', 'opencode']),
      });

      const result = parseOptions(schema, { client: 'claude-code' });

      expect(result.client).toBe('claude-code');
    });

    it('should throw user-friendly error for invalid enum', () => {
      const schema = z.object({
        client: z.enum(['claude-code', 'copilot-cli', 'opencode']),
      });

      expect(() => {
        parseOptions(schema, { client: 'invalid-client' });
      }).toThrow();
    });
  });

  describe('error handling', () => {
    it('should throw error with user-friendly message for invalid type', () => {
      const schema = z.object({
        count: z.number(),
      });

      expect(() => {
        parseOptions(schema, { count: 'not-a-number' });
      }).toThrow();
    });

    it('should include field name in error message', () => {
      const schema = z.object({
        count: z.number(),
      });

      try {
        parseOptions(schema, { count: 'invalid' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(String(error)).toContain('count');
      }
    });

    it('should handle multiple validation errors', () => {
      const schema = z.object({
        count: z.number(),
        enabled: z.boolean(),
      });

      expect(() => {
        parseOptions(schema, { count: 'invalid', enabled: 'invalid' });
      }).toThrow();
    });
  });

  describe('SyncOptionsSchema', () => {
    it('should parse valid sync options', () => {
      const result = parseOptions(SyncOptionsSchema, {
        dryRun: true,
        force: false,
        skipPlugins: false,
        skipSkills: false,
        skipAgents: false,
        skipUndetected: true,
        detail: false,
      });

      expect(result).toEqual({
        dryRun: true,
        force: false,
        skipPlugins: false,
        skipSkills: false,
        skipAgents: false,
        skipUndetected: true,
        detail: false,
      });
    });

    it('should apply defaults for missing sync options', () => {
      const result = parseOptions(SyncOptionsSchema, {});

      expect(result.dryRun).toBe(false);
      expect(result.force).toBe(false);
      expect(result.skipPlugins).toBe(false);
      expect(result.skipSkills).toBe(false);
      expect(result.skipAgents).toBe(false);
      expect(result.skipUndetected).toBe(true);
      expect(result.detail).toBe(false);
    });

    it('should handle client option', () => {
      const result = parseOptions(SyncOptionsSchema, {
        client: 'claude-code',
      });

      expect(result.client).toBe('claude-code');
    });

    it('should handle missing client option', () => {
      const result = parseOptions(SyncOptionsSchema, {});

      expect(result.clients).toBeUndefined();
    });

    it('should coerce string booleans in sync options', () => {
      const result = parseOptions(SyncOptionsSchema, {
        dryRun: 'true',
        force: 'false',
      });

      expect(result.dryRun).toBe(true);
      expect(result.force).toBe(false);
    });
  });

  describe('ValidateOptionsSchema', () => {
    it('should parse valid validate options', () => {
      const result = parseOptions(ValidateOptionsSchema, {
        client: 'claude-code',
        detail: true,
      });

      expect(result.client).toBe('claude-code');
      expect(result.detail).toBe(true);
    });

    it('should apply defaults for missing validate options', () => {
      const result = parseOptions(ValidateOptionsSchema, {});

      expect(result.detail).toBe(false);
      expect(result.client).toBeUndefined();
    });

    it('should validate client enum in validate options', () => {
      expect(() => {
        parseOptions(ValidateOptionsSchema, { client: 'invalid' });
      }).toThrow();
    });
  });

  describe('McpListOptionsSchema', () => {
    it('should parse valid mcp list options', () => {
      const result = parseOptions(McpListOptionsSchema, {
        detail: true,
      });

      expect(result.detail).toBe(true);
    });

    it('should apply defaults for missing mcp list options', () => {
      const result = parseOptions(McpListOptionsSchema, {});

      expect(result.detail).toBe(false);
    });
  });

  describe('McpEnableOptionsSchema', () => {
    it('should parse valid mcp enable options', () => {
      const result = parseOptions(McpEnableOptionsSchema, {
        name: 'test-mcp',
        client: 'claude-code',
      });

      expect(result.name).toBe('test-mcp');
      expect(result.client).toBe('claude-code');
    });

    it('should require name field', () => {
      expect(() => {
        parseOptions(McpEnableOptionsSchema, {
          client: 'claude-code',
        });
      }).toThrow();
    });

    it('should validate client enum in mcp enable options', () => {
      expect(() => {
        parseOptions(McpEnableOptionsSchema, {
          name: 'test',
          client: 'invalid',
        });
      }).toThrow();
    });
  });

  describe('AuditOptionsSchema', () => {
    it('should parse valid audit options', () => {
      const result = parseOptions(AuditOptionsSchema, {
        detail: true,
      });

      expect(result.detail).toBe(true);
    });

    it('should apply defaults for missing audit options', () => {
      const result = parseOptions(AuditOptionsSchema, {});

      expect(result.detail).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined values', () => {
      const schema = z.object({
        optional: z.string().optional(),
      });

      const result = parseOptions(schema, { optional: undefined });

      expect(result.optional).toBeUndefined();
    });

    it('should handle null values', () => {
      const schema = z.object({
        optional: z.string().nullable(),
      });

      const result = parseOptions(schema, { optional: null });

      expect(result.optional).toBeNull();
    });

    it('should ignore extra properties not in schema', () => {
      const schema = z.object({
        name: z.string(),
      });

      const result = parseOptions(schema, {
        name: 'test',
        extra: 'ignored',
      });

      expect(result).toEqual({ name: 'test' });
      expect('extra' in result).toBe(false);
    });

    it('should handle empty object', () => {
      const schema = z.object({
        flag: z.boolean().default(false),
      });

      const result = parseOptions(schema, {});

      expect(result).toEqual({ flag: false });
    });

    it('should reject null for required boolean', () => {
      const schema = z.object({
        flag: z.boolean(),
      });

      expect(() => {
        parseOptions(schema, { flag: null });
      }).toThrow();
    });

    it('should reject undefined for required boolean', () => {
      const schema = z.object({
        flag: z.boolean(),
      });

      expect(() => {
        parseOptions(schema, { flag: undefined });
      }).toThrow();
    });

    it('should handle whitespace in string values', () => {
      const schema = z.object({
        path: z.string(),
      });

      const result = parseOptions(schema, { path: '  /path/with/spaces  ' });

      expect(result.path).toBe('  /path/with/spaces  ');
    });

    it('should handle special characters in string values', () => {
      const schema = z.object({
        path: z.string(),
      });

      const result = parseOptions(schema, {
        path: '/path/with/special-chars_123.json',
      });

      expect(result.path).toBe('/path/with/special-chars_123.json');
    });

    it('should handle Unicode characters in string values', () => {
      const schema = z.object({
        path: z.string(),
      });

      const result = parseOptions(schema, { path: '/path/with/émojis/🚀' });

      expect(result.path).toBe('/path/with/émojis/🚀');
    });

    it('should handle large arrays', () => {
      const schema = z.object({
        items: z.array(z.string()).default([]),
      });

      const largeArray = Array.from({ length: 100 }, (_, i) => `item-${i}`);
      const result = parseOptions(schema, { items: largeArray });

      expect(result.items).toHaveLength(100);
      expect(result.items[0]).toBe('item-0');
      expect(result.items[99]).toBe('item-99');
    });

    it('should preserve false value (not treat as falsy)', () => {
      const schema = z.object({
        flag: z.boolean().default(true),
      });

      const result = parseOptions(schema, { flag: false });

      expect(result.flag).toBe(false);
    });

    it('should handle empty string value', () => {
      const schema = z.object({
        text: z.string(),
      });

      const result = parseOptions(schema, { text: '' });

      expect(result.text).toBe('');
    });

    it('should handle zero as number value', () => {
      const schema = z.object({
        count: z.number(),
      });

      const result = parseOptions(schema, { count: 0 });

      expect(result.count).toBe(0);
    });

    it('should reject invalid string for number field', () => {
      const schema = z.object({
        count: z.number(),
      });

      expect(() => {
        parseOptions(schema, { count: 'not-a-number' });
      }).toThrow();
    });

    it('should handle negative numbers', () => {
      const schema = z.object({
        count: z.number(),
      });

      const result = parseOptions(schema, { count: -42 });

      expect(result.count).toBe(-42);
    });
  });

  describe('type coercion edge cases', () => {
    it('should not coerce "TRUE" (uppercase) to boolean', () => {
      const schema = z.object({
        flag: z.boolean().default(false),
      });

      expect(() => {
        parseOptions(schema, { flag: 'TRUE' });
      }).toThrow();
    });

    it('should not coerce "FALSE" (uppercase) to boolean', () => {
      const schema = z.object({
        flag: z.boolean().default(false),
      });

      expect(() => {
        parseOptions(schema, { flag: 'FALSE' });
      }).toThrow();
    });

    it('should not coerce "1" to boolean', () => {
      const schema = z.object({
        flag: z.boolean().default(false),
      });

      expect(() => {
        parseOptions(schema, { flag: '1' });
      }).toThrow();
    });

    it('should not coerce "0" to boolean', () => {
      const schema = z.object({
        flag: z.boolean().default(false),
      });

      expect(() => {
        parseOptions(schema, { flag: '0' });
      }).toThrow();
    });

    it('should reject single string for array field', () => {
      const schema = z.object({
        items: z.array(z.string()).default([]),
      });

      expect(() => {
        parseOptions(schema, { items: 'single' });
      }).toThrow();
    });
  });

  describe('default value behavior', () => {
    it('should use .default(false) for boolean false (not ??)', () => {
      const schema = z.object({
        flag: z.boolean().default(false),
      });

      const result = parseOptions(schema, {});

      expect(result.flag).toBe(false);
      expect(result.flag).not.toBeUndefined();
    });

    it('should use .default(true) for custom defaults', () => {
      const schema = z.object({
        skipUndetected: z.boolean().default(true),
      });

      const result = parseOptions(schema, {});

      expect(result.skipUndetected).toBe(true);
    });

    it('should use .default([]) for empty array', () => {
      const schema = z.object({
        items: z.array(z.string()).default([]),
      });

      const result = parseOptions(schema, {});

      expect(result.items).toEqual([]);
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('should override all defaults when values provided', () => {
      const schema = z.object({
        flag1: z.boolean().default(false),
        flag2: z.boolean().default(true),
      });

      const result = parseOptions(schema, {
        flag1: true,
        flag2: false,
      });

      expect(result.flag1).toBe(true);
      expect(result.flag2).toBe(false);
    });

    it('should handle partial option overrides', () => {
      const schema = z.object({
        flag1: z.boolean().default(false),
        flag2: z.boolean().default(true),
        flag3: z.boolean().default(false),
      });

      const result = parseOptions(schema, {
        flag1: true,
      });

      expect(result.flag1).toBe(true);
      expect(result.flag2).toBe(true);
      expect(result.flag3).toBe(false);
    });
  });

  describe('parseSyncOptions helper', () => {
    it('should convert single client to clients array', () => {
      const result = parseSyncOptions({
        client: 'claude-code',
      });

      expect(result.clients).toEqual(['claude-code']);
    });

    it('should return undefined clients when no client provided', () => {
      const result = parseSyncOptions({});

      expect(result.clients).toBeUndefined();
    });

    it('should include all sync options in result', () => {
      const result = parseSyncOptions({
        dryRun: true,
        force: false,
        client: 'copilot-cli',
      });

      expect(result.dryRun).toBe(true);
      expect(result.force).toBe(false);
      expect(result.clients).toEqual(['copilot-cli']);
    });

    it('should apply defaults for missing sync options', () => {
      const result = parseSyncOptions({});

      expect(result.dryRun).toBe(false);
      expect(result.force).toBe(false);
      expect(result.skipPlugins).toBe(false);
      expect(result.skipSkills).toBe(false);
      expect(result.skipAgents).toBe(false);
      expect(result.skipUndetected).toBe(true);
      expect(result.detail).toBe(false);
      expect(result.clients).toBeUndefined();
    });
  });

  describe('error message formatting', () => {
    it('should format error with field name and message', () => {
      const schema = z.object({
        count: z.number(),
      });

      try {
        parseOptions(schema, { count: 'invalid' });
        expect.fail('Should have thrown');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('Invalid options');
        expect(message).toContain('count');
      }
    });

    it('should not expose raw Zod error format', () => {
      const schema = z.object({
        flag: z.boolean(),
      });

      try {
        parseOptions(schema, { flag: 'invalid' });
        expect.fail('Should have thrown');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).not.toContain('ZodError');
        expect(message).toContain('Invalid options');
      }
    });

    it('should include multiple error messages for multiple failures', () => {
      const schema = z.object({
        count: z.number(),
        flag: z.boolean(),
      });

      try {
        parseOptions(schema, { count: 'invalid', flag: 'invalid' });
        expect.fail('Should have thrown');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('count');
        expect(message).toContain('flag');
      }
    });

    it('should use bullet points for readability', () => {
      const schema = z.object({
        count: z.number(),
      });

      try {
        parseOptions(schema, { count: 'invalid' });
        expect.fail('Should have thrown');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('•');
      }
    });
  });
});
