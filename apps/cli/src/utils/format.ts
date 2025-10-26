import chalk from 'chalk';

/**
 * Output formatting utilities for CLI display.
 * Provides helpers for formatting lists, tables, and structured text.
 */

/**
 * Format a list of items with bullet points.
 * @param items - Array of items to format
 * @param bullet - Bullet character (default: '•')
 * @returns Formatted string with each item on a new line
 */
export function formatList(items: string[], bullet = '•'): string {
  return items.map((item) => `  ${bullet} ${item}`).join('\n');
}

/**
 * Format a key-value pair with consistent spacing.
 * @param key - The key/label
 * @param value - The value
 * @param keyWidth - Width to pad the key to (default: 20)
 * @returns Formatted string with key and value
 */
export function formatKeyValue(
  key: string,
  value: string,
  keyWidth = 20
): string {
  return `  ${key.padEnd(keyWidth)} ${chalk.gray(':')} ${value}`;
}

/**
 * Format a simple table from key-value pairs.
 * @param data - Record of key-value pairs
 * @param keyWidth - Width to pad keys to (default: 20)
 * @returns Formatted string with all key-value pairs
 */
export function formatTable(
  data: Record<string, string>,
  keyWidth = 20
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
 */
export function formatSection(header: string, content: string): string {
  return `${chalk.bold(header)}\n${content}`;
}

/**
 * Format a heading with optional color.
 * @param text - The heading text
 * @param color - Chalk color function (default: bold)
 * @returns Formatted heading
 */
export function formatHeading(
  text: string,
  color: (str: string) => string = chalk.bold
): string {
  return color(text);
}

/**
 * Format a horizontal divider line.
 * @param char - Character to use for divider (default: '─')
 * @param width - Width of divider (default: 50)
 * @returns Formatted divider string
 */
export function formatDivider(char = '─', width = 50): string {
  return chalk.gray(char.repeat(width));
}

/**
 * Indent text by a specified number of spaces.
 * @param text - The text to indent
 * @param spaces - Number of spaces to indent (default: 2)
 * @returns Indented text
 */
export function indent(text: string, spaces = 2): string {
  const padding = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => `${padding}${line}`)
    .join('\n');
}
