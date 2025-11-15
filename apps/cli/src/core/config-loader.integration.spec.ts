/**
 * Integration Tests for Config Loader
 *
 * These tests use real YAML files and the actual file system to validate
 * config loading, merging, precedence, and error handling.
 *
 * @module core/config-loader.integration.spec
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  loadUserConfig,
  loadProjectConfig,
  mergeConfigs,
  loadConfig,
  hasUserConfig,
  hasProjectConfig,
  ConfigLoadError,
  ConfigValidationError,
} from './config-loader';

// Mock path resolver to use temp paths
const mockGetUserConfigPath = jest.fn();
const mockGetProjectConfigPath = jest.fn();

jest.mock('./path-resolver', () => {
  const actual = jest.requireActual<typeof import('./path-resolver')>('./path-resolver');

  return {
    ...actual,
    getUserConfigPath: (...args: unknown[]) => mockGetUserConfigPath(...args),
    getProjectConfigPath: (...args: unknown[]) => mockGetProjectConfigPath(...args),
  };
});

import * as pathResolver from './path-resolver';

// Helper function to set mock paths
function setMockPaths(userPath: string, projectPath: string) {
  mockGetUserConfigPath.mockReturnValue(userPath);
  mockGetProjectConfigPath.mockReturnValue(projectPath);
}

describe('ConfigLoader Integration Tests', () => {
  const fixturesDir = path.join(__dirname, '__fixtures__', 'config-loader');
  let tempDir: string;

  beforeEach(() => {
    // Create temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'overture-test-'));

    // Clear all mocks
    mockGetUserConfigPath.mockClear();
    mockGetProjectConfigPath.mockClear();
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Config Precedence', () => {
    describe('User config only', () => {
      it('should load user config when project config does not exist', () => {
        // Setup: Copy user config to temp dir
        const userConfigPath = path.join(tempDir, 'overture.yml');
        fs.copyFileSync(path.join(fixturesDir, 'valid-user.yaml'), userConfigPath);

        // Mock path resolvers
        setMockPaths(userConfigPath, path.join(tempDir, '.overture', 'config.yaml'));

        // Test
        const config = loadConfig();

        // Verify
        expect(config.version).toBe('2.0');
        expect(config.mcp).toHaveProperty('filesystem');
        expect(config.mcp).toHaveProperty('github');
        expect(config.mcp).toHaveProperty('memory');
        expect(config.mcp).not.toHaveProperty('python-repl');
        expect(config.clients).toBeDefined();
        expect(config.clients?.['claude-code']?.enabled).toBe(true);
        expect(config.sync?.mergeStrategy).toBe('append');
      });

      it('should return user config as-is when no project config', () => {
        const userConfigPath = path.join(tempDir, 'overture.yml');
        fs.copyFileSync(path.join(fixturesDir, 'valid-user.yaml'), userConfigPath);

        setMockPaths(userConfigPath, path.join(tempDir, '.overture', 'config.yaml'));

        const userConfig = loadUserConfig();
        const projectConfig = null;
        const merged = mergeConfigs(userConfig, projectConfig);

        expect(merged).toEqual(userConfig);
      });
    });

    describe('Project config only', () => {
      it('should load project config and merge with user config', () => {
        // Setup both configs
        const userConfigPath = path.join(tempDir, 'overture.yml');
        const projectConfigPath = path.join(tempDir, '.overture', 'config.yaml');

        fs.mkdirSync(path.dirname(projectConfigPath), { recursive: true });
        fs.copyFileSync(path.join(fixturesDir, 'valid-user.yaml'), userConfigPath);
        fs.copyFileSync(path.join(fixturesDir, 'valid-project.yaml'), projectConfigPath);

        setMockPaths(userConfigPath, projectConfigPath);

        // Test
        const config = loadConfig();

        // Verify: should have both user and project MCPs
        expect(config.mcp).toHaveProperty('filesystem'); // from user
        expect(config.mcp).toHaveProperty('memory'); // from user
        expect(config.mcp).toHaveProperty('python-repl'); // from project
        expect(config.mcp).toHaveProperty('ruff'); // from project
      });

      it('should return null when project config does not exist', () => {
        const nonExistentPath = path.join(tempDir, '.overture', 'config.yaml');
        setMockPaths(path.join(tempDir, 'overture.yml'), nonExistentPath);

        const projectConfig = loadProjectConfig();

        expect(projectConfig).toBeNull();
      });
    });

    describe('Both configs (project overrides user)', () => {
      it('should override user MCP settings with project settings', () => {
        const userConfigPath = path.join(tempDir, 'overture.yml');
        const projectConfigPath = path.join(tempDir, '.overture', 'config.yaml');

        fs.mkdirSync(path.dirname(projectConfigPath), { recursive: true });
        fs.copyFileSync(path.join(fixturesDir, 'valid-user.yaml'), userConfigPath);
        fs.copyFileSync(path.join(fixturesDir, 'valid-project.yaml'), projectConfigPath);

        setMockPaths(userConfigPath, projectConfigPath);

        const config = loadConfig();

        // Verify: github MCP should use project's env var (PROJECT_GITHUB_TOKEN)
        expect(config.mcp.github.env.GITHUB_TOKEN).toBe('${PROJECT_GITHUB_TOKEN}');
      });

      it('should merge sync options with project taking precedence', () => {
        const userConfigPath = path.join(tempDir, 'overture.yml');
        const projectConfigPath = path.join(tempDir, '.overture', 'config.yaml');

        fs.mkdirSync(path.dirname(projectConfigPath), { recursive: true });
        fs.copyFileSync(path.join(fixturesDir, 'valid-user.yaml'), userConfigPath);
        fs.copyFileSync(path.join(fixturesDir, 'valid-project.yaml'), projectConfigPath);

        setMockPaths(userConfigPath, projectConfigPath);

        const config = loadConfig();

        // Project config has mergeStrategy: replace, should override user's append
        expect(config.sync?.mergeStrategy).toBe('replace');
        // But backup settings should still come from user config
        expect(config.sync?.backup).toBe(true);
        expect(config.sync?.backupRetention).toBe(10);
      });

      it('should add project MCPs to user MCPs', () => {
        const userConfigPath = path.join(tempDir, 'overture.yml');
        const projectConfigPath = path.join(tempDir, '.overture', 'config.yaml');

        fs.mkdirSync(path.dirname(projectConfigPath), { recursive: true });
        fs.copyFileSync(path.join(fixturesDir, 'valid-user.yaml'), userConfigPath);
        fs.copyFileSync(path.join(fixturesDir, 'valid-project.yaml'), projectConfigPath);

        setMockPaths(userConfigPath, projectConfigPath);

        const config = loadConfig();

        const mcpNames = Object.keys(config.mcp);

        // Should have all user MCPs
        expect(mcpNames).toContain('filesystem');
        expect(mcpNames).toContain('memory');

        // Should have all project MCPs
        expect(mcpNames).toContain('python-repl');
        expect(mcpNames).toContain('ruff');

        // Should have overridden github
        expect(mcpNames).toContain('github');
        expect(mcpNames.length).toBe(5); // filesystem, github, memory, python-repl, ruff
      });

      it('should preserve client configurations from both configs', () => {
        const userConfigPath = path.join(tempDir, 'overture.yml');
        const projectConfigPath = path.join(tempDir, '.overture', 'config.yaml');

        fs.mkdirSync(path.dirname(projectConfigPath), { recursive: true });
        fs.copyFileSync(path.join(fixturesDir, 'valid-user.yaml'), userConfigPath);
        fs.copyFileSync(path.join(fixturesDir, 'valid-project.yaml'), projectConfigPath);

        setMockPaths(userConfigPath, projectConfigPath);

        const config = loadConfig();

        // User config has client settings
        expect(config.clients).toBeDefined();
        expect(config.clients?.['claude-code']?.enabled).toBe(true);
        expect(config.clients?.['vscode']?.enabled).toBe(false);
      });
    });
  });

  describe('Real YAML Files', () => {
    it('should parse valid YAML with all features', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      fs.copyFileSync(path.join(fixturesDir, 'valid-user.yaml'), configPath);

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      const config = loadUserConfig();

      expect(config.version).toBe('2.0');
      expect(config.mcp.filesystem.command).toBe('npx');
      expect(config.mcp.filesystem.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem', '/home/user']);
      expect(config.mcp.filesystem.transport).toBe('stdio');
      expect(config.mcp.github.env.GITHUB_TOKEN).toBe('${GITHUB_TOKEN}');
    });

    it('should handle YAML with comments', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      fs.copyFileSync(path.join(fixturesDir, 'yaml-features.yaml'), configPath);

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      const config = loadUserConfig();

      expect(config.version).toBe('2.0');
      expect(config.mcp.filesystem).toBeDefined();
      expect(config.mcp.github).toBeDefined();
    });

    it('should handle YAML anchors and aliases', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      fs.copyFileSync(path.join(fixturesDir, 'yaml-features.yaml'), configPath);

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      const config = loadUserConfig();

      // Both should use the anchor values
      expect(config.mcp.filesystem.command).toBe('npx');
      expect(config.mcp.github.command).toBe('npx');

      // Both should have merged env from anchor
      expect(config.mcp.filesystem.env.DEBUG).toBe('false');
      expect(config.mcp.filesystem.env.LOG_LEVEL).toBe('info');
      expect(config.mcp.github.env.DEBUG).toBe('false');
      expect(config.mcp.github.env.LOG_LEVEL).toBe('info');
    });

    it('should handle Unicode characters', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      fs.copyFileSync(path.join(fixturesDir, 'unicode-config.yaml'), configPath);

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      const config = loadUserConfig();

      expect(config.mcp['custom-server'].env.MESSAGE).toBe('Hello 世界 🌍');
      expect(config.mcp['custom-server'].env.PATH_WITH_UNICODE).toBe('/home/user/フォルダ/data');
      expect(config.mcp['custom-server'].metadata?.tags).toContain('国際化');
    });

    it('should handle large config files', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      fs.copyFileSync(path.join(fixturesDir, 'large-config.yaml'), configPath);

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      const config = loadUserConfig();

      const mcpCount = Object.keys(config.mcp).length;
      expect(mcpCount).toBeGreaterThanOrEqual(10);
      expect(config.mcp).toHaveProperty('filesystem');
      expect(config.mcp).toHaveProperty('github');
      expect(config.mcp).toHaveProperty('sequential-thinking');
      expect(config.mcp).toHaveProperty('everart');
    });

    it('should throw on invalid YAML syntax', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      fs.copyFileSync(path.join(fixturesDir, 'invalid-yaml.yaml'), configPath);

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      expect(() => loadUserConfig()).toThrow(ConfigLoadError);
      expect(() => loadUserConfig()).toThrow(/Failed to load user config/);
    });

    it('should allow extra fields not in schema', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      const configContent = `
version: "2.0"
extraField: "should be allowed"
mcp:
  filesystem:
    command: npx
    args: []
    env: {}
    transport: stdio
    customField: "also allowed"
`;
      fs.writeFileSync(configPath, configContent, 'utf-8');

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      // Should not throw - Zod schemas should allow extra fields
      const config = loadUserConfig();
      expect(config.version).toBe('2.0');
    });
  });

  describe('Schema Validation', () => {
    it('should validate v2.0 schema correctly', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      fs.copyFileSync(path.join(fixturesDir, 'valid-user.yaml'), configPath);

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      const config = loadUserConfig();

      expect(config.version).toMatch(/^\d+\.\d+$/);
      expect(config.mcp.filesystem.transport).toBe('stdio');
    });

    it('should reject missing version field', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      fs.copyFileSync(path.join(fixturesDir, 'missing-version.yaml'), configPath);

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      expect(() => loadUserConfig()).toThrow(ConfigValidationError);
      expect(() => loadUserConfig()).toThrow(/Invalid user configuration/);
    });

    it('should reject wrong version format', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      fs.copyFileSync(path.join(fixturesDir, 'wrong-version.yaml'), configPath);

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      expect(() => loadUserConfig()).toThrow(ConfigValidationError);
    });

    it('should reject missing transport field', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      fs.copyFileSync(path.join(fixturesDir, 'missing-transport.yaml'), configPath);

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      expect(() => loadUserConfig()).toThrow(ConfigValidationError);
    });

    it('should validate environment variable patterns', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      fs.copyFileSync(path.join(fixturesDir, 'invalid-env-var.yaml'), configPath);

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      expect(() => loadUserConfig()).toThrow(ConfigValidationError);
    });

    it('should accept valid environment variable syntax', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      fs.copyFileSync(path.join(fixturesDir, 'env-vars.yaml'), configPath);

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      const config = loadUserConfig();

      expect(config.mcp.github.env.GITHUB_TOKEN).toBe('${GITHUB_TOKEN}');
      expect(config.mcp.custom.env.VAR2).toBe('${VAR2:-default-value}');
    });
  });

  describe('Error Handling', () => {
    it('should throw ConfigLoadError when user config file not found', () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist.yml');
      setMockPaths(nonExistentPath, path.join(tempDir, '.overture', 'config.yaml'));

      expect(() => loadUserConfig()).toThrow(ConfigLoadError);
      expect(() => loadUserConfig()).toThrow('User config file not found');
    });

    it('should include path in ConfigLoadError', () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist.yml');
      setMockPaths(nonExistentPath, path.join(tempDir, '.overture', 'config.yaml'));

      try {
        loadUserConfig();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigLoadError);
        expect((error as ConfigLoadError).path).toBe(nonExistentPath);
      }
    });

    it('should handle permission denied errors gracefully', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      fs.copyFileSync(path.join(fixturesDir, 'valid-user.yaml'), configPath);

      // Make file unreadable (Unix-like systems only)
      if (process.platform !== 'win32') {
        fs.chmodSync(configPath, 0o000);

        setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

        expect(() => loadUserConfig()).toThrow(ConfigLoadError);

        // Restore permissions for cleanup
        fs.chmodSync(configPath, 0o644);
      }
    });

    it('should include validation errors in ConfigValidationError', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      fs.copyFileSync(path.join(fixturesDir, 'missing-version.yaml'), configPath);

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      try {
        loadUserConfig();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        const validationError = error as ConfigValidationError;
        expect(validationError.validationErrors).toBeDefined();
        expect(validationError.validationErrors.length).toBeGreaterThan(0);
      }
    });

    it('should handle malformed YAML gracefully', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      fs.copyFileSync(path.join(fixturesDir, 'invalid-yaml.yaml'), configPath);

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      expect(() => loadUserConfig()).toThrow(ConfigLoadError);
    });
  });

  describe('hasUserConfig and hasProjectConfig', () => {
    it('should return true when user config exists', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      fs.copyFileSync(path.join(fixturesDir, 'valid-user.yaml'), configPath);

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      expect(hasUserConfig()).toBe(true);
    });

    it('should return false when user config does not exist', () => {
      jest.spyOn(pathResolver, 'getUserConfigPath').mockReturnValue(path.join(tempDir, 'does-not-exist.yml'));

      expect(hasUserConfig()).toBe(false);
    });

    it('should return true when project config exists', () => {
      const projectConfigPath = path.join(tempDir, '.overture', 'config.yaml');
      fs.mkdirSync(path.dirname(projectConfigPath), { recursive: true });
      fs.copyFileSync(path.join(fixturesDir, 'valid-project.yaml'), projectConfigPath);

      setMockPaths(path.join(tempDir, 'overture.yml'), projectConfigPath);

      expect(hasProjectConfig()).toBe(true);
    });

    it('should return false when project config does not exist', () => {
      jest.spyOn(pathResolver, 'getProjectConfigPath').mockReturnValue(path.join(tempDir, '.overture', 'config.yaml'));

      expect(hasProjectConfig()).toBe(false);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle deeply nested MCP configurations', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      const complexConfig = `
version: "2.0"
mcp:
  complex-server:
    command: npx
    args: ["-y", "complex-server"]
    env:
      NESTED_VAR: "\${TOP_VAR}"
      CONFIG_JSON: '{"nested": {"deep": {"value": "test"}}}'
    transport: stdio
    clients:
      exclude: [copilot-cli]
      overrides:
        vscode:
          transport: http
          env:
            VSCODE_SPECIFIC: "true"
    platforms:
      exclude: [win32]
      commandOverrides:
        darwin: "/usr/local/bin/custom-command"
      argsOverrides:
        linux: ["-y", "linux-specific-arg"]
    metadata:
      description: "Complex server with all features"
      homepage: "https://example.com"
      tags: ["complex", "test"]
`;
      fs.writeFileSync(configPath, complexConfig, 'utf-8');

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      const config = loadUserConfig();

      expect(config.mcp['complex-server'].clients?.exclude).toContain('copilot-cli');
      expect(config.mcp['complex-server'].clients?.overrides?.vscode?.transport).toBe('http');
      expect(config.mcp['complex-server'].platforms?.exclude).toContain('win32');
      expect(config.mcp['complex-server'].metadata?.tags).toContain('complex');
    });

    it('should handle empty MCP definitions', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      const emptyMcpConfig = `
version: "2.0"
mcp: {}
`;
      fs.writeFileSync(configPath, emptyMcpConfig, 'utf-8');

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      const config = loadUserConfig();

      expect(config.mcp).toEqual({});
    });

    it('should handle configs with only required fields', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      const minimalConfig = `
version: "2.0"
mcp:
  minimal:
    command: npx
    args: []
    env: {}
    transport: stdio
`;
      fs.writeFileSync(configPath, minimalConfig, 'utf-8');

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      const config = loadUserConfig();

      expect(config.mcp.minimal.command).toBe('npx');
    });

    it('should handle very long file paths in config', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      const longPath = '/very/long/path/that/goes/on/and/on/' + 'nested/'.repeat(20) + 'file';
      const configWithLongPath = `
version: "2.0"
mcp:
  long-path-server:
    command: npx
    args: ["-y", "server", "${longPath}"]
    env:
      LONG_PATH: "${longPath}"
    transport: stdio
`;
      fs.writeFileSync(configPath, configWithLongPath, 'utf-8');

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      const config = loadUserConfig();

      expect(config.mcp['long-path-server'].args[2]).toBe(longPath);
      expect(config.mcp['long-path-server'].env.LONG_PATH).toBe(longPath);
    });

    it('should handle special characters in MCP names', () => {
      const configPath = path.join(tempDir, 'overture.yml');
      const specialCharsConfig = `
version: "2.0"
mcp:
  server-with-dashes:
    command: npx
    args: []
    env: {}
    transport: stdio
  server_with_underscores:
    command: npx
    args: []
    env: {}
    transport: stdio
  "server.with.dots":
    command: npx
    args: []
    env: {}
    transport: stdio
`;
      fs.writeFileSync(configPath, specialCharsConfig, 'utf-8');

      setMockPaths(configPath, path.join(tempDir, '.overture', 'config.yaml'));

      const config = loadUserConfig();

      expect(config.mcp['server-with-dashes']).toBeDefined();
      expect(config.mcp['server_with_underscores']).toBeDefined();
      expect(config.mcp['server.with.dots']).toBeDefined();
    });

    it('should handle multiple levels of config merging', () => {
      // User config with base settings
      const userConfigPath = path.join(tempDir, 'overture.yml');
      const userConfig = `
version: "2.0"
clients:
  claude-code:
    enabled: true
  vscode:
    enabled: true
mcp:
  base-server:
    command: base-cmd
    args: ["base-arg"]
    env:
      BASE_VAR: "base"
    transport: stdio
  shared-server:
    command: shared-cmd
    args: ["user-arg"]
    env:
      SHARED_VAR: "user-value"
    transport: stdio
sync:
  backup: true
  backupRetention: 5
`;

      // Project config overriding some settings
      const projectConfigPath = path.join(tempDir, '.overture', 'config.yaml');
      const projectConfig = `
version: "2.0"
mcp:
  project-server:
    command: project-cmd
    args: ["project-arg"]
    env:
      PROJECT_VAR: "project"
    transport: stdio
  shared-server:
    command: shared-cmd-override
    args: ["project-arg"]
    env:
      SHARED_VAR: "project-value"
    transport: http
sync:
  backupRetention: 20
`;

      fs.writeFileSync(userConfigPath, userConfig, 'utf-8');
      fs.mkdirSync(path.dirname(projectConfigPath), { recursive: true });
      fs.writeFileSync(projectConfigPath, projectConfig, 'utf-8');

      setMockPaths(userConfigPath, projectConfigPath);

      const config = loadConfig();

      // Should have all MCPs
      expect(config.mcp['base-server']).toBeDefined();
      expect(config.mcp['project-server']).toBeDefined();
      expect(config.mcp['shared-server']).toBeDefined();

      // Base server unchanged
      expect(config.mcp['base-server'].command).toBe('base-cmd');

      // Shared server should use project values
      expect(config.mcp['shared-server'].command).toBe('shared-cmd-override');
      expect(config.mcp['shared-server'].transport).toBe('http');
      expect(config.mcp['shared-server'].env.SHARED_VAR).toBe('project-value');

      // Sync options should be merged
      expect(config.sync?.backup).toBe(true); // from user
      expect(config.sync?.backupRetention).toBe(20); // from project (overridden)
    });
  });
});
