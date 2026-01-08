# Maintainability Enhancement Implementation Plan

## Executive Summary

This plan addresses **5 HIGH priority** and **5 MEDIUM priority** maintainability issues identified in the Overture codebase. The plan is structured in **3 phases** over **6 weeks** with measurable success criteria and rollback strategies.

**Total Effort:** ~6 weeks (1 developer)  
**Expected Impact:**

- Test coverage: 83% -> 90%+
- Average file size: -35%
- Code complexity: -40%
- Documentation coverage: 30% -> 85%

---

## Codebase Statistics (Current State)

| Metric            | Value                        | Status                |
| ----------------- | ---------------------------- | --------------------- |
| **Total Lines**   | ~37,078 (source)             | Reasonable            |
| **Test Lines**    | ~30,440                      | Excellent (82% ratio) |
| **Test Coverage** | 83%                          | Good                  |
| **Test Files**    | 273 passing                  | Comprehensive         |
| **Largest File**  | 1,281 lines (sync-engine.ts) | God Object Risk       |
| **Classes**       | 23 core classes              | Well-organized        |
| **Skipped Tests** | 8 tests (.skip)              | Technical Debt        |

---

## Phase 1: Critical Fixes (Week 1-2)

**Goal:** Address immediate technical debt and test coverage gaps  
**Duration:** 2 weeks  
**Risk Level:** LOW (mostly additive changes)

---

### Task 1.1: Fix All Skipped E2E Tests

**Priority:** HIGH  
**Effort:** 3 days

#### Current State

8 skipped tests across 2 files:

- `apps/cli-e2e/src/cli/audit.spec.ts` (3 skipped)
- `apps/cli-e2e/src/cli/sync-multi-client.spec.ts` (6 skipped)

#### Implementation Steps

**Day 1: Audit & Platform Filtering Tests**

```typescript
// File: apps/cli-e2e/src/cli/audit.spec.ts

// 1. Fix: "should show error for unknown client"
it('should show error for unknown client', async () => {
  const result = await runCLI(['audit', '--client', 'fake-client']);

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain('Unknown client: fake-client');
  expect(result.stderr).toContain(
    'Available clients: claude-code, copilot-cli, opencode',
  );
});

// 2. Fix: "should handle gracefully when no clients installed"
it('should handle gracefully when no clients installed', async () => {
  // Mock empty binary detection
  mockBinaryDetector.detectAll.mockResolvedValue([]);

  const result = await runCLI(['audit']);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain('No AI clients detected');
});

// 3. Fix: "should produce well-formatted output"
it('should produce well-formatted output with clear sections', async () => {
  const result = await runCLI(['audit', '--detail']);

  expect(result.stdout).toMatch(/## Audit Results/);
  expect(result.stdout).toMatch(/### Claude Code/);
});
```

**Day 2: Multi-client Sync Tests**

```typescript
// File: apps/cli-e2e/src/cli/sync-multi-client.spec.ts

// 1. Fix: "should sync user + project configs to all clients"
it('should sync user + project configs to all clients', async () => {
  // Setup configs, execute sync, verify all clients received merged config
});

// 2. Fix: "should preview changes without applying"
it('should preview changes without applying', async () => {
  const result = await runCLI(['sync', '--dry-run']);
  expect(result.stdout).toContain('DRY RUN - No changes applied');
  // Verify no files were actually written
});

// 3. Fix: "should filter by scope when requested"
it('should filter by scope when requested', async () => {
  const result = await runCLI(['sync', '--scope', 'user']);
  // Verify only user config written, not project config
});
```

**Day 3: Platform & Environment Tests**

```typescript
// 4. Fix: "should filter MCPs by platform"
it('should filter MCPs by platform', async () => {
  // Setup config with platform-specific MCPs
  // Verify correct filtering based on current platform
});

// 5. Fix: "should expand environment variables in client configs"
it('should expand environment variables in client configs', async () => {
  process.env.TEST_API_KEY = 'secret-key-123';
  // Verify env vars are expanded in output config
});

// 6. Fix: "should apply only changed MCPs"
it('should apply only changed MCPs', async () => {
  // First sync, then second sync with no changes
  // Verify file wasn't rewritten
});
```

#### Acceptance Criteria

