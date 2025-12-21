/**
 * Output Formatting Utilities
 *
 * Provides helpers for formatting lists, tables, and structured text
 * for CLI display.
 *
 * @module @overture/utils/format
 */

import chalk from 'chalk';

/**
 * Format a list of items with bullet points.
 * @param items - Array of items to format
 * @param bullet - Bullet character (default: '\u2022')
 * @returns Formatted string with each item on a new line
 *
 * @example
 * ```typescript
 * const list = formatList(['item1', 'item2', 'item3']);
 * // Output:
 * //   \u2022 item1
 * //   \u2022 item2
 * //   \u2022 item3
 * ```
 */
export function formatList(items: string[], bullet = '\u2022'): string {
  return items.map((item) => `  ${bullet} ${item}`).join('\n');
}

/**
 * Format a key-value pair with consistent spacing.
 * @param key - The key/label
 * @param value - The value
 * @param keyWidth - Width to pad the key to (default: 20)
 * @returns Formatted string with key and value
 *
 * @example
 * ```typescript
 * const formatted = formatKeyValue('Name', 'my-project');
 * // Output: "  Name                : my-project"
 * ```
 */
export function formatKeyValue(
  key: string,
  value: string,
  keyWidth = 20,
): string {
  return `  ${key.padEnd(keyWidth)} ${chalk.gray(':')} ${value}`;
}

/**
 * Format a simple table from key-value pairs.
 * @param data - Record of key-value pairs
 * @param keyWidth - Width to pad keys to (default: 20)
 * @returns Formatted string with all key-value pairs
 *
 * @example
 * ```typescript
 * const table = formatTable({ Name: 'my-project', Type: 'app' });
 * // Output:
 * //   Name                : my-project
 * //   Type                : app
 * ```
 */
export function formatTable(
  data: Record<string, string>,
  keyWidth = 20,
): string {
  return Object.entries(data)
    .map(([key, value]) => formatKeyValue(key, value, keyWidth))
    .join('\n');
}

/**
 * Format a section with a header and content.
 * @param header - The section header
 * @param content - The section content
 * @returns Formatted string with header and indented content
 *
 * @example
 * ```typescript
 * const section = formatSection('Configuration', formatTable({ key: 'value' }));
 * ```
 */
export function formatSection(header: string, content: string): string {
  return `${chalk.bold(header)}\n${content}`;
}

/**
 * Format a heading with optional color.
 * @param text - The heading text
 * @param color - Chalk color function (default: bold)
 * @returns Formatted heading
 *
 * @example
 * ```typescript
 * const heading = formatHeading('My Title', chalk.cyan);
 * ```
 */
export function formatHeading(
  text: string,
  color: (str: string) => string = chalk.bold,
): string {
  return color(text);
}

/**
 * Format a horizontal divider line.
 * @param char - Character to use for divider (default: '\u2500')
 * @param width - Width of divider (default: 50)
 * @returns Formatted divider string
 *
 * @example
 * ```typescript
 * const divider = formatDivider();
 * // Output: gray line of 50 dashes
 * ```
 */
export function formatDivider(char = '\u2500', width = 50): string {
  return chalk.gray(char.repeat(width));
}

/**
 * Indent text by a specified number of spaces.
 * @param text - The text to indent
 * @param spaces - Number of spaces to indent (default: 2)
 * @returns Indented text
 *
 * @example
 * ```typescript
 * const indented = indent('line1\nline2', 4);
 * // Output:
 * //     line1
 * //     line2
 * ```
 */
export function indent(text: string, spaces = 2): string {
  const padding = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => `${padding}${line}`)
    .join('\n');
}
