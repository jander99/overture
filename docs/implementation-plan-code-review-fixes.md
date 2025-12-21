# Implementation Plan: Code Review Fixes

**Created:** 2025-12-21
**Status:** Ready for Implementation
**Estimated Total Effort:** 24-30 hours (parallelizable to ~8-10 hours with multiple agents)

---

## Executive Summary

This document provides a detailed implementation plan for fixing issues identified in the code review of the Overture MCP configuration orchestrator. The plan is organized into 8 workstreams that can be executed in parallel by multiple agents.

### Issue Summary

| Category                    | Count         | Priority |
| --------------------------- | ------------- | -------- |
| Critical Bugs               | 3             | P0       |
| Lint Errors                 | 33            | P1       |
| Lint Warnings               | 86            | P1       |
| Documentation Discrepancies | 4             | P1       |
| Error Handling Issues       | 12 files      | P2       |
| Output Port Violations      | 55+ instances | P2       |
| Code Duplication            | 4 patterns    | P3       |
| Missing Tests               | 9 files       | P3       |
| E2E Test Issues             | 10 skipped    | P4       |

---

## Pre-Implementation Checklist

Before starting any workstream, agents should:

1. **Read this entire document** to understand dependencies
2. **Check git status** - ensure clean working directory
3. **Create feature branch**: `git checkout -b fix/code-review-fixes`
4. **Run baseline tests**: `nx run-many -t test --all` to establish baseline
5. **Run baseline lint**: `nx run-many -t lint --all` to confirm 119 issues exist

---

## Workstream Dependencies

```
WS1 (Critical) ──┬──> WS2 (Lint)
                 │
                 ├──> WS3 (Docs) ─────────────────────────┐
                 │                                         │
                 └──> WS4 (Error Handling) ──> WS5 (Output Port) ──> WS6 (Dedup)
                                                           │
                                                           └──> WS7 (Tests)
                                                                  │
                                                                  └──> WS8 (E2E)
```

**Parallel Execution Strategy:**

- WS1 must complete first (critical bugs)
- WS2, WS3, WS4 can run in parallel after WS1
- WS5 depends on WS4 completion
- WS6 can run after WS5
- WS7 can start after WS5 (tests need Output Port patterns)
- WS8 runs last (depends on all other fixes)

---

## Workstream 1: Critical Fixes (P0)

**Priority:** Immediate
**Estimated Time:** 2 hours
**Dependencies:** None
**Can Parallelize:** No (must complete first)

### Task 1.1: Fix Broken Import in `process-lock.ts`

**File:** `apps/cli/src/core/process-lock.ts`

**Problem:** Line 18 imports from `./path-resolver` which doesn't exist. The actual function is in `libs/core/config/src/lib/path-resolver.ts`.

**Solution (Option A - Function Parameter):**

1. Remove the broken import at line 18
2. Modify function signatures to accept `getLockFilePath` as a parameter:

```typescript
// BEFORE
import { getLockFilePath } from './path-resolver';

export async function acquireLock(options: LockOptions = {}): Promise<boolean> {
  const lockPath = getLockFilePath();
  // ...
}

// AFTER
export async function acquireLock(
  getLockFilePath: () => string,
  options: LockOptions = {},
): Promise<boolean> {
  const lockPath = getLockFilePath();
  // ...
}
```

3. Update all exported functions:
   - `acquireLock(getLockFilePath, options)` - line 73
   - `releaseLock(getLockFilePath)` - line 166
   - `isLocked(getLockFilePath, staleTimeout)` - line 202
   - `getLockInfo(getLockFilePath)` - line 226
   - `forceReleaseLock(getLockFilePath)` - line 246

4. Update call sites in CLI commands (search for usages)

5. Update `apps/cli/src/core/process-lock.spec.ts`:
   - Remove the mock at lines 22-24
   - Pass mock function directly to each function call

**Verification:**

```bash
nx test @overture/cli --testPathPattern=process-lock
nx build @overture/cli
```

### Task 1.2: Fix CLI Version String

**File:** `apps/cli/src/cli/index.ts:35`

**Problem:** Hardcoded version `1.0.0` doesn't match actual version `0.3.0`.

**Solution:**