- [ ] All 8 skipped tests pass consistently
- [ ] No new test flakiness introduced
- [ ] Test execution time < 30s for all new tests
- [ ] Code coverage for tested modules > 90%

#### Rollback Strategy

```bash
# If tests are unstable, revert commits:
git revert <commit-hash>

# If specific test fails, re-skip temporarily with TODO:
it.skip('test name', () => { /* TODO: Re-enable after fixing #XYZ */ });
```

---

### Task 1.2: Add Test Coverage for `skill.ts`

**Priority:** HIGH  
**Effort:** 2 days

#### Current State

```
skill.ts: 0% coverage (lines 13-69 uncovered)
```

#### Implementation Steps

**Day 1: Unit Tests**

```typescript
// File: apps/cli/src/cli/commands/skill.spec.ts

describe('skill command', () => {
  describe('skill list', () => {
    it('should list all discovered skills', async () => {
      mockSkillDiscovery.discoverSkills.mockResolvedValue([
        { name: 'code-reviewer', path: '/path', source: 'global' },
        { name: 'debugger', path: '/path', source: 'project' },
      ]);

      const command = skillCommand(mockDeps);
      await command.parseAsync(['node', 'test', 'skill', 'list']);

      expect(mockOutput.log).toHaveBeenCalledWith(
        expect.stringContaining('code-reviewer'),
      );
    });

    it('should handle no skills found gracefully', async () => {
      mockSkillDiscovery.discoverSkills.mockResolvedValue([]);
      // Verify "No skills found" message
    });

    it('should show source (global/project) for each skill', async () => {
      // Verify output shows [Global] or [Project] labels
    });

    it('should format output as table', async () => {
      // Verify table format with headers
    });

    it('should handle discovery errors', async () => {
      mockSkillDiscovery.discoverSkills.mockRejectedValue(
        new Error('Permission denied'),
      );
      // Verify error is handled gracefully
    });

    it('should support --verbose flag for detailed output', async () => {
      // Verify verbose output includes file paths
    });
  });
});
```

**Day 2: Integration Tests**

```typescript
// File: apps/cli/src/cli/commands/skill.integration.spec.ts

describe('skill command integration', () => {
  it('should discover skills from actual filesystem', async () => {
    // Setup real skill files, verify discovery
  });

  it('should handle malformed YAML gracefully', async () => {
    // Setup broken YAML, verify warning but no crash
  });
});
```

#### Acceptance Criteria

- [ ] Test coverage for `skill.ts`: 0% -> 85%+
- [ ] All edge cases covered (empty, errors, filters)
- [ ] No regressions in `skill list` command

---

### Task 1.3: Extract Formatters from Command Files

**Priority:** HIGH  
**Effort:** 2 days

#### Current State

```
sync.ts: 934 lines (formatting mixed with logic)
user.ts: 619 lines (formatting mixed with logic)
```

#### Implementation Plan

**Step 1: Create Formatter Library**

```typescript
// File: libs/shared/formatters/src/lib/sync-formatter.ts

export interface SyncFormatterOptions {
  detail?: boolean;
  showDiff?: boolean;
  showMcpTable?: boolean;
}

export class SyncFormatter {
  /**
   * Formats sync result into human-readable output
   */
  format(result: SyncResult, options: SyncFormatterOptions = {}): string {
    const sections: string[] = [];

    sections.push(this.formatSummary(result));

    if (options.showMcpTable) {
      sections.push(this.formatMcpTable(result));
    }

    for (const clientResult of result.results) {
      sections.push(this.formatClientResult(clientResult, options));
    }

    if (result.warnings.length > 0) {
      sections.push(this.formatWarnings(result.warnings));
    }

    return sections.join('\n\n');
  }

  private formatSummary(result: SyncResult): string {
    /* ... */
  }
  private formatMcpTable(result: SyncResult): string {
    /* ... */
  }
  private formatClientResult(
    result: ClientSyncResult,
    options: SyncFormatterOptions,
  ): string {
    /* ... */
  }
  private formatWarnings(warnings: string[]): string {
    /* ... */
  }
}
```

**Step 2: Refactor sync.ts Command**

