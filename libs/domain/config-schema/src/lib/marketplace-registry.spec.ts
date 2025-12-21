/**
 * MarketplaceRegistry Tests
 *
 * Comprehensive test suite for marketplace shortcut resolution and registry management.
 * Tests all public static methods with focus on edge cases and validation.
 *
 * @module domain/marketplace-registry.spec
 * @version 0.3.0
 */

import {
  MarketplaceRegistry,
  type MarketplaceConfig,
} from './marketplace-registry';

describe('MarketplaceRegistry', () => {
  // Reset the registry between tests to ensure clean state
  beforeEach(() => {
    // Clear any custom marketplaces that might have been added
    // This ensures test isolation
    vi.clearAllMocks();
  });

  describe('resolveMarketplace', () => {
    it('should resolve known marketplace shortcut to full path', () => {
      const result = MarketplaceRegistry.resolveMarketplace(
        'claude-code-workflows',
      );

      expect(result).toBe('anthropics/claude-code-workflows');
    });

    it('should return unknown marketplace as-is (pass-through)', () => {
      const customMarketplace = 'myorg/custom-marketplace';
      const result = MarketplaceRegistry.resolveMarketplace(customMarketplace);

      expect(result).toBe(customMarketplace);
    });

    it('should return local marketplace path as-is', () => {
      const localPath = './my-local-marketplace';
      const result = MarketplaceRegistry.resolveMarketplace(localPath);

      expect(result).toBe(localPath);
    });

    it('should return absolute local path as-is', () => {
      const absolutePath = '/home/user/dev/marketplace';
      const result = MarketplaceRegistry.resolveMarketplace(absolutePath);

      expect(result).toBe(absolutePath);
    });

    it('should handle empty string gracefully', () => {
      const result = MarketplaceRegistry.resolveMarketplace('');

      expect(result).toBe('');
    });

    it('should handle marketplace with special characters', () => {
      const specialMarketplace =
        'org-name/marketplace-with-dashes_and_underscores';
      const result = MarketplaceRegistry.resolveMarketplace(specialMarketplace);

      expect(result).toBe(specialMarketplace);
    });

    it('should be case-sensitive for shortcut matching', () => {
      // Shortcuts are case-sensitive
      const result = MarketplaceRegistry.resolveMarketplace(
        'Claude-Code-Workflows',
      );

      // Should not match, so returns as-is
      expect(result).toBe('Claude-Code-Workflows');
    });

    it('should resolve after custom marketplace is added', () => {
      MarketplaceRegistry.addCustomMarketplace(
        'custom-market',
        'custom-org/market',
      );

      const result = MarketplaceRegistry.resolveMarketplace('custom-market');

      expect(result).toBe('custom-org/market');

      // Clean up
      MarketplaceRegistry.removeCustomMarketplace('custom-market');
    });
  });

  describe('isKnownMarketplace', () => {
    it('should return true for known marketplace shortcut', () => {
      const result = MarketplaceRegistry.isKnownMarketplace(
        'claude-code-workflows',
      );

      expect(result).toBe(true);
    });

    it('should return false for unknown marketplace', () => {
      const result = MarketplaceRegistry.isKnownMarketplace('myorg/custom');

      expect(result).toBe(false);
    });

    it('should return false for full path of known marketplace', () => {
      // Full path is NOT a known shortcut
      const result = MarketplaceRegistry.isKnownMarketplace(
        'anthropics/claude-code-workflows',
      );

      expect(result).toBe(false);
    });

    it('should return false for empty string', () => {
      const result = MarketplaceRegistry.isKnownMarketplace('');

      expect(result).toBe(false);
    });

    it('should return false for local paths', () => {
      const result = MarketplaceRegistry.isKnownMarketplace(
        './local-marketplace',
      );

      expect(result).toBe(false);
    });

    it('should be case-sensitive', () => {
      const result = MarketplaceRegistry.isKnownMarketplace(
        'Claude-Code-Workflows',
      );

      expect(result).toBe(false);
    });

    it('should return true after custom marketplace is added', () => {
      MarketplaceRegistry.addCustomMarketplace(
        'test-market',
        'test-org/market',
      );

      const result = MarketplaceRegistry.isKnownMarketplace('test-market');

      expect(result).toBe(true);

      // Clean up
      MarketplaceRegistry.removeCustomMarketplace('test-market');
    });
  });

  describe('getAllKnown', () => {
    it('should return array of all known marketplaces', () => {
      const marketplaces = MarketplaceRegistry.getAllKnown();

      expect(Array.isArray(marketplaces)).toBe(true);
      expect(marketplaces.length).toBeGreaterThan(0);
    });

    it('should include claude-code-workflows marketplace', () => {
      const marketplaces = MarketplaceRegistry.getAllKnown();

      const claudeWorkflows = marketplaces.find(
        (m) => m.shortName === 'claude-code-workflows',
      );

      expect(claudeWorkflows).toBeDefined();
      expect(claudeWorkflows).toMatchObject({
        shortName: 'claude-code-workflows',
        fullPath: 'anthropics/claude-code-workflows',
        type: 'github',
      });
    });

    it('should return valid MarketplaceConfig objects', () => {
      const marketplaces = MarketplaceRegistry.getAllKnown();

      marketplaces.forEach((marketplace: MarketplaceConfig) => {
        expect(marketplace).toHaveProperty('shortName');
        expect(marketplace).toHaveProperty('fullPath');
        expect(marketplace).toHaveProperty('type');
        expect(typeof marketplace.shortName).toBe('string');
        expect(typeof marketplace.fullPath).toBe('string');
        expect(marketplace.type).toBe('github');
      });
    });

    it('should include custom marketplaces when added', () => {
      MarketplaceRegistry.addCustomMarketplace('custom1', 'org1/repo1');
      MarketplaceRegistry.addCustomMarketplace('custom2', 'org2/repo2');

      const marketplaces = MarketplaceRegistry.getAllKnown();

      const custom1 = marketplaces.find((m) => m.shortName === 'custom1');
      const custom2 = marketplaces.find((m) => m.shortName === 'custom2');

      expect(custom1).toBeDefined();
      expect(custom2).toBeDefined();
      expect(custom1?.fullPath).toBe('org1/repo1');
      expect(custom2?.fullPath).toBe('org2/repo2');

      // Clean up
      MarketplaceRegistry.removeCustomMarketplace('custom1');
      MarketplaceRegistry.removeCustomMarketplace('custom2');
    });

    it('should return new array instance (not shared reference)', () => {
      const marketplaces1 = MarketplaceRegistry.getAllKnown();
      const marketplaces2 = MarketplaceRegistry.getAllKnown();

      expect(marketplaces1).not.toBe(marketplaces2);
      expect(marketplaces1).toEqual(marketplaces2);
    });
  });

  describe('getShortcutForPath', () => {
    it('should return shortcut for known full path', () => {
      const shortcut = MarketplaceRegistry.getShortcutForPath(
        'anthropics/claude-code-workflows',
      );

      expect(shortcut).toBe('claude-code-workflows');
    });

    it('should return undefined for unknown full path', () => {
      const shortcut = MarketplaceRegistry.getShortcutForPath('myorg/custom');

      expect(shortcut).toBeUndefined();
    });

    it('should return undefined for shortcut input (not reverse lookup)', () => {
      const shortcut = MarketplaceRegistry.getShortcutForPath(
        'claude-code-workflows',
      );

      expect(shortcut).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const shortcut = MarketplaceRegistry.getShortcutForPath('');

      expect(shortcut).toBeUndefined();
    });

    it('should return undefined for local paths', () => {
      const shortcut = MarketplaceRegistry.getShortcutForPath(
        './local-marketplace',
      );

      expect(shortcut).toBeUndefined();
    });

    it('should be case-sensitive', () => {
      const shortcut = MarketplaceRegistry.getShortcutForPath(
        'Anthropics/claude-code-workflows',
      );

      expect(shortcut).toBeUndefined();
    });

    it('should find shortcut for custom marketplace after adding', () => {
      MarketplaceRegistry.addCustomMarketplace('my-market', 'my-org/my-repo');

      const shortcut = MarketplaceRegistry.getShortcutForPath('my-org/my-repo');

      expect(shortcut).toBe('my-market');

      // Clean up
      MarketplaceRegistry.removeCustomMarketplace('my-market');
    });
  });

  describe('normalize', () => {
    it('should preserve known shortcut as-is', () => {
      const normalized = MarketplaceRegistry.normalize('claude-code-workflows');

      expect(normalized).toBe('claude-code-workflows');
    });

    it('should convert known full path to shortcut', () => {
      const normalized = MarketplaceRegistry.normalize(
        'anthropics/claude-code-workflows',
      );

      expect(normalized).toBe('claude-code-workflows');
    });

    it('should preserve unknown marketplace as-is', () => {
      const normalized = MarketplaceRegistry.normalize('myorg/custom');

      expect(normalized).toBe('myorg/custom');
    });

    it('should preserve local paths as-is', () => {
      const normalized = MarketplaceRegistry.normalize('./local-marketplace');

      expect(normalized).toBe('./local-marketplace');
    });

    it('should handle empty string', () => {
      const normalized = MarketplaceRegistry.normalize('');

      expect(normalized).toBe('');
    });

    it('should normalize custom marketplace full path to shortcut', () => {
      MarketplaceRegistry.addCustomMarketplace(
        'custom',
        'custom-org/custom-repo',
      );

      const normalized = MarketplaceRegistry.normalize(
        'custom-org/custom-repo',
      );

      expect(normalized).toBe('custom');

      // Clean up
      MarketplaceRegistry.removeCustomMarketplace('custom');
    });

    it('should be idempotent (normalizing twice yields same result)', () => {
      const once = MarketplaceRegistry.normalize(
        'anthropics/claude-code-workflows',
      );
      const twice = MarketplaceRegistry.normalize(once);

      expect(once).toBe(twice);
      expect(twice).toBe('claude-code-workflows');
    });
  });

  describe('addCustomMarketplace', () => {
    afterEach(() => {
      // Clean up any custom marketplaces added during tests
      MarketplaceRegistry.removeCustomMarketplace('test-custom');
      MarketplaceRegistry.removeCustomMarketplace('another-custom');
    });

    it('should add custom marketplace successfully', () => {
      MarketplaceRegistry.addCustomMarketplace(
        'test-custom',
        'test-org/test-repo',
      );

      const isKnown = MarketplaceRegistry.isKnownMarketplace('test-custom');
      const resolved = MarketplaceRegistry.resolveMarketplace('test-custom');

      expect(isKnown).toBe(true);
      expect(resolved).toBe('test-org/test-repo');
    });

    it('should allow overwriting existing custom marketplace', () => {
      MarketplaceRegistry.addCustomMarketplace('test-custom', 'org1/repo1');
      MarketplaceRegistry.addCustomMarketplace('test-custom', 'org2/repo2');

      const resolved = MarketplaceRegistry.resolveMarketplace('test-custom');

      expect(resolved).toBe('org2/repo2');
    });

    it('should add marketplace to getAllKnown() results', () => {
      MarketplaceRegistry.addCustomMarketplace(
        'test-custom',
        'test-org/test-repo',
      );

      const all = MarketplaceRegistry.getAllKnown();
      const custom = all.find((m) => m.shortName === 'test-custom');

      expect(custom).toBeDefined();
      expect(custom?.fullPath).toBe('test-org/test-repo');
      expect(custom?.type).toBe('github');
    });

    it('should support multiple custom marketplaces', () => {
      MarketplaceRegistry.addCustomMarketplace('custom1', 'org1/repo1');
      MarketplaceRegistry.addCustomMarketplace('custom2', 'org2/repo2');

      expect(MarketplaceRegistry.resolveMarketplace('custom1')).toBe(
        'org1/repo1',
      );
      expect(MarketplaceRegistry.resolveMarketplace('custom2')).toBe(
        'org2/repo2',
      );

      // Clean up
      MarketplaceRegistry.removeCustomMarketplace('custom1');
      MarketplaceRegistry.removeCustomMarketplace('custom2');
    });

    it('should handle local paths as full path', () => {
      MarketplaceRegistry.addCustomMarketplace(
        'local-dev',
        './local-marketplace',
      );

      const resolved = MarketplaceRegistry.resolveMarketplace('local-dev');

      expect(resolved).toBe('./local-marketplace');

      // Clean up
      MarketplaceRegistry.removeCustomMarketplace('local-dev');
    });
  });

  describe('removeCustomMarketplace', () => {
    it('should remove custom marketplace successfully', () => {
      MarketplaceRegistry.addCustomMarketplace(
        'test-custom',
        'test-org/test-repo',
      );

      const removed =
        MarketplaceRegistry.removeCustomMarketplace('test-custom');

      expect(removed).toBe(true);
      expect(MarketplaceRegistry.isKnownMarketplace('test-custom')).toBe(false);
    });

    it('should return false when removing non-existent marketplace', () => {
      const removed =
        MarketplaceRegistry.removeCustomMarketplace('non-existent');

      expect(removed).toBe(false);
    });

    it('should prevent removal of built-in marketplace (claude-code-workflows)', () => {
      const removed = MarketplaceRegistry.removeCustomMarketplace(
        'claude-code-workflows',
      );

      expect(removed).toBe(false);
      expect(
        MarketplaceRegistry.isKnownMarketplace('claude-code-workflows'),
      ).toBe(true);
    });

    it('should remove marketplace from getAllKnown() results', () => {
      MarketplaceRegistry.addCustomMarketplace(
        'test-custom',
        'test-org/test-repo',
      );
      MarketplaceRegistry.removeCustomMarketplace('test-custom');

      const all = MarketplaceRegistry.getAllKnown();
      const custom = all.find((m) => m.shortName === 'test-custom');

      expect(custom).toBeUndefined();
    });

    it('should return false when trying to remove built-in marketplace', () => {
      const builtInMarketplaces = ['claude-code-workflows'];

      builtInMarketplaces.forEach((marketplace) => {
        const removed =
          MarketplaceRegistry.removeCustomMarketplace(marketplace);
        expect(removed).toBe(false);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace in marketplace names', () => {
      const withSpaces = ' claude-code-workflows ';
      const resolved = MarketplaceRegistry.resolveMarketplace(withSpaces);

      // Should not match (whitespace makes it different)
      expect(resolved).toBe(withSpaces);
    });

    it('should handle special characters in custom marketplace names', () => {
      MarketplaceRegistry.addCustomMarketplace('test-_123', 'org/repo-_123');

      expect(MarketplaceRegistry.resolveMarketplace('test-_123')).toBe(
        'org/repo-_123',
      );

      // Clean up
      MarketplaceRegistry.removeCustomMarketplace('test-_123');
    });

    it('should maintain independence between methods', () => {
      // Adding a custom marketplace shouldn't affect other methods unexpectedly
      const initialCount = MarketplaceRegistry.getAllKnown().length;

      MarketplaceRegistry.addCustomMarketplace('temp', 'temp-org/temp-repo');

      expect(MarketplaceRegistry.getAllKnown().length).toBe(initialCount + 1);
      expect(MarketplaceRegistry.isKnownMarketplace('temp')).toBe(true);
      expect(MarketplaceRegistry.resolveMarketplace('temp')).toBe(
        'temp-org/temp-repo',
      );

      MarketplaceRegistry.removeCustomMarketplace('temp');

      expect(MarketplaceRegistry.getAllKnown().length).toBe(initialCount);
      expect(MarketplaceRegistry.isKnownMarketplace('temp')).toBe(false);
    });

    it('should handle Unicode characters in marketplace names', () => {
      const unicode = 'org/repo-\u65e5\u672c\u8a9e';
      const resolved = MarketplaceRegistry.resolveMarketplace(unicode);

      expect(resolved).toBe(unicode);
    });
  });

  describe('integration scenarios', () => {
    it('should support typical workflow: resolve, check, normalize', () => {
      const shortcut = 'claude-code-workflows';

      // Check if known
      const isKnown = MarketplaceRegistry.isKnownMarketplace(shortcut);
      expect(isKnown).toBe(true);

      // Resolve to full path
      const fullPath = MarketplaceRegistry.resolveMarketplace(shortcut);
      expect(fullPath).toBe('anthropics/claude-code-workflows');

      // Normalize full path back to shortcut
      const normalized = MarketplaceRegistry.normalize(fullPath);
      expect(normalized).toBe(shortcut);
    });

    it('should handle unknown marketplace gracefully in workflow', () => {
      const custom = 'custom-org/custom-repo';

      // Unknown marketplace
      const isKnown = MarketplaceRegistry.isKnownMarketplace(custom);
      expect(isKnown).toBe(false);

      // Pass-through resolution
      const resolved = MarketplaceRegistry.resolveMarketplace(custom);
      expect(resolved).toBe(custom);

      // Normalize preserves unknown
      const normalized = MarketplaceRegistry.normalize(custom);
      expect(normalized).toBe(custom);
    });

    it('should support dynamic marketplace registration workflow', () => {
      const shortcut = 'enterprise-marketplace';
      const fullPath = 'mycompany/enterprise-marketplace';

      // Initially unknown
      expect(MarketplaceRegistry.isKnownMarketplace(shortcut)).toBe(false);

      // Add marketplace
      MarketplaceRegistry.addCustomMarketplace(shortcut, fullPath);

      // Now known and usable
      expect(MarketplaceRegistry.isKnownMarketplace(shortcut)).toBe(true);
      expect(MarketplaceRegistry.resolveMarketplace(shortcut)).toBe(fullPath);
      expect(MarketplaceRegistry.getShortcutForPath(fullPath)).toBe(shortcut);
      expect(MarketplaceRegistry.normalize(fullPath)).toBe(shortcut);

      // Remove marketplace
      MarketplaceRegistry.removeCustomMarketplace(shortcut);

      // Back to unknown
      expect(MarketplaceRegistry.isKnownMarketplace(shortcut)).toBe(false);
    });
  });

  describe('type safety and contracts', () => {
    it('should return consistent types from getAllKnown()', () => {
      const marketplaces = MarketplaceRegistry.getAllKnown();

      marketplaces.forEach((marketplace) => {
        // TypeScript compile-time check + runtime validation
        const config: MarketplaceConfig = marketplace;
        expect(config.shortName).toBeDefined();
        expect(config.fullPath).toBeDefined();
        expect(config.type).toBeDefined();
        expect(['github', 'local', 'custom']).toContain(config.type);
      });
    });

    it('should always return string from resolveMarketplace()', () => {
      const inputs = [
        'claude-code-workflows',
        'unknown-marketplace',
        './local-path',
        '',
      ];

      inputs.forEach((input) => {
        const result = MarketplaceRegistry.resolveMarketplace(input);
        expect(typeof result).toBe('string');
      });
    });

    it('should always return boolean from isKnownMarketplace()', () => {
      const inputs = ['claude-code-workflows', 'unknown-marketplace', ''];

      inputs.forEach((input) => {
        const result = MarketplaceRegistry.isKnownMarketplace(input);
        expect(typeof result).toBe('boolean');
      });
    });

    it('should return string | undefined from getShortcutForPath()', () => {
      const result1 = MarketplaceRegistry.getShortcutForPath(
        'anthropics/claude-code-workflows',
      );
      const result2 = MarketplaceRegistry.getShortcutForPath('unknown/path');

      expect(typeof result1).toBe('string');
      expect(result2).toBeUndefined();
    });
  });
});
