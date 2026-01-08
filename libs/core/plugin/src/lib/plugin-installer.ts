/**
 * Plugin Installer Service
 *
 * Installs Claude Code plugins via the Claude CLI (`claude plugin install`).
 * Handles marketplace auto-addition, command execution, and error handling.
 *
 * Uses hexagonal architecture with dependency injection for testability.
 *
 * @module lib/plugin-installer
 * @version 3.0.0
 */

import type { ProcessPort } from '@overture/ports-process';
import type { OutputPort } from '@overture/ports-output';
import type {
  InstallationResult,
  InstallationOptions,
} from '@overture/config-types';
import { MarketplaceRegistry } from '@overture/config-schema';
import { TIMEOUTS } from '@overture/utils';

const DEFAULT_INSTALLATION_TIMEOUT = TIMEOUTS.PLUGIN_INSTALL_MS;

/**
 * Plugin Installer Service
 *
 * Provides methods to install Claude Code plugins via the Claude CLI.
 * Automatically handles marketplace addition for known marketplaces.
 *
 * @example
 * ```typescript
 * import { PluginInstaller } from '@overture/plugin-core';
 * import { NodeProcessAdapter, ConsoleOutputAdapter } from '@overture/adapters-node';
 *
 * const process = new NodeProcessAdapter();
 * const output = new ConsoleOutputAdapter();
 * const installer = new PluginInstaller(process, output);
 *
 * // Install a plugin
 * const result = await installer.installPlugin(
 *   'python-development',
 *   'claude-code-workflows'
 * );
 * // { success: true, plugin: 'python-development', marketplace: 'claude-code-workflows' }
 *
 * // Dry run (simulate without installing)
 * const result = await installer.installPlugin(
 *   'python-development',
 *   'claude-code-workflows',
 *   { dryRun: true }
 * );
 * ```
 */
export class PluginInstaller {
  private readonly process: ProcessPort;
  private readonly output: OutputPort;

  constructor(process: ProcessPort, output: OutputPort) {
    this.process = process;
    this.output = output;
  }

