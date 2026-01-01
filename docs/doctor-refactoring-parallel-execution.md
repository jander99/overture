# Doctor Refactoring - Parallel Execution Guide

**Quick Reference for Parallel Implementation**

---

## TL;DR

- **Sequential Time:** 47.5 hours (~6 days)
- **Parallel Time:** 19 hours (~2.5 days)
- **Time Savings:** 60%
- **Workstreams:** 6 parallel + 1 sequential foundation
- **Critical Path:** Phase 1 → WS-A3 → Integration → Phase 4 → Phase 5 → E2E

---

## Visual Timeline

```
Hour 0 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Hour 19

├─ Phase 1: Foundation (1.5h) ─┤
                                │
                                ├─ WS-A1: ConfigRepo + Skills (6h) ──────┤
                                ├─ WS-A2: Agents (5h) ─────────────┤
                                ├─ WS-A3: Clients + MCP (6.5h) ──────────┤ ← CRITICAL
                                ├─ WS-B1: Env + ConfigRepo Format (5h) ──┤
                                ├─ WS-B2: Clients + MCP Format (4h) ─┤
                                ├─ WS-B3: Summary + Helpers (4.5h) ────┤
                                                                         │
                                                                         ├─ Integrate (0.5h) ─┤
                                                                                               │
                                                                                               ├─ Phase 4: Orchestrator (5h) ─────┤
                                                                                                                                   │
                                                                                                                                   ├─ Phase 5: doctor.ts (3.5h) ──┤
                                                                                                                                                                  │
                                                                                                                                                                  ├─ E2E (2h) ─┤
```

---

## Workstream Assignments

### 🟦 Workstream A1: Core Checkers - Config & Skills

**Owner:** Agent 1  
**Duration:** 6 hours  
**Start:** After Phase 1 complete

**Tasks:**

1. Create `ConfigRepoChecker` class (2h)
   - File: `libs/core/diagnostics/src/lib/checkers/config-repo-checker.ts`
   - Check config repo existence
   - Check git status
   - Get remote hash and sync status
2. Create `SkillsChecker` class (1h)
   - File: `libs/core/diagnostics/src/lib/checkers/skills-checker.ts`
   - Count skills in skills directory

3. Write `ConfigRepoChecker` tests (2h)
   - File: `libs/core/diagnostics/src/lib/checkers/config-repo-checker.spec.ts`
   - Cover all methods and error cases

4. Write `SkillsChecker` tests (1h)
   - File: `libs/core/diagnostics/src/lib/checkers/skills-checker.spec.ts`
   - Cover counting logic

**Deliverables:**

- ✅ 2 checker classes implemented
- ✅ 2 test files with 85%+ coverage
- ✅ All tests passing

---

### 🟩 Workstream A2: Core Checkers - Agents

**Owner:** Agent 2  
**Duration:** 5 hours  
**Start:** After Phase 1 complete

**Tasks:**

1. Create `AgentsChecker` class (2h)
   - File: `libs/core/diagnostics/src/lib/checkers/agents-checker.ts`
   - Check global and project agents
   - Validate YAML/MD pairs
   - Validate models.yaml

2. Write `AgentsChecker` tests (3h)
   - File: `libs/core/diagnostics/src/lib/checkers/agents-checker.spec.ts`
   - Cover all validation logic
   - Test error scenarios

**Deliverables:**

- ✅ 1 checker class implemented
- ✅ 1 test file with 85%+ coverage
- ✅ All tests passing

---

### 🟨 Workstream A3: Core Checkers - Clients & MCP ⚠️ CRITICAL PATH

**Owner:** Agent 3  
**Duration:** 6.5 hours  
**Start:** After Phase 1 complete

**Tasks:**

1. Create `ClientsChecker` class (2h)
   - File: `libs/core/diagnostics/src/lib/checkers/clients-checker.ts`
   - Check all installed clients
   - Validate config files

2. Create `McpChecker` class (1h)
   - File: `libs/core/diagnostics/src/lib/checkers/mcp-checker.ts`
   - Check MCP server availability

3. Write `ClientsChecker` tests (2h)
   - File: `libs/core/diagnostics/src/lib/checkers/clients-checker.spec.ts`
   - Cover detection logic

4. Write `McpChecker` tests (1.5h)
   - File: `libs/core/diagnostics/src/lib/checkers/mcp-checker.spec.ts`
   - Cover availability checks

**Deliverables:**

- ✅ 2 checker classes implemented
- ✅ 2 test files with 85%+ coverage
- ✅ All tests passing

---

### 🟪 Workstream B1: Formatters - Environment & ConfigRepo

**Owner:** Agent 4  
**Duration:** 5 hours  
**Start:** After Phase 1 complete

**Tasks:**

1. Create `EnvironmentFormatter` class (1h)
   - File: `libs/shared/formatters/src/lib/formatters/environment-formatter.ts`
   - Format environment information