1. Read version from `apps/cli/package.json`:

```typescript
// At top of file
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8'),
);

// In createProgram()
program.name('overture').description('...').version(packageJson.version);
```

2. Ensure `apps/cli/package.json` has correct version:

```json
{
  "version": "0.3.0"
}
```

**Verification:**

```bash
nx build @overture/cli
node dist/apps/cli/main.js --version  # Should output 0.3.0
```

### Task 1.3: Remove Stub Code

**File:** `libs/core/sync/src/lib/sync.ts`

**Problem:** This file contains only a stub function that returns `'sync'`.

**Solution:**

1. Delete the file: `libs/core/sync/src/lib/sync.ts`
2. Remove export from `libs/core/sync/src/index.ts` (if present)
3. Search for any imports of this function and remove them

**Verification:**

```bash
nx build @overture/sync-core
nx test @overture/sync-core
```

---

## Workstream 2: Lint Fixes (P1)

**Priority:** High
**Estimated Time:** 2-3 hours
**Dependencies:** WS1 complete
**Can Parallelize:** Yes (by project)

### Task 2.1: Auto-Fix Lint Issues

Run auto-fix on all projects:

```bash
nx run-many -t lint --all -- --fix
```

This should fix:

- `@typescript-eslint/no-inferrable-types` (2 errors)
- Some formatting issues

### Task 2.2: Fix Module Boundary Violations

**Files:**

- `apps/cli/src/main.ts:5`
- `apps/cli/src/main.spec.ts:4`

**Problem:** Static imports of lazy-loaded library `@overture/utils`.

**Solution:** Check if `@overture/utils` should be eagerly loaded or adjust the import pattern. Review `nx.json` or project tags to understand the boundary rule.

**Investigation needed:**

```bash
nx graph --focus=@overture/cli
```

### Task 2.3: Fix Empty Function Errors in Tests

**File:** `libs/ports/output/src/lib/output.port.spec.ts:251-254`

**Problem:** Empty mock methods trigger `@typescript-eslint/no-empty-function`.

**Solution:** Add eslint disable comment or implement no-op body:

```typescript
// Option A: Disable comment
// eslint-disable-next-line @typescript-eslint/no-empty-function
info() {}

// Option B: No-op body
info() { /* no-op mock */ }
```

### Task 2.4: Fix Unused Variables in Tests

**File:** `libs/ports/output/src/lib/output.port.spec.ts:588, 593`

**Problem:** `incomplete1` and `incomplete2` variables are unused.

**Solution:** Either use the variables in assertions or prefix with underscore: `_incomplete1`.

### Task 2.5: Fix Remaining `any` Types

**Files with `@typescript-eslint/no-explicit-any` warnings:**

- `libs/domain/config-schema/src/lib/config-schema.spec.ts:112, 444`
- `apps/cli/src/main.spec.ts:201, 207, 223, 240, 257`
- `apps/cli/src/test-utils/app-dependencies.mock.ts:132`
- `apps/cli/src/test-utils/test-fixtures.ts:106, 135, 164, 231`

**Solution:** Replace `any` with proper types or `unknown`. Example:

```typescript
// BEFORE
const result = someFunction() as any;

// AFTER
const result = someFunction() as SomeSpecificType;
// OR
const result = someFunction() as unknown;
```

### Task 2.6: Verify All Lint Issues Fixed

```bash
nx run-many -t lint --all
# Expected: 0 errors, 0 warnings (or acceptable warnings)
```

---

## Workstream 3: Documentation Updates (P1)

**Priority:** High
**Estimated Time:** 1 hour
**Dependencies:** WS1 complete
**Can Parallelize:** Yes

### Task 3.1: Update AGENTS.md

**File:** `AGENTS.md`

**Changes needed:**

1. **Line 30:** Change "Jest" to "Vitest"

   ```markdown
   - **Testing:** Vitest (384 tests, 83%+ coverage)
   ```

2. **Line 122-127:** Update test framework section

   ```markdown
   **Test Framework:** Vitest with TypeScript support

   - **Total Tests:** 384+ passing
   - **Coverage:** 83%+ (branches, functions, lines)
   ```

3. **Line 139:** Already mentions `vi.mock()` which is correct for Vitest