```typescript
// File: apps/cli/src/cli/commands/sync.ts (AFTER: ~100 lines)

import { SyncFormatter } from '@overture/formatters';

export function syncCommand(deps: AppDependencies) {
  const formatter = new SyncFormatter();

  return new Command('sync').action(async (options) => {
    const result = await deps.syncEngine.sync(options);
    const output = formatter.format(result, { detail: options.detail });
    deps.output.log(output);
  });
}
```

#### File Size Reduction

```
BEFORE:
apps/cli/src/cli/commands/sync.ts: 934 lines

AFTER:
apps/cli/src/cli/commands/sync.ts: ~100 lines (-89%)
libs/shared/formatters/src/lib/sync-formatter.ts: ~300 lines (new)
libs/shared/formatters/src/lib/sync-formatter.spec.ts: ~200 lines (new)
```

#### Acceptance Criteria

- [ ] `sync.ts` reduced to < 150 lines
- [ ] All formatting logic in separate testable class
- [ ] No behavior changes (existing tests still pass)
- [ ] New formatter has 90%+ test coverage

---

### Task 1.4: Replace Magic Numbers with Constants

**Priority:** MEDIUM  
**Effort:** 4 hours

#### Implementation Plan

**Step 1: Create Constants File**

```typescript
// File: libs/shared/utils/src/lib/formatting-constants.ts

export const TABLE_FORMATTING = {
  MIN_MCP_COLUMN_WIDTH: 15,
  SOURCE_COLUMN_WIDTH: 10,
  CLIENT_COLUMN_WIDTH: 15,
  COLUMN_SEPARATOR: ' | ',
  ROW_SEPARATOR: '-',
} as const;

export const BACKUP_RETENTION = {
  DEFAULT_RETENTION_COUNT: 10,
  MAX_RETENTION_COUNT: 100,
} as const;

export const FILE_LIMITS = {
  MAX_CONFIG_SIZE: 1_000_000,
  MAX_SKILL_SIZE: 100_000,
} as const;

export const TIMEOUTS = {
  BINARY_DETECTION_TIMEOUT: 5_000,
  PLUGIN_INSTALL_TIMEOUT: 30_000,
  SYNC_TIMEOUT: 10_000,
} as const;
```

**Step 2: Update Code**

```typescript
// BEFORE
const mcpColumnWidth = Math.max(
  15,
  ...sortedMcpNames.map((name) => name.length),
);

// AFTER
import { TABLE_FORMATTING } from '@overture/utils';
const mcpColumnWidth = Math.max(
  TABLE_FORMATTING.MIN_MCP_COLUMN_WIDTH,
  ...sortedMcpNames.map((name) => name.length),
);
```

#### Acceptance Criteria

- [ ] All hardcoded numbers > 10 extracted to constants
- [ ] Constants have descriptive names and JSDoc comments
- [ ] All tests still pass

---

## Phase 2: Structural Refactoring (Week 3-4)

**Goal:** Reduce file sizes and improve code organization  
**Duration:** 2 weeks  
**Risk Level:** MEDIUM (requires careful testing)

---

### Task 2.1: Refactor SyncEngine (Break God Object)

**Priority:** HIGH  
**Effort:** 5 days

#### Current State

```
libs/core/sync/src/lib/sync-engine.ts: 1,281 lines
Single class with 10+ responsibilities
```

#### Target Architecture

```
libs/core/sync/src/
├── lib/
│   ├── sync-orchestrator.ts          # Main orchestration (200 lines)
│   ├── services/
│   │   ├── config-service.ts         # Config loading/merging (150 lines)
│   │   ├── mcp-sync-service.ts       # MCP synchronization (200 lines)
│   │   ├── plugin-sync-service.ts    # Plugin sync (150 lines)
│   │   ├── validation-service.ts     # Pre-sync validation (100 lines)
│   │   └── backup-coordinator.ts     # Backup orchestration (100 lines)
│   └── index.ts
```

#### Implementation Plan

**Day 1: Extract ConfigService**

```typescript
// File: libs/core/sync/src/lib/services/config-service.ts

export class ConfigService {
  constructor(private deps: ConfigServiceDeps) {}

  async loadConfigurations(options: SyncOptions): Promise<{
    userConfig: OvertureConfig | null;
    projectConfig: OvertureConfig | null;
    mergedConfig: OvertureConfig;
    mcpSources: Record<string, 'global' | 'project'>;
    warnings: string[];
    projectRoot: string | null;
  }> {
    // Extract config loading logic from sync-engine
  }
}
```

