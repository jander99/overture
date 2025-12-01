/**
 * JetBrains GitHub Copilot Plugin Adapter
 *
 * Adapter for GitHub Copilot plugin in JetBrains IDEs (IntelliJ IDEA, PyCharm, etc.).
 * Supports both global (user) and workspace-level configurations.
 *
 * Config locations:
 * - Global:
 *   - macOS: ~/Library/Application Support/github-copilot/intellij/mcp.json (placeholder)
 *   - Linux: ~/.config/github-copilot/intellij/mcp.json (placeholder)
 *   - Windows: %LOCALAPPDATA%\github-copilot\intellij\mcp.json (confirmed)
 * - Workspace: ./.vscode/mcp.json (shared with VS Code)
 *
 * Note: Workspace config path is shared with VS Code to maintain compatibility
 * when switching between VS Code and JetBrains IDEs on the same project.
 *
 * @module adapters/jetbrains-copilot-adapter
 * @version 2.0
 */

import * as fs from 'fs';
import { BaseClientAdapter, type ConfigPathResult, type ClientMcpConfig } from './client-adapter.interface';
import type { Platform, OvertureConfig } from '../domain/config.types';
import { getJetBrainsCopilotPath, getJetBrainsCopilotWorkspacePath } from '../core/path-resolver';
import { expandEnvVarsInObject } from '../core/env-expander';

/**
 * JetBrains Copilot adapter implementation
 */
export class JetBrainsCopilotAdapter extends BaseClientAdapter {
  readonly name = 'jetbrains-copilot' as const;
  readonly schemaRootKey = 'mcpServers' as const;

  detectConfigPath(platform: Platform, projectRoot?: string): ConfigPathResult {
    const userPath = getJetBrainsCopilotPath(platform);
    const projectPath = getJetBrainsCopilotWorkspacePath(projectRoot);

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
      throw new Error(`Failed to read JetBrains Copilot config at ${path}: ${(error as Error).message}`);
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
      throw new Error(`Failed to write JetBrains Copilot config to ${path}: ${(error as Error).message}`);
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

      // JetBrains Copilot likely requires Overture to expand environment variables
      // (similar to VS Code, no native ${VAR} support assumed)
      const expandedEnv = this.needsEnvVarExpansion()
        ? expandEnvVarsInObject(serverConfig.env || {})
        : serverConfig.env;

      mcpServers[name] = {
        command: serverConfig.command,
        args: serverConfig.args,
        env: Object.keys(expandedEnv || {}).length > 0 ? expandedEnv : undefined,
      };
    }

    return { mcpServers };
  }

  supportsTransport(transport: 'stdio' | 'http' | 'sse'): boolean {
    // JetBrains Copilot plugin supports stdio (as of 2025-11)
    return transport === 'stdio';
  }

  needsEnvVarExpansion(): boolean {
    // JetBrains Copilot likely requires Overture to expand environment variables
    // (similar to VS Code, no native ${VAR} support assumed)
    return true;
  }

  override getBinaryNames(): string[] {
    // Check for any JetBrains IDE binary
    // TODO: Research - should we check all or let user specify?
    return ['idea', 'pycharm', 'webstorm', 'phpstorm', 'goland', 'rider'];
  }

  override getAppBundlePaths(_platform: Platform): string[] {
    // JetBrains IDEs are accessed via binaries
    return [];
  }

  override requiresBinary(): boolean {
    // JetBrains Copilot requires an IDE binary
    return true;
  }
}
