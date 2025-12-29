# Cognitive Complexity - Quick Reference

## Function-by-Function Summary

| # | File | Function | Line | Complexity | Status | Strategy | Effort | Priority |
|---|------|----------|------|-----------|--------|----------|--------|----------|
| 1 | doctor.ts | action handler | 91 | 226 | 🔴 CRITICAL | Extract phase handlers + formatter | HIGH (16h) | P1 |
| 2 | sync.ts | action handler | 180 | 201 | 🔴 CRITICAL | Extract formatter + processor | HIGH (18h) | P1 |
| 3 | validate.ts | action handler | 65 | 125 | 🟠 HIGH | Extract validators + reporter | MEDIUM (12h) | P2 |
| 4 | user.ts | init subcommand | 356 | 67 | 🟠 HIGH | Extract wizard pattern | MEDIUM (8h) | P2 |
| 5 | cleanup.ts | createCommand | 28 | 29 | 🟡 MEDIUM | Inline helpers | MEDIUM (4h) | P3 |
| 6 | cleanup.ts | action handler | 103 | 17 | 🟡 MEDIUM | Inline helpers | MEDIUM (3h) | P3 |
| 7 | import.ts | action handler | 48 | 30 | 🟡 MEDIUM | Extract modes | MEDIUM (5h) | P3 |
| 8 | mcp.ts | createCommand | 25 | 21 | 🟢 LOW | Inline helpers | LOW (2h) | P3 |
| 9 | mcp.ts | enable action | 152 | 21 | 🟢 LOW | Inline helpers | LOW (2h) | P3 |
| 10 | plugin-list.ts | action handler | 34 | 27 | 🟢 LOW | Inline formatter | LOW (2h) | P3 |
| 11 | skill.ts | cp action | 83 | 16 | 🟢 LOW | Keep as-is + comments | LOW (1h) | - |
| 12 | sync.ts | generateMcpTable | 83 | 16 | 🟢 LOW | Keep as-is + comments | LOW (1h) | - |
| 13 | user.ts | show action | 148 | 18 | 🟢 LOW | Inline helpers | LOW (1h) | - |
| 14 | env-var-validator.ts | validateEnvVarReferences | 73 | 22 | 🟢 LOW | Simplify nesting | LOW (2h) | - |
| 15 | env-var-validator.ts | getFixSuggestion | 89 | 27 | ❌ FALSE POSITIVE | None | NONE (0h) | - |

## Critical Functions Detail

### 1. doctor.ts:91 (Complexity 226)
**Root Cause:** Monolithic 550-line function mixing 8 phases
- Config repo detection (50 lines)
- Git status checking (60 lines)
- Skills directory scanning (30 lines)
- Client discovery (25 lines)
- MCP server checking (50 lines)
- JSON/text output formatting (300+ lines)
- Summary reporting (30 lines)

**Solution:** Extract DoctorPhaseHandler + DoctorOutputFormatter

### 2. sync.ts:180 (Complexity 201)
**Root Cause:** Monolithic 450-line function mixing 4 phases + complex output
- Phase 1: Detection summary (80 lines)
- Phase 2: Sync execution (150 lines)
- Phase 3: Warnings aggregation (100 lines)
- Phase 4: Backup info (50 lines)

**Specific Issues:**
- Triple-nested loop for client deduplication (20 lines)
- Complex warning categorization with dual branches
- Conditional diff formatting throughout

**Solution:** Extract SyncOutputFormatter + SyncResultProcessor

### 3. validate.ts:65 (Complexity 125)
**Root Cause:** 345-line function with nested validation loops
- Main MCP validation loop (80 lines) with 5 nested conditions
- Platform/client validation sub-loops
- Duplicate detection logic
- Transport/environment validation for each client

**Solution:** Extract McpValidator + ConfigValidator + ValidationReporter

### 4. user.ts:356 (Complexity 67)
**Root Cause:** 215-line init subcommand with sequential flow control
- MCP selection prompt + validation (30 lines)
- Config assembly with conditionals (20 lines)
- Validation + confirmation (20 lines)
- File system operations (20 lines)
- Output formatting (30 lines)

**Solution:** Extract UserInitWizard class

## Effort Estimates by Phase