4. **Add linting/formatting section** after "Before Committing:" (line 183):

   ```markdown
   **Before Committing:**

   1. Run linter: `nx run-many -t lint --all`
   2. Run formatter: `npx prettier --write .`
   3. Run tests: `nx test @overture/cli`
   4. Run build: `nx build @overture/cli`
   5. Review changes: `git diff`
   6. Write descriptive commit message with body
   ```

### Task 3.2: Update CLAUDE.md

**File:** `CLAUDE.md`

**Changes needed:**

1. **Line 26:** Update test count

   ```markdown
   - [x] **Test Suite** — Comprehensive Vitest tests with 83%+ code coverage (384+ tests passing)
   ```

2. **Add to "Before Committing Checklist" (around line 486):**

   ```markdown
   - [ ] **Run linter** — Execute `nx run-many -t lint --all` to ensure no lint errors
   - [ ] **Run formatter** — Execute `npx prettier --write .` for consistent formatting
   ```

3. **Add to "Common Anti-Patterns to Avoid" (around line 556):**

   ```markdown
   - Skip running linter before commits
   - Commit code with lint errors or warnings
   ```

4. **Add to "Do:" section (around line 569):**
   ```markdown
   - Run linter and formatter before every commit
   - Fix all lint errors immediately (don't defer)
   ```

### Task 3.3: Verify Documentation Accuracy

Review and verify:

- Test counts match actual: `nx run-many -t test --all 2>&1 | grep -E "passed|failed"`
- Project structure matches actual directory layout
- Command examples work correctly

---

## Workstream 4: Error Handling Standardization (P2)

**Priority:** Medium
**Estimated Time:** 3-4 hours
**Dependencies:** WS1 complete
**Can Parallelize:** Yes (by file)

### Task 4.1: Create Error Handling Guidelines

**Document the standard pattern** (add to `docs/howtos/error-handling.md`):

```typescript
// Standard error handling pattern for CLI commands
import { ErrorHandler } from '@overture/utils';

try {
  // Command logic
} catch (error) {
  ErrorHandler.handleCommandError(error, 'command-name');
  // Note: handleCommandError calls process.exit internally
}
```

### Task 4.2: Refactor `init.ts` Error Handling

**File:** `apps/cli/src/cli/commands/init.ts`

**Current (lines 98-101):**

```typescript
} catch (error) {
  output.error(`Failed to initialize configuration: ${(error as Error).message}`);
  process.exit(1);
}
```

**Change to:**

```typescript
} catch (error) {
  ErrorHandler.handleCommandError(error, 'init');
}
```

### Task 4.3: Refactor `sync.ts` Error Handling

**File:** `apps/cli/src/cli/commands/sync.ts`

**Lines to update:** 380, 392 (and any other `process.exit` calls)

Apply same pattern as Task 4.2.

### Task 4.4: Refactor `user.ts` Error Handling

**File:** `apps/cli/src/cli/commands/user.ts`

**Lines to update:** 114, 135, 180, 212, 244, 264, 272, 292, 296

**Special consideration:** Remove the test artifact check (lines 238-241):

```typescript
// REMOVE THIS - test artifact leaking into production
if (error instanceof Error && error.message.startsWith('process.exit:')) {
  throw error;
}
```

### Task 4.5: Refactor `backup.ts` Error Handling

**File:** `apps/cli/src/cli/commands/backup.ts`

**Lines to update:** 163, 182

### Task 4.6: Refactor `audit.ts` Error Handling

**File:** `apps/cli/src/cli/commands/audit.ts`

**Line to update:** 70

### Task 4.7: Verify Error Handling Consistency

After all changes:

```bash
grep -rn "process\.exit" apps/cli/src/cli/commands/
# Should only show ErrorHandler.handleCommandError usage or signal handlers
```

---

## Workstream 5: Output Port Refactoring (P2)

**Priority:** Medium
**Estimated Time:** 4-5 hours
**Dependencies:** WS4 complete
**Can Parallelize:** Yes (by file)

### Task 5.1: Extend OutputPort Interface (Optional)

**File:** `libs/ports/output/src/lib/output.port.ts`

Consider adding methods if needed:

