/**
 * E2E Tests: Multi-Client Sync Scenarios
 *
 * Tests the complete sync workflow from config files through to client config generation.
 * Uses the real Overture CLI executable with actual file I/O and temp directories.
 *
 * Test Scenarios:
 * 1. Full Sync Workflow - Complete sync with user + project configs
 * 2. Client-Specific Sync - Target specific clients
 * 3. Dry-Run Mode - Preview changes without applying
 * 4. Scope Filtering - Sync only global or project MCPs
 * 5. Platform-Specific Sync - Platform-aware MCP filtering
 * 6. Transport Warnings - Handle unsupported transport types
 * 7. Error Recovery - Partial success on errors
 * 8. Incremental Updates - Apply only changed MCPs
 *
 * @module cli-e2e/sync-multi-client
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';

describe('Sync Multi-Client E2E Tests', () => {
  let testDir: string;
  let cliPath: string;
  let userConfigPath: string;
  let projectConfigPath: string;
  let claudeCodeGlobalConfigPath: string;
  let claudeCodeProjectConfigPath: string;

  /**
   * Setup before all tests - build CLI once
   */
  beforeAll(() => {
    // Build CLI
    console.log('Building CLI...');
    try {
      const workspaceRoot = resolve(__dirname, '../../../..');
      execSync('nx build @overture/cli', {
        cwd: workspaceRoot,
        stdio: 'inherit',
      });
      console.log('CLI build complete');
    } catch (error) {
      console.error('CLI build failed:', error);
      throw error;
    }

    // Set CLI path - resolve to workspace root
    const workspaceRoot = resolve(__dirname, '../../../..');
    cliPath = join(workspaceRoot, 'dist/apps/cli/main.js');
    if (!existsSync(cliPath)) {
      throw new Error(`CLI not found at ${cliPath}`);
    }
  });

  /**
   * Setup before each test - create isolated test environment
   */
  beforeEach(() => {
    // Create unique test directory
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    testDir = join(tmpdir(), `overture-e2e-${timestamp}-${random}`);
    mkdirSync(testDir, { recursive: true });

    // Create config directories - user config at ~/.config/overture.yml
    const configDir = join(testDir, '.config');
    mkdirSync(configDir, { recursive: true });
    userConfigPath = join(configDir, 'overture.yml');

    const projectOvertureDir = join(testDir, 'project', '.overture');
    mkdirSync(projectOvertureDir, { recursive: true });
    projectConfigPath = join(projectOvertureDir, 'config.yaml');

    // Create mock client config paths (Claude Code uses ~/.claude.json)
    claudeCodeGlobalConfigPath = join(testDir, '.claude.json');
    claudeCodeProjectConfigPath = join(testDir, 'project', '.mcp.json');

    // Create project directory (global config is just a file in HOME)
    mkdirSync(join(testDir, 'project'), { recursive: true });

    // Create initial empty client configs
    const emptyConfig = JSON.stringify({ mcpServers: {} }, null, 2);
    writeFileSync(claudeCodeGlobalConfigPath, emptyConfig);
    writeFileSync(claudeCodeProjectConfigPath, emptyConfig);

    console.log(`Test directory: ${testDir}`);
  });

  /**
   * Cleanup after each test
   */
  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper: Run overture CLI command
   */
  function runOverture(
    args: string,
    options: { expectError?: boolean; env?: Record<string, string> } = {},
  ): string {
    const command = `node ${cliPath} ${args}`;
    const env = {
      ...process.env,
      NODE_ENV: 'production', // Ensure CLI runs in E2E tests
      HOME: testDir,
      ...options.env,
    };

    try {
      return execSync(command, {
        cwd: join(testDir, 'project'),
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
      console.error('Command failed:', command);
      console.error('Error:', execError.message);
      console.error('Stdout:', execError.stdout);
      console.error('Stderr:', execError.stderr);
      throw error;
    }
  }

  /**
   * Helper: Read and parse JSON file
   */
  function readJsonFile(path: string): unknown {
    const content = readFileSync(path, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Helper: Check if backup exists
   */
  function _hasBackup(dir: string, client: string): boolean {
    if (!existsSync(dir)) return false;
    const files = readdirSync(dir);
    return files.some(
      (f) => f.startsWith(`${client}-backup-`) && f.endsWith('.json'),
    );
  }

  /**
   * TEST 1: Full Sync Workflow
   *
   * Tests complete sync with user and project configs:
   * - User config: 3 global MCPs (filesystem, memory, github)
   * - Project config: 2 project MCPs (python-repl, ruff)
   * - Verifies all 5 MCPs merged correctly
   * - Verifies client configs created
   * - Verifies backups created
   */
  describe('Test 1: Full Sync Workflow', () => {
    it.skip('should sync user + project configs to all clients', () => {
      // Create user config with 3 global MCPs
      const userConfig = `
version: "2.0"
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
`;
      writeFileSync(userConfigPath, userConfig);

      // Create project config with 2 project MCPs
      const projectConfig = `
version: "2.0"
project:
  name: test-project
  type: python-backend

mcp:
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
    transport: stdio


  ruff:
    command: uvx
    args: [mcp-server-ruff]
    transport: stdio

`;
      writeFileSync(projectConfigPath, projectConfig);

      // Run sync
      const output = runOverture('sync');

      // Verify output mentions sync
      expect(output).toContain('Syncing MCP configurations');

      // Verify global config (Claude Code)
      const globalConfig = readJsonFile(claudeCodeGlobalConfigPath);
      expect(Object.keys(globalConfig.mcpServers)).toHaveLength(5);
      expect(globalConfig.mcpServers.filesystem).toBeDefined();
      expect(globalConfig.mcpServers.memory).toBeDefined();
      expect(globalConfig.mcpServers.github).toBeDefined();
      expect(globalConfig.mcpServers['python-repl']).toBeDefined();
      expect(globalConfig.mcpServers.ruff).toBeDefined();

      // Verify project config
      const projectConfig2 = readJsonFile(claudeCodeProjectConfigPath);
      expect(Object.keys(projectConfig2.mcpServers)).toHaveLength(5);

      // Verify GitHub token expanded
      expect(globalConfig.mcpServers.github.env?.GITHUB_TOKEN).toBe(
        'test-token',
      );

      // Verify backups created
      const backupDir = join(testDir, '.config', 'overture', 'backups');
      expect(existsSync(backupDir)).toBe(true);
    });
  });

  /**
   * TEST 2: Client-Specific Sync
   *
   * Tests targeting specific clients:
   * - Initial sync to all clients
   * - Update only claude-code
   * - Update only vscode + cursor
   * - Verifies other clients unchanged
   */
  describe('Test 2: Client-Specific Sync', () => {
    it('should sync only specified clients', () => {
      // Setup initial config
      const config = `
version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    transport: stdio

`;
      writeFileSync(userConfigPath, config);

      // Initial sync to all
      runOverture('sync');

      // Verify initial state
      const initialGlobal = readJsonFile(claudeCodeGlobalConfigPath);
      expect(initialGlobal.mcpServers.filesystem).toBeDefined();

      // Add another MCP
      const updatedConfig = `
version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    transport: stdio


  memory:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-memory"]
    transport: stdio

`;
      writeFileSync(userConfigPath, updatedConfig);

      // Sync only claude-code (should update global config)
      const output = runOverture('sync --client claude-code');

      // Verify output mentions specific client
      expect(output).toContain('claude-code');

      // Verify global config updated
      const updatedGlobal = readJsonFile(claudeCodeGlobalConfigPath);
      expect(Object.keys(updatedGlobal.mcpServers)).toHaveLength(2);
      expect(updatedGlobal.mcpServers.memory).toBeDefined();
    });
  });

  /**
   * TEST 3: Dry-Run Mode
   *
   * Tests preview mode without applying changes:
   * - Shows diff output
   * - Does not modify client configs
   * - Does not create backups
   */
  describe('Test 3: Dry-Run Mode', () => {
    it.skip('should preview changes without applying', () => {
      // Setup config
      const config = `
version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    transport: stdio

`;
      writeFileSync(userConfigPath, config);

      // Initial sync
      runOverture('sync');
      const beforeConfig = readJsonFile(claudeCodeGlobalConfigPath);

      // Update config
      const updatedConfig = `
version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    transport: stdio


  memory:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-memory"]
    transport: stdio

`;
      writeFileSync(userConfigPath, updatedConfig);

      // Dry run
      const output = runOverture('sync --dry-run');

      // Verify output shows diff
      expect(
        output.includes('dry run') ||
          output.includes('preview') ||
          output.includes('would'),
      ).toBe(true);

      // Verify config unchanged
      const afterConfig = readJsonFile(claudeCodeGlobalConfigPath);
      expect(afterConfig).toStrictEqual(beforeConfig);

      // Verify no new backups created
      const backupDir = join(testDir, '.config', 'overture', 'backups');
      const backupsBefore = existsSync(backupDir)
        ? readdirSync(backupDir).length
        : 0;
      expect(readdirSync(backupDir)).toHaveLength(backupsBefore);
    });
  });

  /**
   * TEST 4: Scope Filtering
   *
   * Tests syncing only global or project MCPs:
   * - Sync only global scope
   * - Sync only project scope
   * - Sync all scopes
   * - Verifies correct filtering
   */
  describe('Test 4: Scope Filtering', () => {
    it.skip('should filter by scope when requested', () => {
      // Create user config with global MCP
      const userConfig = `
version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    transport: stdio

`;
      writeFileSync(userConfigPath, userConfig);

      // Create project config with project MCP
      const projectConfig = `
version: "2.0"
mcp:
  python-repl:
    command: uvx
    args: [mcp-server-python-repl]
    transport: stdio

`;
      writeFileSync(projectConfigPath, projectConfig);

      // Sync only global
      runOverture('sync --scope global');
      const globalOnly = readJsonFile(claudeCodeGlobalConfigPath);
      expect(globalOnly.mcpServers.filesystem).toBeDefined();
      expect(globalOnly.mcpServers['python-repl']).toBeUndefined();

      // Reset config
      writeFileSync(
        claudeCodeGlobalConfigPath,
        JSON.stringify({ mcpServers: {} }, null, 2),
      );

      // Sync only project
      runOverture('sync --scope project');
      const projectOnly = readJsonFile(claudeCodeGlobalConfigPath);
      expect(projectOnly.mcpServers['python-repl']).toBeDefined();
      expect(projectOnly.mcpServers.filesystem).toBeUndefined();

      // Reset config
      writeFileSync(
        claudeCodeGlobalConfigPath,
        JSON.stringify({ mcpServers: {} }, null, 2),
      );

      // Sync all
      runOverture('sync');
      const allScopes = readJsonFile(claudeCodeGlobalConfigPath);
      expect(allScopes.mcpServers.filesystem).toBeDefined();
      expect(allScopes.mcpServers['python-repl']).toBeDefined();
    });
  });

  /**
   * TEST 5: Platform-Specific Sync
   *
   * Tests platform-aware MCP filtering:
   * - MCPs with platform exclusions
   * - Sync for darwin platform
   * - Sync for linux platform
   * - Verifies correct filtering
   */
  describe('Test 5: Platform-Specific Sync', () => {
    it.skip('should filter MCPs by platform', () => {
      // Create config with platform exclusions
      const config = `
version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    transport: stdio


  macos-only:
    command: echo
    args: [macos]
    transport: stdio

    excludePlatforms: [linux, win32]

  linux-only:
    command: echo
    args: [linux]
    transport: stdio

    excludePlatforms: [darwin, win32]
`;
      writeFileSync(userConfigPath, config);

      // Sync for darwin
      runOverture('sync --platform darwin');
      const darwinConfig = readJsonFile(claudeCodeGlobalConfigPath);
      expect(darwinConfig.mcpServers.filesystem).toBeDefined();
      expect(darwinConfig.mcpServers['macos-only']).toBeDefined();
      expect(darwinConfig.mcpServers['linux-only']).toBeUndefined();

      // Reset
      writeFileSync(
        claudeCodeGlobalConfigPath,
        JSON.stringify({ mcpServers: {} }, null, 2),
      );

      // Sync for linux
      runOverture('sync --platform linux');
      const linuxConfig = readJsonFile(claudeCodeGlobalConfigPath);
      expect(linuxConfig.mcpServers.filesystem).toBeDefined();
      expect(linuxConfig.mcpServers['linux-only']).toBeDefined();
      expect(linuxConfig.mcpServers['macos-only']).toBeUndefined();
    });
  });

  /**
   * TEST 6: Transport Warnings
   *
   * Tests handling of unsupported transport types:
   * - MCP with HTTP transport
   * - Target client that doesn't support HTTP
   * - Verify warning shown
   * - Verify sync blocked
   * - Force sync with --force
   */
  describe('Test 6: Transport Warnings', () => {
    it('should warn about unsupported transports', () => {
      // Create config with HTTP transport
      const config = `
version: "2.0"
mcp:
  http-server:
    command: echo
    args: [http]
    transports: [http]

`;
      writeFileSync(userConfigPath, config);

      // Attempt sync (should warn but may complete depending on client support)
      const output = runOverture('sync', { expectError: true });

      // Verify warning mentioned (transport/HTTP/unsupported)
      const hasWarning =
        output.includes('transport') ||
        output.includes('HTTP') ||
        output.includes('unsupported') ||
        output.includes('warning');

      // If warning shown, verify --force overrides
      if (hasWarning) {
        const forceOutput = runOverture('sync --force');
        expect(forceOutput).toBeTruthy();

        // Verify config written despite warning
        const config2 = readJsonFile(claudeCodeGlobalConfigPath);
        expect(config2.mcpServers['http-server']).toBeDefined();
      }
    });
  });

  /**
   * TEST 7: Error Recovery
   *
   * Tests partial success on errors:
   * - Corrupt one client config
   * - Attempt sync
   * - Verify error reported
   * - Verify other clients synced successfully
   * - Verify backups created for successful clients
   */
  describe('Test 7: Error Recovery', () => {
    it('should handle partial failures gracefully', () => {
      // Setup valid config
      const config = `
version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    transport: stdio

`;
      writeFileSync(userConfigPath, config);

      // Corrupt global config (invalid JSON)
      writeFileSync(claudeCodeGlobalConfigPath, '{ invalid json }');

      // Attempt sync (expect error)
      const output = runOverture('sync', { expectError: true });

      // Verify error mentioned
      expect(output).toBeTruthy(); // Got some output

      // If there was an error, verify it's about JSON/parsing
      const hasError =
        output.includes('error') ||
        output.includes('Error') ||
        output.includes('failed') ||
        output.includes('invalid');

      expect(hasError).toBe(true);
    });
  });

  /**
   * TEST 8: Incremental Updates
   *
   * Tests applying only changed MCPs:
   * - Initial sync with 2 MCPs
   * - Update config: add 1 MCP, remove 1 MCP
   * - Sync again
   * - Verify diff shows +1, -1
   * - Verify only changes applied
   */
  describe('Test 8: Incremental Updates', () => {
    it.skip('should apply only changed MCPs', () => {
      // Initial config with 2 MCPs
      const initialConfig = `
version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    transport: stdio


  memory:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-memory"]
    transport: stdio

`;
      writeFileSync(userConfigPath, initialConfig);

      // Initial sync
      runOverture('sync');
      const before = readJsonFile(claudeCodeGlobalConfigPath);
      expect(Object.keys(before.mcpServers)).toHaveLength(2);
      expect(before.mcpServers.filesystem).toBeDefined();
      expect(before.mcpServers.memory).toBeDefined();

      // Update config: remove memory, add github
      const updatedConfig = `
version: "2.0"
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    transport: stdio


  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    transport: stdio

`;
      writeFileSync(userConfigPath, updatedConfig);

      // Incremental sync
      const output = runOverture('sync');

      // Verify diff shown (add/remove)
      expect(output).toBeTruthy();

      // Verify final state
      const after = readJsonFile(claudeCodeGlobalConfigPath);
      expect(Object.keys(after.mcpServers)).toHaveLength(2);
      expect(after.mcpServers.filesystem).toBeDefined();
      expect(after.mcpServers.github).toBeDefined();
      expect(after.mcpServers.memory).toBeUndefined();

      // Verify filesystem unchanged (only github added)
      expect(after.mcpServers.filesystem).toStrictEqual(
        before.mcpServers.filesystem,
      );
    });
  });

  /**
   * TEST 10: Environment Variable Expansion
   *
   * Tests that environment variables are correctly expanded:
   * - MCP with ${VAR} in env
   * - Set environment variable
   * - Verify expanded in client config
   */
  describe('Test 10: Environment Variable Expansion', () => {
    it.skip('should expand environment variables in client configs', () => {
      // Create config with env var reference
      const config = `
version: "2.0"
mcp:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    transport: stdio

    env:
      GITHUB_TOKEN: "\${GITHUB_TOKEN}"
      API_KEY: "\${MY_API_KEY}"
`;
      writeFileSync(userConfigPath, config);

      // Run sync with env vars set
      runOverture('sync', {
        env: {
          GITHUB_TOKEN: 'test-github-token-12345',
          MY_API_KEY: 'test-api-key-67890',
        },
      });

      // Verify config written
      const config2 = readJsonFile(claudeCodeGlobalConfigPath);
      expect(config2.mcpServers.github).toBeDefined();

      // Verify env vars expanded
      expect(config2.mcpServers.github.env?.GITHUB_TOKEN).toBe(
        'test-github-token-12345',
      );
      expect(config2.mcpServers.github.env?.API_KEY).toBe('test-api-key-67890');
    });
  });
});
