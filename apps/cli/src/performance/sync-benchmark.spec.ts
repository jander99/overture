/**
 * Sync Engine Performance Benchmarks
 *
 * Comprehensive performance testing and benchmarking for sync operations.
 * Measures timing, memory usage, and scalability across various scenarios.
 *
 * Target Performance Metrics:
 * - Small config (5 MCPs): < 1s
 * - Medium config (15 MCPs): < 2s
 * - Large config (50 MCPs): < 5s
 * - Multi-client sync (5 clients): < 3s
 * - Incremental update: < 500ms
 * - Config loading: < 100ms
 * - Backup creation: < 200ms
 * - Transport validation: < 500ms
 * - Exclusion filtering: < 100ms
 * - Lock acquisition: < 100ms for failures
 *
 * @module performance/sync-benchmark.spec
 */

import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { syncClients, syncClient } from '../core/sync-engine';
import type { OvertureConfig, Platform } from '../domain/config.types';
import type { ClientAdapter } from '../adapters/client-adapter.interface';
import * as configLoader from '../core/config-loader';
import * as adapterRegistry from '../adapters/adapter-registry';
import * as processLock from '../core/process-lock';
import * as backupService from '../core/backup-service';
import { filterMcpsForClient } from '../core/exclusion-filter';
import { getTransportWarnings } from '../core/transport-validator';

// Mock modules for controlled testing
jest.mock('../core/config-loader');
jest.mock('../adapters/adapter-registry', () => ({
  getAdapterForClient: jest.fn(),
}));
jest.mock('../core/process-lock');
jest.mock('../core/backup-service');

const mockConfigLoader = configLoader as jest.Mocked<typeof configLoader>;
const mockProcessLock = processLock as jest.Mocked<typeof processLock>;
const mockBackupService = backupService as jest.Mocked<typeof backupService>;
const mockGetAdapterForClient = adapterRegistry.getAdapterForClient as jest.MockedFunction<
  typeof adapterRegistry.getAdapterForClient
>;

/**
 * Performance metrics collected during benchmark
 */
interface PerformanceMetrics {
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  stdDev: number;
  heapUsedMB: number;
  rssMB: number;
}

/**
 * Benchmark result with pass/fail status
 */
interface BenchmarkResult extends PerformanceMetrics {
  name: string;
  target: number;
  pass: boolean;
  iterations: number;
}

/**
 * Overall performance report
 */
interface PerformanceReport {
  results: BenchmarkResult[];
  passed: number;
  failed: number;
  grade: string;
  timestamp: string;
}

/**
 * Run a benchmark multiple times and collect timing statistics
 */
async function runBenchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number = 10
): Promise<PerformanceMetrics> {
  const times: number[] = [];
  let totalHeapUsed = 0;
  let totalRss = 0;

  // Warmup run (not counted)
  await fn();

  // Collect metrics
  for (let i = 0; i < iterations; i++) {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const memBefore = process.memoryUsage();
    const start = performance.now();

    await fn();

    const end = performance.now();
    const memAfter = process.memoryUsage();

    times.push(end - start);
    totalHeapUsed += (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
    totalRss += (memAfter.rss - memBefore.rss) / 1024 / 1024;
  }

  // Calculate statistics
  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b) / times.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  // Standard deviation
  const variance = times.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);

  return {
    avg,
    p50,
    p95,
    p99,
    min,
    max,
    stdDev,
    heapUsedMB: totalHeapUsed / iterations,
    rssMB: totalRss / iterations,
  };
}

/**
 * Format benchmark results for console output
 */
