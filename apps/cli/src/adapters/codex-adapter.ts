/**
 * OpenAI Codex CLI Adapter
 *
 * Adapter for OpenAI Codex CLI with MCP support.
 * Only supports user-level configuration (no project-level).
 *
 * Config locations:
 * - Default: ~/.codex/mcp-config.json
 * - Windows: %USERPROFILE%\.codex\mcp-config.json
 *
 * Context file: AGENTS.md (project root)
 *
 * @module adapters/codex-adapter
 * @version 1.0
 */

import * as fs from 'fs';
import {
  BaseClientAdapter,
  type ConfigPathResult,
  type ClientMcpConfig,
  type ClientMcpServerDef,
} from './client-adapter.interface';
import type { Platform, OvertureConfig } from '../domain/config.types';
import { getCodexPath } from '../core/path-resolver';

/**
 * OpenAI Codex CLI adapter implementation
 */
export class CodexAdapter extends BaseClientAdapter {
  readonly name = 'codex' as const;
  readonly schemaRootKey = 'mcpServers' as const;

  detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult {
    return getCodexPath(platform);
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
        `Failed to read Codex config at ${path}: ${(error as Error).message}`
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
        `Failed to write Codex config to ${path}: ${(error as Error).message}`
      );
    }
  }

  convertFromOverture(
    overtureConfig: OvertureConfig,
    platform: Platform
  ): ClientMcpConfig {
    const mcpServers: Record<string, ClientMcpServerDef> = {};

    for (const [name, mcpConfig] of Object.entries(overtureConfig.mcp)) {
      // Check if should sync
      if (!this.shouldSyncMcp(mcpConfig, platform)) {
        continue;
      }

      // Build config with all overrides applied
      const serverConfig = this.buildServerConfig(mcpConfig, platform);

      // Codex uses similar structure to Claude Code
      mcpServers[name] = {
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
      };
    }

    return { mcpServers };
  }

  supportsTransport(transport: 'stdio' | 'http' | 'sse'): boolean {
    // Codex CLI supports stdio (assumed based on MCP standard)
    return transport === 'stdio';
  }

  needsEnvVarExpansion(): boolean {
    // Codex CLI likely has native ${VAR} support
    return false;
  }

  override getBinaryNames(): string[] {
    return ['codex'];
  }

  override getAppBundlePaths(_platform: Platform): string[] {
    // Codex CLI is a CLI-only tool
    return [];
  }

  override requiresBinary(): boolean {
    // Codex CLI requires the binary
    return true;
  }
}
