/**
 * Claude Desktop Adapter
 *
 * Adapter for Claude Desktop application.
 * Only supports user-level configuration (no project-level).
 *
 * Config location: claude_desktop_config.json
 * - macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
 * - Linux: ~/.config/Claude/claude_desktop_config.json
 * - Windows: %APPDATA%/Claude/claude_desktop_config.json
 *
 * @module adapters/claude-desktop-adapter
 * @version 2.0
 */

import * as fs from 'fs';
import { BaseClientAdapter, type ConfigPathResult, type ClientMcpConfig, type ClientMcpServerDef } from './client-adapter.interface';
import type { Platform, OvertureConfig } from '../domain/config.types';
import { getClaudeDesktopPath } from '../core/path-resolver';

/**
 * Claude Desktop adapter implementation
 */
export class ClaudeDesktopAdapter extends BaseClientAdapter {
  readonly name = 'claude-desktop' as const;
  readonly schemaRootKey = 'mcpServers' as const;

  detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult {
    return getClaudeDesktopPath(platform);
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
      throw new Error(`Failed to read Claude Desktop config at ${path}: ${(error as Error).message}`);
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
      throw new Error(`Failed to write Claude Desktop config to ${path}: ${(error as Error).message}`);
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

      // Claude Desktop supports native ${VAR} expansion (assumed, needs verification)
      mcpServers[name] = {
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
      };
    }

    return { mcpServers };
  }

  supportsTransport(transport: 'stdio' | 'http' | 'sse'): boolean {
    // Claude Desktop currently only supports stdio (as of 2025-11)
    // HTTP/SSE support may be added in future versions
    return transport === 'stdio';
  }

  needsEnvVarExpansion(): boolean {
    // Claude Desktop likely has native ${VAR} support (needs verification)
    // Assuming same as Claude Code for now
    return false;
  }

  override getBinaryNames(): string[] {
    // Claude Desktop is a GUI-only application
    return [];
  }

  override getAppBundlePaths(platform: Platform): string[] {
    switch (platform) {
      case 'darwin':
        return ['/Applications/Claude.app'];
      case 'win32':
        return [
          'C:\\\\Program Files\\\\Claude\\\\Claude.exe',
          'C:\\\\Program Files (x86)\\\\Claude\\\\Claude.exe',
        ];
      case 'linux':
        return ['/opt/Claude', '/usr/share/applications/claude.desktop'];
    }
  }

  override requiresBinary(): boolean {
    // App bundle is sufficient
    return false;
  }
}
