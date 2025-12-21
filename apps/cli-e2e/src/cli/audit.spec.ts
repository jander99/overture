/**
 * E2E Tests for Audit Command
 *
 * These tests verify the audit command functionality with real client configs
 * and Overture configurations. Tests cover:
 * - Detecting unmanaged MCPs in single/multiple clients
 * - Client-specific auditing
 * - Output formatting and suggestions
 * - Error handling and edge cases
 *
 * @module cli-e2e/audit
 */

import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Audit Command E2E Tests', () => {
  let testDir: string;
  let overtureConfigDir: string;
  let claudeCodeConfigPath: string;
  let vscodeConfigPath: string;
  let cliPath: string;

  beforeEach(() => {
    // Create unique test directory
    testDir = join(
      tmpdir(),
      `overture-audit-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testDir, { recursive: true });

    // Set up config directories
    overtureConfigDir = join(testDir, '.overture');
    mkdirSync(overtureConfigDir, { recursive: true });

    // Client config paths
    const claudeCodeDir = join(testDir, '.config', 'claude');
    const vscodeDir = join(testDir, '.config', 'Code', 'User');

    mkdirSync(claudeCodeDir, { recursive: true });
    mkdirSync(vscodeDir, { recursive: true });

    claudeCodeConfigPath = join(claudeCodeDir, 'mcp.json');
    vscodeConfigPath = join(vscodeDir, 'mcp.json');

    // CLI executable path
    cliPath = join(process.cwd(), 'dist/apps/cli/main.js');

    // Verify CLI exists
    if (!existsSync(cliPath)) {
      throw new Error(
        `CLI not built at ${cliPath}. Run: nx build @overture/cli`,
      );
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper: Create Overture config file
   */
  function createOvertureConfig(mcpNames: string[]): void {
    const config: any = {
      version: '2.0',
      mcp: {},
    };

    mcpNames.forEach((name) => {
      config.mcp[name] = {
        command: `mcp-server-${name}`,
        args: [],
        env: {},
        transport: 'stdio',
      };
    });

    // Write to user config (required by config-loader)
    const userConfigDir = join(testDir, '.config');
    mkdirSync(userConfigDir, { recursive: true });
    const userConfigPath = join(userConfigDir, 'overture.yml');

    // Use YAML format
    const yaml = require('js-yaml');
    writeFileSync(userConfigPath, yaml.dump(config));
  }

  /**
   * Helper: Create Claude Code config file
   */
  function createClaudeCodeConfig(mcpNames: string[]): void {
    const config: any = {
      mcpServers: {},
    };

    mcpNames.forEach((name) => {
      config.mcpServers[name] = {
        command: `mcp-server-${name}`,
        args: [],
      };
    });

    writeFileSync(claudeCodeConfigPath, JSON.stringify(config, null, 2));
  }

  /**
   * Helper: Create VSCode config file
   */
  function createVSCodeConfig(mcpNames: string[]): void {
    const config: any = {
      servers: {}, // VS Code uses "servers" not "mcpServers"
    };

    mcpNames.forEach((name) => {
      config.servers[name] = {
        command: `mcp-server-${name}`,
        args: [],
      };
    });

    writeFileSync(vscodeConfigPath, JSON.stringify(config, null, 2));
  }

  /**
   * Helper: Run overture audit command
   */
  function runAudit(args: string[] = []): {
    stdout: string;
    stderr: string;
    exitCode: number;
  } {
    try {
      const stdout = execSync(`node ${cliPath} audit ${args.join(' ')}`, {
        cwd: testDir,
        encoding: 'utf-8',
        env: {
          ...process.env,
          HOME: testDir,
          XDG_CONFIG_HOME: join(testDir, '.config'),
        },
      });

      return { stdout, stderr: '', exitCode: 0 };
    } catch (error: any) {
      return {
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || '',
        exitCode: error.status || 1,
      };
    }
  }

  /**
   * Test 1: Detect Unmanaged MCPs in Single Client
   */
  describe('Scenario 1: Detect Unmanaged MCPs', () => {
    it('should detect unmanaged MCPs in Claude Code config', () => {
      // Create Overture config with 2 MCPs
      createOvertureConfig(['filesystem', 'memory']);

      // Create Claude Code config with 4 MCPs (2 extra)
      createClaudeCodeConfig(['filesystem', 'memory', 'github', 'slack']);

      // Run audit
      const result = runAudit();

      // Verify detects 2 unmanaged MCPs
      expect(result.stdout).toContain('Found 2 unmanaged MCP(s)');
      expect(result.stdout).toContain('github');
      expect(result.stdout).toContain('slack');

      // Verify suggestions
      expect(result.stdout).toContain('overture user add mcp github');
      expect(result.stdout).toContain('overture user add mcp slack');

      // Verify success exit code
      expect(result.exitCode).toBe(0);
    });
  });

  /**
   * Test 2: Audit All Installed Clients
   */
  describe('Scenario 2: Audit All Installed Clients', () => {
    it('should show findings for multiple clients', () => {
      // Create Overture config with common MCPs
      createOvertureConfig(['filesystem', 'memory']);

      // Create Claude Code config with extra MCP
      createClaudeCodeConfig(['filesystem', 'memory', 'github']);

      // Create VSCode config with different extra MCP
      createVSCodeConfig(['filesystem', 'memory', 'slack']);

      // Run audit (no client specified = all clients)
      const result = runAudit();

      // Verify shows findings for both clients
      expect(result.stdout).toContain('claude-code');
      expect(result.stdout).toContain('vscode');
      expect(result.stdout).toContain('github');
      expect(result.stdout).toContain('slack');

      // Verify total count
      expect(result.stdout).toContain('Found 2 unmanaged MCP(s)');

      // Verify consolidated suggestions
      expect(result.stdout).toContain('overture user add mcp github');
      expect(result.stdout).toContain('overture user add mcp slack');

      expect(result.exitCode).toBe(0);
    });
  });

  /**
   * Test 3: Audit Specific Client
   */
  describe('Scenario 3: Audit Specific Client', () => {
    it('should only audit Claude Code when specified', () => {
      // Create Overture config
      createOvertureConfig(['filesystem']);

      // Create configs with unmanaged MCPs
      createClaudeCodeConfig(['filesystem', 'github']);
      createVSCodeConfig(['filesystem', 'slack']);

      // Run audit for claude-code only
      const result = runAudit(['--client', 'claude-code']);

      // Verify only shows claude-code findings
      expect(result.stdout).toContain('Auditing client: claude-code');
      expect(result.stdout).toContain('github');
      expect(result.stdout).not.toContain('slack');
      expect(result.stdout).not.toContain('vscode');

      expect(result.exitCode).toBe(0);
    });

    it('should only audit VSCode when specified', () => {
      // Create Overture config
      createOvertureConfig(['filesystem']);

      // Create configs with unmanaged MCPs
      createClaudeCodeConfig(['filesystem', 'github']);
      createVSCodeConfig(['filesystem', 'slack']);

      // Run audit for vscode only
      const result = runAudit(['--client', 'vscode']);

      // Verify only shows vscode findings
      expect(result.stdout).toContain('Auditing client: vscode');
      expect(result.stdout).toContain('slack');
      expect(result.stdout).not.toContain('github');
      expect(result.stdout).not.toContain('claude-code');

      expect(result.exitCode).toBe(0);
    });
  });

  /**
   * Test 4: No Unmanaged MCPs Found
   */
  describe('Scenario 4: No Unmanaged MCPs Found', () => {
    it('should show success message when all MCPs are managed', () => {
      // Create Overture config with MCPs
      createOvertureConfig(['filesystem', 'memory', 'github']);

      // Create client config with exact same MCPs
      createClaudeCodeConfig(['filesystem', 'memory', 'github']);

      // Run audit
      const result = runAudit();

      // Verify success message
      expect(result.stdout).toContain('No unmanaged MCPs found');
      expect(result.stdout).toContain(
        'All client MCPs are managed by Overture',
      );

      // Verify exit code
      expect(result.exitCode).toBe(0);
    });

    it('should handle subset of MCPs (client has fewer)', () => {
      // Overture manages more MCPs than client uses
      createOvertureConfig(['filesystem', 'memory', 'github', 'slack']);

      // Client only uses subset
      createClaudeCodeConfig(['filesystem', 'memory']);

      // Run audit
      const result = runAudit();

      // Should show no unmanaged MCPs (client's MCPs are all managed)
      expect(result.stdout).toContain('No unmanaged MCPs found');

      expect(result.exitCode).toBe(0);
    });
  });

  /**
   * Test 5: Client Not Found
   */
  describe('Scenario 5: Client Not Found', () => {
    it.skip('should show error for unknown client', () => {
      // Create Overture config
      createOvertureConfig(['filesystem']);

      // Run audit with nonexistent client
      const result = runAudit(['--client', 'nonexistent-client']);

      // Verify error shown
      expect(result.stdout).toContain('Unknown client: nonexistent-client');
      expect(result.stdout).toContain('Available clients');

      // Verify non-zero exit code
      expect(result.exitCode).not.toBe(0);
    });
  });

  /**
   * Test 6: Missing Client Configs
   */
  describe('Scenario 6: Missing Client Configs', () => {
    it.skip('should handle gracefully when no clients installed', () => {
      // Create Overture config but no client configs
      createOvertureConfig(['filesystem', 'memory']);

      // Don't create any client config files
      // (they don't exist, so clients appear uninstalled)

      // Run audit
      const result = runAudit();

      // Verify handles gracefully
      expect(result.stdout).toContain('No installed AI clients detected');

      // Verify doesn't crash
      expect(result.exitCode).not.toBe(0);
    });

    it('should skip client when config not found but client specified', () => {
      // Create Overture config
      createOvertureConfig(['filesystem']);

      // Run audit for claude-code but don't create its config
      const result = runAudit(['--client', 'claude-code']);

      // Should indicate client not installed
      expect(result.stdout).toMatch(/not installed|No unmanaged MCPs found/);

      // Command should not crash
      expect(result.exitCode).toBe(0);
    });
  });

  /**
   * Test 7: Deduplication Across Clients
   */
  describe('Scenario 7: Deduplication Across Clients', () => {
    it('should deduplicate suggestions when same MCP in multiple clients', () => {
      // Create Overture config
      createOvertureConfig(['filesystem']);

      // Both clients have same extra MCP "github"
      createClaudeCodeConfig(['filesystem', 'github']);
      createVSCodeConfig(['filesystem', 'github']);

      // Run audit
      const result = runAudit();

      // Verify "github" appears in both client sections
      expect(result.stdout).toContain('claude-code');
      expect(result.stdout).toContain('vscode');

      // But suggestion should only appear once
      const matches = result.stdout.match(/overture user add mcp github/g);
      expect(matches).toHaveLength(1);

      expect(result.exitCode).toBe(0);
    });
  });

  /**
   * Test 8: Empty Overture Config
   */
  describe('Scenario 8: Empty Overture Config', () => {
    it('should detect all client MCPs as unmanaged when Overture config is empty', () => {
      // Create empty Overture config
      createOvertureConfig([]);

      // Create client config with MCPs
      createClaudeCodeConfig(['filesystem', 'memory', 'github']);

      // Run audit
      const result = runAudit();

      // All client MCPs should be detected as unmanaged
      expect(result.stdout).toContain('Found 3 unmanaged MCP(s)');
      expect(result.stdout).toContain('filesystem');
      expect(result.stdout).toContain('memory');
      expect(result.stdout).toContain('github');

      // Verify suggestions for all MCPs
      expect(result.stdout).toContain('overture user add mcp filesystem');
      expect(result.stdout).toContain('overture user add mcp github');
      expect(result.stdout).toContain('overture user add mcp memory');

      expect(result.exitCode).toBe(0);
    });

    it('should handle missing Overture config file', () => {
      // Don't create Overture config at all

      // Create client config
      createClaudeCodeConfig(['filesystem', 'memory']);

      // Run audit
      const result = runAudit();

      // Should handle gracefully (may error about missing config)
      // The exact behavior depends on implementation
      // Either detects as unmanaged OR errors about missing config
      expect(result.exitCode).not.toBe(0); // Expected to fail without config
    });
  });

  /**
   * Test 9: Mixed Managed and Unmanaged
   */
  describe('Scenario 9: Mixed Managed and Unmanaged', () => {
    it('should only report unmanaged MCPs, not managed ones', () => {
      // Create Overture config with: filesystem, memory, github
      createOvertureConfig(['filesystem', 'memory', 'github']);

      // Create client config with: filesystem, memory, github, slack, postgres
      createClaudeCodeConfig([
        'filesystem',
        'memory',
        'github',
        'slack',
        'postgres',
      ]);

      // Run audit
      const result = runAudit();

      // Verify detects only slack and postgres as unmanaged
      expect(result.stdout).toContain('Found 2 unmanaged MCP(s)');
      expect(result.stdout).toContain('slack');
      expect(result.stdout).toContain('postgres');

      // Verify doesn't report managed MCPs
      expect(result.stdout).not.toContain('overture user add mcp filesystem');
      expect(result.stdout).not.toContain('overture user add mcp memory');
      expect(result.stdout).not.toContain('overture user add mcp github');

      // Verify suggestions only for unmanaged
      expect(result.stdout).toContain('overture user add mcp postgres');
      expect(result.stdout).toContain('overture user add mcp slack');

      expect(result.exitCode).toBe(0);
    });
  });

  /**
   * Test 10: Output Formatting
   */
  describe('Scenario 10: Output Formatting', () => {
    it.skip('should produce well-formatted output with clear sections', () => {
      // Create scenario with findings
      createOvertureConfig(['filesystem']);
      createClaudeCodeConfig(['filesystem', 'github', 'slack']);
      createVSCodeConfig(['filesystem', 'memory']);

      // Run audit
      const result = runAudit();

      // Verify loading message
      expect(result.stdout).toContain('Loading Overture configuration');

      // Verify client section headers
      expect(result.stdout).toContain('claude-code:');
      expect(result.stdout).toContain('vscode:');

      // Verify indentation (MCPs under clients)
      const lines = result.stdout.split('\n');
      const claudeCodeIdx = lines.findIndex((line) =>
        line.includes('claude-code:'),
      );
      const nextLines = lines.slice(claudeCodeIdx + 1, claudeCodeIdx + 5);

      // Should have indented MCP names
      const hasIndentedMcps = nextLines.some((line) =>
        line.match(/^\s{2,}- \w+/),
      );
      expect(hasIndentedMcps).toBe(true);

      // Verify suggestions section
      expect(result.stdout).toContain('Suggestions:');
      expect(result.stdout).toContain('To add these MCPs to Overture, run:');

      // Verify suggestions are commands
      expect(result.stdout).toContain('overture user add mcp');

      expect(result.exitCode).toBe(0);
    });

    it('should show summary count with correct numbers', () => {
      // Create scenario with multiple unmanaged MCPs
      createOvertureConfig(['filesystem']);
      createClaudeCodeConfig(['filesystem', 'github', 'slack', 'memory']);

      // Run audit
      const result = runAudit();

      // Verify count
      expect(result.stdout).toContain('Found 3 unmanaged MCP(s)');

      // Verify all MCPs listed
      expect(result.stdout).toContain('github');
      expect(result.stdout).toContain('slack');
      expect(result.stdout).toContain('memory');

      expect(result.exitCode).toBe(0);
    });
  });

  /**
   * Test 11: Suggestions Sorted Alphabetically
   */
  describe('Scenario 11: Suggestions Sorted Alphabetically', () => {
    it('should sort suggestions alphabetically', () => {
      // Create Overture config
      createOvertureConfig(['filesystem']);

      // Create client with unsorted MCPs
      createClaudeCodeConfig(['filesystem', 'zebra', 'apple', 'memory']);

      // Run audit
      const result = runAudit();

      // Extract suggestions section
      const suggestionsMatch = result.stdout.match(/Suggestions:[\s\S]*$/);
      expect(suggestionsMatch).toBeTruthy();

      const suggestionsText = suggestionsMatch![0];

      // Verify order (apple before memory before zebra)
      const appleIdx = suggestionsText.indexOf('overture user add mcp apple');
      const memoryIdx = suggestionsText.indexOf('overture user add mcp memory');
      const zebraIdx = suggestionsText.indexOf('overture user add mcp zebra');

      expect(appleIdx).toBeLessThan(memoryIdx);
      expect(memoryIdx).toBeLessThan(zebraIdx);

      expect(result.exitCode).toBe(0);
    });
  });

  /**
   * Test 12: Large Config Performance
   */
  describe('Scenario 12: Large Config Performance', () => {
    it('should handle large number of MCPs efficiently', () => {
      // Create Overture config with 20 MCPs
      const managedMcps = Array.from(
        { length: 20 },
        (_, i) => `managed-mcp-${i}`,
      );
      createOvertureConfig(managedMcps);

      // Create client config with 30 MCPs (10 unmanaged)
      const clientMcps = [
        ...managedMcps,
        ...Array.from({ length: 10 }, (_, i) => `unmanaged-mcp-${i}`),
      ];
      createClaudeCodeConfig(clientMcps);

      // Run audit
      const startTime = Date.now();
      const result = runAudit();
      const duration = Date.now() - startTime;

      // Verify correct detection
      expect(result.stdout).toContain('Found 10 unmanaged MCP(s)');

      // Should complete in reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);

      // Verify all unmanaged MCPs detected
      for (let i = 0; i < 10; i++) {
        expect(result.stdout).toContain(`unmanaged-mcp-${i}`);
      }

      expect(result.exitCode).toBe(0);
    });
  });
});
