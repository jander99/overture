/**
 * Zod-based Option Parser Utility
 *
 * Eliminates type assertions from Commander.js options by providing
 * a generic, type-safe option parsing function with user-friendly error messages.
 *
 * @module lib/option-parser
 */

import { z } from 'zod';
import type { ClientName } from '@overture/config-types';

/**
 * Parse and validate Commander.js options using a Zod schema
 *
 * Converts Record<string, unknown> options to type-safe objects with:
 * - Automatic type coercion (string "true" → boolean true)
 * - Default value application
 * - User-friendly validation error messages
 *
 * @template T - The type of the parsed options
 * @param schema - Zod schema defining the option structure and validation
 * @param options - Raw options from Commander.js (Record<string, unknown>)
 * @returns Parsed and validated options of type T
 * @throws Error with user-friendly message if validation fails
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   dryRun: z.boolean().default(false),
 *   client: z.enum(['claude-code', 'copilot-cli']).optional(),
 * });
 *
 * const parsed = parseOptions(schema, {
 *   dryRun: 'true',  // String coerced to boolean
 *   client: 'claude-code',
 * });
 * // parsed.dryRun === true
 * // parsed.client === 'claude-code'
 * ```
 */
export function parseOptions<T>(
  schema: z.ZodSchema<T>,
  options: Record<string, unknown>,
): T {
  try {
    // Coerce string booleans to actual booleans
    const coercedOptions = coerceOptions(options);

    // Parse and validate using Zod schema
    return schema.parse(coercedOptions);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(formatZodError(error));
    }
    throw error;
  }
}

/**
 * Coerce string representations of booleans to actual boolean values
 *
 * Handles:
 * - "true" → true
 * - "false" → false
 * - true/false → unchanged
 * - Other values → unchanged
 *
 * @param options - Raw options from Commander.js
 * @returns Options with string booleans coerced to actual booleans
 */
function coerceOptions(
  options: Record<string, unknown>,
): Record<string, unknown> {
  const coerced: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(options)) {
    if (typeof value === 'string') {
      if (value === 'true') {
        coerced[key] = true;
      } else if (value === 'false') {
        coerced[key] = false;
      } else {
        coerced[key] = value;
      }
    } else {
      coerced[key] = value;
    }
  }

  return coerced;
}

/**
 * Format Zod validation errors into user-friendly messages
 *
 * Extracts field names and error descriptions to create
 * clear, actionable error messages.
 *
 * @param error - Zod validation error
 * @returns Formatted error message
 */
function formatZodError(error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.join('.');
    const message = issue.message;
    return `  • ${path}: ${message}`;
  });

  return `Invalid options:\n${issues.join('\n')}`;
}

/**
 * Schema for sync command options
 *
 * Defines validation for all sync command options with defaults
 * matching current behavior (|| false patterns).
 */
export const SyncOptionsSchema = z.object({
  dryRun: z.boolean().default(false),
  force: z.boolean().default(false),
  skipPlugins: z.boolean().default(false),
  skipSkills: z.boolean().default(false),
  skipAgents: z.boolean().default(false),
  skipUndetected: z.boolean().default(true),
  detail: z.boolean().default(false),
  client: z.string().optional(),
});

/**
 * Parsed sync options type
 */
export type SyncOptions = z.infer<typeof SyncOptionsSchema> & {
  clients?: ClientName[];
};

/**
 * Transform sync options to include clients array
 *
 * Converts single client option to clients array for compatibility
 * with sync engine expectations.
 *
 * @param options - Raw sync options
 * @returns Parsed sync options with clients array
 */
export function parseSyncOptions(
  options: Record<string, unknown>,
): SyncOptions {
  const parsed = parseOptions(SyncOptionsSchema, options);
  const { client, ...rest } = parsed;
  return {
    ...rest,
    clients: client ? [client] : undefined,
  };
}

/**
 * Schema for validate command options
 */
export const ValidateOptionsSchema = z.object({
  client: z.string().optional(),
  detail: z.boolean().default(false),
  verbose: z.boolean().optional(),
});

/**
 * Parsed validate options type
 */
export type ValidateOptions = z.infer<typeof ValidateOptionsSchema>;

/**
 * Parse and validate validate command options
 *
 * @param options - Raw options from Commander.js
 * @returns Parsed validate options with type safety
 */
export function parseValidateOptions(
  options: Record<string, unknown>,
): ValidateOptions {
  return parseOptions(ValidateOptionsSchema, options);
}

/**
 * Schema for mcp list command options
 */
export const McpListOptionsSchema = z.object({
  scope: z.string().optional(),
  client: z.string().optional(),
});

/**
 * Parsed mcp list options type
 */
export type McpListOptions = z.infer<typeof McpListOptionsSchema>;

/**
 * Parse and validate mcp list command options
 *
 * @param options - Raw options from Commander.js
 * @returns Parsed mcp list options with type safety
 */
export function parseMcpListOptions(
  options: Record<string, unknown>,
): McpListOptions {
  return parseOptions(McpListOptionsSchema, options);
}

/**
 * Schema for mcp enable command options
 */
export const McpEnableOptionsSchema = z.object({
  name: z.string().min(1, 'MCP name is required'),
});

/**
 * Parsed mcp enable options type
 */
export type McpEnableOptions = z.infer<typeof McpEnableOptionsSchema>;

/**
 * Parse and validate mcp enable command options
 *
 * @param options - Raw options from Commander.js
 * @returns Parsed mcp enable options with type safety
 */
export function parseMcpEnableOptions(
  options: Record<string, unknown>,
): McpEnableOptions {
  return parseOptions(McpEnableOptionsSchema, options);
}

/**
 * Schema for audit command options
 */
export const AuditOptionsSchema = z.object({
  client: z.string().optional(),
});

/**
 * Parsed audit options type
 */
export type AuditOptions = z.infer<typeof AuditOptionsSchema>;

/**
 * Parse and validate audit command options
 *
 * @param options - Raw options from Commander.js
 * @returns Parsed audit options with type safety
 */
export function parseAuditOptions(
  options: Record<string, unknown>,
): AuditOptions {
  return parseOptions(AuditOptionsSchema, options);
}
