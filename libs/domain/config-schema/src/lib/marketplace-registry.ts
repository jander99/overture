/**
 * Marketplace Registry
 *
 * Central registry for Claude Code plugin marketplace configurations.
 * Maps marketplace shortcuts to full repository paths and provides
 * marketplace resolution utilities.
 *
 * @module domain/marketplace-registry
 * @version 0.3.0
 */

/**
 * Marketplace Configuration
 *
 * Configuration for a plugin marketplace.
 *
 * @example
 * ```typescript
 * {
 *   shortName: 'claude-code-workflows',
 *   fullPath: 'anthropics/claude-code-workflows',
 *   type: 'github'
 * }
 * ```
 */
export interface MarketplaceConfig {
  /**
   * Short name used in config
   * @example "claude-code-workflows"
   */
  shortName: string;

  /**
   * Full path for Claude CLI
   * @example "anthropics/claude-code-workflows"
   */
  fullPath: string;

  /**
   * Marketplace type
   */
  type: 'github' | 'local' | 'custom';

  /**
   * Local filesystem path (for local marketplaces)
   * @example "/home/user/dev/marketplace"
   */
  localPath?: string;
}

/**
 * Marketplace Registry
 *
 * Static registry that maps marketplace shortcuts to full repository paths.
 * Provides resolution and validation methods for marketplace identifiers.
 *
 * This registry is extensible - new marketplaces can be added as they become available.
 *
 * @example
 * ```typescript
 * // Resolve marketplace shortcut
 * const fullPath = MarketplaceRegistry.resolveMarketplace('claude-code-workflows');
 * // 'anthropics/claude-code-workflows'
 *
 * // Check if marketplace is known
 * const isKnown = MarketplaceRegistry.isKnownMarketplace('claude-code-workflows');
 * // true
 *
 * // Get all known marketplaces
 * const all = MarketplaceRegistry.getAllKnown();
 * // [{ shortName: 'claude-code-workflows', fullPath: 'anthropics/claude-code-workflows', type: 'github' }]
 * ```
 */
export class MarketplaceRegistry {
  /**
   * Known marketplace mappings
   *
   * Maps shortcut names to full repository paths.
   * Add new marketplaces here as they become available.
   *
   * Format:
   * - Key: Shortcut name used in config (lowercase, kebab-case)
   * - Value: Full repository path for Claude CLI (e.g., "org/repo")
   */
  private static readonly KNOWN_MARKETPLACES: Record<string, string> = {
    'claude-code-workflows': 'anthropics/claude-code-workflows',
    // Future marketplaces can be added here:
    // 'community-workflows': 'community/claude-workflows',
    // 'enterprise-tools': 'myorg/enterprise-marketplace',
  };

  /**
   * Custom marketplace mappings added at runtime
   *
   * Stores dynamically registered marketplace shortcuts.
   * Separate from KNOWN_MARKETPLACES to maintain immutability.
   */
  private static customMarketplaces = new Map<string, string>();

  /**
   * Resolve marketplace shortcut to full path
   *
   * If the provided marketplace is a known shortcut, returns the full path.
   * Otherwise, returns the input unchanged (assumes it's already a full path or custom marketplace).
   *
   * @param shortNameOrPath - Marketplace shortcut or full path
   * @returns Full marketplace path
   *
   * @example
   * ```typescript
   * // Known shortcut
   * MarketplaceRegistry.resolveMarketplace('claude-code-workflows');
   * // → 'anthropics/claude-code-workflows'
   *
   * // Already full path
   * MarketplaceRegistry.resolveMarketplace('myorg/custom-marketplace');
   * // → 'myorg/custom-marketplace'
   *
   * // Local path
   * MarketplaceRegistry.resolveMarketplace('./my-local-marketplace');
   * // → './my-local-marketplace'
   * ```
   */
  static resolveMarketplace(shortNameOrPath: string): string {
    // Check built-in marketplaces first
    if (shortNameOrPath in this.KNOWN_MARKETPLACES) {
      return this.KNOWN_MARKETPLACES[shortNameOrPath];
    }

    // Check custom marketplaces
    const customPath = this.customMarketplaces.get(shortNameOrPath);
    if (customPath) {
      return customPath;
    }

    // Return unchanged if not found (assume it's already a full path)
    return shortNameOrPath;
  }

  /**
   * Check if marketplace is a known shortcut
   *
   * Returns true if the provided identifier is a registered marketplace shortcut.
   *
   * @param shortName - Marketplace identifier to check
   * @returns True if marketplace is in the known registry
   *
   * @example
   * ```typescript
   * MarketplaceRegistry.isKnownMarketplace('claude-code-workflows');
   * // true
   *
   * MarketplaceRegistry.isKnownMarketplace('myorg/custom');
   * // false
   * ```
   */
  static isKnownMarketplace(shortName: string): boolean {
    return shortName in this.KNOWN_MARKETPLACES || this.customMarketplaces.has(shortName);
  }

