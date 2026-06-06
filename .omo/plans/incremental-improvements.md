# Overture Incremental Improvements Plan

## TL;DR

> **Quick Summary**: Improve type safety, maintainability, and test coverage through Zod option parsing, validate.ts extraction, and E2E test expansion.
>
> **Deliverables**:
>
> - Zod-based option parser utility eliminating ~80% of type assertions
> - validate.ts refactored into 4 focused modules
> - 15 new E2E integration tests in existing harness
>
> **Estimated Effort**: Medium (5-7 days)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (parser) → Task 3 (migrate sync) → Task 7 (validate refactor)

---

## Context

### Original Request

Implement incremental improvements based on comprehensive code review findings:

- 208 type assertions from Commander.js options
- 41 lint warnings (no errors)
- 87% test coverage, 293 tests passing
- validate.ts at 500 LOC needing extraction
- composition-root.ts at 41.5% coverage

### Interview Summary

**Key Discussions**:

- User chose TDD approach (test-first)
- Single comprehensive plan preferred
- Type safety first priority (highest leverage)

**Research Findings**:

- validate.ts is 500 LOC (not 852 - that's the test file)
- E2E harness already exists in apps/cli-e2e/
- Shared formatters extraction is moot (formatTimestamp etc. only in backup.ts)
- Config loading centralization limited to 2 files (sync.ts, mcp.ts)

### Metis Review

**Scope Corrections Applied**:

- Dropped "extract shared formatters" (not actually shared)
- Reduced config centralization to "migrate 2 files"
- Changed E2E from "create harness" to "expand existing harness"
- Excluded user.ts `any` casts (different problem, different fix)

**Critical Patterns Found**:

```typescript
// Pattern 1: Boolean options (MOST COMMON)
detailMode = (options.detail as boolean | undefined) ?? false;

// Pattern 2: String arrays
platforms.exclude as string[];

// Pattern 3: Double assertion (CODE SMELL)
clients: [options.client as string as ClientName];
```

---

## Work Objectives

### Core Objective

Eliminate type safety debt and improve maintainability while preserving all existing behavior.

### Concrete Deliverables

- `apps/cli/src/lib/option-parser.ts` - Zod-based option parsing utility
- `apps/cli/src/lib/validators/mcp-config-validator.ts` - Extracted MCP validation
- `apps/cli/src/lib/validators/client-validator.ts` - Extracted client validation
- `apps/cli/src/lib/formatters/validation-formatter.ts` - Extracted display logic
- `apps/cli-e2e/src/cli/*.spec.ts` - 15 new E2E test cases

### Definition of Done

- [x] `grep -r "as boolean\|as string\[\]" apps/cli/src/cli/commands/ | wc -l` returns <20 (from ~80+)
- [x] `nx test @overture/cli` passes (293+ tests)
- [x] `nx e2e @overture/cli-e2e` passes with 15+ new tests
- [x] `nx lint @overture/cli` shows 0 errors (warnings acceptable)

### Must Have

- All existing tests continue to pass
- No behavior changes to CLI commands
- TDD approach for all new code
- ESM-compatible imports (.js extensions)

### Must NOT Have (Guardrails)

- No error message text changes during refactoring
- No refactoring of adjacent code not in scope
- No new features or validation rules
- No `as any` escape hatches in new code
- No changes to user.ts `any` casts (separate future task)
- No changes to backup.ts formatters (not shared)
- No OutputPort interface changes

---

## Verification Strategy (MANDATORY)

### Test Decision

- **Infrastructure exists**: YES (Vitest + E2E harness)
- **User wants tests**: TDD
- **Framework**: Vitest (unit), execSync (E2E)

### TDD Workflow per Task

**Task Structure:**

1. **RED**: Write failing test first
   - Test file: `[path].spec.ts`
   - Test command: `nx test @overture/cli --testFile=[file]`
   - Expected: FAIL (test exists, implementation doesn't)
2. **GREEN**: Implement minimum code to pass
   - Command: `nx test @overture/cli`
   - Expected: PASS
3. **REFACTOR**: Clean up while keeping green
   - Command: `nx test @overture/cli && nx lint @overture/cli`
   - Expected: PASS

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Create option parser utility (foundation)
├── Task 2: Add option parser tests
└── Task 11: Fix lint warnings (independent)

Wave 2 (After Wave 1):
├── Task 3: Migrate sync.ts to option parser
├── Task 4: Migrate validate.ts to option parser
├── Task 5: Migrate mcp.ts to option parser
├── Task 6: Migrate audit.ts to option parser
└── Task 12: Expand E2E test coverage

Wave 3 (After Wave 2):
├── Task 7: Extract mcp-config-validator.ts
├── Task 8: Extract client-validator.ts
├── Task 9: Extract validation-formatter.ts
└── Task 10: Centralize config loading (sync.ts, mcp.ts)

Critical Path: Task 1 → Task 3 → Task 7
Parallel Speedup: ~40% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks     | Can Parallelize With |
| ---- | ---------- | ---------- | -------------------- |
| 1    | None       | 3, 4, 5, 6 | 2, 11                |
| 2    | None       | None       | 1, 11                |
| 3    | 1          | 7          | 4, 5, 6, 12          |
| 4    | 1          | 7          | 3, 5, 6, 12          |
| 5    | 1          | 10         | 3, 4, 6, 12          |
| 6    | 1          | None       | 3, 4, 5, 12          |
| 7    | 3, 4       | 9          | 8                    |
| 8    | 3, 4       | None       | 7                    |
| 9    | 7          | None       | 8, 10                |
| 10   | 5          | None       | 7, 8, 9              |
| 11   | None       | None       | 1, 2                 |
| 12   | 1          | None       | 3, 4, 5, 6           |

### Agent Dispatch Summary

| Wave | Tasks          | Recommended Dispatch |
| ---- | -------------- | -------------------- |
| 1    | 1, 2, 11       | 3 parallel agents    |
| 2    | 3, 4, 5, 6, 12 | 5 parallel agents    |
| 3    | 7, 8, 9, 10    | 4 parallel agents    |

---

## TODOs

### Phase 1: Type Safety

---

- [x] 1. Create Zod Option Parser Utility

  **What to do**:
  - Create `apps/cli/src/lib/option-parser.ts`
  - Define generic `parseOptions<T>(schema: ZodSchema<T>, options: Record<string, unknown>): T`
  - Handle Zod validation errors with user-friendly messages
  - Export individual option schemas for reuse

  **Must NOT do**:
  - Do not change any existing command behavior
  - Do not add new validation rules beyond current behavior
  - Do not use `as any` or other escape hatches

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file creation with clear specification
  - **Skills**: [`typescript-advanced`]
    - `typescript-advanced`: Generic types, Zod schema design

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 11)
  - **Blocks**: Tasks 3, 4, 5, 6
  - **Blocked By**: None (can start immediately)

  **References**:
  - `apps/cli/src/cli/commands/sync.ts:12-51` - Current option parsing patterns to replicate
  - `apps/cli/src/lib/validators/env-var-validator.ts` - Existing validator pattern to follow
  - `apps/cli/src/domain/schemas.ts` - Existing Zod schema patterns
  - Official docs: https://zod.dev/?id=basic-usage - Zod .default() and .coerce() behavior

  **Acceptance Criteria**:
  - [ ] Test file created: `apps/cli/src/lib/option-parser.spec.ts`
  - [ ] Tests cover: valid options, missing options with defaults, invalid option types
  - [ ] `nx test @overture/cli --testFile=option-parser.spec.ts` → PASS
  - [ ] `nx lint @overture/cli` → 0 errors

  ```bash
  # Verification
  cat apps/cli/src/lib/option-parser.ts | head -20
  # Assert: File exists with Zod imports

  nx test @overture/cli --testFile=option-parser.spec.ts
  # Assert: Tests pass
  ```

  **Commit**: YES
  - Message: `feat(cli): add Zod-based option parser utility`
  - Files: `apps/cli/src/lib/option-parser.ts`, `apps/cli/src/lib/option-parser.spec.ts`
  - Pre-commit: `nx test @overture/cli --testFile=option-parser.spec.ts`

---

- [x] 2. Add Comprehensive Option Parser Tests

  **What to do**:
  - Test all current option patterns (boolean, string, string[], ClientName)
  - Test edge cases: undefined, null, wrong types, coercion
  - Test error message formatting for invalid inputs
  - Verify default value behavior matches current `|| false` patterns

  **Must NOT do**:
  - Do not test behavior that doesn't exist yet
  - Do not add tests for user.ts patterns (out of scope)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Test file expansion, clear patterns exist
  - **Skills**: [`angular-testing`]
    - `angular-testing`: Vitest patterns, mock creation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 11)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `apps/cli/src/cli/commands/sync.spec.ts` - Existing test patterns
  - `apps/cli/src/test-utils/app-dependencies.mock.ts` - Mock factory patterns
  - `apps/cli/src/cli/commands/validate.spec.ts:852` - Comprehensive edge case examples

  **Acceptance Criteria**:
  - [ ] Tests for boolean options with `|| false` behavior
  - [ ] Tests for string[] options with empty array default
  - [ ] Tests for ClientName validation with helpful error
  - [ ] `nx test @overture/cli --testFile=option-parser.spec.ts` → 15+ tests pass

  ```bash
  nx test @overture/cli --testFile=option-parser.spec.ts --coverage
  # Assert: >90% coverage on option-parser.ts
  ```

  **Commit**: YES (groups with Task 1)
  - Message: `test(cli): add comprehensive option parser tests`
  - Files: `apps/cli/src/lib/option-parser.spec.ts`
  - Pre-commit: `nx test @overture/cli`

