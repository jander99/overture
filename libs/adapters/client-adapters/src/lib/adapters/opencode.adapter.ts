/**
 * OpenCode Adapter
 *
 * Adapter for OpenCode CLI client (github.com/koksang/opencode).
 * Supports both user-level and project-level MCP configurations.
 *
 * Config locations:
 * - User: ~/.config/opencode/opencode.json (Linux/macOS), %APPDATA%/opencode/opencode.json (Windows)
 * - Project: ./opencode.json
 *
 * @module adapters/opencode.adapter
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
import { McpError, ValidationError } from '@overture/errors';
import { getDirname } from '@overture/utils';

/**
 * OpenCode adapter implementation with dependency injection
 */
export class OpenCodeAdapter extends BaseClientAdapter {
  readonly name = 'opencode' as const;
  readonly schemaRootKey = 'mcp' as const;

  constructor(
    private readonly filesystem: FilesystemPort,
    private readonly environment: EnvironmentPort,
  ) {
    super();
  }

  detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult {
    const userPath = this.getOpenCodeGlobalPath(platform);
    const projectPath = this.getOpenCodeProjectPath(projectRoot);

    return {
      user: userPath,
      project: projectPath,
    };
  }

  async readConfig(path: string): Promise<ClientMcpConfig> {
    const exists = await this.filesystem.exists(path);
    if (!exists) {
      return { mcp: {} };
    }

    try {
      const content = await this.filesystem.readFile(path);
      const parsed = JSON.parse(content);

      // Ensure root key exists
      if (!parsed.mcp) {
        return { mcp: {} };
      }

      return parsed;
    } catch (error) {
      throw new McpError(
        `Failed to read OpenCode config at ${path}: ${(error as Error).message}`,
        this.name,
      );
    }
  }

  async writeConfig(path: string, config: ClientMcpConfig): Promise<void> {
    try {
      // Read existing config to preserve non-MCP sections
      let existing = {};
      if (await this.filesystem.exists(path)) {
        const content = await this.filesystem.readFile(path);
        existing = JSON.parse(content);
      }

      // Transform MCP config to OpenCode format
      const transformedMcp: Record<string, any> = {};
      for (const [name, serverDef] of Object.entries(config.mcp)) {
        transformedMcp[name] = {
          type: serverDef.type || 'local',
          enabled: true,
          // Combine command and args into single array
          command: [serverDef.command, ...serverDef.args],
          // Use 'environment' instead of 'env'
          ...(serverDef.env && { environment: serverDef.env }),
        };
      }

      // Merge: Preserve everything except 'mcp' section
      const merged = {
        ...existing,
        mcp: transformedMcp,
      };

      // Ensure directory exists
      const dir = getDirname(path);
      const dirExists = await this.filesystem.exists(dir);
      if (!dirExists) {
        await this.filesystem.mkdir(dir, { recursive: true });
      }

      const content = JSON.stringify(merged, null, 2);
      await this.filesystem.writeFile(path, content);
    } catch (error) {
      throw new McpError(
        `Failed to write OpenCode config to ${path}: ${(error as Error).message}`,
        this.name,
      );
    }
  }

  convertFromOverture(
    overtureConfig: OvertureConfig,
    platform: Platform,
  ): ClientMcpConfig {
    const mcp: Record<string, ClientMcpServerDef> = {};

    for (const [name, mcpConfig] of Object.entries(overtureConfig.mcp)) {
      // Check if should sync
      if (!this.shouldSyncMcp(mcpConfig, platform)) {
        continue;
      }

      // Build config with all overrides applied
      const serverConfig = this.buildServerConfig(mcpConfig, platform);

      // Convert to OpenCode format:
      // 1. Keep command and args separate (will be combined during writeConfig)
      // 2. Rename env → environment
      // 3. Add type: 'local' and enabled: true
      // 4. Translate ${VAR} → {env:VAR}
      const environment = serverConfig.env
        ? this.translateEnvVars(serverConfig.env)
        : undefined;

      mcp[name] = {
        command: serverConfig.command,
        args: serverConfig.args,
        type: 'local',
        enabled: true,
        // Store environment as additional property for OpenCode
        ...(environment && { env: environment }),
      };
    }

    return { mcp };
  }

  supportsTransport(transport: 'stdio' | 'http' | 'sse'): boolean {
    // OpenCode supports all transport types
    return true;
  }

  needsEnvVarExpansion(): boolean {
    // OpenCode has native {env:VAR} support
    return false;
  }

  override getBinaryNames(): string[] {
    return ['opencode'];
  }

  override getAppBundlePaths(_platform: Platform): string[] {
    // OpenCode is a CLI-only client
    return [];
  }

  override requiresBinary(): boolean {
    // OpenCode requires the CLI binary
    return true;
  }

  /**
   * Translate environment variables from Overture format to OpenCode format
   *
   * Overture: ${VAR} or ${env:VAR}
   * OpenCode: {env:VAR}
   *
   * @param env - Environment variables from Overture config
   * @returns Translated environment variables
   */
  private translateEnvVars(
    env: Record<string, string>,
  ): Record<string, string> {
    const translated: Record<string, string> = {};

    for (const [key, value] of Object.entries(env)) {
      // Replace ${VAR} or ${env:VAR} with {env:VAR}
      translated[key] = value
        .replace(/\$\{env:([^}]+)\}/g, '{env:$1}')
        .replace(/\$\{([^}]+)\}/g, '{env:$1}');
    }

    return translated;
  }

  /**
   * Translate environment variables from OpenCode format to Overture format
   *
   * OpenCode: {env:VAR} or {env:VAR:-default}
   * Overture: ${VAR} or ${VAR:-default}
   *
   * @param env - Environment variables from OpenCode config
   * @returns Translated environment variables in Overture format
   */
  translateFromOpenCodeEnv(
    env: Record<string, string> | undefined,
  ): Record<string, string> {
    if (!env) {
      return {};
    }

    const translated: Record<string, string> = {};

    for (const [key, value] of Object.entries(env)) {
      // Replace {env:VAR} or {env:VAR:-default} with ${VAR} or ${VAR:-default}
      translated[key] = value.replace(/\{env:([^}]+)\}/g, '$${$1}');
    }

    return translated;
  }

  // Helper methods for path construction
  private getOpenCodeGlobalPath(platform: Platform): string {
    const env = this.environment.env;

    switch (platform) {
      case 'linux':
        return `${env.XDG_CONFIG_HOME || `${env.HOME}/.config`}/opencode/opencode.json`;
      case 'darwin':
        return `${env.HOME}/.config/opencode/opencode.json`;
      case 'win32':
        return `${env.APPDATA}/opencode/opencode.json`;
      default:
        throw new ValidationError(`Unsupported platform: ${platform}`);
    }
  }

  private getOpenCodeProjectPath(projectRoot?: string): string {
    const root = projectRoot || this.environment.env.PWD || '/';
    return `${root}/opencode.json`;
  }
}
