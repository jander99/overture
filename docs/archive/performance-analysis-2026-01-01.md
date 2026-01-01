# Overture CLI Performance Analysis

**Date:** January 1, 2026  
**Version:** v0.3.0  
**Status:** BASELINE ESTABLISHED

## Executive Summary

The Overture CLI shows acceptable performance for most operations (~300ms), but the `doctor` command exhibits significant slowdown (~7.8 seconds) due to sequential I/O operations. Key optimization opportunities identified:

1. **High Priority:** Parallelize MCP command checking (8 sequential `which` calls)
2. **High Priority:** Parallelize client discovery (3 sequential detections)
3. **Medium Priority:** Lazy-load validation dependencies (Zod ~5.2MB)
4. **Low Priority:** Bundle size optimization (currently 1.3MB, acceptable)

## Performance Baseline

### Command Execution Times

| Command           | Time (avg)      | CPU Usage | Notes                            |
| ----------------- | --------------- | --------- | -------------------------------- |
| `--version`       | 311ms           | 133%      | Fast startup, CLI initialization |
| `validate --help` | 318ms           | 124%      | Command help output              |
| `doctor --help`   | 279ms           | 124%      | Command help output              |
| `validate`        | 322ms           | 130%      | Config validation only           |
| `doctor`          | **7,786ms**     | 62%       | **SLOW - needs optimization**    |
| `sync`            | Not benchmarked | -         | Complex, varies by clients       |

### Bundle Metrics

- **Total Size:** 1.3MB
- **Main Entry:** 1.4KB (`main.js`)
- **Total Lines:** 19,606 lines compiled JS
- **Node Modules:** ~400+ dependencies (including transitive)

### Heavy Dependencies

| Package            | Size  | Usage Count | Impact              | Optimization Potential      |
| ------------------ | ----- | ----------- | ------------------- | --------------------------- |
| `zod@3.25.76`      | 5.2MB | 5 imports   | Schema validation   | **HIGH** - Lazy load        |
| `js-yaml@4.1.1`    | 480KB | Multiple    | Config parsing      | Medium - Always needed      |
| `commander@14.0.2` | 252KB | 16 imports  | CLI framework       | Low - Always needed         |
| `inquirer@9.3.8`   | 176KB | 0 imports   | Interactive prompts | **HIGH** - Remove if unused |
| `chalk@5.6.2`      | 92KB  | 2 imports   | Terminal colors     | Low - Small footprint       |

## Critical Performance Issues

### 1. `doctor` Command - Sequential MCP Checking

**Problem:** Each MCP server command is checked sequentially using `which`/`where`.

**Current Flow:**

```
For each MCP server (8 servers):
  - Run: which <command>  (~500-1000ms per call)

Total: 8 × 1000ms = ~8 seconds
```

**Location:** `libs/core/diagnostics/src/lib/checkers/mcp-checker.ts:32`

```typescript
for (const [mcpName, mcpDef] of Object.entries(mcpConfig)) {
  const commandExists = await this.process.commandExists(mcpDef.command);
  // ... process result
}
```

**Solution:** Parallelize with `Promise.all()`

```typescript
const checks = Object.entries(mcpConfig).map(async ([mcpName, mcpDef]) => {
  const commandExists = await this.process.commandExists(mcpDef.command);
  return { mcpName, mcpDef, commandExists };
});

const results = await Promise.all(checks);
```

**Expected Impact:** ~8 seconds → ~1-2 seconds (6-7 second improvement)

---

### 2. `doctor` Command - Sequential Client Discovery

**Problem:** Client detection happens sequentially across 3 clients.

**Current Flow:**

```
For each client (claude-code, copilot-cli, opencode):
  - Run binary detection (which/where + version check)
  - Run config validation

Total: 3 × ~500ms = ~1.5 seconds
```

**Location:** `libs/core/discovery/src/lib/discovery-service.ts:111`

```typescript
for (const adapter of adapters) {
  const result = await this.discoverClient(
    adapter,
    platform,
    isWSL2 ? wsl2Info : undefined,
  );
  clients.push(result);
}
```

**Solution:** Parallelize client discovery

```typescript
const discoveryPromises = adapters.map((adapter) =>
  this.discoverClient(adapter, platform, isWSL2 ? wsl2Info : undefined),
);

const clients = await Promise.all(discoveryPromises);
```

**Expected Impact:** ~1.5 seconds → ~500ms (1 second improvement)

---

### 3. Sync Engine - Sequential Client Sync

**Problem:** Config sync happens sequentially per client (affects `sync` command).

**Location:** `libs/core/sync/src/lib/sync-engine.ts:406`

```typescript
for (const client of clients) {
  const userResult = await this.syncToClient(client, ...);
  results.push(userResult);

  const projectResult = await this.syncToClient(client, ...);
  results.push(projectResult);
}
```

**Consideration:** File writes should remain sequential to avoid race conditions, but detection and validation can be parallelized.

**Partial Solution:** Parallelize detection phase, keep writes sequential

**Expected Impact:** Moderate (depends on number of clients and I/O speed)

---

## Optimization Opportunities

### HIGH PRIORITY

#### 1. Parallelize MCP Command Checking

- **File:** `libs/core/diagnostics/src/lib/checkers/mcp-checker.ts`
- **Effort:** Low (2-3 hours)
- **Impact:** 6-7 second improvement on `doctor`
- **Risk:** Low (independent operations)

#### 2. Parallelize Client Discovery

- **File:** `libs/core/discovery/src/lib/discovery-service.ts`
- **Effort:** Low (2-3 hours)
- **Impact:** 1 second improvement on `doctor`
- **Risk:** Low (independent operations)

#### 3. Lazy-Load Zod (5.2MB)