---

- [x] 3. Migrate sync.ts to Option Parser

  **What to do**:
  - Define `SyncOptionsSchema` using Zod
  - Replace all `as boolean`, `as string[]` assertions with schema parsing
  - Ensure error handling shows user-friendly messages
  - Run existing sync.spec.ts tests to verify no behavior change

  **Must NOT do**:
  - Do not change any error messages
  - Do not add new options or change defaults
  - Do not refactor unrelated sync.ts code

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file migration with clear before/after pattern
  - **Skills**: [`typescript-advanced`]
    - `typescript-advanced`: Type inference, generic constraints

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 6, 12)
  - **Blocks**: Task 7
  - **Blocked By**: Task 1

  **References**:
  - `apps/cli/src/cli/commands/sync.ts:12-51` - Current assertions to replace
  - `apps/cli/src/cli/commands/sync.spec.ts` - Tests that must continue passing
  - `apps/cli/src/lib/option-parser.ts` - Parser utility to use

  **Acceptance Criteria**:
  - [ ] `grep -c "as boolean" apps/cli/src/cli/commands/sync.ts` → 0
  - [ ] `grep -c "as string" apps/cli/src/cli/commands/sync.ts` → 0
  - [ ] `nx test @overture/cli --testFile=sync.spec.ts` → All 29 tests pass
  - [ ] No changes to sync.spec.ts required (behavior preserved)

  ```bash
  # Count assertions before
  grep -c "as boolean\|as string" apps/cli/src/cli/commands/sync.ts || echo "0"
  # Assert: 0 after migration

  nx test @overture/cli --testFile=sync.spec.ts
  # Assert: 29 tests pass
  ```

  **Commit**: YES
  - Message: `refactor(cli): migrate sync command to Zod option parser`
  - Files: `apps/cli/src/cli/commands/sync.ts`
  - Pre-commit: `nx test @overture/cli --testFile=sync.spec.ts`

