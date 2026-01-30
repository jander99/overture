# Task 1: Zod Option Parser - Learnings

## Implementation Summary

Created `apps/cli/src/lib/option-parser.ts` with:
- Generic `parseOptions<T>(schema: ZodSchema<T>, options: Record<string, unknown>): T` function
- Automatic string boolean coercion ("true" → true, "false" → false)
- User-friendly Zod validation error formatting
- 5 exported schemas for command options (Sync, Validate, McpList, McpEnable, Audit)
- Helper function `parseSyncOptions()` to transform client option to clients array

## Key Patterns Established

### 1. Boolean Coercion
- Only coerces exact strings "true" and "false" (case-sensitive)
- Does NOT coerce "TRUE", "1", "0", etc. (strict matching)
- Preserves actual boolean values unchanged
- Matches current `|| false` behavior exactly

### 2. Schema Design
- All boolean options use `.default(false)` or `.default(true)` (not `??`)
- Array options use `.default([])` for empty defaults
- Enum options use `z.enum(['claude-code', 'copilot-cli', 'opencode'])`
- Optional fields use `.optional()` (not `.default(undefined)`)

### 3. Error Handling
- Zod errors caught and reformatted with user-friendly messages
- Error format: "Invalid options:\n  • fieldName: error message"
- Includes all validation failures in single error (not fail-fast)
- Field names extracted from Zod error path

### 4. Type Safety
- Generic type parameter `T` inferred from schema
- No `as any` or type assertions needed
- `parseSyncOptions()` helper handles client → clients transformation
- Exported type aliases for each schema (SyncOptions, ValidateOptions, etc.)

## Test Coverage

Created 63 comprehensive tests covering:
- Basic parsing and defaults
- Boolean coercion (true/false strings)
- String array handling
- Enum validation
- Error messages and formatting
- All 5 command schemas
- Edge cases (undefined, null, empty strings, zero, large arrays)
- Type coercion edge cases (uppercase, numeric strings)
- Default value behavior
- Helper function `parseSyncOptions()`

**Result:** 63/63 tests passing, 0 lint errors

## Patterns for Next Tasks (Commands Migration)

When migrating sync.ts, validate.ts, mcp.ts, audit.ts:

1. **Replace assertions:**
   ```typescript
   // OLD
   dryRun: (options.dryRun as boolean) || false
   
   // NEW
   const parsed = parseSyncOptions(options);
   dryRun: parsed.dryRun
   ```

2. **Use helper for client transformation:**
   ```typescript
   // OLD
   clients: (options.client as string) ? [options.client as string as ClientName] : undefined
   
   // NEW
   const parsed = parseSyncOptions(options);
   clients: parsed.clients
   ```

3. **Define schema in command file:**
   ```typescript
   const schema = SyncOptionsSchema; // or ValidateOptionsSchema, etc.
   const parsed = parseOptions(schema, options);
   ```

## Zod Patterns Learned

- `.default()` applies when field is missing (not when undefined/null)
- `.optional()` allows undefined but not null
- `.nullable()` allows null but not undefined
- `.default()` and `.optional()` are mutually exclusive
- Enum validation with helpful error messages
- Error formatting with `z.ZodError.issues` array

## Files Created

- `apps/cli/src/lib/option-parser.ts` (200 LOC)
- `apps/cli/src/lib/option-parser.spec.ts` (710 LOC)

## Next Steps

Ready for Wave 2 tasks:
- Task 3: Migrate sync.ts
- Task 4: Migrate validate.ts
- Task 5: Migrate mcp.ts
- Task 6: Migrate audit.ts

All can run in parallel using this utility.