### Phase 1: Critical Functions
| Task | Hours | Status |
|------|-------|--------|
| doctor.ts refactoring | 16 | Planned |
| sync.ts refactoring | 18 | Planned |
| Test suite creation | 10 | Planned |
| Code review & iteration | 8 | Planned |
| **Total Phase 1** | **52** | **Estimated** |

### Phase 2: High-Priority Functions
| Task | Hours | Status |
|------|-------|--------|
| validate.ts refactoring | 12 | Deferred |
| user.ts refactoring | 8 | Deferred |
| Test suite creation | 8 | Deferred |
| Code review & iteration | 4 | Deferred |
| **Total Phase 2** | **32** | **Estimated** |

### Phase 3: Medium/Low Functions
| Task | Hours | Status |
|------|-------|--------|
| Inline helpers (6 functions) | 12 | Deferred |
| Comments & documentation | 4 | Deferred |
| False positive suppressions | 1 | Deferred |
| **Total Phase 3** | **17** | **Estimated** |

## Refactoring Patterns Summary

### Pattern 1: Phase Handlers
**Use:** doctor.ts, sync.ts  
**Creates:** Separate handler class with methods for each phase  
**Benefit:** ~30% complexity reduction, independent testability

```typescript
class DoctorPhaseHandler {
  async detectConfigRepo(): Promise<ConfigRepoStatus>
  async detectGitStatus(repoPath: string): Promise<GitStatus>
  async scanSkillsDirectory(skillsPath: string): Promise<SkillCount>
  // ... etc
}
```

### Pattern 2: Output Formatters
**Use:** doctor.ts, sync.ts, validate.ts  
**Creates:** Separate formatter class for output  
**Benefit:** Reusable, testable, separated from logic

```typescript
class DoctorOutputFormatter {
  formatEnvironmentInfo(): void
  formatConfigRepoStatus(): void
  formatClientDetections(): void
  // ... etc
}
```

### Pattern 3: Validators
**Use:** validate.ts  
**Creates:** Separate validator classes for different validation concerns  
**Benefit:** Single responsibility, reusable

```typescript
class McpValidator { validateCommand(), validateTransport(), ... }
class ConfigValidator { validateDuplicateNames(), validateSyncConfig(), ... }
```

### Pattern 4: Wizard Pattern
**Use:** user.ts  
**Creates:** Step-by-step wizard class  
**Benefit:** Clear flow, independently testable steps

```typescript
class UserInitWizard {
  async selectMcpServers(): Promise<string[]>
  async buildMcpConfig(selectedMcps): Promise<McpConfig>
  async confirmAndCreate(config): Promise<boolean>
  // ... etc
}
```

## False Positives & Exceptions

### env-var-validator.ts:89 - getFixSuggestion
- **Reported Complexity:** 27
- **Actual Function Size:** 16 lines
- **Status:** FALSE POSITIVE - No refactoring needed
- **Reason:** Simple string formatting function, appears complex due to multi-line string literal

## Testing Strategy

### Unit Tests Required
- 20+ tests per extracted validator class
- 10+ tests per extracted formatter class
- 15+ tests per extracted handler/processor
- **Total: 100+ new test cases**

### Coverage Goals
- Current: 83%
- After Phase 1: 88%
- After Phase 2: 92%
- Final target: 90%+

## Recommendations

### For Team Lead
1. Schedule Phase 1 refactoring (1 week)
2. Allocate 2 engineers for extraction work
3. Plan code review schedule (2-3 days)
4. Update architecture documentation

### For Developers Starting Refactoring
1. Read full COGNITIVE_COMPLEXITY_ANALYSIS.md
2. Start with doctor.ts (clearest pattern)
3. Follow with sync.ts (similar pattern)
4. Create reusable component library
5. Use patterns for Phase 2

### For Code Reviewers
1. Verify all phases/concerns are properly separated
2. Check for consistent naming patterns
3. Ensure test coverage (20+ per component)
4. Review composition over inheritance
5. Validate error handling

## Quick Links

- **Full Analysis:** docs/COGNITIVE_COMPLEXITY_ANALYSIS.md
- **ESLint Config:** eslint.config.mjs
- **Test Files:** apps/cli/src/cli/commands/*.spec.ts
- **Phase 1 Detail:** COGNITIVE_COMPLEXITY_ANALYSIS.md#phase-1
- **Patterns Guide:** COGNITIVE_COMPLEXITY_ANALYSIS.md#refactoring-principles