---

- [x] 4. Migrate validate.ts to Option Parser

  **What to do**:
  - Define `ValidateOptionsSchema` using Zod
  - Replace assertions in option handling
  - Preserve all existing validation logic unchanged

  **Must NOT do**:
  - Do not change validation logic (that's Task 7-9)
  - Do not extract validators yet
  - Do not modify error messages

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Similar to Task 3, clear pattern to follow
  - **Skills**: [`typescript-advanced`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 5, 6, 12)
  - **Blocks**: Task 7
  - **Blocked By**: Task 1

  **References**:
  - `apps/cli/src/cli/commands/validate.ts:40-135` - Option handling area
  - `apps/cli/src/cli/commands/validate.spec.ts` - 26 tests to verify
  - `apps/cli/src/cli/commands/sync.ts` - Migration pattern from Task 3

  **Acceptance Criteria**:
  - [ ] `grep -c "as string\[\]" apps/cli/src/cli/commands/validate.ts` → 0
  - [ ] `nx test @overture/cli --testFile=validate.spec.ts` → All 26 tests pass

  ```bash
  nx test @overture/cli --testFile=validate.spec.ts
  # Assert: 26 tests pass
  ```

  **Commit**: YES
  - Message: `refactor(cli): migrate validate command to Zod option parser`
  - Files: `apps/cli/src/cli/commands/validate.ts`
  - Pre-commit: `nx test @overture/cli --testFile=validate.spec.ts`

---

- [x] 5. Migrate mcp.ts to Option Parser

  **What to do**:
  - Define `McpListOptionsSchema` and `McpEnableOptionsSchema`
  - Replace assertions in option handling
  - Preserve config loading pattern for now (Task 10 will centralize)

  **Must NOT do**:
  - Do not change config loading yet (that's Task 10)
  - Do not refactor MCP display logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`typescript-advanced`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 6, 12)
  - **Blocks**: Task 10
  - **Blocked By**: Task 1

  **References**:
  - `apps/cli/src/cli/commands/mcp.ts:143-298` - Option handling with assertions
  - `apps/cli/src/cli/commands/mcp.spec.ts` - Tests to verify

  **Acceptance Criteria**:
  - [ ] `grep -c "as boolean\|as string" apps/cli/src/cli/commands/mcp.ts` → reduced by 80%+
  - [ ] `nx test @overture/cli --testFile=mcp.spec.ts` → All tests pass

  **Commit**: YES
  - Message: `refactor(cli): migrate mcp command to Zod option parser`
  - Files: `apps/cli/src/cli/commands/mcp.ts`
  - Pre-commit: `nx test @overture/cli --testFile=mcp.spec.ts`

---

- [x] 6. Migrate audit.ts to Option Parser

  **What to do**:
  - Define `AuditOptionsSchema`
  - Replace assertions in option handling

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`typescript-advanced`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 5, 12)
  - **Blocks**: None
  - **Blocked By**: Task 1

  **References**:
  - `apps/cli/src/cli/commands/audit.ts` - Target file
  - `apps/cli/src/cli/commands/audit.spec.ts` - Tests to verify

  **Acceptance Criteria**:
  - [ ] Assertions reduced to 0 in audit.ts
  - [ ] All audit tests pass

  **Commit**: YES
  - Message: `refactor(cli): migrate audit command to Zod option parser`
  - Files: `apps/cli/src/cli/commands/audit.ts`
  - Pre-commit: `nx test @overture/cli --testFile=audit.spec.ts`

