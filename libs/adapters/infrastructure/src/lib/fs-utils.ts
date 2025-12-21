import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigError } from '@overture/errors';

export class FsUtils {
  /**
   * Read file as string with error handling
   */
  static async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new ConfigError(
        `Failed to read file: ${(error as Error).message}`,
        filePath,
      );
    }
  }

  /**
   * Write file with directory creation
   */
  static async writeFile(filePath: string, content: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      throw new ConfigError(
        `Failed to write file: ${(error as Error).message}`,
        filePath,
      );
    }
  }

  /**
   * Check if file exists
   */
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure directory exists
   */
  static async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  /**
   * Find file by walking up directory tree
   */
  static async findUp(
    fileName: string,
    startDir: string = process.cwd(),
  ): Promise<string | null> {
    let currentDir = path.resolve(startDir);
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
      const filePath = path.join(currentDir, fileName);
      if (await this.exists(filePath)) {
        return filePath;
      }
      currentDir = path.dirname(currentDir);
    }

    return null;
  }
}