**Day 2: Extract McpSyncService**

```typescript
// File: libs/core/sync/src/lib/services/mcp-sync-service.ts

export class McpSyncService {
  constructor(private deps: McpSyncServiceDeps) {}

  async syncToClient(
    client: ClientName,
    config: OvertureConfig,
    options: SyncOptions,
  ): Promise<ClientSyncResult> {
    // Extract client sync logic from sync-engine
  }

  async syncToAllClients(
    clients: ClientName[],
    config: OvertureConfig,
    options: SyncOptions,
  ): Promise<ClientSyncResult[]> {
    // Orchestrate syncing to all clients
  }
}
```

**Day 3: Create SyncOrchestrator**

```typescript
// File: libs/core/sync/src/lib/sync-orchestrator.ts

export class SyncOrchestrator {
  constructor(private deps: SyncOrchestratorDeps) {}

  async sync(options: SyncOptions): Promise<SyncResult> {
    // Step 1: Load configuration
    const configResult =
      await this.deps.configService.loadConfigurations(options);

    // Step 2: Detect clients
    const clients = await this.detectClients(options);

    // Step 3: Sync MCPs
    const mcpResults = await this.deps.mcpSyncService.syncToAllClients(
      clients,
      configResult.mergedConfig,
      options,
    );

    // Step 4-6: Sync plugins, skills, agents (optional)
    // ...

    return { success: true, results: mcpResults, warnings: [], errors: [] };
  }
}
```

**Day 4-5: Migrate Tests & Update Dependencies**

#### Migration Strategy

1. Create new files alongside sync-engine.ts
2. Extract one service at a time (start with ConfigService)
3. Write tests for each service before extraction
4. Update sync-engine.ts to use new services
5. Verify all tests pass after each extraction
6. Delete old code only when new code is proven stable

#### Rollback Strategy

```bash
# Keep both versions during migration:
libs/core/sync/src/lib/
├── sync-engine.ts           # Original (deprecated)
├── sync-orchestrator.ts     # New (active)

# After 1 sprint of stability, delete sync-engine.ts
```

#### Acceptance Criteria

- [ ] sync-engine.ts -> ~200 lines (SyncOrchestrator)
- [ ] 5 focused services, each < 250 lines
- [ ] All existing tests pass
- [ ] New tests for each service (90%+ coverage)
- [ ] No behavior changes for end users

---

### Task 2.2: Split config.types.ts (Type Organization)

**Priority:** MEDIUM  
**Effort:** 4 hours

#### Current State

```
libs/domain/config-types/src/lib/config.types.ts: 1,049 lines
```

#### Target Structure

```
libs/domain/config-types/src/lib/
├── mcp/
│   ├── mcp-server.types.ts
│   ├── mcp-client-config.types.ts
│   └── mcp-filter.types.ts
├── agent/
│   ├── agent.types.ts
│   └── agent-model.types.ts
├── sync/
│   ├── sync-options.types.ts
│   └── sync-result.types.ts
├── project/
│   └── project-metadata.types.ts
├── config.types.ts           # Main config structure (200 lines)
└── index.ts                  # Re-export everything
```

#### Acceptance Criteria

- [ ] All types split into logical categories
- [ ] No file > 300 lines
- [ ] All imports updated
- [ ] All tests pass

---

## Phase 3: Documentation & Maintenance (Week 5-6)

**Goal:** Improve documentation and set up local quality checks  
**Duration:** 2 weeks  
**Risk Level:** LOW (non-breaking changes)

---

### Task 3.1: Add JSDoc to Public APIs

**Priority:** MEDIUM  
**Effort:** 1 week

#### Scope

All public classes and methods in:

- `libs/core/**/*.ts` (7 libraries)
- `libs/adapters/**/*.ts`
- `libs/ports/**/*.ts`

#### Template

````typescript
/**
 * [One-line summary of what this class/function does]
 *
 * [Optional: 2-3 sentences of detailed explanation]
 *
 * @param paramName - Description of parameter
 * @returns Description of return value
 * @throws {ErrorType} Description of when this error is thrown
 *
 * @example
 * ```typescript
 * const service = new ServiceName(deps);
 * const result = await service.method(params);
 * ```
 *
 * @since 0.4.0
 * @public
 */