```typescript
export interface OutputPort {
  // Existing
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;

  // New methods (optional)
  debug?(message: string): void;
  raw?(message: string): void; // Unformatted output
  nl?(): void; // Newline
}
```

**Note:** Make new methods optional with `?` for backward compatibility.

### Task 5.2: Refactor `doctor.ts` Console Usage

**File:** `apps/cli/src/cli/commands/doctor.ts`

**Lines with console.log:** 134, 138, 142, 222, 227, 246, 250, 255, 315, 327, 330-367

**Solution:** Replace all `console.log` with `output.info()` from deps:

```typescript
// BEFORE
console.log(`Platform: ${platform}`);

// AFTER
output.info(`Platform: ${platform}`);
```

### Task 5.3: Refactor `user.ts` Console Usage

**File:** `apps/cli/src/cli/commands/user.ts`

**Lines:** 313-420 (`displayUserConfig` function)

**Solution:** The function needs access to `output` from deps. Either:

1. Pass `output` as parameter to `displayUserConfig`
2. Move function inside the command action where deps are available

### Task 5.4: Refactor `sync.ts` Console Usage

**File:** `apps/cli/src/cli/commands/sync.ts`

**Line 244:** `console.log(diffOutput)`

**Solution:**

```typescript
// BEFORE
console.log(diffOutput);

// AFTER
output.info(diffOutput);
// Or if raw output needed, add raw() to OutputPort
```

### Task 5.5: Refactor `backup.ts` Console Usage

**File:** `apps/cli/src/cli/commands/backup.ts`

**Lines:** 60, 67

Replace with `output.info()`.

### Task 5.6: Refactor `plugin-list.ts` Console Usage

**File:** `apps/cli/src/cli/commands/plugin-list.ts`

**Line 74:** `console.log(JSON.stringify(...))`

Replace with `output.info(JSON.stringify(...))`.

### Task 5.7: Refactor Library Code Console Usage

**Files:**

- `libs/core/plugin/src/lib/plugin-detector.ts:108, 265`
- `libs/core/config/src/lib/config-loader.ts:190, 206, 295`
- `apps/cli/src/core/process-lock.ts:118, 293`

**Solution for libraries:** These need `OutputPort` injected via constructor.

**For plugin-detector.ts:**

```typescript
// Add to constructor
constructor(
  private filesystem: FilesystemPort,
  private environment: EnvironmentPort,
  private output?: OutputPort  // Optional for backward compatibility
) {}

// Use conditionally
if (this.output) {
  this.output.warn('Plugin error...');
}
```

**For config-loader.ts:**

```typescript
// Change process.stderr.write to output.warn()
// Requires adding OutputPort to ConfigLoader constructor
```

### Task 5.8: Verify No Direct Console Usage

```bash
grep -rn "console\.\(log\|warn\|error\)" apps/cli/src/ libs/ --include="*.ts" | grep -v ".spec.ts" | grep -v "logger.ts"
# Should return empty or only acceptable usages
```

---

## Workstream 6: Code Deduplication (P3)

**Priority:** Low-Medium
**Estimated Time:** 2-3 hours
**Dependencies:** WS5 complete
**Can Parallelize:** Yes (by pattern)

### Task 6.1: Extract `getDirname` to Shared Utility

**Create file:** `libs/shared/utils/src/lib/path-utils.ts`

```typescript
/**
 * Cross-platform dirname extraction
 * Handles both forward slashes (Unix) and backslashes (Windows)
 *
 * @param filePath - File path to extract directory from
 * @returns Directory portion of the path
 */
export function getDirname(filePath: string): string {
  const lastSlash = Math.max(
    filePath.lastIndexOf('/'),
    filePath.lastIndexOf('\\'),
  );
  return lastSlash === -1 ? '.' : filePath.substring(0, lastSlash);
}
```

**Update barrel export:** `libs/shared/utils/src/index.ts`

```typescript
export { getDirname } from './lib/path-utils';
```

**Update client adapters:**

- `libs/adapters/client-adapters/src/lib/adapters/claude-code.adapter.ts:145-149`
- `libs/adapters/client-adapters/src/lib/adapters/copilot-cli.adapter.ts:159-165`
- `libs/adapters/client-adapters/src/lib/adapters/opencode.adapter.ts:225-232`