---

### Phase 2: Maintainability

---

- [x] 7. Extract mcp-config-validator.ts from validate.ts

  **What to do**:
  - Create `apps/cli/src/lib/validators/mcp-config-validator.ts`
  - Extract: `validateMcpConfigs`, `validateMcpPlatforms`, `validateMcpClients`, `checkDuplicateMcpNames`
  - Use `lsp_find_references` first to verify no external callers
  - Keep same function signatures (no API changes)

  **Must NOT do**:
  - Do not change function behavior
  - Do not add new validation rules
  - Do not change error messages

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Mechanical extraction with TDD verification
  - **Skills**: [`typescript-advanced`]
    - `typescript-advanced`: Module organization, exports

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 9, 10)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 3, 4

  **References**:
  - `apps/cli/src/cli/commands/validate.ts:150-250` - Functions to extract
  - `apps/cli/src/lib/validators/env-var-validator.ts` - Pattern for new validator file
  - `apps/cli/src/cli/commands/validate.spec.ts` - Tests that must pass

  **Acceptance Criteria**:
  - [ ] File created: `apps/cli/src/lib/validators/mcp-config-validator.ts`
  - [ ] Functions exported with identical signatures
  - [ ] validate.ts imports from new location
  - [ ] `nx test @overture/cli --testFile=validate.spec.ts` → All tests pass
  - [ ] `nx test @overture/cli` → All 293+ tests pass

  ```bash
  # Verify extraction
  grep -c "validateMcpConfigs" apps/cli/src/lib/validators/mcp-config-validator.ts
  # Assert: 1 (export exists)

  nx test @overture/cli
  # Assert: All tests pass
  ```

  **Commit**: YES
  - Message: `refactor(cli): extract mcp config validators to separate module`
  - Files: `apps/cli/src/lib/validators/mcp-config-validator.ts`, `apps/cli/src/cli/commands/validate.ts`
  - Pre-commit: `nx test @overture/cli`

---

