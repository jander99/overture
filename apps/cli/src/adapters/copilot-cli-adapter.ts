/**
 * GitHub Copilot CLI Adapter
 *
 * Adapter for GitHub Copilot CLI with MCP support.
 * Only supports user-level configuration (no project-level).
 *
 * Config locations:
 * - Default: ~/.copilot/mcp-config.json
 * - With XDG_CONFIG_HOME: $XDG_CONFIG_HOME/.copilot/mcp-config.json
 * - Windows: %USERPROFILE%\.copilot\mcp-config.json
 *
 * Note: GitHub Copilot CLI bundles a native GitHub MCP server.
 * Consider excluding the "github" MCP when syncing to avoid duplication.
 *
 * @module adapters/copilot-cli-adapter
 * @version 2.0
 */

import * as fs from 'fs';
import { BaseClientAdapter, type ConfigPathResult, type ClientMcpConfig } from './client-adapter.interface';
import type { Platform, OvertureConfig } from '../domain/config.types';
import { getCopilotCliPath } from '../core/path-resolver';

/**
 * GitHub Copilot CLI adapter implementation
 */
export class CopilotCliAdapter extends BaseClientAdapter {
  readonly name = 'copilot-cli' as const;
  readonly schemaRootKey = 'mcpServers' as const;

  detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult {
    return getCopilotCliPath(platform);
  }

  readConfig(path: string): ClientMcpConfig {
    if (!fs.existsSync(path)) {
      return { mcpServers: {} };
    }

    try {
      const content = fs.readFileSync(path, 'utf-8');
      const parsed = JSON.parse(content);

      // Ensure root key exists
      if (!parsed.mcpServers) {
        return { mcpServers: {} };
      }

      return parsed;
    } catch (error) {
      throw new Error(`Failed to read Copilot CLI config at ${path}: ${(error as Error).message}`);
    }
  }

  writeConfig(path: string, config: ClientMcpConfig): void {
    try {
      // Ensure directory exists
      const dir = path.substring(0, path.lastIndexOf('/'));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const content = JSON.stringify(config, null, 2);
      fs.writeFileSync(path, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write Copilot CLI config to ${path}: ${(error as Error).message}`);
    }
  }

  convertFromOverture(overtureConfig: OvertureConfig, platform: Platform): ClientMcpConfig {
    const mcpServers: Record<string, any> = {};

    for (const [name, mcpConfig] of Object.entries(overtureConfig.mcp)) {
      // Check if should sync
      if (!this.shouldSyncMcp(mcpConfig, platform)) {
        continue;
      }

      // Build config with all overrides applied
      const serverConfig = this.buildServerConfig(mcpConfig, platform);

      // Copilot CLI requires 'type' and 'tools' fields
      mcpServers[name] = {
        type: 'local', // stdio transport = 'local' type in Copilot
        command: serverConfig.command,
        args: serverConfig.args,
        tools: ['*'], // Enable all tools from the MCP server
        env: serverConfig.env,
      };
    }

    return { mcpServers };
  }

  supportsTransport(transport: 'stdio' | 'http' | 'sse'): boolean {
    // Copilot CLI supports stdio (as of 2025-11)
    return transport === 'stdio';
  }

  needsEnvVarExpansion(): boolean {
    // Copilot CLI likely has native ${VAR} support
    return false;
  }

  override getBinaryNames(): string[] {
    return ['copilot'];
  }

  override getAppBundlePaths(_platform: Platform): string[] {
    // Copilot CLI is a CLI-only tool
    return [];
  }

  override requiresBinary(): boolean {
    // Copilot CLI requires the binary
    return true;
  }
}
