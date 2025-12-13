/**
 * WSL2 Environment Detector
 *
 * Detects WSL2 environment and provides Windows path resolution capabilities.
 * Handles translation between WSL2 Linux paths and Windows paths.
 *
 * @module core/wsl2-detector
 * @version 1.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProcessExecutor } from '../infrastructure/process-executor';
import type { WSL2EnvironmentInfo } from '../domain/discovery.types';
import type { ClientName } from '../domain/config.types';

/**
 * Timeout for WSL2 detection operations (ms)
 */
const WSL2_DETECTION_TIMEOUT = 3000;

/**
 * System users to exclude when inferring Windows profile
 */
const WINDOWS_SYSTEM_USERS = [
  'Public',
  'Default',
  'Default User',
  'All Users',
  'defaultuser0',
  'LOCALSERVICE',
  'NETWORKSERVICE',
];

/**
 * Default Windows installation paths for AI coding tools
 * Relative to Windows user profile (/mnt/c/Users/{user})
 */
export const WINDOWS_DEFAULT_PATHS: Record<
  ClientName,
  { binaryPaths: string[]; configPath?: string }
> = {
  'claude-code': {
    binaryPaths: [
      'AppData/Local/Programs/claude-code/claude.exe',
      'AppData/Roaming/npm/claude.cmd',
    ],
    configPath: 'AppData/Roaming/Claude/mcp.json',
  },
  'claude-desktop': {
    binaryPaths: [
      'AppData/Local/Programs/Claude/Claude.exe',
      'AppData/Local/Claude/Claude.exe',
    ],
    configPath: 'AppData/Roaming/Claude/claude_desktop_config.json',
  },
  vscode: {
    binaryPaths: [
      'AppData/Local/Programs/Microsoft VS Code/Code.exe',
      'AppData/Local/Programs/Microsoft VS Code/bin/code.cmd',
    ],
    configPath: 'AppData/Roaming/Code/User/mcp.json',
  },
  cursor: {
    binaryPaths: [
      'AppData/Local/Programs/cursor/Cursor.exe',
      'AppData/Local/cursor/Cursor.exe',
    ],
    configPath: '.cursor/mcp.json',
  },
  windsurf: {
    binaryPaths: [
      'AppData/Local/Programs/windsurf/Windsurf.exe',
      '.codeium/windsurf/Windsurf.exe',
    ],
    configPath: '.codeium/windsurf/mcp_config.json',
  },
  'copilot-cli': {
    binaryPaths: [
      'AppData/Roaming/npm/copilot.cmd',
      'AppData/Roaming/npm/github-copilot-cli.cmd',
    ],
    configPath: '.copilot/mcp-config.json',
  },
  'jetbrains-copilot': {
    binaryPaths: [],
    configPath: 'AppData/Local/github-copilot/intellij/mcp.json',
  },
  codex: {
    binaryPaths: [
      'AppData/Roaming/npm/codex.cmd',
      '.local/bin/codex.exe',
    ],
    configPath: '.codex/mcp-config.json',
  },
  'gemini-cli': {
    binaryPaths: [
      'AppData/Roaming/npm/gemini.cmd',
      '.local/bin/gemini.exe',
    ],
    configPath: '.gemini/mcp-config.json',
  },
};

/**
 * WSL2 Environment Detector
 *
 * Provides methods to detect WSL2 environment and resolve Windows paths.
 */
export class WSL2Detector {
  private cachedInfo: WSL2EnvironmentInfo | null = null;

  /**
   * Detect if running in WSL2 environment and gather environment info
   *
   * @returns WSL2 environment information
   *
   * @example
   * ```typescript
   * const detector = new WSL2Detector();
   * const info = await detector.detectEnvironment();
   * if (info.isWSL2) {
   *   console.log(`Running in WSL2 (${info.distroName})`);
   *   console.log(`Windows profile: ${info.windowsUserProfile}`);
   * }
   * ```
   */
  async detectEnvironment(): Promise<WSL2EnvironmentInfo> {
    if (this.cachedInfo) return this.cachedInfo;

    const isWSL2 = await this.isWSL2();

    if (!isWSL2) {
      this.cachedInfo = { isWSL2: false };
      return this.cachedInfo;
    }

    const [distroName, windowsUserProfile] = await Promise.all([
      this.getDistroName(),
      this.getWindowsUserProfile(),
    ]);

    this.cachedInfo = {
      isWSL2: true,
      distroName,
      windowsUserProfile,
    };

    return this.cachedInfo;
  }

  /**
   * Check if running in WSL2 environment
   *
   * Uses multiple detection methods:
   * 1. WSL_DISTRO_NAME environment variable (fast)
   * 2. /proc/version containing "microsoft" (fallback)
   *
   * @returns True if running in WSL2
   */
  async isWSL2(): Promise<boolean> {
    // Check environment variable first (fast path)
    if (process.env.WSL_DISTRO_NAME) {
      return true;
    }

    // Check /proc/version for "microsoft" string
    try {
      const procVersion = fs.readFileSync('/proc/version', 'utf-8');
      return procVersion.toLowerCase().includes('microsoft');
    } catch {
      return false;
    }
  }

  /**
   * Get WSL2 distribution name
   *
   * @returns Distribution name or undefined
   */
  getDistroName(): string | undefined {
    return process.env.WSL_DISTRO_NAME;
  }

