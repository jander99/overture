/**
 * VS Code Adapter
 *
 * Adapter for Visual Studio Code with MCP extension.
 * Supports both user and workspace-level configurations.
 *
 * Key difference: Uses "servers" instead of "mcpServers" as root key.
 * Also requires "type" field instead of inferring from transport.
 *
 * Config locations:
 * - User: mcp.json in VS Code user settings directory
 *   - macOS: ~/Library/Application Support/Code/User/mcp.json
 *   - Linux: ~/.config/Code/User/mcp.json
 *   - Windows: %APPDATA%/Code/User/mcp.json
 * - Workspace: ./.vscode/mcp.json
 *
 * @module adapters/vscode-adapter
 * @version 2.0
 */

import * as fs from 'fs';
import { BaseClientAdapter, type ConfigPathResult, type ClientMcpConfig } from './client-adapter.interface';
import type { Platform, OvertureConfigV2 } from '../domain/config-v2.types';
import { getVSCodeGlobalPath, getVSCodeWorkspacePath } from '../core/path-resolver';
import { expandEnvVarsInObject } from '../core/env-expander';

/**
 * VS Code adapter implementation
 */
export class VSCodeAdapter extends BaseClientAdapter {
  readonly name = 'vscode' as const;
  readonly schemaRootKey = 'servers' as const; // VS Code uses "servers" not "mcpServers"

  detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult {
    const userPath = getVSCodeGlobalPath(platform);
    const projectPath = getVSCodeWorkspacePath(projectRoot);

    return {
      user: userPath,
      project: projectPath,
    };
  }

  readConfig(path: string): ClientMcpConfig {
    if (!fs.existsSync(path)) {
      return { servers: {} };
    }

    try {
      const content = fs.readFileSync(path, 'utf-8');
      const parsed = JSON.parse(content);

      // Ensure root key exists (VS Code uses "servers")
      if (!parsed.servers) {
        return { servers: {} };
      }

      return parsed;
    } catch (error) {
      throw new Error(`Failed to read VS Code config at ${path}: ${(error as Error).message}`);
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
      throw new Error(`Failed to write VS Code config to ${path}: ${(error as Error).message}`);
    }
  }

  convertFromOverture(overtureConfig: OvertureConfigV2, platform: Platform): ClientMcpConfig {
    const servers: Record<string, any> = {};

    for (const [name, mcpConfig] of Object.entries(overtureConfig.mcp)) {
      // Check if should sync
      if (!this.shouldSyncMcp(mcpConfig, platform)) {
        continue;
      }

      // Start with base config
      let command = mcpConfig.command;
      let args = [...mcpConfig.args];
      let env = { ...mcpConfig.env };
      let transport = mcpConfig.transport;

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
        if (clientOverride.transport) transport = clientOverride.transport;
      }

      // VS Code requires environment variable expansion by Overture
      const expandedEnv = this.needsEnvVarExpansion() ? expandEnvVarsInObject(env) : env;

      // VS Code requires "type" field
      servers[name] = {
        command,
        args,
        type: transport, // VS Code uses "type" instead of "transport"
        env: Object.keys(expandedEnv).length > 0 ? expandedEnv : undefined,
      };
    }

    return { servers };
  }

  supportsTransport(transport: 'stdio' | 'http' | 'sse'): boolean {
    // VS Code MCP extension supports stdio and potentially http/sse
    // As of 2025-11, stdio is primary, http/sse support varies by extension version
    return transport === 'stdio' || transport === 'http';
  }

  needsEnvVarExpansion(): boolean {
    // VS Code requires Overture to expand environment variables
    // (no native ${VAR} support in mcp.json)
    return true;
  }
}
