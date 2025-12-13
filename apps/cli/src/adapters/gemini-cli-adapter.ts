/**
 * Google Gemini CLI Adapter
 *
 * Adapter for Google Gemini CLI with MCP support.
 * Only supports user-level configuration (no project-level).
 *
 * Config locations:
 * - Default: ~/.gemini/mcp-config.json
 * - Windows: %USERPROFILE%\.gemini\mcp-config.json
 *
 * Context file: GEMINI.md (project root)
 *
 * Note: Gemini CLI has a 1M token context window, allowing for
 * expanded context files and full API spec inclusion.
 *
 * @module adapters/gemini-cli-adapter
 * @version 1.0
 */

import * as fs from 'fs';
import {
  BaseClientAdapter,
  type ConfigPathResult,
  type ClientMcpConfig,
} from './client-adapter.interface';
import type { Platform, OvertureConfig } from '../domain/config.types';
import { getGeminiCliPath } from '../core/path-resolver';

/**
 * Google Gemini CLI adapter implementation
 */
export class GeminiCliAdapter extends BaseClientAdapter {
  readonly name = 'gemini-cli' as const;
  readonly schemaRootKey = 'mcpServers' as const;

  detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult {
    return getGeminiCliPath(platform);
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
      throw new Error(
        `Failed to read Gemini CLI config at ${path}: ${(error as Error).message}`
      );
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
      throw new Error(
        `Failed to write Gemini CLI config to ${path}: ${(error as Error).message}`
      );
    }
  }

  convertFromOverture(
    overtureConfig: OvertureConfig,
    platform: Platform
  ): ClientMcpConfig {
    const mcpServers: Record<string, any> = {};

    for (const [name, mcpConfig] of Object.entries(overtureConfig.mcp)) {
      // Check if should sync
      if (!this.shouldSyncMcp(mcpConfig, platform)) {
        continue;
      }

      // Build config with all overrides applied
      const serverConfig = this.buildServerConfig(mcpConfig, platform);

      // Gemini CLI uses similar structure to Claude Code
      mcpServers[name] = {
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
      };
    }

    return { mcpServers };
  }

  supportsTransport(transport: 'stdio' | 'http' | 'sse'): boolean {
    // Gemini CLI supports stdio (assumed based on MCP standard)
    return transport === 'stdio';
  }

  needsEnvVarExpansion(): boolean {
    // Gemini CLI likely has native ${VAR} support
    return false;
  }

  override getBinaryNames(): string[] {
    return ['gemini'];
  }

  override getAppBundlePaths(_platform: Platform): string[] {
    // Gemini CLI is a CLI-only tool
    return [];
  }

  override requiresBinary(): boolean {
    // Gemini CLI requires the binary
    return true;
  }
}