  /**
   * Get Windows user profile path as WSL2 mount path
   *
   * Tries multiple detection methods:
   * 1. Execute cmd.exe to get USERPROFILE
   * 2. Infer from /mnt/c/Users/ directory
   *
   * @returns Windows user profile path in WSL2 format (e.g., /mnt/c/Users/jeff)
   */
  async getWindowsUserProfile(): Promise<string | undefined> {
    // Try cmd.exe first
    const cmdProfile = await this.getProfileViaCmdExe();
    if (cmdProfile) {
      return cmdProfile;
    }

    // Fallback: infer from /mnt/c/Users/
    return this.inferWindowsUserProfile();
  }

  /**
   * Get Windows user profile via cmd.exe
   *
   * @returns Translated Windows profile path or undefined
   */
  private async getProfileViaCmdExe(): Promise<string | undefined> {
    try {
      // Use Promise.race for timeout
      const result = await Promise.race<{ stdout: string; exitCode: number }>([
        ProcessExecutor.exec('/mnt/c/Windows/System32/cmd.exe', [
          '/c',
          'echo',
          '%USERPROFILE%',
        ]),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('timeout')),
            WSL2_DETECTION_TIMEOUT
          )
        ),
      ]);

      if (result.exitCode === 0 && result.stdout.trim()) {
        const windowsPath = result.stdout.trim();
        // Only translate if it looks like a Windows path
        if (windowsPath.match(/^[A-Za-z]:\\/)) {
          return this.translateWindowsPath(windowsPath);
        }
      }
    } catch {
      // cmd.exe failed or timed out
    }
    return undefined;
  }

  /**
   * Infer Windows user profile by checking /mnt/c/Users/
   *
   * Finds non-system user directories and picks the most likely one.
   *
   * @returns Inferred user profile path or undefined
   */
  private inferWindowsUserProfile(): string | undefined {
    const usersDir = '/mnt/c/Users';

    try {
      if (!fs.existsSync(usersDir)) {
        return undefined;
      }

      const entries = fs.readdirSync(usersDir);
      const userDirs = entries.filter((entry) => {
        // Skip system users
        if (WINDOWS_SYSTEM_USERS.includes(entry)) {
          return false;
        }

        // Verify it's a directory
        try {
          const stat = fs.statSync(path.join(usersDir, entry));
          return stat.isDirectory();
        } catch {
          return false;
        }
      });

      // If exactly one user found, use it
      if (userDirs.length === 1) {
        return path.join(usersDir, userDirs[0]);
      }

      // If multiple users, prefer the one with common Windows user artifacts
      for (const dir of userDirs) {
        const desktopPath = path.join(usersDir, dir, 'Desktop');
        if (fs.existsSync(desktopPath)) {
          return path.join(usersDir, dir);
        }
      }

      // Return first user if any exist
      if (userDirs.length > 0) {
        return path.join(usersDir, userDirs[0]);
      }
    } catch {
      // Directory enumeration failed
    }

    return undefined;
  }

  /**
   * Translate Windows path to WSL2 mount path
   *
   * @param windowsPath - Windows path (e.g., C:\Users\jeff)
   * @returns WSL2 path (e.g., /mnt/c/Users/jeff)
   *
   * @example
   * ```typescript
   * detector.translateWindowsPath('C:\\Users\\jeff')
   * // Returns: '/mnt/c/Users/jeff'
   *
   * detector.translateWindowsPath('D:\\Projects')
   * // Returns: '/mnt/d/Projects'
   * ```
   */
  translateWindowsPath(windowsPath: string): string {
    // Handle C:\path format
    const match = windowsPath.match(/^([A-Za-z]):\\(.*)$/);
    if (match) {
      const drive = match[1].toLowerCase();
      const rest = match[2].replace(/\\/g, '/');
      return `/mnt/${drive}/${rest}`;
    }
    return windowsPath;
  }

  /**
   * Check if a path exists, handling Windows path translation
   *
   * @param targetPath - Path to check (Windows or WSL2 format)
   * @returns True if path exists
   */
  pathExists(targetPath: string): boolean {
    const translatedPath = targetPath.includes(':\\')
      ? this.translateWindowsPath(targetPath)
      : targetPath;
    return fs.existsSync(translatedPath);
  }

  /**
   * Get Windows installation paths for a specific client
   *
   * @param client - Client name
   * @param windowsUserProfile - Windows user profile path in WSL2 format
   * @returns Array of potential installation paths
   */
  getWindowsInstallPaths(
    client: ClientName,
    windowsUserProfile: string
  ): string[] {
    const paths: string[] = [];
    const defaults = WINDOWS_DEFAULT_PATHS[client];

    if (!defaults) {
      return paths;
    }

    // Add binary paths relative to user profile
    for (const relativePath of defaults.binaryPaths) {
      paths.push(path.join(windowsUserProfile, relativePath));
    }

    // Add Program Files paths
    paths.push(
      ...defaults.binaryPaths
        .map((p) => {
          if (p.includes('AppData')) return null;
          return path.join('/mnt/c/Program Files', p);
        })
        .filter(Boolean) as string[]
    );

    return paths;
  }

  /**
   * Get Windows config path for a specific client
   *
   * @param client - Client name
   * @param windowsUserProfile - Windows user profile path in WSL2 format
   * @returns Config file path or undefined
   */
  getWindowsConfigPath(
    client: ClientName,
    windowsUserProfile: string
  ): string | undefined {
    const defaults = WINDOWS_DEFAULT_PATHS[client];

    if (!defaults?.configPath) {
      return undefined;
    }

    return path.join(windowsUserProfile, defaults.configPath);
  }

  /**
   * Reset cached environment info
   *
   * Primarily for testing purposes.
   */
  resetCache(): void {
    this.cachedInfo = null;
  }
}

/**
 * Global WSL2 detector instance
 */
export const wsl2Detector = new WSL2Detector();