2. Create `ConfigRepoFormatter` class (3h)
   - File: `libs/shared/formatters/src/lib/formatters/config-repo-formatter.ts`
   - Format config repo status
   - Format git status
   - Format skills/agents status

3. Write formatter tests (1h)
   - Test output formatting

**Deliverables:**

- ✅ 2 formatter classes implemented
- ✅ Tests with 80%+ coverage
- ✅ All tests passing

---

### 🟧 Workstream B2: Formatters - Clients & MCP

**Owner:** Agent 5  
**Duration:** 4 hours  
**Start:** After Phase 1 complete

**Tasks:**

1. Create `ClientsFormatter` class (2h)
   - File: `libs/shared/formatters/src/lib/formatters/clients-formatter.ts`
   - Format client detection results

2. Create `McpFormatter` class (1h)
   - File: `libs/shared/formatters/src/lib/formatters/mcp-formatter.ts`
   - Format MCP server results

3. Write formatter tests (1h)
   - Test output formatting

**Deliverables:**

- ✅ 2 formatter classes implemented
- ✅ Tests with 80%+ coverage
- ✅ All tests passing

---

### 🟥 Workstream B3: Formatters - Summary & Helpers

**Owner:** Agent 6  
**Duration:** 4.5 hours  
**Start:** After Phase 1 complete

**Tasks:**

1. Create `SummaryFormatter` class (3h)
   - File: `libs/shared/formatters/src/lib/formatters/summary-formatter.ts`
   - Format complete diagnostic summary
   - Generate recommendations

2. Create `RecommendationsHelper` utility (0.5h)
   - File: `libs/shared/formatters/src/lib/helpers/recommendations.ts`
   - Installation recommendations
   - MCP command recommendations

3. Write formatter tests (1h)
   - Test summary output

**Deliverables:**

- ✅ 1 formatter class implemented
- ✅ 1 helper utility implemented
- ✅ Tests with 80%+ coverage
- ✅ All tests passing

---

## Execution Steps

### Step 0: Preparation (5 minutes)

```bash
# Create feature branch
git checkout -b feat/doctor-refactoring

# Tag current state for rollback
git tag pre-doctor-refactor

# Ensure all dependencies installed
npm install
```

---

### Step 1: Foundation (1.5 hours)

**Executor:** Single agent or developer  
**Dependencies:** None

```bash
# Create diagnostics-types library
nx g @nx/js:library diagnostics-types \
  --directory=libs/domain \
  --importPath=@overture/diagnostics-types \
  --unitTestRunner=vitest \
  --bundler=tsc \
  --strict
```

**Tasks:**

1. Define all type interfaces (30 min)
2. Export types from index (5 min)
3. Add unit tests (30 min)
4. Verify build (5 min)

**Verification:**

```bash
nx build @overture/diagnostics-types
nx test @overture/diagnostics-types
```

**Signal to all agents:** Phase 1 complete ✅

---

### Step 2: Launch Parallel Workstreams (6.5 hours)

**Executor:** 6 agents in parallel  
**Dependencies:** Phase 1 complete

**Agent 1:** Execute Workstream A1  
**Agent 2:** Execute Workstream A2  
**Agent 3:** Execute Workstream A3 (critical path)  
**Agent 4:** Execute Workstream B1  
**Agent 5:** Execute Workstream B2  
**Agent 6:** Execute Workstream B3

**Completion criteria:** All agents report completion

**Verification (run after all agents complete):**

```bash
# Verify all new files created
ls -la libs/core/diagnostics/src/lib/checkers/
ls -la libs/shared/formatters/src/lib/formatters/

# Verify builds
nx build @overture/diagnostics-core
nx build @overture/formatters

# Verify tests
nx test @overture/diagnostics-core
nx test @overture/formatters
```

---

### Step 3: Integration Checkpoint (0.5 hours)

**Executor:** Single agent  
**Dependencies:** All workstreams complete

**Tasks:**

1. Export all checkers (5 min)
   - Update `libs/core/diagnostics/src/lib/checkers/index.ts`
2. Update diagnostics dependencies (10 min)
   - Update `libs/core/diagnostics/package.json`
3. Export all formatters (5 min)
   - Update `libs/shared/formatters/src/lib/formatters/index.ts`
4. Update formatters dependencies (10 min)
   - Update `libs/shared/formatters/package.json`

**Verification:**

```bash
nx build @overture/diagnostics-core
nx build @overture/formatters
nx run-many -t lint --projects=@overture/diagnostics-core,@overture/formatters
```

---

### Step 4: Build Orchestrator (5 hours)

**Executor:** Single agent  
**Dependencies:** Integration checkpoint complete

**Tasks:**

1. Create `DiagnosticsOrchestrator` class (4h)
   - File: `libs/core/diagnostics/src/lib/diagnostics-orchestrator.ts`
   - Coordinate all checkers
   - Build complete result
   - Handle all errors gracefully

