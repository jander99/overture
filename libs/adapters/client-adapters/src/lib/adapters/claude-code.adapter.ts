/**
 * Claude Code Adapter
 *
 * Adapter for Claude Code CLI client (claude.ai/code).
 * Supports both user-level and project-level MCP configurations.
 *
 * Config locations:
 * - User: ~/.claude.json (all platforms)
 * - Project: ./.mcp.json
 *
 * @module adapters/claude-code.adapter
 * @version 3.0 - Hexagonal Architecture with Dependency Injection
 */

import type { FilesystemPort } from '@overture/ports-filesystem';
import type { EnvironmentPort } from '@overture/ports-process';
import {
  BaseClientAdapter,
  type ConfigPathResult,
  type ClientMcpConfig,
  type ClientMcpServerDef,
} from '../client-adapter.interface.js';
import type {
  Platform,
  OvertureConfig,
  ClaudeCodeFullConfig,
  CleanupTarget,
} from '@overture/config-types';
import { McpError } from '@overture/errors';
import { getDirname } from '@overture/utils';

/**
 * Claude Code adapter implementation with dependency injection
 */
export class ClaudeCodeAdapter extends BaseClientAdapter {
  readonly name = 'claude-code' as const;
  readonly schemaRootKey = 'mcpServers' as const;

  constructor(
    private readonly filesystem: FilesystemPort,
    private readonly environment: EnvironmentPort,
  ) {
    super();
  }

  detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult {
    // Path resolution logic moved to factory or left in path-resolver utility
    // For now, keeping the path construction here for simplicity
    const userPath = this.getClaudeCodeGlobalPath(platform);
    const projectPath = this.getClaudeCodeProjectPath(projectRoot);

    return {
      user: userPath,
      project: projectPath,
    };
  }

  async readConfig(path: string): Promise<ClientMcpConfig> {
    const exists = await this.filesystem.exists(path);
    if (!exists) {
      return { mcpServers: {} };
    }

    try {
      const content = await this.filesystem.readFile(path);
      const parsed = JSON.parse(content);

      // Ensure root key exists
      if (!parsed.mcpServers) {
        return { mcpServers: {} };
      }

      return parsed;
    } catch (error) {
      throw new McpError(
        `Failed to read Claude Code config at ${path}: ${(error as Error).message}`,
        this.name,
      );
    }
  }

  async writeConfig(path: string, config: ClientMcpConfig): Promise<void> {
    try {
      // Ensure directory exists
      const dir = getDirname(path);
      const dirExists = await this.filesystem.exists(dir);
      if (!dirExists) {
        await this.filesystem.mkdir(dir, { recursive: true });
      }

      // Check if this is the user config file (contains all Claude Code settings)
      // User config: ~/.claude.json (preserve all existing settings)
      // Project config: .mcp.json (can be overwritten)
      const isUserConfig = path.endsWith('.claude.json');

      if (isUserConfig) {
        // Read existing config and merge to preserve all settings
        const existingConfig: Record<string, unknown> = await this.filesystem
          .exists(path)
          .then(async (exists) => {
            if (!exists) {
              return {};
            }
            const content = await this.filesystem.readFile(path);
            return JSON.parse(content) as Record<string, unknown>;
          });

        // Merge new mcpServers with existing config, preserving all other fields
        const fullConfig = {
          ...existingConfig,
          mcpServers: config.mcpServers,
        };

        const content = JSON.stringify(fullConfig, null, 2);
        await this.filesystem.writeFile(path, content);
      } else {
        // Project config - write directly
        const content = JSON.stringify(config, null, 2);
        await this.filesystem.writeFile(path, content);
      }
    } catch (error) {
      throw new McpError(
        `Failed to write Claude Code config to ${path}: ${(error as Error).message}`,
        this.name,
      );
    }
  }

  convertFromOverture(
    overtureConfig: OvertureConfig,
    platform: Platform,
  ): ClientMcpConfig {
    const mcpServers: Record<string, ClientMcpServerDef> = {};

    for (const [name, mcpConfig] of Object.entries(overtureConfig.mcp)) {
      // Check if should sync
      if (!this.shouldSyncMcp(mcpConfig, platform)) {
        continue;
      }

      // Build config with all overrides applied
      const serverConfig = this.buildServerConfig(mcpConfig, platform);

      // Claude Code supports native ${VAR} expansion, no need to expand
      // eslint-disable-next-line security/detect-object-injection -- name comes from Object.entries() of overtureConfig.mcp, safe
      mcpServers[name] = {
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
      };
    }

    return { mcpServers };
  }

