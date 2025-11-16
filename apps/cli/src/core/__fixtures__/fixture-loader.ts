/**
 * Test Fixture Loader Utilities
 *
 * Utilities for loading test fixtures from the __fixtures__ directory.
 * Provides convenient functions to load text, JSON, and YAML fixtures.
 *
 * @module core/__fixtures__/fixture-loader
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Load a test fixture file as text
 *
 * @param relativePath - Path relative to __fixtures__ directory
 * @returns File contents as string
 *
 * @example
 * ```typescript
 * const content = await loadFixture('plugin-sync/claude-settings/valid-settings.json');
 * ```
 */
export async function loadFixture(relativePath: string): Promise<string> {
  const fixturePath = path.join(__dirname, relativePath);
  return await fs.readFile(fixturePath, 'utf-8');
}

/**
 * Load and parse JSON fixture
 *
 * @param relativePath - Path relative to __fixtures__ directory
 * @returns Parsed JSON object
 *
 * @example
 * ```typescript
 * const settings = await loadJsonFixture<ClaudeSettings>(
 *   'plugin-sync/claude-settings/valid-settings.json'
 * );
 * ```
 */
export async function loadJsonFixture<T>(relativePath: string): Promise<T> {
  const content = await loadFixture(relativePath);
  return JSON.parse(content);
}

/**
 * Load and parse YAML fixture
 *
 * @param relativePath - Path relative to __fixtures__ directory
 * @returns Parsed YAML object
 *
 * @example
 * ```typescript
 * const config = await loadYamlFixture<OvertureConfig>(
 *   'plugin-sync/configs/user-with-plugins.yaml'
 * );
 * ```
 */
export async function loadYamlFixture<T>(relativePath: string): Promise<T> {
  const yaml = await import('js-yaml');
  const content = await loadFixture(relativePath);
  return yaml.load(content) as T;
}
