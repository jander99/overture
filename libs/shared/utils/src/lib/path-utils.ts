/**
 * Path Utilities
 *
 * Cross-platform path manipulation utilities.
 *
 * @module lib/path-utils
 */

/**
 * Cross-platform dirname extraction
 * Handles both forward slashes (Unix) and backslashes (Windows)
 *
 * @param filePath - File path to extract directory from
 * @returns Directory portion of the path, or '.' if no directory component
 *
 * @example
 * ```typescript
 * getDirname('/home/user/file.txt') // '/home/user'
 * getDirname('C:\\Users\\file.txt') // 'C:\\Users'
 * getDirname('file.txt') // '.'
 * ```
 */
export function getDirname(filePath: string): string {
  const lastSlash = Math.max(
    filePath.lastIndexOf('/'),
    filePath.lastIndexOf('\\'),
  );
  return lastSlash === -1 ? '.' : filePath.substring(0, lastSlash);
}
