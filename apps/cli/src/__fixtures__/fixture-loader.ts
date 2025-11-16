/**
 * Fixture Loader Utility
 *
 * Provides helper functions for loading test fixtures in unit and integration tests.
 *
 * @module __fixtures__/fixture-loader
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * Load a test fixture file as raw string
 *
 * @param relativePath - Path relative to __fixtures__ directory
 * @returns File content as string
 *
 * @example
 * ```typescript
 * const output = await loadFixture('plugin-sync/command-outputs/install-success.txt');
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
export async function loadJsonFixture<T = any>(relativePath: string): Promise<T> {
  const content = await loadFixture(relativePath);
  return JSON.parse(content) as T;
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
export async function loadYamlFixture<T = any>(relativePath: string): Promise<T> {
  const content = await loadFixture(relativePath);
  return yaml.load(content) as T;
}

/**
 * Load multiple fixtures in parallel
 *
 * @param relativePaths - Array of paths relative to __fixtures__ directory
 * @returns Array of file contents in same order
 *
 * @example
 * ```typescript
 * const [valid, empty, malformed] = await loadFixtures([
 *   'plugin-sync/claude-settings/valid-settings.json',
 *   'plugin-sync/claude-settings/empty-settings.json',
 *   'plugin-sync/claude-settings/malformed-settings.json'
 * ]);
 * ```
 */
export async function loadFixtures(relativePaths: string[]): Promise<string[]> {
  return Promise.all(relativePaths.map(loadFixture));
}

/**
 * Get absolute path to fixture file
 *
 * Useful when you need to pass a file path to a function under test.
 *
 * @param relativePath - Path relative to __fixtures__ directory
 * @returns Absolute path to fixture file
 *
 * @example
 * ```typescript
 * const configPath = getFixturePath('configs/valid-config.yaml');
 * const config = await configLoader.loadConfig(configPath);
 * ```
 */
export function getFixturePath(relativePath: string): string {
  return path.join(__dirname, relativePath);
}