````

#### Example

````typescript
/**
 * Orchestrates the complete MCP synchronization workflow across all AI clients.
 *
 * Coordinates multiple services to load configuration, detect clients,
 * sync MCP servers, install plugins, and sync agents/skills.
 *
 * @param deps - Injected dependencies including all required services
 *
 * @example
 * ```typescript
 * const orchestrator = new SyncOrchestrator(deps);
 * const result = await orchestrator.sync({ dryRun: true });
 * ```
 *
 * @since 0.4.0
 * @public
 */
export class SyncOrchestrator {
  /* ... */
}
````

#### Acceptance Criteria

- [ ] All public classes documented (100%)
- [ ] All public methods documented (100%)
- [ ] Examples provided for complex APIs

---

### Task 3.2: Set Up Local Quality Checks

**Priority:** HIGH  
**Effort:** 1 day

#### Implementation

**Step 1: Add Pre-commit Hooks**

```bash
# Install husky and lint-staged
npm install -D husky lint-staged

# Initialize husky
npx husky init
```

```json
// package.json
{
  "lint-staged": {
    "*.ts": ["eslint --fix --max-warnings 0", "prettier --write"]
  }
}
```

```bash
# .husky/pre-commit
#!/bin/sh
npx lint-staged
```

```bash
# .husky/pre-push
#!/bin/sh
npm run test:affected
```

**Step 2: Add ESLint Rules for Maintainability**

```javascript
// eslint.config.js (add these rules)
{
  rules: {
    // Prevent overly complex functions
    'complexity': ['warn', { max: 10 }],
    'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true }],
    'max-lines': ['warn', { max: 500, skipBlankLines: true }],

    // Prevent magic numbers
    'no-magic-numbers': ['warn', {
      ignore: [0, 1, -1],
      ignoreArrayIndexes: true,
      enforceConst: true
    }],
  }
}
```

**Step 3: Add Manual Quality Check Script**

```bash
# scripts/quality-check.sh
#!/bin/bash

echo "=== Quality Check ==="

echo "Checking for files > 500 lines..."
OVERSIZED=$(find libs apps -name "*.ts" ! -name "*.spec.ts" -exec wc -l {} + | awk '$1 > 500 {print $2 " (" $1 " lines)"}')
if [ -n "$OVERSIZED" ]; then
  echo "WARNING: Files exceeding 500 lines:"
  echo "$OVERSIZED"
fi

echo "Checking for skipped tests..."
SKIPPED=$(grep -rn "\.skip\|\.only" --include="*.spec.ts" apps libs || true)
if [ -n "$SKIPPED" ]; then
  echo "WARNING: Found skipped or focused tests:"
  echo "$SKIPPED"
fi

echo "Running tests with coverage..."
nx test @overture/cli --coverage

echo "=== Quality Check Complete ==="
```

```json
// package.json
{
  "scripts": {
    "quality-check": "bash scripts/quality-check.sh"
  }
}
```

#### Acceptance Criteria

- [ ] Pre-commit hooks prevent bad commits
- [ ] ESLint rules warn about complexity
- [ ] Quality check script available for manual runs

**Note:** For future CI/CD automation, see [Future Quality Gates](./howtos/future-quality-gates.md).

---

## Success Metrics

### Code Quality Metrics

| Metric                | Before      | Target    | Measurement                        |
| --------------------- | ----------- | --------- | ---------------------------------- |
| **Test Coverage**     | 83%         | 90%+      | `nx test --coverage`               |
| **Skipped Tests**     | 8           | 0         | `grep ".skip" *.spec.ts`           |
| **Average File Size** | 584 lines   | 350 lines | `find -name "*.ts" \| xargs wc -l` |
| **Largest File**      | 1,281 lines | 500 lines | Max file in codebase               |
| **God Objects**       | 2           | 0         | Files > 800 lines                  |
| **JSDoc Coverage**    | ~30%        | 85%+      | Manual review                      |

### Velocity Metrics

| Phase     | Tasks | Estimated Days | Actual Days |
| --------- | ----- | -------------- | ----------- |
| Phase 1   | 4     | 10 days        | TBD         |
| Phase 2   | 2     | 10 days        | TBD         |
| Phase 3   | 2     | 10 days        | TBD         |
| **Total** | **8** | **30 days**    | **TBD**     |

