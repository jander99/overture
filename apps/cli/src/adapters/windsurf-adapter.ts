/**
 * Windsurf Adapter
 *
 * Adapter for Windsurf IDE (Codeium).
 * Only supports user-level configuration (no project-level).
 *
 * Config location: ~/.codeium/windsurf/mcp_config.json (all platforms)
 *
 * @module adapters/windsurf-adapter
 * @version 2.0
 */

import * as fs from 'fs';
import { BaseClientAdapter, type ConfigPathResult, type ClientMcpConfig } from './client-adapter.interface';
import type { Platform, OvertureConfig } from '../domain/config.types';
import { getWindsurfPath } from '../core/path-resolver';

/**
 * Windsurf adapter implementation
 */
export class WindsurfAdapter extends BaseClientAdapter {
  readonly name = 'windsurf' as const;
  readonly schemaRootKey = 'mcpServers' as const;

  detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult {
    return getWindsurfPath(platform);
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
      throw new Error(`Failed to read Windsurf config at ${path}: ${(error as Error).message}`);
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
      throw new Error(`Failed to write Windsurf config to ${path}: ${(error as Error).message}`);
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

      // Windsurf native ${VAR} support (assumed)
      mcpServers[name] = {
        command,
        args,
        env: Object.keys(env).length > 0 ? env : undefined,
      };
    }

    return { mcpServers };
  }

  supportsTransport(transport: 'stdio' | 'http' | 'sse'): boolean {
    // Windsurf primarily supports stdio (as of 2025-11)
    // May support other transports in future versions
    return transport === 'stdio';
  }

  needsEnvVarExpansion(): boolean {
    // Windsurf likely has native ${VAR} support
    return false;
  }
}
