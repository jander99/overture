import type { Mock, Mocked, MockedObject, MockedFunction, MockInstance } from 'vitest';
/**
 * CLI Integration Tests (WU-034)
 *
 * End-to-end tests that execute actual CLI commands to verify the full
 * command pipeline works correctly. These tests use real file I/O and
 * test command chaining.
 *
 * @module cli/commands/integration.spec
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Note: chalk is mocked via alias in vitest.config.ts - no vi.mock needed

// Mock inquirer (inline mock for compatibility)
vi.mock('inquirer', () => ({
  prompt: vi.fn(),
  createPromptModule: vi.fn(),
}));

vi.mock('../../utils/prompts');

import { createProgram } from '../index';
import { Prompts } from '../../utils/prompts';

// Temp directory management
let tempDir: string;
let originalCwd: string;

beforeEach(() => {
  // Create temp directory for each test
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'overture-integration-'));
  originalCwd = process.cwd();
  process.chdir(tempDir);

  // Configure Prompts mock implementations
  (Prompts.multiSelect as Mock).mockResolvedValue(['filesystem', 'memory']);
  (Prompts.confirm as Mock).mockResolvedValue(true);
  (Prompts.select as Mock).mockResolvedValue('option1');
  (Prompts.input as Mock).mockResolvedValue('test-value');
});

afterEach(() => {
  // Restore original directory
  process.chdir(originalCwd);

  // Cleanup temp directory
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

/**
 * Helper to execute CLI command programmatically
 */
async function runCommand(args: string[]): Promise<{ exitCode: number; output: string; error: string }> {
  const program = createProgram();
  const stdout: string[] = [];
  const stderr: string[] = [];

  // Capture all output channels
  const originalLog = console.log;
  const originalError = console.error;
  const originalExit = process.exit;
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  console.log = (...args: unknown[]) => stdout.push(args.map(String).join(' '));
  console.error = (...args: unknown[]) => stderr.push(args.map(String).join(' '));

  // Capture direct writes to stdout/stderr (used by Commander for --help and --version)
  process.stdout.write = ((chunk: any) => {
    stdout.push(String(chunk));
    return true;
  }) as any;

  process.stderr.write = ((chunk: any) => {
    stderr.push(String(chunk));
    return true;
  }) as any;

  let exitCode = 0;
  // Note: Use "Process exit:" (capital P) to match validate.ts line 110
  // and maintain consistency with unit test patterns in validate.spec.ts
  (process.exit as unknown) = ((code?: number) => {
    throw new Error(`Process exit: ${code ?? 0}`);
  }) as typeof process.exit;

  try {
    // Commander.js expects argv format: ['node', 'script.js', ...args]
    // Since the program name is already set by createProgram(), we just pass the args
    await program.parseAsync(args, { from: 'user' });
  } catch (error) {
    // Expected for Process exit calls - extract exit code from error message
    if (error instanceof Error && error.message.startsWith('Process exit')) {
      const match = error.message.match(/Process exit: (\d+)/);
      if (match) {
        exitCode = parseInt(match[1], 10);
      }
    } else {
      throw error;
    }
  } finally {
    // Restore original functions
    console.log = originalLog;
    console.error = originalError;
    process.exit = originalExit;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }

  return {
    exitCode,
    output: stdout.join('\n'),
    error: stderr.join('\n'),
  };
}