---

## Prioritization Matrix

```
HIGH Impact, HIGH Effort:
├── Task 2.1: Refactor SyncEngine (5 days) - CRITICAL PATH
└── Task 1.1: Fix Skipped Tests (3 days) - BLOCKING

HIGH Impact, LOW Effort:
├── Task 1.2: Add skill.ts Tests (2 days) - QUICK WIN
├── Task 1.3: Extract Formatters (2 days) - QUICK WIN
└── Task 1.4: Replace Magic Numbers (0.5 days) - INSTANT WIN

MEDIUM Impact, MEDIUM Effort:
├── Task 3.1: Add JSDoc (5 days) - NICE TO HAVE
└── Task 3.2: Local Quality Checks (1 day) - AUTOMATION

LOW Impact, LOW Effort:
└── Task 2.2: Split Types (0.5 days) - CLEANUP
```

---

## Week-by-Week Breakdown

**Week 1: Quick Wins**

- Day 1-3: Fix all skipped tests (Task 1.1)
- Day 4-5: Add skill.ts tests (Task 1.2)

**Week 2: Refactoring Foundations**

- Day 1-2: Extract formatters (Task 1.3)
- Day 3: Replace magic numbers (Task 1.4)
- Day 4-5: Split config types (Task 2.2)

**Week 3-4: Major Refactoring**

- Day 1-10: Refactor SyncEngine (Task 2.1)
  - Day 1-2: Extract ConfigService
  - Day 3-4: Extract McpSyncService
  - Day 5-6: Create SyncOrchestrator
  - Day 7-8: Migrate tests
  - Day 9-10: Integration testing & cleanup

**Week 5: Documentation**

- Day 1-5: Add JSDoc to all public APIs (Task 3.1)

**Week 6: Automation & Polish**

- Day 1: Set up local quality checks (Task 3.2)
- Day 2-5: Final testing, documentation, knowledge transfer

---

## Risk Mitigation

### Risk 1: Refactoring Breaks Functionality

**Likelihood:** Medium  
**Impact:** HIGH

**Mitigation:**

1. Never delete code until new code is proven
2. Run full test suite after each change
3. Keep original classes for 1 sprint before deletion
4. Document rollback procedures

### Risk 2: Tests Become Flaky

**Likelihood:** Medium  
**Impact:** MEDIUM

**Mitigation:**

1. Run tests 10x before merging
2. Use deterministic test data
3. Mock all external dependencies

### Risk 3: Developer Velocity Slows Down

**Likelihood:** High  
**Impact:** LOW

**Mitigation:**

1. Pair programming for complex refactorings
2. Knowledge sharing sessions
3. Create migration guides

---

## Definition of Done

Each task must meet ALL criteria:

### Code Quality

- [ ] All affected tests pass
- [ ] No new ESLint warnings
- [ ] Test coverage maintained or improved
- [ ] No skipped tests (`.skip()`)

### Documentation

- [ ] Public APIs have JSDoc comments
- [ ] README updated if behavior changed
- [ ] CHANGELOG.md entry added

### Code Review

- [ ] Peer reviewed
- [ ] All review comments addressed

---

## Completion Checklist

### Phase 1 Complete When:

- [ ] All 8 skipped tests are passing
- [ ] skill.ts has 85%+ test coverage
- [ ] Command files use extracted formatters
- [ ] No magic numbers in code
- [ ] Config types split into logical files

### Phase 2 Complete When:

- [ ] SyncEngine refactored into <5 services
- [ ] No files > 500 lines
- [ ] All services have 90%+ test coverage

### Phase 3 Complete When:

- [ ] All public APIs have JSDoc (85%+)
- [ ] Local quality checks configured
- [ ] Team trained on new practices

### Project Complete When:

- [ ] All success metrics achieved
- [ ] Retrospective completed

---

## Related Documentation

- [Future Quality Gates](./howtos/future-quality-gates.md) - CI/CD automation for when budget allows
- [Architecture Documentation](./contributing/architecture.md) - Technical design patterns
- [User Guide](./user-guide.md) - End-user documentation

---

**Document Version:** 1.0  
**Created:** 2026-01-05  
**Status:** Ready for Execution
