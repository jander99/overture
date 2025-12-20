/**
 * Copilot CLI Adapter
 *
 * Adapter for GitHub Copilot CLI client.
 * Supports both user-level and project-level MCP configurations.
 *
 * Config locations:
 * - User: ~/.copilot/mcp-config.json (all platforms, respects XDG_CONFIG_HOME on Linux)
 * - Project: ./.github/mcp.json
 *
 * @module adapters/copilot-cli.adapter
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
import type { Platform, OvertureConfig } from '@overture/config-types';
import { McpError } from '@overture/errors';

export class CopilotCliAdapter extends BaseClientAdapter {
  readonly name = 'copilot-cli' as const;
  readonly schemaRootKey = 'mcpServers' as const;

  constructor(
    private readonly filesystem: FilesystemPort,
    private readonly environment: EnvironmentPort,
  ) {
    super();
  }

  detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult {
    const userPath = this.getCopilotCliGlobalPath(platform);
    const projectPath = this.getCopilotCliProjectPath(projectRoot);

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

      if (!parsed.mcpServers) {
        return { mcpServers: {} };
      }

      return parsed;
    } catch (error) {
      throw new McpError(
        `Failed to read Copilot CLI config at ${path}: ${(error as Error).message}`,
        this.name,
      );
    }
  }

  async writeConfig(path: string, config: ClientMcpConfig): Promise<void> {
    try {
      const dir = this.getDirname(path);
      const dirExists = await this.filesystem.exists(dir);
      if (!dirExists) {
        await this.filesystem.mkdir(dir, { recursive: true });
      }

      const content = JSON.stringify(config, null, 2);
      await this.filesystem.writeFile(path, content);
    } catch (error) {
      throw new McpError(
        `Failed to write Copilot CLI config to ${path}: ${(error as Error).message}`,
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
      // Skip GitHub MCP - Copilot CLI bundles it by default
      if (name === 'github') {
        continue;
      }

      if (!this.shouldSyncMcp(mcpConfig, platform)) {
        continue;
      }

      const serverConfig = this.buildServerConfig(mcpConfig, platform);

      mcpServers[name] = {
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
      };
    }

    return { mcpServers };
  }

  supportsTransport(transport: 'stdio' | 'http' | 'sse'): boolean {
    return true; // Copilot CLI supports all transport types
  }

  needsEnvVarExpansion(): boolean {
    return false; // Copilot CLI has native ${VAR} support
  }

  override getBinaryNames(): string[] {
    return ['copilot', 'github-copilot-cli'];
  }

  override getAppBundlePaths(_platform: Platform): string[] {
    return []; // CLI-only client
  }

  override requiresBinary(): boolean {
    return true;
  }

  private getCopilotCliGlobalPath(platform: Platform): string {
    const env = this.environment.env;
    const homeDir = env.HOME || env.USERPROFILE || '/';

    switch (platform) {
      case 'darwin':
      case 'linux': {
        const configBase = env.XDG_CONFIG_HOME || `${homeDir}/.config`;
        return `${configBase}/github-copilot/mcp.json`;
      }
      case 'win32': {
        return `${homeDir}\\.config\\github-copilot\\mcp.json`;
      }
      default:
        throw new McpError(`Unsupported platform: ${platform}`, this.name);
    }
  }

  private getCopilotCliProjectPath(projectRoot?: string): string {
    const root = projectRoot || this.environment.env.PWD || '/';
    return `${root}/.github/mcp.json`;
  }

  private getDirname(filePath: string): string {
    const lastSlash = Math.max(
      filePath.lastIndexOf('/'),
      filePath.lastIndexOf('\\'),
    );
    return lastSlash === -1 ? '.' : filePath.substring(0, lastSlash);
  }
}