```typescript
// BEFORE (in each adapter)
private getDirname(filePath: string): string { ... }

// AFTER
import { getDirname } from '@overture/utils';
// Remove private method, use imported function
```

### Task 6.2: Centralize Client Name Constants

**Create file:** `libs/domain/config-types/src/lib/client-names.ts`

```typescript
/**
 * Supported client names for MCP configuration sync
 */
export const SUPPORTED_CLIENTS = [
  'claude-code',
  'copilot-cli',
  'opencode',
] as const;

/**
 * Type for supported client names
 */
export type ClientName = (typeof SUPPORTED_CLIENTS)[number];

/**
 * All known client names (including deprecated/legacy)
 * Used for validation and migration warnings
 */
export const ALL_KNOWN_CLIENTS = [
  ...SUPPORTED_CLIENTS,
  'claude-desktop',
  'vscode',
  'cursor',
  'windsurf',
  'jetbrains-copilot',
  'codex',
  'gemini-cli',
] as const;

/**
 * Type for all known client names
 */
export type KnownClientName = (typeof ALL_KNOWN_CLIENTS)[number];
```

**Update barrel export:** `libs/domain/config-types/src/index.ts`

**Update files using hardcoded arrays:**

- `apps/cli/src/cli/commands/doctor.ts:35`
- `apps/cli/src/cli/commands/validate.ts:23-33`
- `apps/cli/src/test-utils/app-dependencies.mock.ts:167, 170`
- `libs/shared/testing/src/lib/mocks/sync-engine-deps.mock.ts:71`

### Task 6.3: Consolidate Platform Detection

**Files using direct `os.platform()` or `process.platform`:**

- `apps/cli/src/cli/commands/doctor.ts:26`
- `libs/shared/utils/src/lib/error-handler.ts:308`

**Solution:** Use injected `EnvironmentPort`:

```typescript
// In doctor.ts - environment is available via deps
const platform = deps.environment.platform();

// In error-handler.ts - add platform as parameter or inject
static formatError(error: unknown, platform?: Platform): FormattedError {
  // Use provided platform or default
}
```

### Task 6.4: Verify Deduplication Complete

```bash
# Check for getDirname duplicates
grep -rn "getDirname" libs/adapters/client-adapters/
# Should only show imports, not implementations

# Check for hardcoded client arrays
grep -rn "claude-code.*copilot-cli.*opencode" apps/ libs/
# Should only show imports from config-types
```

---

## Workstream 7: Missing Test Coverage (P3)

**Priority:** Low-Medium
**Estimated Time:** 6-8 hours
**Dependencies:** WS5 complete (for consistent patterns)
**Can Parallelize:** Yes (per file)

### Overview of Files Needing Tests

| File                     | Complexity | Priority | Tested Indirectly? |
| ------------------------ | ---------- | -------- | ------------------ |
| `env-expander.ts`        | Simple     | High     | No                 |
| `audit-service.ts`       | Medium     | High     | No                 |
| `restore-service.ts`     | Medium     | High     | No                 |
| `backup-service.ts`      | Medium     | High     | Mocked only        |
| `transport-validator.ts` | Simple     | Medium   | Mocked             |
| `config-diff.ts`         | Simple     | Medium   | Mocked             |
| `client-env-service.ts`  | Simple     | Medium   | Mocked             |
| `exclusion-filter.ts`    | Medium     | Low      | Mocked             |
| `mcp-detector.ts`        | Simple     | Low      | Mocked             |

### Task 7.1: Create `env-expander.spec.ts`

**File:** `libs/core/sync/src/lib/env-expander.spec.ts`

**Test cases:**

1. `expandEnvVars()` - basic expansion
2. `expandEnvVars()` - default values `${VAR:-default}`
3. `expandEnvVars()` - missing required vars throw
4. `expandEnvVarsRecursive()` - nested vars
5. `expandEnvVarsRecursive()` - cycle detection
6. `expandEnvVarsInObject()` - deep object expansion
7. `hasEnvVars()` - detection
8. `extractEnvVarNames()` - extraction
9. `validateEnvVars()` - validation