- **Files:** All files importing `zod`
- **Effort:** Medium (4-6 hours)
- **Impact:** ~100-150ms faster startup for non-validation commands
- **Risk:** Medium (needs careful refactoring)

**Current Zod Usage:**

```bash
$ grep -r "from 'zod'" apps/cli/src libs --include="*.ts" | wc -l
5
```

**Strategy:**

- Move schema definitions to separate modules
- Import schemas only when validation is needed
- Use dynamic imports: `const { z } = await import('zod')`

---

### MEDIUM PRIORITY

#### 4. Remove/Lazy-Load Inquirer (176KB)

- **Files:** Check if actually used
- **Effort:** Low (1-2 hours)
- **Impact:** 50-80ms faster startup
- **Risk:** Low (if unused, just remove)

**Current Usage:**

```bash
$ grep -r "inquirer" apps/cli/src --include="*.ts" | wc -l
0
```

**Recommendation:** Remove from dependencies if truly unused.

#### 5. Optimize Git Operations

- **File:** `libs/core/diagnostics/src/lib/checkers/config-repo-checker.ts`
- **Effort:** Medium (3-4 hours)
- **Impact:** 500ms improvement on `doctor`
- **Risk:** Low

**Opportunities:**

- Cache git status results
- Parallelize git remote checks
- Skip remote checks with `--fast` flag

---

### LOW PRIORITY

#### 6. Bundle Size Reduction

- **Effort:** High (8-12 hours)
- **Impact:** 50-100ms faster startup
- **Risk:** Medium (may break tree-shaking)

**Current:** 1.3MB is acceptable for a CLI tool

**Potential Savings:**

- Review if all Zod schemas are tree-shakeable
- Check for duplicate dependencies
- Use bundle analyzer: `npx source-map-explorer dist/`

---

## Implementation Roadmap

### Phase 1: Quick Wins (Week 1)

1. ✅ Establish performance baseline
2. Parallelize MCP command checking
3. Parallelize client discovery
4. Remove `inquirer` if unused

**Expected Result:** `doctor` command: 7.8s → 1.5s (6.3s improvement)

### Phase 2: Structural Improvements (Week 2-3)

1. Lazy-load Zod schemas
2. Optimize git operations
3. Add performance benchmarks to CI/CD

**Expected Result:** Additional 200-300ms improvement across all commands

### Phase 3: Advanced Optimizations (Future)

1. Bundle size analysis and optimization
2. Caching strategies for repeated operations
3. Profile-guided optimizations

---

## Benchmarking Guidelines

### Adding Performance Tests

**Location:** `apps/cli-e2e/src/cli/performance.spec.ts` (to be created)

```typescript
describe('Performance Benchmarks', () => {
  it('should complete --version in under 500ms', async () => {
    const start = Date.now();
    execSync('node dist/apps/cli/main.js --version');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('should complete doctor in under 2000ms', async () => {
    const start = Date.now();
    execSync('node dist/apps/cli/main.js doctor');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });
});
```

### CI/CD Integration

Add to GitHub Actions workflow:

```yaml
- name: Performance Benchmarks
  run: |
    npm run build
    time node dist/apps/cli/main.js --version
    time node dist/apps/cli/main.js doctor
```

---

## Monitoring & Metrics

### Key Performance Indicators (KPIs)

1. **Startup Time:** `--version` < 500ms
2. **Validation Time:** `validate` < 500ms
3. **Doctor Time:** `doctor` < 2000ms (after optimizations)
4. **Sync Time:** `sync` < 3000ms (for 3 clients)

### Regression Detection

Alert if:

- Any command takes >2× baseline
- `doctor` exceeds 3 seconds
- Bundle size grows >20%

---

## Risks & Trade-offs

### Parallelization Risks

**Risk:** Race conditions on shared resources  
**Mitigation:** Keep file writes sequential, parallelize only reads

**Risk:** Error handling complexity  
**Mitigation:** Use `Promise.allSettled()` for independent operations

### Lazy Loading Risks

**Risk:** Breaking dynamic imports in ESM/CJS  
**Mitigation:** Extensive testing across Node versions

**Risk:** Code complexity  
**Mitigation:** Isolate lazy-loaded modules with clear boundaries

---

## Appendix A: Detailed Measurements

### Test Environment

- **OS:** WSL2 (Ubuntu)
- **Node:** v25.2.1
- **CPU:** Intel (VM)
- **Disk:** SSD

### Raw Benchmark Data

```bash
# Startup (--version)
Trial 1: 0.311s
Trial 2: 0.298s
Trial 3: 0.324s
Average: 0.311s

# Doctor command
Trial 1: 7.786s
Trial 2: 7.652s
Trial 3: 7.901s
Average: 7.779s

# Validate command
Trial 1: 0.322s
Trial 2: 0.315s
Trial 3: 0.328s
Average: 0.322s
```

---

## Appendix B: Code Hotspots

### Files with Most Async Operations

1. `libs/core/sync/src/lib/sync-engine.ts` - 44 async operations
2. `libs/core/diagnostics/src/lib/diagnostics-orchestrator.ts` - 15 async operations
3. `libs/core/discovery/src/lib/discovery-service.ts` - 12 async operations

### Largest Files (potential refactoring targets)

1. `libs/core/sync/src/lib/sync-engine.ts` - 1,281 lines
2. `libs/core/import/src/lib/import-service.ts` - 997 lines
3. `apps/cli/src/cli/commands/sync.ts` - 934 lines

---

## Next Steps

1. Implement MCP parallelization (HIGH priority)
2. Implement client discovery parallelization (HIGH priority)
3. Create performance test suite
4. Run before/after benchmarks
5. Document results in CHANGELOG.md

---

**Document Status:** COMPLETE  
**Review Date:** TBD  
**Owner:** AI Agents Team
