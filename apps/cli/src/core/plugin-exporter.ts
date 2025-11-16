/**
 * Plugin Exporter Service
 *
 * Exports installed Claude Code plugins to Overture user config.
 * Provides interactive selection and config file updates while preserving structure.
 *
 * @module core/plugin-exporter
 * @version 0.3.0
 */

import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import type { InstalledPlugin, ExportOptions } from '../domain/plugin.types';
import type { OvertureConfig } from '../domain/config.types';
import { PluginDetector } from './plugin-detector';
import { getUserConfigPath } from './path-resolver';
import { PluginError } from '../domain/errors';

/**
 * Plugin selection for export
 */
export interface PluginSelection {
  /**
   * Selected plugin names
   */
  selectedPlugins: string[];
}

/**
 * Plugin Exporter Service
 *
 * Exports installed Claude Code plugins to Overture user configuration.
 * Supports interactive selection via checkbox prompts and non-interactive mode
 * with explicit plugin lists.
 *
 * @example
 * ```typescript
 * const exporter = new PluginExporter();
 *
 * // Interactive export (prompts user)
 * await exporter.exportPlugins({ interactive: true });
 *
 * // Non-interactive export (explicit list)
 * await exporter.exportPlugins({
 *   interactive: false,
 *   pluginNames: ['python-development', 'backend-development']
 * });
 * ```
 */
export class PluginExporter {
  private readonly detector: PluginDetector;

  constructor(detector?: PluginDetector) {
    this.detector = detector || new PluginDetector();
  }

  /**
   * Export installed plugins to user config
   *
   * Workflow:
   * 1. Detect all installed plugins
   * 2. Prompt user to select plugins (interactive) or use provided list
   * 3. Update ~/.config/overture.yml with selected plugins
   * 4. Preserve existing config structure and formatting
   *
   * @param options - Export options (interactive mode, explicit plugin list)
   * @returns Promise that resolves when export is complete
   * @throws {PluginError} If config update fails
   *
   * @example
   * ```typescript
   * // Interactive selection
   * await exporter.exportPlugins({ interactive: true });
   *
   * // Explicit plugin list
   * await exporter.exportPlugins({
   *   interactive: false,
   *   pluginNames: ['python-development']
   * });
   * ```
   */
  async exportPlugins(options: ExportOptions = {}): Promise<void> {
    const interactive = options.interactive ?? true;

    // Detect installed plugins
    const installedPlugins = await this.detector.detectInstalledPlugins();

    if (installedPlugins.length === 0) {
      console.log('ℹ️  No plugins installed. Nothing to export.');
      return;
    }

    // Select plugins to export
    let selectedPlugins: InstalledPlugin[];

    if (interactive) {
      // Interactive mode - prompt user
      selectedPlugins = await this.promptPluginSelection(installedPlugins);

      if (selectedPlugins.length === 0) {
        console.log('ℹ️  No plugins selected. Export cancelled.');
        return;
      }
    } else {
      // Non-interactive mode - use explicit list
      if (!options.pluginNames || options.pluginNames.length === 0) {
        throw new PluginError(
          'Non-interactive mode requires pluginNames option',
          undefined
        );
      }

      selectedPlugins = installedPlugins.filter((plugin) =>
        options.pluginNames!.includes(plugin.name)
      );

      if (selectedPlugins.length === 0) {
        throw new PluginError(
          `No installed plugins match the provided names: ${options.pluginNames.join(', ')}`,
          undefined
        );
      }
    }

    // Update user config with selected plugins
    await this.updateUserConfig(selectedPlugins);

    console.log(`✅ Updated user config with ${selectedPlugins.length} plugins:`);
    for (const plugin of selectedPlugins) {
      console.log(`   • ${plugin.name}@${plugin.marketplace}`);
    }
  }

  /**
   * Prompt user to select plugins for export
   *
   * Uses inquirer checkbox prompt to allow multi-select of installed plugins.
   * This method should be implemented with inquirer when the feature is built.
   *
   * @param plugins - Available installed plugins
   * @returns Array of selected plugins
   *
   * @example
   * ```typescript
   * const selected = await exporter.promptPluginSelection(installedPlugins);
   * // User selects via checkbox interface
   * ```
   */
  private async promptPluginSelection(
    plugins: InstalledPlugin[]
  ): Promise<InstalledPlugin[]> {
    // TODO: Implement with inquirer in actual implementation
    // This is a placeholder for the interface design
    //
    // Expected implementation:
    // ```typescript
    // import inquirer from 'inquirer';
    //
    // const choices = plugins.map(p => ({
    //   name: `${p.name}@${p.marketplace}${p.enabled ? '' : ' (disabled)'}`,
    //   value: p.name,
    //   checked: true
    // }));
    //
    // const answers = await inquirer.prompt<PluginSelection>([
    //   {
    //     type: 'checkbox',
    //     name: 'selectedPlugins',
    //     message: 'Select plugins to export to config:',
    //     choices
    //   }
    // ]);
    //
    // return plugins.filter(p => answers.selectedPlugins.includes(p.name));
    // ```

    throw new Error(
      'Interactive plugin selection not yet implemented. Use non-interactive mode with pluginNames option.'
    );
  }

