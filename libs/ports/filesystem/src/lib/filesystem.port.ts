/**
 * File system statistics interface
 *
 * Represents metadata about a file or directory.
 *
 * @interface Stats
 */
export interface Stats {
  /**
   * Returns true if the path is a file
   */
  isFile(): boolean;

  /**
   * Returns true if the path is a directory
   */
  isDirectory(): boolean;

  /**
   * Size of the file in bytes
   */
  size: number;

  /**
   * Last modified timestamp
   */
  mtime: Date;
}

/**
 * Filesystem port interface for hexagonal architecture
 *
 * This port defines the contract for filesystem operations that can be
 * implemented by different adapters (Node.js fs, in-memory, etc.).
 *
 * All methods are async to support various backend implementations.
 *
 * @interface FilesystemPort
 * @example
 * ```typescript
 * // Implementing the port
 * class NodeFilesystemAdapter implements FilesystemPort {
 *   async readFile(path: string): Promise<string> {
 *     return fs.promises.readFile(path, 'utf-8');
 *   }
 *   // ... other methods
 * }
 * ```
 */
export interface FilesystemPort {
  /**
   * Read the contents of a file as a UTF-8 string
   *
   * @param path - Absolute or relative path to the file
   * @returns Promise resolving to file contents as string
   * @throws Error if file doesn't exist or cannot be read
   */
  readFile(path: string): Promise<string>;

  /**
   * Write content to a file, creating it if it doesn't exist
   *
   * @param path - Absolute or relative path to the file
   * @param content - String content to write
   * @returns Promise resolving when write completes
   * @throws Error if file cannot be written
   */
  writeFile(path: string, content: string): Promise<void>;

  /**
   * Check if a path exists (file or directory)
   *
   * @param path - Absolute or relative path to check
   * @returns Promise resolving to true if path exists, false otherwise
   */
  exists(path: string): Promise<boolean>;

  /**
   * Create a directory
   *
   * @param path - Absolute or relative path to create
   * @param options - Optional configuration
   * @param options.recursive - If true, create parent directories as needed
   * @returns Promise resolving when directory is created
   * @throws Error if directory cannot be created (unless recursive and parents exist)
   */
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;

  /**
   * Read the contents of a directory
   *
   * @param path - Absolute or relative path to directory
   * @returns Promise resolving to array of entry names (files and directories)
   * @throws Error if path is not a directory or cannot be read
   */
  readdir(path: string): Promise<string[]>;

  /**
   * Get file or directory statistics
   *
   * @param path - Absolute or relative path to check
   * @returns Promise resolving to stats object
   * @throws Error if path doesn't exist or cannot be accessed
   */
  stat(path: string): Promise<Stats>;

  /**
   * Remove a file or directory
   *
   * @param path - Absolute or relative path to remove
   * @param options - Optional configuration
   * @param options.recursive - If true, remove directories and their contents
   * @returns Promise resolving when removal completes
   * @throws Error if path cannot be removed
   */
  rm(path: string, options?: { recursive?: boolean }): Promise<void>;
}