  /**
   * Get all known marketplace configurations
   *
   * Returns an array of all registered marketplaces with their configurations.
   *
   * @returns Array of marketplace configurations
   *
   * @example
   * ```typescript
   * const marketplaces = MarketplaceRegistry.getAllKnown();
   * // [
   * //   {
   * //     shortName: 'claude-code-workflows',
   * //     fullPath: 'anthropics/claude-code-workflows',
   * //     type: 'github'
   * //   }
   * // ]
   * ```
   */
  static getAllKnown(): MarketplaceConfig[] {
    const builtIn = Object.entries(this.KNOWN_MARKETPLACES).map(([shortName, fullPath]) => ({
      shortName,
      fullPath,
      type: 'github' as const,
    }));

    const custom = Array.from(this.customMarketplaces.entries()).map(([shortName, fullPath]) => ({
      shortName,
      fullPath,
      type: 'github' as const,
    }));

    return [...builtIn, ...custom];
  }

  /**
   * Get marketplace shortcut from full path
   *
   * Reverse lookup: finds the shortcut for a given full path.
   * Returns undefined if no shortcut is registered for the path.
   *
   * @param fullPath - Full marketplace path
   * @returns Shortcut name if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const shortcut = MarketplaceRegistry.getShortcutForPath(
   *   'anthropics/claude-code-workflows'
   * );
   * // 'claude-code-workflows'
   *
   * const unknown = MarketplaceRegistry.getShortcutForPath('myorg/custom');
   * // undefined
   * ```
   */
  static getShortcutForPath(fullPath: string): string | undefined {
    // Check built-in marketplaces first
    for (const [shortName, registeredPath] of Object.entries(this.KNOWN_MARKETPLACES)) {
      if (registeredPath === fullPath) {
        return shortName;
      }
    }

    // Check custom marketplaces
    for (const [shortName, registeredPath] of this.customMarketplaces.entries()) {
      if (registeredPath === fullPath) {
        return shortName;
      }
    }

    return undefined;
  }

  /**
   * Normalize marketplace identifier
   *
   * Normalizes marketplace identifiers by:
   * - Converting full paths to shortcuts if available
   * - Preserving unknown marketplaces as-is
   *
   * Useful for comparing marketplace identifiers from different sources.
   *
   * @param marketplace - Marketplace identifier to normalize
   * @returns Normalized marketplace identifier (prefers shortcuts)
   *
   * @example
   * ```typescript
   * // Full path → shortcut
   * MarketplaceRegistry.normalize('anthropics/claude-code-workflows');
   * // 'claude-code-workflows'
   *
   * // Already shortcut
   * MarketplaceRegistry.normalize('claude-code-workflows');
   * // 'claude-code-workflows'
   *
   * // Unknown marketplace
   * MarketplaceRegistry.normalize('myorg/custom');
   * // 'myorg/custom'
   * ```
   */
  static normalize(marketplace: string): string {
    // Check if it's already a known shortcut
    if (this.isKnownMarketplace(marketplace)) {
      return marketplace;
    }

    // Check if it's a full path that has a shortcut
    const shortcut = this.getShortcutForPath(marketplace);
    if (shortcut) {
      return shortcut;
    }

    // Unknown marketplace - return as-is
    return marketplace;
  }

  /**
   * Add a custom marketplace to the registry
   *
   * Registers a new marketplace shortcut. This is useful for:
   * - Testing with custom marketplaces
   * - Enterprise deployments with private marketplaces
   * - Local development
   *
   * Note: Additions are runtime-only and not persisted.
   *
   * @param shortName - Shortcut name for the marketplace
   * @param fullPath - Full repository path or local path
   *
   * @example
   * ```typescript
   * // Add custom marketplace
   * MarketplaceRegistry.addCustomMarketplace(
   *   'my-marketplace',
   *   'myorg/my-marketplace'
   * );
   *
   * // Now it can be resolved
   * MarketplaceRegistry.resolveMarketplace('my-marketplace');
   * // 'myorg/my-marketplace'
   * ```
   */
  static addCustomMarketplace(shortName: string, fullPath: string): void {
    this.customMarketplaces.set(shortName, fullPath);
  }

  /**
   * Remove a custom marketplace from the registry
   *
   * Removes a marketplace shortcut. Cannot remove built-in marketplaces.
   *
   * @param shortName - Shortcut name to remove
   * @returns True if marketplace was removed, false if it doesn't exist or is built-in
   *
   * @example
   * ```typescript
   * // Add and remove custom marketplace
   * MarketplaceRegistry.addCustomMarketplace('temp', 'org/temp');
   * MarketplaceRegistry.removeCustomMarketplace('temp');
   * // true
   *
   * // Cannot remove built-in marketplaces
   * MarketplaceRegistry.removeCustomMarketplace('claude-code-workflows');
   * // false (or throw error in strict mode)
   * ```
   */
  static removeCustomMarketplace(shortName: string): boolean {
    // Prevent removal of built-in marketplaces
    if (shortName in this.KNOWN_MARKETPLACES) {
      return false;
    }

    // Remove from custom marketplaces
    return this.customMarketplaces.delete(shortName);
  }
}
