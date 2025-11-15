/**
 * Cursor Adapter
 *
 * Adapter for Cursor IDE with MCP support.
 * Supports both global and project-level configurations.
 *
 * Config locations:
 * - Global:
 *   - macOS: ~/Library/Application Support/Cursor/User/globalStorage/mcp.json
 *   - Linux: ~/.config/Cursor/User/globalStorage/mcp.json
 *   - Windows: %APPDATA%/Cursor/User/globalStorage/mcp.json
 * - Project: ./.cursor/mcp.json
 *
 * @module adapters/cursor-adapter
 * @version 2.0
 */

import * as fs from 'fs';
import { BaseClientAdapter, type ConfigPathResult, type ClientMcpConfig } from './client-adapter.interface';
import type { Platform, OvertureConfig } from '../domain/config.types';
import { getCursorGlobalPath, getCursorProjectPath } from '../core/path-resolver';

/**
 * Cursor adapter implementation
 */
export class CursorAdapter extends BaseClientAdapter {
  readonly name = 'cursor' as const;
  readonly schemaRootKey = 'mcpServers' as const;

  detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult {
    const userPath = getCursorGlobalPath(platform);
    const projectPath = getCursorProjectPath(projectRoot);

    return {
      user: userPath,
      project: projectPath,
    };
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
      throw new Error(`Failed to read Cursor config at ${path}: ${(error as Error).message}`);
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
      throw new Error(`Failed to write Cursor config to ${path}: ${(error as Error).message}`);
    }
  }

  convertFromOverture(overtureConfig: OvertureConfig, platform: Platform): ClientMcpConfig {
    const mcpServers: Record<string, any> = {};

    for (const [name, mcpConfig] of Object.entries(overtureConfig.mcp)) {
      // Check if should sync
      if (!this.shouldSyncMcp(mcpConfig, platform)) {
        continue;
      }

      // Start with base config
      let command = mcpConfig.command;
      let args = [...mcpConfig.args];
      let env = { ...mcpConfig.env };

      // Apply platform overrides
      if (mcpConfig.platforms?.commandOverrides?.[platform]) {
        command = mcpConfig.platforms.commandOverrides[platform];
      }
      if (mcpConfig.platforms?.argsOverrides?.[platform]) {
        args = [...mcpConfig.platforms.argsOverrides[platform]];
      }

      // Apply client-specific overrides
      const clientOverride = mcpConfig.clients?.overrides?.[this.name];
      if (clientOverride) {
        if (clientOverride.command) command = clientOverride.command;
        if (clientOverride.args) args = [...clientOverride.args];
        if (clientOverride.env) env = { ...env, ...clientOverride.env };
      }

      // Cursor supports native ${VAR} expansion (assumed, similar to Claude Code)
      mcpServers[name] = {
        command,
        args,
        env: Object.keys(env).length > 0 ? env : undefined,
      };
    }

    return { mcpServers };
  }

  supportsTransport(transport: 'stdio' | 'http' | 'sse'): boolean {
    // Cursor supports stdio and http (similar to VS Code architecture)
    return transport === 'stdio' || transport === 'http';
  }

  needsEnvVarExpansion(): boolean {
    // Cursor likely has native ${VAR} support (similar to Claude Code)
    return false;
  }

  override getBinaryNames(): string[] {
    return ['cursor'];
  }

  override getAppBundlePaths(_platform: Platform): string[] {
    // Cursor is accessed via CLI binary
    return [];
  }

  override requiresBinary(): boolean {
    // Cursor requires the CLI binary
    return true;
  }
}