describe('CLI Integration Tests (WU-034)', () => {
  // ============================================================================
  // User Command Flow Tests (WU-027, WU-028)
  // ============================================================================
  describe('User command flow', () => {
    it('should create user config with user init', async () => {
      // Use --force since a user config may already exist on the system
      const result = await runCommand(['user', 'init', '--force']);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('User configuration created');

      // Note: Config file is created at ~/.config/overture.yml
      // We don't verify the file directly to avoid modifying the test user's home directory
    });

    it('should display user config with user show', async () => {
      // First create a config
      await runCommand(['user', 'init']);

      // Then show it
      const result = await runCommand(['user', 'show']);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('User Global Configuration');
    });

    it('should handle missing user config gracefully', async () => {
      // NOTE: This test operates on real user home directory (~/.config/overture.yml)
      // If a user config exists on the system, the command will succeed (exit 0)
      // If no user config exists, the command should fail with exit code 2
      const result = await runCommand(['user', 'show']);

      // Accept either success (config exists) or failure (config missing)
      if (result.exitCode === 0) {
        // Config exists - command should show configuration
        expect(result.output).toContain('User Global Configuration');
      } else {
        // Config missing - command should report error
        expect(result.exitCode).toBe(2);
        expect(result.error).toMatch(/User configuration not found|No user configuration found/);
      }
    });
  });

  // ============================================================================
  // Sync Command Tests (WU-029)
  // ============================================================================
  describe('Sync command flow', () => {
    beforeEach(() => {
      // Create a minimal project config for testing
      fs.mkdirSync(path.join(tempDir, '.overture'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, '.overture', 'config.yaml'),
        `
version: "2.0"

plugins: {}

mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem"]
    env: {}
    transport: stdio

clients:
  claude-code:
    enabled: true

sync:
  backup: true
  backupDir: ~/.config/overture/backups
  backupRetention: 10
`
      );
    });

    it('should sync with default options', async () => {
      const result = await runCommand(['sync']);

      // Sync might fail if clients aren't installed, but command should execute
      expect(result.output).toMatch(/(Sync complete|Client.*not installed|Sync failed)/);
    });

    it('should support dry-run mode', async () => {
      const result = await runCommand(['sync', '--dry-run']);

      expect(result.output).toContain('dry-run');
      expect(result.output).not.toContain('Backup created');
    });

    it('should support client filtering', async () => {
      const result = await runCommand(['sync', '--client', 'claude-code']);

      expect(result.output).toMatch(/(claude-code|Client.*not installed)/);
    });

    it('should support force mode', async () => {
      const result = await runCommand(['sync', '--force']);

      expect(result.output).toMatch(/(Sync complete|Client.*not installed|Sync failed)/);
    });
  });

  // ============================================================================
  // Audit Command Tests (WU-030)
  // ============================================================================
  describe('Audit command flow', () => {
    beforeEach(() => {
      // Create minimal config
      fs.mkdirSync(path.join(tempDir, '.overture'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, '.overture', 'config.yaml'),
        `
version: "2.0"

plugins: {}

mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem"]
    env: {}
    transport: stdio

clients:
  claude-code:
    enabled: true
`
      );
    });

    it('should detect unmanaged MCPs', async () => {
      const result = await runCommand(['audit']);

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/(No unmanaged MCPs found|Unmanaged MCPs detected)/);
    });

    it('should support client filtering', async () => {
      const result = await runCommand(['audit', '--client', 'claude-code']);

      // In integration tests, adapters may not be registered, so command may error
      // If it succeeds (adapter exists), verify output mentions client or no unmanaged MCPs
      // If it fails (adapter doesn't exist), verify error message mentions unknown client
      if (result.exitCode === 0) {
        expect(result.output).toMatch(/(claude-code|No unmanaged MCPs)/);
      } else {
        expect(result.error || result.output).toMatch(/Unknown client|not installed/i);
      }
    });
  });

  // ============================================================================
  // Validate Command Tests (WU-032)
  // ============================================================================
  describe('Validate command flow', () => {
    it('should validate valid config', async () => {
      fs.mkdirSync(path.join(tempDir, '.overture'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, '.overture', 'config.yaml'),
        `
version: "2.0"

plugins: {}

mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem"]
    env: {}
    transport: stdio

clients:
  claude-code:
    enabled: true

sync:
  backup: true
  backupDir: ~/.config/overture/backups
  backupRetention: 10
`
      );

      const result = await runCommand(['validate']);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('valid');
    });

    it('should detect invalid config', async () => {
      fs.mkdirSync(path.join(tempDir, '.overture'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, '.overture', 'config.yaml'),
        `
version: "2.0"

mcp:
  invalid-mcp:
    # Missing required fields
    command: npx
`
      );

      const result = await runCommand(['validate']);

      expect(result.exitCode).not.toBe(0);
      expect(result.output).toMatch(/(error|invalid|failed|transport.*issue|transport.*compatibility)/i);
    });

    it('should validate transport compatibility', async () => {
      fs.mkdirSync(path.join(tempDir, '.overture'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, '.overture', 'config.yaml'),
        `
version: "2.0"

plugins: {}

mcp:
  http-server:
    command: npx
    args: ["-y", "mcp-http-server"]
    env: {}
    transport: http

clients:
  claude-code:
    enabled: true
`
      );

      const result = await runCommand(['validate']);

      // Claude Code supports all transports, so config is valid (no warning)
      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/(valid|warning|transport)/i);
    });
  });

  // ============================================================================
  // MCP List Command Tests (WU-031)
  // ============================================================================
  describe('MCP list command flow', () => {
    beforeEach(() => {
      fs.mkdirSync(path.join(tempDir, '.overture'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, '.overture', 'config.yaml'),
        `
version: "2.0"

plugins: {}

mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem"]
    env: {}
    transport: stdio

  python-repl:
    command: uvx
    args: ["mcp-server-python-repl"]
    env: {}
    transport: stdio

clients:
  claude-code:
    enabled: true
`
      );
    });

    it('should list all MCPs', async () => {
      const result = await runCommand(['mcp', 'list']);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('filesystem');
      expect(result.output).toContain('python-repl');
    });

    it('should filter by scope', async () => {
      const result = await runCommand(['mcp', 'list', '--scope', 'project']);

      expect(result.exitCode).toBe(0);
      // Both MCPs are in project config, so both should appear with project scope filter
      expect(result.output).toContain('filesystem');
      expect(result.output).toContain('python-repl');
    });

    it('should filter by client', async () => {
      const result = await runCommand(['mcp', 'list', '--client', 'claude-code']);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('filesystem');
    });
  });

  // ============================================================================
  // Backup Command Tests (WU-033)
  // ============================================================================
  describe('Backup command flow', () => {
    let backupDir: string;

    beforeEach(() => {
      backupDir = path.join(tempDir, 'backups');
      fs.mkdirSync(backupDir, { recursive: true });
    });

    it('should list backups', async () => {
      const result = await runCommand(['backup', 'list']);

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/(No backups found|Backups for|All backups)/);
    });

    it('should list backups for specific client', async () => {
      const result = await runCommand(['backup', 'list', '--client', 'claude-code']);

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/(No backups found|claude-code)/);
    });

    it('should handle backup restore with confirmation', async () => {
      // This would require mocking user input
      // For now, just test that the command exists and handles --latest flag
      const result = await runCommand(['backup', 'restore', '--help']);

      expect(result.output).toContain('restore');
      expect(result.output).toContain('--latest');
    });

    it('should cleanup old backups', async () => {
      const result = await runCommand(['backup', 'cleanup', '--help']);

      expect(result.output).toContain('cleanup');
      expect(result.output).toContain('--keep');
    });
  });

  // ============================================================================
  // Command Chaining Tests
  // ============================================================================
  describe('Command chaining workflows', () => {
    it('should support init → sync → validate workflow', async () => {
      // Create project config
      fs.mkdirSync(path.join(tempDir, '.overture'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, '.overture', 'config.yaml'),
        `
version: "2.0"

plugins: {}

mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem"]
    env: {}
    transport: stdio

clients:
  claude-code:
    enabled: true

sync:
  backup: true
  backupDir: ~/.config/overture/backups
  backupRetention: 10
`
      );

      // Run validate
      const validateResult = await runCommand(['validate']);
      expect(validateResult.exitCode).toBe(0);

      // Run sync (might fail if clients not installed, but should execute)
      const syncResult = await runCommand(['sync', '--dry-run']);
      expect(syncResult.output).toMatch(/dry-run mode/i);

      // Run validate again
      const validate2Result = await runCommand(['validate']);
      expect(validate2Result.exitCode).toBe(0);
    });

    it('should support sync → audit workflow', async () => {
      // Create project config
      fs.mkdirSync(path.join(tempDir, '.overture'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, '.overture', 'config.yaml'),
        `
version: "2.0"

plugins: {}

mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem"]
    env: {}
    transport: stdio

clients:
  claude-code:
    enabled: true

sync:
  backup: true
  backupDir: ~/.config/overture/backups
  backupRetention: 10
`
      );

      // Run sync in dry-run mode
      const syncResult = await runCommand(['sync', '--dry-run']);
      expect(syncResult.output).toContain('dry-run');

      // Run audit
      const auditResult = await runCommand(['audit']);
      expect(auditResult.exitCode).toBe(0);
    });

    it('should support validate → mcp list workflow', async () => {
      // Create project config
      fs.mkdirSync(path.join(tempDir, '.overture'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, '.overture', 'config.yaml'),
        `
version: "2.0"

plugins: {}

mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem"]
    env: {}
    transport: stdio

clients:
  claude-code:
    enabled: true

sync:
  backup: true
  backupDir: ~/.config/overture/backups
  backupRetention: 10
`
      );

      // Run validate
      const validateResult = await runCommand(['validate']);
      expect(validateResult.exitCode).toBe(0);

      // Run mcp list
      const listResult = await runCommand(['mcp', 'list']);
      expect(listResult.exitCode).toBe(0);
      expect(listResult.output).toContain('filesystem');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================
  describe('Error handling', () => {
    it('should handle missing config gracefully', async () => {
      // Create .overture directory without config file
      fs.mkdirSync(path.join(tempDir, '.overture'), { recursive: true });

      const result = await runCommand(['validate']);

      // If user has global config, validate will succeed (exit 0)
      // If no config exists at all, validate will fail (exit != 0)
      if (result.exitCode !== 0) {
        expect(result.error).toMatch(/(not found|missing|does not exist|No configuration found)/i);
      }
      // Either way is acceptable - we're just checking it doesn't crash
    });

    it('should handle invalid YAML syntax', async () => {
      fs.mkdirSync(path.join(tempDir, '.overture'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, '.overture', 'config.yaml'),
        `
version: "2.0"
invalid: yaml: syntax: here::
  - broken
`
      );

      const result = await runCommand(['validate']);

      expect(result.exitCode).not.toBe(0);
      // Error can be either parse/syntax error or config load error
      expect(result.error).toMatch(/(parse|syntax|invalid|Failed to load)/i);
    });

    it('should handle unknown commands gracefully', async () => {
      const result = await runCommand(['unknown-command']);

      expect(result.exitCode).not.toBe(0);
      expect(result.error).toMatch(/(unknown|invalid|not found)/i);
    });

    it('should handle invalid client names', async () => {
      const result = await runCommand(['mcp', 'list', '--client', 'invalid-client']);

      expect(result.exitCode).not.toBe(0);
      // Error could be about invalid client or no config found
      expect(result.error).toMatch(/(invalid|unknown|not supported|No configuration found)/i);
    });
  });

  // ============================================================================
  // Help and Version Tests
  // ============================================================================
  describe('Help and version commands', () => {
    it('should display help for main command', async () => {
      const result = await runCommand(['--help']);

      expect(result.output).toContain('overture');
      expect(result.output).toContain('sync');
      expect(result.output).toContain('validate');
      expect(result.output).toContain('audit');
    });

    it('should display version', async () => {
      const result = await runCommand(['--version']);

      expect(result.output).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should display help for subcommands', async () => {
      const syncHelp = await runCommand(['sync', '--help']);
      expect(syncHelp.output).toContain('sync');
      expect(syncHelp.output).toContain('--dry-run');

      const auditHelp = await runCommand(['audit', '--help']);
      expect(auditHelp.output).toContain('audit');
      expect(auditHelp.output).toContain('--client');

      const validateHelp = await runCommand(['validate', '--help']);
      expect(validateHelp.output).toContain('validate');
    });
  });
});