**Template:**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  expandEnvVars,
  expandEnvVarsRecursive,
  expandEnvVarsInObject,
  hasEnvVars,
  extractEnvVarNames,
  validateEnvVars,
} from './env-expander';

describe('env-expander', () => {
  describe('expandEnvVars', () => {
    it('should expand simple env vars', () => {
      const env = { HOME: '/home/user' };
      expect(expandEnvVars('${HOME}/config', env)).toBe('/home/user/config');
    });

    it('should use default value when var missing', () => {
      expect(expandEnvVars('${MISSING:-default}', {})).toBe('default');
    });

    // ... more tests
  });
});
```

### Task 7.2: Create `audit-service.spec.ts`

**File:** `libs/core/sync/src/lib/audit-service.spec.ts`

**Test cases:**

1. `auditClient()` - single client audit
2. `auditAllClients()` - multiple clients
3. `compareConfigs()` - finds unmanaged MCPs
4. `generateSuggestions()` - creates add commands
5. Error handling for missing configs

### Task 7.3: Create `restore-service.spec.ts`

**File:** `libs/core/sync/src/lib/restore-service.spec.ts`

**Test cases:**

1. `restore()` - successful restore
2. `restore()` - backup not found
3. `restoreLatest()` - finds latest backup
4. `preview()` - shows backup without applying
5. `compare()` - diff between backup and current

### Task 7.4: Create `backup-service.spec.ts`

**File:** `libs/core/sync/src/lib/backup-service.spec.ts`

**Test cases:**

1. `backup()` - creates backup with timestamp
2. `listBackups()` - sorted by date
3. `getBackup()` - retrieves specific backup
4. `deleteBackup()` - removes backup
5. `cleanupOldBackups()` - retention policy
6. `getLatestBackup()` - most recent

### Task 7.5: Create `transport-validator.spec.ts`

**File:** `libs/core/sync/src/lib/transport-validator.spec.ts`

**Test cases:**

1. `validateMcpTransport()` - single validation
2. `getTransportWarnings()` - unsupported transports
3. `filterByTransport()` - filter to supported only
4. `formatTransportWarnings()` - human readable

### Task 7.6: Create `config-diff.spec.ts`

**File:** `libs/core/sync/src/lib/config-diff.spec.ts`

**Test cases:**

1. `generateDiff()` - additions
2. `generateDiff()` - removals
3. `generateDiff()` - modifications
4. `generateDiff()` - unchanged
5. `formatDiff()` - output formatting
6. `formatDiffSummary()` - compact summary

### Task 7.7: Create `client-env-service.spec.ts`

**File:** `libs/core/sync/src/lib/client-env-service.spec.ts`

**Test cases:**

1. `shouldExpandEnvVars()` - checks client support
2. `expandEnvVarsInMcpConfig()` - single config
3. `expandEnvVarsInClientConfig()` - full config
4. `getClientsNeedingExpansion()` - list
5. `getClientsWithNativeSupport()` - list

### Task 7.8: Verify Test Coverage

```bash
nx test @overture/sync-core --coverage
# Target: 80%+ coverage on all new files
```

---

## Workstream 8: E2E Test Fixes (P4)

**Priority:** Low
**Estimated Time:** 3-4 hours
**Dependencies:** All other WS complete
**Can Parallelize:** Yes (by test file)

### Task 8.1: Investigate Skipped Tests

**Files with skipped tests:**

- `apps/cli-e2e/src/cli/sync-multi-client.spec.ts` - 7 skipped
- `apps/cli-e2e/src/cli/audit.spec.ts` - 3 skipped

**Investigation steps:**

1. Run each skipped test individually to understand failure
2. Document reason for skip (flaky? unimplemented? environment?)
3. Create plan to fix or remove

```bash
# Run specific test
nx e2e @overture/cli-e2e --testPathPattern=sync-multi-client
```

### Task 8.2: Fix or Remove Skipped Tests

For each skipped test:

1. If fixable: Fix the test
2. If feature not implemented: Add TODO comment with issue reference
3. If test is obsolete: Remove it

### Task 8.3: Add E2E Test Setup

**File:** `apps/cli-e2e/src/test-setup.ts`

Currently empty. Add useful setup:

```typescript
import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Ensure CLI is built before E2E tests
beforeAll(() => {
  console.log('Building CLI for E2E tests...');
  execSync('nx build @overture/cli', { stdio: 'inherit' });
});