  /**
   * Install a Claude Code plugin
   *
   * Executes `claude plugin install name@marketplace` via ProcessPort.
   * Automatically adds known marketplaces before installation.
   *
   * Installation workflow:
   * 1. Check Claude CLI binary availability
   * 2. Add marketplace if it's a known marketplace
   * 3. Execute install command
   * 4. Capture output and check for success
   *
   * @param name - Plugin name
   * @param marketplace - Marketplace identifier (shortcut or full path)
   * @param options - Installation options (dryRun, force, timeout)
   * @returns Installation result with success status and output
   *
   * @example
   * ```typescript
   * // Standard installation
   * const result = await installer.installPlugin(
   *   'python-development',
   *   'claude-code-workflows'
   * );
   *
   * // Dry run
   * const result = await installer.installPlugin(
   *   'backend-development',
   *   'claude-code-workflows',
   *   { dryRun: true }
   * );
   *
   * // With custom timeout
   * const result = await installer.installPlugin(
   *   'large-plugin',
   *   'custom-marketplace',
   *   { timeout: 60000 } // 60 seconds
   * );
   * ```
   */
  async installPlugin(
    name: string,
    marketplace: string,
    options: InstallationOptions = {},
  ): Promise<InstallationResult> {
    const dryRun = options.dryRun ?? false;
    const timeout = options.timeout ?? DEFAULT_INSTALLATION_TIMEOUT;

    // Validate input for security
    if (!PluginInstaller.isValidPluginName(name)) {
      return {
        success: false,
        plugin: name,
        marketplace,
        error: `Invalid plugin name: ${name}. Must be lowercase alphanumeric with hyphens/underscores.`,
      };
    }

    if (!PluginInstaller.isValidMarketplace(marketplace)) {
      return {
        success: false,
        plugin: name,
        marketplace,
        error: `Invalid marketplace identifier: ${marketplace}`,
      };
    }

    try {
      // Check Claude binary availability (unless dry run)
      if (!dryRun) {
        const binaryAvailable = await this.checkClaudeBinary();
        if (!binaryAvailable) {
          return {
            success: false,
            plugin: name,
            marketplace,
            error:
              'Claude CLI not found. Install from https://claude.com/claude-code',
          };
        }
      }

      // Dry run mode - simulate success
      if (dryRun) {
        this.output.info(`[DRY RUN] Would install: ${name}@${marketplace}`);
        return {
          success: true,
          plugin: name,
          marketplace,
          output: `[DRY RUN] Would install: ${name}@${marketplace}`,
        };
      }

      // Ensure marketplace is added (for known marketplaces)
      await this.ensureMarketplace(marketplace);

      // Execute install command
      this.output.info(`Installing ${name}@${marketplace}...`);
      const installArgs = ['plugin', 'install', `${name}@${marketplace}`];

      let timeoutId: NodeJS.Timeout | undefined;
      const result = await Promise.race([
        this.process.exec('claude', installArgs),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error('Installation timeout')),
            timeout,
          );
        }),
      ]);

      // Clear timeout to prevent event loop delay
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      // Check if installation succeeded
      if (result.exitCode === 0) {
        this.output.success(`✅ Installed ${name}@${marketplace}`);
        return {
          success: true,
          plugin: name,
          marketplace,
          output: result.stdout,
        };
      } else {
        // Installation failed
        this.output.error(`❌ Failed to install ${name}@${marketplace}`);
        return {
          success: false,
          plugin: name,
          marketplace,
          error: result.stderr || 'Installation failed',
          output: result.stdout,
        };
      }
    } catch (error) {
      // Handle errors (timeout, command execution failure, etc.)
      this.output.error(
        `❌ Error installing ${name}@${marketplace}: ${(error as Error).message}`,
      );
      return {
        success: false,
        plugin: name,
        marketplace,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Ensure marketplace is added to Claude CLI
   *
   * Automatically adds known marketplaces (e.g., claude-code-workflows)
   * before plugin installation. Uses MarketplaceRegistry to resolve
   * marketplace shortcuts to full paths.
   *
   * For unknown marketplaces, skips addition (assumes user has already added it).
   *
   * @param marketplace - Marketplace identifier
   * @returns Promise that resolves when marketplace is ready
   *
   * @example
   * ```typescript
   * // Add known marketplace
   * await installer.ensureMarketplace('claude-code-workflows');
   * // Executes: claude plugin marketplace add anthropics/claude-code-workflows
   *
   * // Unknown marketplace (skips)
   * await installer.ensureMarketplace('myorg/custom-marketplace');
   * // No action taken
   * ```
   */
  async ensureMarketplace(marketplace: string): Promise<void> {
    // Check if this is a known marketplace
    if (!MarketplaceRegistry.isKnownMarketplace(marketplace)) {
      // Unknown marketplace - skip addition (assume user has added it)
      return;
    }

    // Resolve marketplace to full path
    const fullPath = MarketplaceRegistry.resolveMarketplace(marketplace);

    try {
      // Execute marketplace add command
      const addArgs = ['plugin', 'marketplace', 'add', fullPath];
      const result = await this.process.exec('claude', addArgs);

      // Ignore errors (marketplace may already be added)
      if (result.exitCode !== 0) {
        this.output.warn(
          `⚠️  Marketplace add returned non-zero exit: ${result.stderr}`,
        );
      }
    } catch (error) {
      // Ignore errors - marketplace may already be added
      this.output.warn(
        `⚠️  Failed to add marketplace ${fullPath}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Check if Claude CLI binary is available
   *
   * Uses ProcessPort to check if the `claude` command is available.
   *
   * @returns True if Claude CLI is available
   *
   * @example
   * ```typescript
   * const available = await installer.checkClaudeBinary();
   * if (!available) {
   *   console.error('Claude CLI not found');
   * }
   * ```
   */
  async checkClaudeBinary(): Promise<boolean> {
    try {
      return await this.process.commandExists('claude');
    } catch {
      return false;
    }
  }

  /**
   * Install multiple plugins sequentially
   *
   * Installs a batch of plugins one at a time. Continues on failure
   * to install as many plugins as possible.
   *
   * @param plugins - Array of [name, marketplace] tuples
   * @param options - Installation options
   * @returns Array of installation results
   *
   * @example
   * ```typescript
   * const results = await installer.installPlugins([
   *   ['python-development', 'claude-code-workflows'],
   *   ['backend-development', 'claude-code-workflows'],
   *   ['custom-plugin', 'myorg/custom']
   * ]);
   *
   * const succeeded = results.filter(r => r.success).length;
   * const failed = results.filter(r => !r.success).length;
   * console.log(`${succeeded} succeeded, ${failed} failed`);
   * ```
   */
  async installPlugins(
    plugins: Array<[string, string]>,
    options: InstallationOptions = {},
  ): Promise<InstallationResult[]> {
    const results: InstallationResult[] = [];

    // Install plugins sequentially (not in parallel to avoid race conditions)
    for (const [name, marketplace] of plugins) {
      const result = await this.installPlugin(name, marketplace, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Validate plugin name format
   *
   * Checks if a plugin name is valid according to Claude Code naming rules.
   * Plugin names should be lowercase, alphanumeric with hyphens.
   *
   * @param name - Plugin name to validate
   * @returns True if name is valid
   *
   * @example
   * ```typescript
   * PluginInstaller.isValidPluginName('python-development'); // true
   * PluginInstaller.isValidPluginName('Python_Development'); // false
   * PluginInstaller.isValidPluginName('my-plugin-v2'); // true
   * ```
   */
  static isValidPluginName(name: string): boolean {
    // Plugin names: lowercase, alphanumeric, hyphens, underscores
    const validNameRegex = /^[a-z0-9][a-z0-9-_]*$/;
    return validNameRegex.test(name);
  }

  /**
   * Validate marketplace format
   *
   * Checks if a marketplace identifier is valid.
   * Can be either:
   * - A shortcut (e.g., "claude-code-workflows")
   * - A full GitHub path (e.g., "anthropics/claude-code-workflows")
   * - A local path (e.g., "./marketplace" or "/abs/path/marketplace")
   *
   * @param marketplace - Marketplace identifier to validate
   * @returns True if marketplace format is valid
   *
   * @example
   * ```typescript
   * PluginInstaller.isValidMarketplace('claude-code-workflows'); // true
   * PluginInstaller.isValidMarketplace('myorg/custom-marketplace'); // true
   * PluginInstaller.isValidMarketplace('./local-marketplace'); // true
   * PluginInstaller.isValidMarketplace(''); // false
   * ```
   */
  static isValidMarketplace(marketplace: string): boolean {
    if (!marketplace || marketplace.trim().length === 0) {
      return false;
    }

    // Check for valid patterns:
    // - Shortcut: alphanumeric with hyphens
    // - GitHub: org/repo format
    // - Local: starts with . or /
    const shortcutRegex = /^[a-z0-9][a-z0-9-_]*$/;
    const githubRegex = /^[a-z0-9-_]+\/[a-z0-9-_]+$/i;
    const localRegex = /^[./]/;

    return (
      shortcutRegex.test(marketplace) ||
      githubRegex.test(marketplace) ||
      localRegex.test(marketplace)
    );
  }
}