  supportsTransport(_transport: 'stdio' | 'http' | 'sse'): boolean {
    // Claude Code supports all transport types
    return true;
  }

  needsEnvVarExpansion(): boolean {
    // Claude Code has native ${VAR} support
    return false;
  }

  override getBinaryNames(): string[] {
    return ['claude'];
  }

  override getAppBundlePaths(_platform: Platform): string[] {
    // Claude Code is a CLI-only client
    return [];
  }

  override requiresBinary(): boolean {
    // Claude Code requires the CLI binary
    return true;
  }

  // Helper methods for path construction (could be moved to path-resolver utility)
  private getClaudeCodeGlobalPath(_platform: Platform): string {
    // According to official Claude Code docs (https://code.claude.com/docs/en/mcp.md),
    // Claude Code reads MCP configuration from ~/.claude.json on all platforms
    const env = this.environment.env;
    const homeDir = env.HOME || env.USERPROFILE || '/';
    return `${homeDir}/.claude.json`;
  }

  private getClaudeCodeProjectPath(projectRoot?: string): string {
    const root = projectRoot || this.environment.env.PWD || '/';
    return `${root}/.mcp.json`;
  }

  /**
   * Read the full Claude Code config including directory-based overrides
   *
   * Returns both the top-level mcpServers (global) and the projects object
   * with directory-specific configurations.
   */
  async readFullConfig(platform: Platform): Promise<ClaudeCodeFullConfig> {
    const userPath = this.getClaudeCodeGlobalPath(platform);
    const exists = await this.filesystem.exists(userPath);

    if (!exists) {
      return { mcpServers: {}, projects: {} };
    }

    try {
      const content = await this.filesystem.readFile(userPath);
      const parsed = JSON.parse(content) as ClaudeCodeFullConfig;

      return {
        mcpServers: parsed.mcpServers || {},
        projects: parsed.projects || {},
        ...parsed, // Include all other settings
      };
    } catch (error) {
      throw new McpError(
        `Failed to read full Claude Code config: ${(error as Error).message}`,
        this.name,
      );
    }
  }

  /**
   * Clean up directory-based MCP configs for Overture-managed directories
   *
   * Removes only the mcpServers entries that are managed by Overture,
   * preserving all other project settings and unmanaged MCPs.
   */
  async cleanupDirectoryMcps(
    platform: Platform,
    targets: CleanupTarget[],
  ): Promise<void> {
    if (targets.length === 0) {
      return;
    }

    const userPath = this.getClaudeCodeGlobalPath(platform);
    const fullConfig = await this.readFullConfig(platform);

    // Create backup
    const backupPath = `${userPath}.backup`;
    const content = JSON.stringify(fullConfig, null, 2);
    await this.filesystem.writeFile(backupPath, content);

    // Process each cleanup target
    for (const target of targets) {
      const projectConfig = fullConfig.projects?.[target.directory];
      if (!projectConfig?.mcpServers) {
        continue;
      }

      // Remove only the managed MCPs
      for (const mcpName of target.mcpsToRemove) {
        // eslint-disable-next-line security/detect-object-injection -- mcpName is from validated CleanupTarget array
        delete projectConfig.mcpServers[mcpName];
      }

      // If mcpServers is now empty, remove the key
      if (Object.keys(projectConfig.mcpServers).length === 0) {
        delete projectConfig.mcpServers;
      }
    }

    // Write back the modified config
    await this.writeFullConfig(userPath, fullConfig);
  }

  /**
   * Write the full Claude Code config (preserves all settings)
   */
  private async writeFullConfig(
    path: string,
    config: ClaudeCodeFullConfig,
  ): Promise<void> {
    try {
      const content = JSON.stringify(config, null, 2);
      await this.filesystem.writeFile(path, content);
    } catch (error) {
      throw new McpError(
        `Failed to write full Claude Code config: ${(error as Error).message}`,
        this.name,
      );
    }
  }
}
