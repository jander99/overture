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
import { BaseClientAdapter, type ConfigPathResult, type ClientMcpConfig, type ClientMcpServerDef } from '../client-adapter.interface.js';
import type { Platform, OvertureConfig } from '@overture/config-types';
import { McpError } from '@overture/errors';

/**
 * Claude Code adapter implementation with dependency injection
 */
export class ClaudeCodeAdapter extends BaseClientAdapter {
  readonly name = 'claude-code' as const;
  readonly schemaRootKey = 'mcpServers' as const;

  constructor(
    private readonly filesystem: FilesystemPort,
    private readonly environment: EnvironmentPort
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
      throw new McpError(`Failed to read Claude Code config at ${path}: ${(error as Error).message}`, this.name);
    }
  }

  async writeConfig(path: string, config: ClientMcpConfig): Promise<void> {
    try {
      // Ensure directory exists
      const dir = this.getDirname(path);
      const dirExists = await this.filesystem.exists(dir);
      if (!dirExists) {
        await this.filesystem.mkdir(dir, { recursive: true });
      }

      const content = JSON.stringify(config, null, 2);
      await this.filesystem.writeFile(path, content);
    } catch (error) {
      throw new McpError(`Failed to write Claude Code config to ${path}: ${(error as Error).message}`, this.name);
    }
  }

  convertFromOverture(overtureConfig: OvertureConfig, platform: Platform): ClientMcpConfig {
    const mcpServers: Record<string, ClientMcpServerDef> = {};

    for (const [name, mcpConfig] of Object.entries(overtureConfig.mcp)) {
      // Check if should sync
      if (!this.shouldSyncMcp(mcpConfig, platform)) {
        continue;
      }

      // Build config with all overrides applied
      const serverConfig = this.buildServerConfig(mcpConfig, platform);

      // Claude Code supports native ${VAR} expansion, no need to expand
      mcpServers[name] = {
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
      };
    }

    return { mcpServers };
  }

  supportsTransport(transport: 'stdio' | 'http' | 'sse'): boolean {
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
  private getClaudeCodeGlobalPath(platform: Platform): string {
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

  private getDirname(filePath: string): string {
    // Cross-platform dirname (handles both / and \)
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    return lastSlash === -1 ? '.' : filePath.substring(0, lastSlash);
  }
}