- [x] 8. Extract client-validator.ts from validate.ts

  **What to do**:
  - Create `apps/cli/src/lib/validators/client-validator.ts`
  - Extract: `validateClientOption`, `validateEnabledClients`, `determineClientsToValidate`, `validateTransportAndEnv`
  - Keep same function signatures

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: [`typescript-advanced`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 9, 10)
  - **Blocks**: None
  - **Blocked By**: Tasks 3, 4

  **References**:
  - `apps/cli/src/cli/commands/validate.ts:75-150` - Functions to extract
  - `apps/cli/src/lib/validators/mcp-config-validator.ts` - Pattern from Task 7

  **Acceptance Criteria**:
  - [ ] File created with functions exported
  - [ ] `nx test @overture/cli` → All tests pass

  **Commit**: YES
  - Message: `refactor(cli): extract client validators to separate module`
  - Files: `apps/cli/src/lib/validators/client-validator.ts`, `apps/cli/src/cli/commands/validate.ts`
  - Pre-commit: `nx test @overture/cli`

---

- [x] 9. Extract validation-formatter.ts from validate.ts

  **What to do**:
  - Create `apps/cli/src/lib/formatters/validation-formatter.ts`
  - Extract: `displayValidationResults` and related display functions
  - Keep same function signatures

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: [`typescript-advanced`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 8, 10)
  - **Blocks**: None
  - **Blocked By**: Task 7

  **References**:
  - `apps/cli/src/cli/commands/validate.ts:300-350` - Display functions to extract
  - `apps/cli/src/lib/validators/mcp-config-validator.ts` - Pattern to follow

  **Acceptance Criteria**:
  - [ ] File created with functions exported
  - [ ] validate.ts reduced to ~150 LOC (orchestration only)
  - [ ] `nx test @overture/cli` → All tests pass

  **Commit**: YES
  - Message: `refactor(cli): extract validation formatters to separate module`
  - Files: `apps/cli/src/lib/formatters/validation-formatter.ts`, `apps/cli/src/cli/commands/validate.ts`
  - Pre-commit: `nx test @overture/cli`

---

- [x] 10. Centralize Config Loading in sync.ts and mcp.ts

  **What to do**:
  - Create shared config loading utility in `apps/cli/src/lib/config-loader.ts`
  - Migrate `loadSyncConfig()` from sync.ts
  - Migrate config loading pattern from mcp.ts
  - Keep same behavior (load user config, optional project config, merge)

  **Must NOT do**:
  - Do not change config loading behavior
  - Do not touch other commands' config loading

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: [`typescript-advanced`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 8, 9)
  - **Blocks**: None
  - **Blocked By**: Task 5

  **References**:
  - `apps/cli/src/cli/commands/sync.ts:7-28` - Current loadSyncConfig pattern
  - `apps/cli/src/cli/commands/mcp.ts:134-158` - Similar pattern to consolidate

  **Acceptance Criteria**:
  - [ ] File created: `apps/cli/src/lib/config-loader.ts`
  - [ ] sync.ts and mcp.ts use shared loader
  - [ ] `nx test @overture/cli` → All tests pass

  **Commit**: YES
  - Message: `refactor(cli): centralize config loading pattern`
  - Files: `apps/cli/src/lib/config-loader.ts`, `apps/cli/src/cli/commands/sync.ts`, `apps/cli/src/cli/commands/mcp.ts`
  - Pre-commit: `nx test @overture/cli`

---

### Phase 3: Testing

---