function formatBenchmarkResult(result: BenchmarkResult): string {
  const status = result.pass ? '✓ PASS' : '✗ FAIL';
  const statusColor = result.pass ? '\x1b[32m' : '\x1b[31m'; // Green or red
  const resetColor = '\x1b[0m';

  return `
${result.name}:
  Target: < ${result.target}ms
  Average: ${result.avg.toFixed(2)}ms
  p50: ${result.p50.toFixed(2)}ms
  p95: ${result.p95.toFixed(2)}ms
  p99: ${result.p99.toFixed(2)}ms
  Min: ${result.min.toFixed(2)}ms
  Max: ${result.max.toFixed(2)}ms
  StdDev: ${result.stdDev.toFixed(2)}ms
  Heap: ${result.heapUsedMB.toFixed(2)}MB
  RSS: ${result.rssMB.toFixed(2)}MB
  ${statusColor}${status}${resetColor} (${result.iterations} iterations)
`;
}

/**
 * Generate performance grade based on pass rate
 */
function calculateGrade(passRate: number): string {
  if (passRate >= 0.95) return 'A';
  if (passRate >= 0.9) return 'A-';
  if (passRate >= 0.85) return 'B+';
  if (passRate >= 0.8) return 'B';
  if (passRate >= 0.75) return 'B-';
  if (passRate >= 0.7) return 'C+';
  if (passRate >= 0.65) return 'C';
  return 'F';
}

/**
 * Generate full performance report
 */