2. Create factory function (1h)
   - File: `libs/core/diagnostics/src/lib/create-diagnostics-orchestrator.ts`
   - Wire up all dependencies

3. Update diagnostics exports (5 min)
   - Export orchestrator from index

4. Write orchestrator tests (included in 4h)
   - Integration tests for orchestration

**Verification:**

```bash
nx build @overture/diagnostics-core
nx test @overture/diagnostics-core
```

---

### Step 5: Simplify doctor.ts (3.5 hours)

**Executor:** Single agent  
**Dependencies:** Phase 4 complete

**Tasks:**

1. Remove all extracted code from doctor.ts (30 min)
   - Delete lines 30-1726
2. Refactor `createDoctorCommand` (2h)
   - Use orchestrator
   - Use formatters
   - Simplify to ~100 lines

3. Update composition-root.ts (1h)
   - Wire up diagnostics orchestrator
   - Create formatters

4. Update CLI dependencies (10 min)
   - Add new dependencies to package.json

**Verification:**

```bash
nx build @overture/cli
nx test @overture/cli
```

---

### Step 6: End-to-End Tests (2 hours)

**Executor:** Single agent  
**Dependencies:** Phase 5 complete

**Tasks:**

1. Write E2E tests (2h)
   - File: `apps/cli-e2e/src/cli/doctor.e2e.spec.ts`
   - Test full doctor command
   - Test all CLI options

**Verification:**

```bash
nx test cli-e2e
```

---

### Step 7: Final Verification (30 minutes)

**Executor:** Single agent or developer

```bash
# Run all tests
nx run-many -t test --all

# Build everything
nx run-many -t build --all

# Lint everything
nx run-many -t lint --all

# Manual smoke tests
overture doctor
overture doctor --json
overture doctor --verbose
overture doctor --wsl2
```

---

## Success Criteria

### Code Quality ✅

- [ ] 94% reduction in doctor.ts file size (1,727 → 100 lines)
- [ ] 80%+ test coverage on all new libraries
- [ ] Zero TypeScript errors
- [ ] Zero ESLint errors
- [ ] All existing tests pass

### Functionality ✅

- [ ] doctor command behavior unchanged (user-facing)
- [ ] All CLI options work: --json, --verbose, --wsl2
- [ ] WSL2 detection still works
- [ ] Error handling maintains "never fail" principle
- [ ] Sequential execution preserved

### Parallel Execution ✅

- [ ] All workstreams completed independently
- [ ] No file conflicts or merge issues
- [ ] Integration checkpoint successful
- [ ] Total elapsed time ≤ 19 hours

---

## Troubleshooting

### Workstream Blocked

**Symptom:** Agent reports dependency missing  
**Cause:** Phase 1 not complete or published  
**Solution:**

```bash
# Verify Phase 1 complete
nx build @overture/diagnostics-types
nx test @overture/diagnostics-types

# Re-sync dependencies
npm install
```

### Build Failures After Integration

**Symptom:** `nx build` fails after integration checkpoint  
**Cause:** Missing exports or dependencies  
**Solution:**

```bash
# Check exports
cat libs/core/diagnostics/src/lib/checkers/index.ts
cat libs/shared/formatters/src/lib/formatters/index.ts

# Check dependencies
cat libs/core/diagnostics/package.json
cat libs/shared/formatters/package.json
```

### Test Coverage Below Target

**Symptom:** Coverage < 80%  
**Cause:** Missing test cases  
**Solution:** Review coverage report and add missing tests

```bash
nx test @overture/diagnostics-core --coverage
nx test @overture/formatters --coverage
```

---

## Timeline Comparison

### Sequential Execution

```
Day 1: Phase 1 + Phase 2 (partial)
Day 2: Phase 2 (complete) + Phase 3 (partial)
Day 3: Phase 3 (complete) + Phase 4
Day 4: Phase 5 + Phase 6 (partial)
Day 5: Phase 6 (continue)
Day 6: Phase 6 (complete) + verification
```

**Total: 6 days**

### Parallel Execution (6 Workstreams)

```
Day 1 (8 hours):
  - Hour 1-1.5: Phase 1 (Foundation)
  - Hour 1.5-8: All 6 workstreams in parallel

Day 2 (8 hours):
  - Hour 8-8.5: Integration checkpoint
  - Hour 8.5-13.5: Phase 4 (Orchestrator)

Day 3 (6.5 hours):
  - Hour 13.5-17: Phase 5 (doctor.ts)
  - Hour 17-19: E2E tests
  - Final verification
```

**Total: 2.5 days (60% faster)**

---

**Last Updated:** December 31, 2025  
**Status:** Ready for parallel execution  
**Recommended Approach:** 6 parallel workstreams for maximum efficiency