- [x] 11. Fix Lint Warnings (Correctness Issues)

  **What to do**:
  - Fix `@typescript-eslint/no-unnecessary-condition` (15 occurrences)
  - Fix `@typescript-eslint/no-non-null-assertion` (4 occurrences)
  - Leave stylistic warnings (`prefer-nullish-coalescing`) for later

  **Must NOT do**:
  - Do not change behavior when fixing warnings
  - Do not fix `||` to `??` without verifying semantic equivalence

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Targeted lint fixes, clear guidance
  - **Skills**: [`typescript-advanced`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `apps/cli/src/core/process-lock.ts:90,100,166,195` - Non-null assertions to fix
  - `apps/cli/src/cli/commands/mcp.ts:143,167,291,298` - Unnecessary conditions
  - `apps/cli/src/cli/commands/validate.ts:155,263,416` - Unnecessary conditions

  **Acceptance Criteria**:
  - [ ] `nx lint @overture/cli 2>&1 | grep -c "no-unnecessary-condition"` → 0
  - [ ] `nx lint @overture/cli 2>&1 | grep -c "no-non-null-assertion"` → 0
  - [ ] `nx test @overture/cli` → All tests pass (behavior preserved)

  ```bash
  nx lint @overture/cli 2>&1 | grep -E "no-unnecessary-condition|no-non-null-assertion" | wc -l
  # Assert: 0
  ```

  **Commit**: YES
  - Message: `fix(cli): resolve correctness-related lint warnings`
  - Files: Multiple (as identified by linter)
  - Pre-commit: `nx lint @overture/cli && nx test @overture/cli`

---

- [x] 12. Expand E2E Test Coverage

  **What to do**:
  - Add 15 new E2E tests to existing `apps/cli-e2e/src/cli/` structure
  - Cover happy paths: sync, validate, doctor, mcp list
  - Cover error paths: missing config, invalid YAML, unknown command
  - Use existing execSync + assertion pattern from cli.spec.ts

  **Must NOT do**:
  - Do not create new harness (use existing)
  - Do not test internal implementation details

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple test scenarios requiring coordination
  - **Skills**: [`angular-testing`]
    - `angular-testing`: E2E patterns, test organization

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 5, 6)
  - **Blocks**: None
  - **Blocked By**: Task 1

  **References**:
  - `apps/cli-e2e/src/cli/cli.spec.ts` - Existing E2E pattern
  - `apps/cli-e2e/project.json` - E2E configuration
  - `apps/cli/src/cli/commands/*.ts` - Commands to test

  **Acceptance Criteria**:
  - [ ] 15+ new E2E test cases added
  - [ ] Tests cover: sync, validate, doctor, mcp list, init
  - [ ] Tests cover at least 3 error scenarios
  - [ ] `nx e2e @overture/cli-e2e` → All tests pass

  ```bash
  nx e2e @overture/cli-e2e
  # Assert: 15+ new tests pass

  grep -c "it(" apps/cli-e2e/src/**/*.spec.ts
  # Assert: Count increased by 15+
  ```

  **Commit**: YES
  - Message: `test(cli-e2e): expand E2E test coverage to 15+ scenarios`
  - Files: `apps/cli-e2e/src/cli/*.spec.ts`
  - Pre-commit: `nx e2e @overture/cli-e2e`

---

## Commit Strategy

| After Task | Message                                                        | Key Files                               | Verification       |
| ---------- | -------------------------------------------------------------- | --------------------------------------- | ------------------ |
| 1-2        | `feat(cli): add Zod-based option parser utility`               | option-parser.ts, option-parser.spec.ts | nx test            |
| 3          | `refactor(cli): migrate sync command to Zod option parser`     | sync.ts                                 | nx test            |
| 4          | `refactor(cli): migrate validate command to Zod option parser` | validate.ts                             | nx test            |
| 5          | `refactor(cli): migrate mcp command to Zod option parser`      | mcp.ts                                  | nx test            |
| 6          | `refactor(cli): migrate audit command to Zod option parser`    | audit.ts                                | nx test            |
| 7          | `refactor(cli): extract mcp config validators`                 | mcp-config-validator.ts                 | nx test            |
| 8          | `refactor(cli): extract client validators`                     | client-validator.ts                     | nx test            |
| 9          | `refactor(cli): extract validation formatters`                 | validation-formatter.ts                 | nx test            |
| 10         | `refactor(cli): centralize config loading`                     | config-loader.ts                        | nx test            |
| 11         | `fix(cli): resolve correctness-related lint warnings`          | various                                 | nx lint && nx test |
| 12         | `test(cli-e2e): expand E2E coverage`                           | cli-e2e/\*.spec.ts                      | nx e2e             |

---

## Success Criteria

### Verification Commands

```bash
# Type assertion reduction
grep -r "as boolean\|as string\[\]\|as Record" apps/cli/src/cli/commands/ | wc -l
# Expected: <20 (from ~80+)

# All tests pass
nx test @overture/cli
# Expected: 293+ tests pass

# E2E tests pass
nx e2e @overture/cli-e2e
# Expected: 15+ new tests pass

# Lint clean (errors only)
nx lint @overture/cli 2>&1 | grep -c "error"
# Expected: 0

# validate.ts reduced
wc -l apps/cli/src/cli/commands/validate.ts
# Expected: ~150 LOC (from 500)
```

### Final Checklist

- [x] All "Must Have" requirements present
- [x] All "Must NOT Have" guardrails respected
- [x] All 12 tasks completed with passing commits
- [x] No regressions in existing functionality