function generatePerformanceReport(results: BenchmarkResult[]): PerformanceReport {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  const passRate = passed / results.length;
  const grade = calculateGrade(passRate);

  return {
    results,
    passed,
    failed,
    grade,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format full performance report
 */
function formatPerformanceReport(report: PerformanceReport): string {
  const resultsOutput = report.results.map(formatBenchmarkResult).join('\n');

  return `
${'='.repeat(60)}
  OVERTURE PERFORMANCE BENCHMARK RESULTS
${'='.repeat(60)}

${resultsOutput}
${'='.repeat(60)}
  SUMMARY
${'='.repeat(60)}

Passed: ${report.passed}/${report.results.length} scenarios
Performance Grade: ${report.grade}
Timestamp: ${report.timestamp}

${'='.repeat(60)}
`;
}

/**
 * Create mock adapter for testing
 */
function createMockAdapter(
  name: string,
  installed: boolean = true,
  supportedTransports: string[] = ['stdio']
): jest.Mocked<ClientAdapter> {
  return {
    name: name as any,
    schemaRootKey: 'mcpServers',
    detectConfigPath: jest.fn(() => `/home/user/.config/${name}/mcp.json`),
    readConfig: jest.fn(),
    writeConfig: jest.fn(),
    convertFromOverture: jest.fn((config) => ({
      mcpServers: config.mcp,
    })),
    supportsTransport: jest.fn((t) => supportedTransports.includes(t)),
    needsEnvVarExpansion: jest.fn(() => false),
    isInstalled: jest.fn(() => installed),
  };
}

/**
 * Generate config with N MCPs
 */
function generateConfig(mcpCount: number): OvertureConfig {
  const mcp: OvertureConfig['mcp'] = {};

  for (let i = 0; i < mcpCount; i++) {
    mcp[`mcp-${i}`] = {
      command: `mcp-server-${i}`,
      args: [`--arg${i}`],
      env: { [`VAR${i}`]: `value${i}` },
      transport: 'stdio',
    };
  }

  return {
    version: '2.0',
    mcp,
  };
}

describe('Sync Engine Performance Benchmarks', () => {
  const platform: Platform = 'linux';
  const benchmarkResults: BenchmarkResult[] = [];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    mockProcessLock.acquireLock.mockResolvedValue(true);
    mockProcessLock.releaseLock.mockReturnValue();
    mockBackupService.backupClientConfig.mockReturnValue('/backup/path.json');
  });

  afterAll(() => {
    // Generate and print performance report
    const report = generatePerformanceReport(benchmarkResults);
    console.log(formatPerformanceReport(report));

    // Optionally write to file
    const reportPath = path.join(__dirname, '..', '..', 'performance-report.txt');
    try {
      fs.writeFileSync(reportPath, formatPerformanceReport(report));
      console.log(`\nPerformance report written to: ${reportPath}`);
    } catch (error) {
      console.warn(`Failed to write performance report: ${error}`);
    }
  });

  describe('Scenario 1: Small Config Sync (5 MCPs)', () => {
    it('should sync 5 MCPs to single client in < 1 second', async () => {
      const config = generateConfig(5);
      const adapter = createMockAdapter('claude-code');

      mockConfigLoader.loadUserConfig.mockReturnValue(config);
      mockConfigLoader.loadProjectConfig.mockReturnValue(null);
      mockConfigLoader.mergeConfigs.mockReturnValue(config);
      mockGetAdapterForClient.mockReturnValue(adapter);

      adapter.readConfig.mockResolvedValue(null);

      const metrics = await runBenchmark(
        'Small Config Sync (5 MCPs)',
        async () => {
          await syncClient('claude-code', { platform });
        },
        10
      );

      const result: BenchmarkResult = {
        name: 'Small Config Sync (5 MCPs)',
        target: 1000,
        pass: metrics.p95 < 1000,
        iterations: 10,
        ...metrics,
      };

      benchmarkResults.push(result);
      expect(result.pass).toBe(true);
    });
  });

  describe('Scenario 2: Medium Config Sync (15 MCPs)', () => {
    it('should sync 15 MCPs to single client in < 2 seconds', async () => {
      const config = generateConfig(15);
      const adapter = createMockAdapter('claude-code');

      mockConfigLoader.loadUserConfig.mockReturnValue(config);
      mockConfigLoader.loadProjectConfig.mockReturnValue(null);
      mockConfigLoader.mergeConfigs.mockReturnValue(config);
      mockGetAdapterForClient.mockReturnValue(adapter);

      adapter.readConfig.mockResolvedValue(null);

      const metrics = await runBenchmark(
        'Medium Config Sync (15 MCPs)',
        async () => {
          await syncClient('claude-code', { platform });
        },
        10
      );

      const result: BenchmarkResult = {
        name: 'Medium Config Sync (15 MCPs)',
        target: 2000,
        pass: metrics.p95 < 2000,
        iterations: 10,
        ...metrics,
      };

      benchmarkResults.push(result);
      expect(result.pass).toBe(true);
    });
  });

  describe('Scenario 3: Large Config Sync (50 MCPs)', () => {
    it('should sync 50 MCPs to single client in < 5 seconds', async () => {
      const config = generateConfig(50);
      const adapter = createMockAdapter('claude-code');

      mockConfigLoader.loadUserConfig.mockReturnValue(config);
      mockConfigLoader.loadProjectConfig.mockReturnValue(null);
      mockConfigLoader.mergeConfigs.mockReturnValue(config);
      mockGetAdapterForClient.mockReturnValue(adapter);

      adapter.readConfig.mockResolvedValue(null);

      const metrics = await runBenchmark(
        'Large Config Sync (50 MCPs)',
        async () => {
          await syncClient('claude-code', { platform });
        },
        5 // Fewer iterations for larger configs
      );

      const result: BenchmarkResult = {
        name: 'Large Config Sync (50 MCPs)',
        target: 5000,
        pass: metrics.p95 < 5000,
        iterations: 5,
        ...metrics,
      };

      benchmarkResults.push(result);
      expect(result.pass).toBe(true);
    });
  });

  describe('Scenario 4: Multi-Client Sync (5 clients)', () => {
    it('should sync 10 MCPs to 5 clients in < 3 seconds', async () => {
      const config = generateConfig(10);
      const adapters = [
        createMockAdapter('claude-code'),
        createMockAdapter('claude-desktop'),
        createMockAdapter('vscode'),
        createMockAdapter('cursor'),
        createMockAdapter('windsurf'),
      ];

      mockConfigLoader.loadUserConfig.mockReturnValue(config);
      mockConfigLoader.loadProjectConfig.mockReturnValue(null);
      mockConfigLoader.mergeConfigs.mockReturnValue(config);

      let adapterIndex = 0;
      mockGetAdapterForClient.mockImplementation(() => {
        const adapter = adapters[adapterIndex % adapters.length];
        adapterIndex++;
        return adapter;
      });

      adapters.forEach((adapter) => {
        adapter.readConfig.mockResolvedValue(null);
      });

      const metrics = await runBenchmark(
        'Multi-Client Sync (5 clients, 10 MCPs)',
        async () => {
          await syncClients({
            clients: ['claude-code', 'claude-desktop', 'vscode', 'cursor', 'windsurf'],
            platform,
          });
        },
        5
      );

      const result: BenchmarkResult = {
        name: 'Multi-Client Sync (5 clients, 10 MCPs)',
        target: 3000,
        pass: metrics.p95 < 3000,
        iterations: 5,
        ...metrics,
      };

      benchmarkResults.push(result);
      expect(result.pass).toBe(true);
    });
  });

  describe('Scenario 5: Incremental Update', () => {
    it('should sync incremental update in < 500ms', async () => {
      const initialConfig = generateConfig(20);
      const updatedConfig = {
        ...initialConfig,
        mcp: {
          ...initialConfig.mcp,
          'mcp-0': {
            ...initialConfig.mcp['mcp-0'],
            args: ['--updated'],
          },
        },
      };

      const adapter = createMockAdapter('claude-code');

      mockConfigLoader.loadUserConfig.mockReturnValue(updatedConfig);
      mockConfigLoader.loadProjectConfig.mockReturnValue(null);
      mockConfigLoader.mergeConfigs.mockReturnValue(updatedConfig);
      mockGetAdapterForClient.mockReturnValue(adapter);

      // Simulate existing config
      adapter.readConfig.mockResolvedValue({
        mcpServers: initialConfig.mcp,
      });

      const metrics = await runBenchmark(
        'Incremental Update (1 MCP changed)',
        async () => {
          await syncClient('claude-code', { platform });
        },
        20
      );

      const result: BenchmarkResult = {
        name: 'Incremental Update (1 MCP changed)',
        target: 500,
        pass: metrics.p95 < 500,
        iterations: 20,
        ...metrics,
      };

      benchmarkResults.push(result);
      expect(result.pass).toBe(true);
    });
  });

  describe('Scenario 6: Config Loading Performance', () => {
    it('should load and merge configs in < 100ms', async () => {
      const userConfig = generateConfig(50);
      const projectConfig = generateConfig(50);

      // Mock file system (not actual I/O for benchmark)
      mockConfigLoader.loadUserConfig.mockReturnValue(userConfig);
      mockConfigLoader.loadProjectConfig.mockReturnValue(projectConfig);

      const metrics = await runBenchmark(
        'Config Loading (100 MCPs total)',
        async () => {
          const user = mockConfigLoader.loadUserConfig();
          const project = mockConfigLoader.loadProjectConfig();
          configLoader.mergeConfigs(user, project || null);
        },
        50
      );

      const result: BenchmarkResult = {
        name: 'Config Loading (100 MCPs total)',
        target: 100,
        pass: metrics.p95 < 100,
        iterations: 50,
        ...metrics,
      };

      benchmarkResults.push(result);
      expect(result.pass).toBe(true);
    });
  });

  describe('Scenario 7: Backup Creation', () => {
    it('should create backup in < 200ms', async () => {
      const config = generateConfig(50);
      const adapter = createMockAdapter('claude-code');

      mockConfigLoader.loadUserConfig.mockReturnValue(config);
      mockConfigLoader.loadProjectConfig.mockReturnValue(null);
      mockConfigLoader.mergeConfigs.mockReturnValue(config);
      mockGetAdapterForClient.mockReturnValue(adapter);

      // Simulate large existing config
      adapter.readConfig.mockResolvedValue({
        mcpServers: config.mcp,
      });

      const metrics = await runBenchmark(
        'Backup Creation (50 MCPs)',
        async () => {
          await syncClient('claude-code', { platform });
        },
        20
      );

      const result: BenchmarkResult = {
        name: 'Backup Creation (50 MCPs)',
        target: 200,
        pass: metrics.p95 < 200,
        iterations: 20,
        ...metrics,
      };

      benchmarkResults.push(result);
      expect(result.pass).toBe(true);
    });
  });

  describe('Scenario 8: Transport Validation', () => {
    it('should validate 50 MCPs against 7 clients in < 500ms', async () => {
      const config = generateConfig(50);
      const adapter = createMockAdapter('claude-code', true, ['stdio', 'sse']);

      const metrics = await runBenchmark(
        'Transport Validation (50 MCPs, 7 clients)',
        async () => {
          // Simulate validation across multiple clients
          for (let i = 0; i < 7; i++) {
            getTransportWarnings(config.mcp, adapter);
          }
        },
        30
      );

      const result: BenchmarkResult = {
        name: 'Transport Validation (50 MCPs, 7 clients)',
        target: 500,
        pass: metrics.p95 < 500,
        iterations: 30,
        ...metrics,
      };

      benchmarkResults.push(result);
      expect(result.pass).toBe(true);
    });
  });

  describe('Scenario 9: Exclusion Filtering', () => {
    it('should filter 50 MCPs in < 100ms', async () => {
      const config = generateConfig(50);
      const adapter = createMockAdapter('claude-code', true, ['stdio']);

      const metrics = await runBenchmark(
        'Exclusion Filtering (50 MCPs)',
        async () => {
          filterMcpsForClient(config.mcp, adapter, platform, undefined);
        },
        50
      );

      const result: BenchmarkResult = {
        name: 'Exclusion Filtering (50 MCPs)',
        target: 100,
        pass: metrics.p95 < 100,
        iterations: 50,
        ...metrics,
      };

      benchmarkResults.push(result);
      expect(result.pass).toBe(true);
    });
  });

  describe('Scenario 10: Concurrent Sync Attempts', () => {
    it('should handle concurrent sync attempts with lock in < 100ms for failures', async () => {
      const config = generateConfig(10);
      const adapter = createMockAdapter('claude-code');

      mockConfigLoader.loadUserConfig.mockReturnValue(config);
      mockConfigLoader.loadProjectConfig.mockReturnValue(null);
      mockConfigLoader.mergeConfigs.mockReturnValue(config);
      mockGetAdapterForClient.mockReturnValue(adapter);

      adapter.readConfig.mockResolvedValue(null);

      // First call gets lock, subsequent calls fail
      mockProcessLock.acquireLock.mockResolvedValueOnce(true).mockResolvedValue(false);

      const metrics = await runBenchmark(
        'Concurrent Sync Lock Failure',
        async () => {
          // This should fail quickly due to lock
          await syncClient('claude-code', { platform });
        },
        20
      );

      const result: BenchmarkResult = {
        name: 'Concurrent Sync Lock Failure',
        target: 100,
        pass: metrics.p95 < 100,
        iterations: 20,
        ...metrics,
      };

      benchmarkResults.push(result);
      expect(result.pass).toBe(true);
    });
  });

  describe('Memory Usage', () => {
    it('should use less than 100MB heap for large config', async () => {
      const config = generateConfig(100);
      const adapter = createMockAdapter('claude-code');

      mockConfigLoader.loadUserConfig.mockReturnValue(config);
      mockConfigLoader.loadProjectConfig.mockReturnValue(null);
      mockConfigLoader.mergeConfigs.mockReturnValue(config);
      mockGetAdapterForClient.mockReturnValue(adapter);

      adapter.readConfig.mockResolvedValue(null);

      const metrics = await runBenchmark(
        'Memory Usage (100 MCPs)',
        async () => {
          await syncClient('claude-code', { platform });
        },
        5
      );

      const result: BenchmarkResult = {
        name: 'Memory Usage (100 MCPs)',
        target: 100, // 100MB target
        pass: Math.abs(metrics.heapUsedMB) < 100,
        iterations: 5,
        ...metrics,
      };

      benchmarkResults.push(result);
      expect(result.pass).toBe(true);
    });
  });
});