  /**
   * Update user config with selected plugins
   *
   * Reads existing user config, adds/updates plugin entries, and writes back
   * while preserving YAML structure and comments.
   *
   * Plugin format in config:
   * ```yaml
   * plugins:
   *   python-development:
   *     marketplace: claude-code-workflows
   *     enabled: true
   *     mcps: []  # Preserve existing mcps if present
   * ```
   *
   * @param selectedPlugins - Plugins to add to config
   * @throws {PluginError} If config file cannot be read or written
   *
   * @example
   * ```typescript
   * await exporter.updateUserConfig([
   *   { name: 'python-development', marketplace: 'claude-code-workflows', enabled: true }
   * ]);
   * ```
   */
  private async updateUserConfig(selectedPlugins: InstalledPlugin[]): Promise<void> {
    const configPath = getUserConfigPath();

    try {
      // Read existing config (or create empty if not exists)
      let existingConfig: OvertureConfig;

      try {
        const content = await fs.readFile(configPath, 'utf-8');
        existingConfig = yaml.load(content) as OvertureConfig;
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
          // File doesn't exist - create minimal config
          existingConfig = {
            version: '2.0',
            mcp: {},
          };
        } else {
          throw error;
        }
      }

      // Ensure plugins section exists
      const updatedConfig: any = {
        ...existingConfig,
        plugins: existingConfig.plugins || {},
      };

      // Add selected plugins to config
      for (const plugin of selectedPlugins) {
        const existingPluginConfig = updatedConfig.plugins[plugin.name] || {};

        updatedConfig.plugins[plugin.name] = {
          marketplace: plugin.marketplace,
          enabled: plugin.enabled,
          // Preserve existing mcps array if present, otherwise empty
          mcps: existingPluginConfig.mcps || [],
        };
      }

      // Write updated config back to file
      const yamlContent = yaml.dump(updatedConfig, {
        indent: 2,
        lineWidth: 100,
        noRefs: true,
        sortKeys: false, // Preserve key order
      });

      await fs.writeFile(configPath, yamlContent, 'utf-8');
    } catch (error) {
      throw new PluginError(
        `Failed to update user config: ${(error as Error).message}`,
        undefined
      );
    }
  }

  /**
   * Export all installed plugins to config
   *
   * Convenience method to export all installed plugins without prompting.
   *
   * @returns Promise that resolves when export is complete
   *
   * @example
   * ```typescript
   * await exporter.exportAllPlugins();
   * ```
   */
  async exportAllPlugins(): Promise<void> {
    const installedPlugins = await this.detector.detectInstalledPlugins();

    if (installedPlugins.length === 0) {
      console.log('ℹ️  No plugins installed. Nothing to export.');
      return;
    }

    await this.updateUserConfig(installedPlugins);

    console.log(`✅ Exported all ${installedPlugins.length} installed plugins to config`);
  }

  /**
   * Check which plugins are in config vs installed
   *
   * Compares installed plugins with plugins in user config to identify:
   * - Plugins installed but not in config
   * - Plugins in config but not installed
   * - Plugins both installed and in config
   *
   * @returns Object with categorized plugins
   *
   * @example
   * ```typescript
   * const comparison = await exporter.compareInstalledWithConfig();
   * console.log('Not in config:', comparison.installedOnly);
   * console.log('Not installed:', comparison.configOnly);
   * console.log('Synced:', comparison.both);
   * ```
   */
  async compareInstalledWithConfig(): Promise<{
    installedOnly: InstalledPlugin[];
    configOnly: string[];
    both: InstalledPlugin[];
  }> {
    // Detect installed plugins
    const installedPlugins = await this.detector.detectInstalledPlugins();

    // Read config
    const configPath = getUserConfigPath();
    let configPlugins: Set<string> = new Set();

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = yaml.load(content) as OvertureConfig;

      if (config.plugins) {
        configPlugins = new Set(Object.keys(config.plugins));
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        // Config doesn't exist - treat as empty
      } else {
        // Log other errors (permission denied, disk full, malformed YAML, etc.)
        console.warn(`⚠️  Could not read config: ${err.message}`);
      }
    }

    // Categorize plugins
    const installedOnly: InstalledPlugin[] = [];
    const both: InstalledPlugin[] = [];

    for (const plugin of installedPlugins) {
      if (configPlugins.has(plugin.name)) {
        both.push(plugin);
        configPlugins.delete(plugin.name);
      } else {
        installedOnly.push(plugin);
      }
    }

    // Remaining plugins in configPlugins are in config but not installed
    const configOnly = Array.from(configPlugins);

    return {
      installedOnly,
      configOnly,
      both,
    };
  }
}