// Shared helpers
export function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'overture-e2e-'));
}

export function cleanupTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
```

### Task 8.4: Verify E2E Tests Pass

```bash
nx e2e @overture/cli-e2e
# All tests should pass (no skipped unless documented)
```

---

## Post-Implementation Checklist

After all workstreams complete:

### Verification Steps

1. **All tests pass:**

   ```bash
   nx run-many -t test --all
   ```

2. **All lint checks pass:**

   ```bash
   nx run-many -t lint --all
   ```

3. **Build succeeds:**

   ```bash
   nx build @overture/cli
   ```

4. **CLI works correctly:**

   ```bash
   node dist/apps/cli/main.js --version
   node dist/apps/cli/main.js --help
   node dist/apps/cli/main.js doctor
   ```

5. **E2E tests pass:**
   ```bash
   nx e2e @overture/cli-e2e
   ```

### Commit Strategy

Create commits per workstream for easy review:

```bash
git add <workstream-files>
git commit -m "fix(core): resolve critical bugs in process-lock and CLI version

- Fix broken import in process-lock.ts (was importing from non-existent module)
- Update CLI version to read from package.json
- Remove dead stub code in sync.ts

🤖 Generated with Claude Code"
```

### Final PR

Create PR with:

- Title: `fix: resolve code review issues (WS1-WS8)`
- Body: Link to this implementation plan
- Labels: `bug`, `refactor`, `tests`, `documentation`

---

## Appendix A: File Reference Quick Lookup

### Critical Files (WS1)

- `apps/cli/src/core/process-lock.ts`
- `apps/cli/src/cli/index.ts`
- `libs/core/sync/src/lib/sync.ts`

### Command Files (WS4, WS5)

- `apps/cli/src/cli/commands/init.ts`
- `apps/cli/src/cli/commands/sync.ts`
- `apps/cli/src/cli/commands/doctor.ts`
- `apps/cli/src/cli/commands/user.ts`
- `apps/cli/src/cli/commands/validate.ts`
- `apps/cli/src/cli/commands/backup.ts`
- `apps/cli/src/cli/commands/audit.ts`
- `apps/cli/src/cli/commands/plugin-list.ts`
- `apps/cli/src/cli/commands/plugin-export.ts`

### Library Files with Console Usage (WS5)

- `libs/core/plugin/src/lib/plugin-detector.ts`
- `libs/core/config/src/lib/config-loader.ts`

### Files Needing Tests (WS7)

- `libs/core/sync/src/lib/env-expander.ts`
- `libs/core/sync/src/lib/audit-service.ts`
- `libs/core/sync/src/lib/restore-service.ts`
- `libs/core/sync/src/lib/backup-service.ts`
- `libs/core/sync/src/lib/transport-validator.ts`
- `libs/core/sync/src/lib/config-diff.ts`
- `libs/core/sync/src/lib/client-env-service.ts`
- `libs/core/sync/src/lib/exclusion-filter.ts`
- `libs/core/sync/src/lib/mcp-detector.ts`

### Documentation Files (WS3)

- `AGENTS.md`
- `CLAUDE.md`

---

## Appendix B: MCP Server Usage Guide for Agents

When implementing this plan, use these MCP servers effectively:

### For Code Changes

- **filesystem MCP**: Read/write files
- **nx MCP**: Run tests, builds, lint via `nx_*` tools

### For Understanding Code

- **nx_workspace**: Get project structure
- **nx_project_details**: Get specific project config
- **context7**: Look up library APIs (Commander.js, Zod, Vitest)

### For Complex Decisions

- **sequentialthinking**: Break down multi-step problems
- **memory**: Track decisions across sessions

### Parallel Agent Execution

Multiple agents can work simultaneously on:

- Different files within same workstream
- Different workstreams (respecting dependencies)

**Example parallel execution:**

```
Agent 1: WS2 (lint fixes for @overture/errors)
Agent 2: WS2 (lint fixes for @overture/ports-output)
Agent 3: WS3 (documentation updates)
```

---

_Last updated: 2025-12-21_
