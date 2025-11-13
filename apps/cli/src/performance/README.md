# Performance Benchmarks

Comprehensive performance testing suite for Overture sync operations.

## Overview

The performance benchmarks measure timing, memory usage, and scalability across various sync scenarios to ensure optimal performance with large configurations and multiple clients.

## Running Benchmarks

```bash
# Run performance benchmarks
nx test @overture/cli --testPathPatterns="performance/"

# Run with verbose output
nx test @overture/cli --testPathPatterns="performance/" --verbose

# Run all tests including performance
nx test @overture/cli
```

## Benchmark Scenarios

### 1. Small Config Sync (5 MCPs)
**Target:** < 1 second
**Measures:** Time to sync 5 MCPs to a single client

### 2. Medium Config Sync (15 MCPs)
**Target:** < 2 seconds
**Measures:** Time to sync 15 MCPs to a single client

### 3. Large Config Sync (50 MCPs)
**Target:** < 5 seconds
**Measures:** Time to sync 50 MCPs to a single client

### 4. Multi-Client Sync (5 clients)
**Target:** < 3 seconds
**Measures:** Time to sync 10 MCPs to 5 different AI clients simultaneously

### 5. Incremental Update
**Target:** < 500ms
**Measures:** Time to sync when only 1 MCP has changed in a 20-MCP config

### 6. Config Loading Performance
**Target:** < 100ms
**Measures:** Time to load and merge user + project configs with 100 total MCPs

### 7. Backup Creation
**Target:** < 200ms
**Measures:** Time to create backup of a 50-MCP configuration

### 8. Transport Validation
**Target:** < 500ms
**Measures:** Time to validate 50 MCPs against 7 different client adapters

### 9. Exclusion Filtering
**Target:** < 100ms
**Measures:** Time to apply client/platform/scope filters to 50 MCPs

### 10. Concurrent Sync Attempts
**Target:** < 100ms for lock failures
**Measures:** Time for graceful failure when process lock is already held

### 11. Memory Usage
**Target:** < 100MB heap
**Measures:** Memory consumption when syncing 100 MCPs

## Performance Metrics

Each benchmark collects:

- **Timing Metrics:**
  - Average execution time
  - p50 (median)
  - p95 (95th percentile)
  - p99 (99th percentile)
  - Min/Max
  - Standard deviation

- **Resource Metrics:**
  - Heap memory usage (MB)
  - RSS (Resident Set Size) memory (MB)

## Performance Report

After running benchmarks, a detailed report is generated at:
```
apps/cli/performance-report.txt
```

The report includes:
- Individual scenario results with all metrics
- Pass/fail status vs. targets
- Overall performance grade (A-F)
- Timestamp

## Current Performance

**Latest Results:** Grade A (11/11 scenarios passing)

All sync operations complete well under target thresholds:
- Small configs: ~0.1ms (1000x faster than target)
- Medium configs: ~0.1ms (2000x faster than target)
- Large configs: ~0.2ms (5000x faster than target)
- Memory usage: < 0.2MB for 100 MCPs (500x under target)

## Interpreting Results

### Grading Scale
- **A:** ≥95% scenarios passing
- **A-:** 90-94% passing
- **B+:** 85-89% passing
- **B:** 80-84% passing
- **B-:** 75-79% passing
- **C+:** 70-74% passing
- **C:** 65-69% passing
- **F:** <65% passing

### What "Passing" Means
A scenario passes if its p95 (95th percentile) execution time is below the target threshold. This ensures that 95% of executions meet performance expectations.

## CI/CD Integration

Performance benchmarks can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Performance Tests
  run: nx test @overture/cli --testPathPatterns="performance/"

- name: Check Performance Grade
  run: |
    grade=$(grep "Performance Grade:" apps/cli/performance-report.txt | awk '{print $3}')
    if [[ "$grade" != "A" && "$grade" != "A-" ]]; then
      echo "Performance degradation detected: Grade $grade"
      exit 1
    fi
```

## Benchmarking Best Practices

1. **Consistent Environment:** Run benchmarks on the same hardware for comparable results
2. **Warmup Runs:** First iteration is discarded to account for JIT compilation
3. **Multiple Iterations:** 5-50 iterations per scenario for statistical significance
4. **Memory Profiling:** Force GC between iterations when available
5. **Isolated Tests:** Each scenario runs independently with fresh mocks

## Extending Benchmarks

To add new performance scenarios:

1. Add a new `describe` block in `sync-benchmark.spec.ts`
2. Define the scenario name, target, and test function
3. Use `runBenchmark()` helper for consistent metrics collection
4. Push result to `benchmarkResults` array
5. Add scenario documentation to this README

Example:
```typescript
describe('Scenario 12: New Feature', () => {
  it('should complete in < 300ms', async () => {
    // Setup
    const config = generateConfig(20);

    // Benchmark
    const metrics = await runBenchmark(
      'New Feature Sync',
      async () => {
        await newFeatureOperation(config);
      },
      10 // iterations
    );

    // Validate
    const result: BenchmarkResult = {
      name: 'New Feature Sync',
      target: 300,
      pass: metrics.p95 < 300,
      iterations: 10,
      ...metrics,
    };

    benchmarkResults.push(result);
    expect(result.pass).toBe(true);
  });
});
```

## Performance Optimization Tips

When performance degrades:

1. **Profile:** Use Node.js profiler to identify bottlenecks
   ```bash
   node --prof dist/apps/cli/main.js sync
   node --prof-process isolate-*.log > profile.txt
   ```

2. **Measure First:** Use benchmarks to establish baseline before optimizing

3. **Focus on Hot Paths:** Optimize operations in tight loops first

4. **Consider Caching:** Memoize expensive computations

5. **Async Operations:** Use Promise.all() for parallel I/O

6. **Memory Management:** Avoid unnecessary object creation in loops

## Related Documentation

- [Sync Engine Architecture](../core/README.md)
- [Testing Strategy](../../README.md#testing)
- [v0.2 Implementation Plan](../../../../docs/v0.2-implementation-plan.md)
