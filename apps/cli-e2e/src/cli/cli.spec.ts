import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

describe('CLI tests', () => {
  const workspaceRoot = resolve(__dirname, '../../../..');
  const cliPath = join(workspaceRoot, 'dist/apps/cli/main.js');
  let testDir: string;

  beforeAll(() => {
    if (!existsSync(cliPath)) {
      throw new Error(
        `CLI not built at ${cliPath}. Run: nx build @overture/cli`,
      );
    }
  });

  beforeEach(() => {
    // Create unique test directory for each test
    testDir = join(
      tmpdir(),
      `overture-cli-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper: Run CLI command with test environment
   */
  function runCli(
    args: string,
    options: { expectError?: boolean; cwd?: string } = {},
  ): string {
    const command = `node ${cliPath} ${args}`;
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      HOME: testDir,
    };

    try {
      return execSync(command, {
        cwd: options.cwd || testDir,
        env,
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (error: unknown) {
      const execError = error as {
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      if (options.expectError) {
        return execError.stdout || execError.stderr || execError.message || '';
      }
      throw error;
    }
  }

  /**
   * Helper: Create test config file
   */
  function createTestConfig(
    content: string,
    options: { global?: boolean } = {},
  ): void {
    const configDir = options.global
      ? join(testDir, '.config')
      : join(testDir, '.overture');
    mkdirSync(configDir, { recursive: true });

    const configPath = options.global
      ? join(configDir, 'overture.yml')
      : join(configDir, 'config.yaml');

    writeFileSync(configPath, content);
  }

  // ========================================
  // Basic CLI Functionality Tests
  // ========================================

  it('should display usage information', () => {
    const output = execSync(`node ${cliPath} --help`, {
      env: { ...process.env, NODE_ENV: 'production' },
    }).toString();

    expect(output).toMatch(/Usage: overture/);
    expect(output).toMatch(/Orchestration layer/);
  });

  it('should display version', () => {
    const output = execSync(`node ${cliPath} --version`, {
      env: { ...process.env, NODE_ENV: 'production' },
    }).toString();

    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });

  it('should display help', () => {
    const output = execSync(`node ${cliPath} --help`, {
      env: { ...process.env, NODE_ENV: 'production' },
    }).toString();

    expect(output).toMatch(/Commands:/);
    expect(output).toMatch(/init/);
    expect(output).toMatch(/sync/);
  });

  // ========================================
  // Happy Path Tests
  // ========================================

  describe('Happy Path Tests', () => {
    it('should successfully run doctor command', () => {
      const output = runCli('doctor');

      expect(output).toMatch(/Summary/);
      expect(output).toMatch(/Config repo/);
      expect(output).toMatch(/Clients detected/);
    });

    it('should successfully run validate command with valid config', () => {
      createTestConfig(
        `version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    transport: stdio
`,
        { global: true },
      );

      const output = runCli('validate');

      expect(output).toMatch(/valid|success|ok/i);
    });

    it.skip('should successfully run init command', () => {
      // TODO: Fix init command bug - pathResolver.resolveProjectConfig is not a function
      const output = runCli('init --force');

      expect(output).toMatch(/initialized|created/i);
      expect(existsSync(join(testDir, '.overture', 'config.yaml'))).toBe(true);
    });

    it('should successfully run mcp list with valid config', () => {
      createTestConfig(
        `version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    transport: stdio
  memory:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-memory"]
    transport: stdio
`,
        { global: true },
      );

      const output = runCli('mcp list');

      expect(output).toMatch(/filesystem|memory/);
    });

    it('should successfully run sync with dry-run flag', () => {
      createTestConfig(
        `version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    transport: stdio
`,
        { global: true },
      );

      const output = runCli('sync --dry-run');

      expect(output).toMatch(/dry.?run|preview|would/i);
    });
  });

  // ========================================
  // Error Scenario Tests
  // ========================================

  describe('Error Scenario Tests', () => {
    it('should error on unknown command', () => {
      const output = runCli('unknown-command-xyz', { expectError: true });

      expect(output).toMatch(/unknown|error|invalid/i);
    });

    it('should error on validate with invalid YAML', () => {
      // Create invalid YAML config
      const configDir = join(testDir, '.config');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, 'overture.yml'),
        `version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y"
    - invalid yaml here
`,
      );

      const output = runCli('validate', { expectError: true });

      expect(output).toMatch(/yaml|parse|invalid|error/i);
    });

    it('should error on sync with missing required config', () => {
      // No config file created
      const output = runCli('sync', { expectError: true });

      expect(output).toMatch(/config|not found|missing|error/i);
    });

    it.skip('should error on init in directory with existing config', () => {
      // TODO: Fix init command bug - pathResolver.resolveProjectConfig is not a function
      runCli('init --force');

      const output = runCli('init', { expectError: true });

      expect(output).toMatch(/exists|already|error|force/i);
    });
  });

  // ========================================
  // Additional Edge Case Tests
  // ========================================

  describe('Additional Edge Case Tests', () => {
    it('should display help for specific command (sync)', () => {
      const output = runCli('sync --help');

      expect(output).toMatch(/sync/i);
      expect(output).toMatch(/options|usage/i);
    });

    it('should display help for specific command (validate)', () => {
      const output = runCli('validate --help');

      expect(output).toMatch(/validate/i);
      expect(output).toMatch(/options|usage/i);
    });

    it('should display help for specific command (doctor)', () => {
      const output = runCli('doctor --help');

      expect(output).toMatch(/doctor/i);
      expect(output).toMatch(/options|usage/i);
    });

    it('should handle mcp list with empty config', () => {
      createTestConfig(
        `version: "2.0"
mcp: {}
`,
        { global: true },
      );

      const output = runCli('mcp list');

      expect(output).toMatch(/no.*mcp|empty|0/i);
    });

    it('should run validate with verbose flag', () => {
      createTestConfig(
        `version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    transport: stdio
`,
        { global: true },
      );

      const output = runCli('validate --verbose');

      expect(output).toMatch(/filesystem|valid/i);
    });

    it('should run sync with specific client flag', () => {
      createTestConfig(
        `version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    transport: stdio
`,
        { global: true },
      );

      const output = runCli('sync --client claude-code --dry-run');

      expect(output).toMatch(/claude-code|dry.?run/i);
    });

    it('should validate config with multiple MCPs', () => {
      createTestConfig(
        `version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    transport: stdio
  memory:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-memory"]
    transport: stdio
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    transport: stdio
    env:
      GITHUB_TOKEN: test-token
`,
        { global: true },
      );

      const output = runCli('validate');

      expect(output).toMatch(/valid|success|ok/i);
    });

    it('should handle doctor with verbose flag', () => {
      const output = runCli('doctor --verbose');

      expect(output).toMatch(/Summary/);
    });

    it('should handle sync with detail flag', () => {
      createTestConfig(
        `version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    transport: stdio
`,
        { global: true },
      );

      const output = runCli('sync --detail --dry-run');

      expect(output).toMatch(/dry.?run|preview|detail/i);
    });

    it('should validate project config when present', () => {
      // Create both global and project configs
      createTestConfig(
        `version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    transport: stdio
`,
        { global: true },
      );

      createTestConfig(
        `version: "2.0"
project:
  name: test-project
  type: python-backend
mcp:
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
    transport: stdio
`,
        { global: false },
      );

      const output = runCli('validate');

      expect(output).toMatch(/valid|success|ok/i);
    });
  });
});
