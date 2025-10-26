import { ProcessExecutor } from '../infrastructure/process-executor';
import { PluginError } from '../domain/errors';
import { Logger } from '../utils/logger';

/**
 * Result of a plugin installation operation.
 */
export interface PluginInstallResult {
  pluginName: string;
  marketplace: string;
  success: boolean;
  message: string;
}

/**
 * Service for installing Claude Code plugins.
 *
 * Uses the Claude CLI to install plugins from specified marketplaces.
 * Validates Claude CLI availability before attempting installation.
 */
export class PluginInstaller {
  /**
   * Install a single plugin using `claude plugin install`.
   *
   * @param pluginName - Name of the plugin to install
   * @param marketplace - Marketplace containing the plugin
   * @returns Promise resolving to installation result
   *
   * @example
   * ```typescript
   * const result = await PluginInstaller.installPlugin(
   *   'python-development',
   *   'claude-code-workflows'
   * );
   *
   * if (result.success) {
   *   console.log('Plugin installed successfully');
   * } else {
   *   console.error(result.message);
   * }
   * ```
   */
  static async installPlugin(
    pluginName: string,
    marketplace: string
  ): Promise<PluginInstallResult> {
    const fullName = `${pluginName}@${marketplace}`;

    Logger.info(`Installing plugin: ${fullName}`);

    try {
      // Check if claude CLI exists
      const claudeExists = await ProcessExecutor.commandExists('claude');

      if (!claudeExists) {
        throw new PluginError(
          'Claude CLI not found. Please install Claude Code first.',
          pluginName
        );
      }

      // Execute plugin install
      const result = await ProcessExecutor.exec('claude', [
        'plugin',
        'install',
        fullName,
      ]);

      if (result.exitCode !== 0) {
        return {
          pluginName,
          marketplace,
          success: false,
          message: result.stderr || 'Installation failed',
        };
      }

      return {
        pluginName,
        marketplace,
        success: true,
        message: 'Plugin installed successfully',
      };
    } catch (error) {
      if (error instanceof PluginError) throw error;

      throw new PluginError(
        `Failed to install plugin: ${(error as Error).message}`,
        pluginName
      );
    }
  }

  /**
   * Install multiple plugins sequentially.
   *
   * Continues installation even if individual plugins fail.
   * Returns results for all attempted installations.
   *
   * @param plugins - Array of plugin definitions with name and marketplace
   * @returns Promise resolving to array of installation results
   *
   * @example
   * ```typescript
   * const results = await PluginInstaller.installPlugins([
   *   { name: 'python-development', marketplace: 'claude-code-workflows' },
   *   { name: 'typescript-patterns', marketplace: 'claude-code-workflows' }
   * ]);
   *
   * const failed = results.filter(r => !r.success);
   * if (failed.length > 0) {
   *   console.error(`${failed.length} plugins failed to install`);
   * }
   * ```
   */
  static async installPlugins(
    plugins: Array<{ name: string; marketplace: string }>
  ): Promise<PluginInstallResult[]> {
    const results: PluginInstallResult[] = [];

    for (const plugin of plugins) {
      try {
        const result = await this.installPlugin(
          plugin.name,
          plugin.marketplace
        );
        results.push(result);
      } catch (error) {
        results.push({
          pluginName: plugin.name,
          marketplace: plugin.marketplace,
          success: false,
          message: (error as Error).message,
        });
      }
    }

    return results;
  }

  /**
   * Check if a plugin is installed.
   *
   * Executes `claude plugin list` and searches for the plugin name
   * in the output.
   *
   * @param pluginName - Name of the plugin to check
   * @returns Promise resolving to true if plugin is installed
   *
   * @example
   * ```typescript
   * const installed = await PluginInstaller.isPluginInstalled(
   *   'python-development'
   * );
   *
   * if (!installed) {
   *   console.log('Plugin not found, installing...');
   * }
   * ```
   */
  static async isPluginInstalled(pluginName: string): Promise<boolean> {
    try {
      const result = await ProcessExecutor.exec('claude', [
        'plugin',
        'list',
      ]);

      return result.stdout.includes(pluginName);
    } catch {
      return false;
    }
  }
}
