/**
 * Claude Code Adapter
 *
 * Adapter for Claude Code CLI client (claude.ai/code).
 * Supports both user-level and project-level MCP configurations.
 *
 * Config locations:
 * - User: ~/.config/claude/mcp.json (Linux/macOS), %APPDATA%/Claude/mcp.json (Windows)
 * - Project: ./.mcp.json
 *
 * @module adapters/claude-code-adapter
 * @version 2.0
 */

import * as fs from 'fs';
import { BaseClientAdapter, type ConfigPathResult, type ClientMcpConfig } from './client-adapter.interface';
import type { Platform, OvertureConfigV2 } from '../domain/config-v2.types';
import { getClaudeCodeGlobalPath, getClaudeCodeProjectPath } from '../core/path-resolver';

/**
 * Claude Code adapter implementation
 */
export class ClaudeCodeAdapter extends BaseClientAdapter {
  readonly name = 'claude-code' as const;
  readonly schemaRootKey = 'mcpServers' as const;

  detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult {
    const userPath = getClaudeCodeGlobalPath(platform);
    const projectPath = getClaudeCodeProjectPath(projectRoot);

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
      throw new Error(`Failed to read Claude Code config at ${path}: ${(error as Error).message}`);
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
      throw new Error(`Failed to write Claude Code config to ${path}: ${(error as Error).message}`);
    }
  }

  convertFromOverture(overtureConfig: OvertureConfigV2, platform: Platform): ClientMcpConfig {
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

      // Claude Code supports native ${VAR} expansion, no need to expand
      mcpServers[name] = {
        command,
        args,
        env: Object.keys(env).length > 0 ? env : undefined,
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
}
