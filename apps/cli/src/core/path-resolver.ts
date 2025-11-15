/**
 * Path Resolution Utilities
 *
 * Cross-platform path resolution for Overture configuration files and client configs.
 * Supports XDG Base Directory specification on Linux and platform-specific conventions
 * on macOS and Windows.
 *
 * @module core/path-resolver
 * @version 2.0
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import type { Platform, ClientName } from '../domain/config.types';

/**
 * Get the current platform
 * @returns Platform identifier
 */
export function getPlatform(): Platform {
  return process.platform as Platform;
}

/**
 * Expand tilde (~) to user home directory
 *
 * @param filepath - Path potentially starting with ~
 * @returns Expanded path with home directory
 *
 * @example
 * ```typescript
 * expandTilde('~/.config/overture.yml')
 * // Returns: '/home/user/.config/overture.yml' (Linux)
 * // Returns: '/Users/user/.config/overture.yml' (macOS)
 * // Returns: 'C:\\Users\\user\\.config\\overture.yml' (Windows)
 * ```
 */
export function expandTilde(filepath: string): string {
  if (!filepath.startsWith('~')) {
    return filepath;
  }

  const homeDir = os.homedir();
  return filepath.replace(/^~(?=$|\/|\\)/, homeDir);
}

/**
 * Get XDG_CONFIG_HOME directory (Linux only)
 *
 * Returns the XDG_CONFIG_HOME environment variable if set,
 * otherwise defaults to ~/.config
 *
 * @returns XDG config directory path
 */
export function getXdgConfigHome(): string {
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
}

/**
 * Get XDG_DATA_HOME directory (Linux only)
 *
 * Returns the XDG_DATA_HOME environment variable if set,
 * otherwise defaults to ~/.local/share
 *
 * @returns XDG data directory path
 */
export function getXdgDataHome(): string {
  return process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
}

/**
 * Get user global Overture configuration path
 *
 * Returns platform-specific path for user global config:
 * - Linux: $XDG_CONFIG_HOME/overture.yml or ~/.config/overture.yml
 * - macOS: ~/.config/overture.yml
 * - Windows: %USERPROFILE%\.config\overture.yml
 *
 * @returns User config file path
 */
export function getUserConfigPath(): string {
  const platform = getPlatform();

  if (platform === 'linux') {
    return path.join(getXdgConfigHome(), 'overture.yml');
  }

  // macOS and Windows both use ~/.config
  return path.join(os.homedir(), '.config', 'overture.yml');
}

/**
 * Get project-level Overture configuration path
 *
 * @param projectRoot - Project root directory (defaults to cwd)
 * @returns Project config file path
 */
export function getProjectConfigPath(projectRoot?: string): string {
  const root = projectRoot || process.cwd();
  return path.join(root, '.overture', 'config.yaml');
}

/**
 * Get Claude Code global configuration path
 *
 * @param platform - Target platform (defaults to current platform)
 * @returns Claude Code global config path
 */
export function getClaudeCodeGlobalPath(platform?: Platform): string {
  const targetPlatform = platform || getPlatform();

  switch (targetPlatform) {
    case 'linux':
      return path.join(getXdgConfigHome(), 'claude', 'mcp.json');
    case 'darwin':
      return path.join(os.homedir(), '.config', 'claude', 'mcp.json');
    case 'win32':
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Claude', 'mcp.json');
    default:
      throw new Error(`Unsupported platform: ${targetPlatform}`);
  }
}

/**
 * Get Claude Code project configuration path
 *
 * @param projectRoot - Project root directory (defaults to cwd)
 * @returns Claude Code project config path
 */
export function getClaudeCodeProjectPath(projectRoot?: string): string {
  const root = projectRoot || process.cwd();
  return path.join(root, '.mcp.json');
}

/**
 * Get Claude Desktop configuration path
 *
 * Platform-specific paths:
 * - macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
 * - Linux: ~/.config/Claude/claude_desktop_config.json
 * - Windows: %APPDATA%\Claude\claude_desktop_config.json
 *
 * @param platform - Target platform (defaults to current platform)
 * @returns Claude Desktop config path
 */
export function getClaudeDesktopPath(platform?: Platform): string {
  const targetPlatform = platform || getPlatform();

  switch (targetPlatform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'linux':
      return path.join(getXdgConfigHome(), 'Claude', 'claude_desktop_config.json');
    case 'win32':
      return path.join(
        process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
        'Claude',
        'claude_desktop_config.json'
      );
    default:
      throw new Error(`Unsupported platform: ${targetPlatform}`);
  }
}

/**
 * Get VS Code global MCP configuration path
 *
 * @param platform - Target platform (defaults to current platform)
 * @returns VS Code global config path
 */
export function getVSCodeGlobalPath(platform?: Platform): string {
  const targetPlatform = platform || getPlatform();

  switch (targetPlatform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
    case 'linux':
      return path.join(getXdgConfigHome(), 'Code', 'User', 'mcp.json');
    case 'win32':
      return path.join(
        process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
        'Code',
        'User',
        'mcp.json'
      );
    default:
      throw new Error(`Unsupported platform: ${targetPlatform}`);
  }
}

/**
 * Get VS Code workspace MCP configuration path
 *
 * @param workspaceRoot - Workspace root directory (defaults to cwd)
 * @returns VS Code workspace config path
 */
export function getVSCodeWorkspacePath(workspaceRoot?: string): string {
  const root = workspaceRoot || process.cwd();
  return path.join(root, '.vscode', 'mcp.json');
}

/**
 * Get Cursor global MCP configuration path
 *
 * @param platform - Target platform (defaults to current platform)
 * @returns Cursor global config path
 */
export function getCursorGlobalPath(platform?: Platform): string {
  const targetPlatform = platform || getPlatform();

  switch (targetPlatform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'mcp.json');
    case 'linux':
      return path.join(getXdgConfigHome(), 'Cursor', 'User', 'globalStorage', 'mcp.json');
    case 'win32':
      return path.join(
        process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
        'Cursor',
        'User',
        'globalStorage',
        'mcp.json'
      );
    default:
      throw new Error(`Unsupported platform: ${targetPlatform}`);
  }
}

/**
 * Get Cursor project MCP configuration path
 *
 * @param projectRoot - Project root directory (defaults to cwd)
 * @returns Cursor project config path
 */
export function getCursorProjectPath(projectRoot?: string): string {
  const root = projectRoot || process.cwd();
  return path.join(root, '.cursor', 'mcp.json');
}

/**
 * Get Windsurf MCP configuration path
 *
 * @param platform - Target platform (defaults to current platform)
 * @returns Windsurf config path
 */
export function getWindsurfPath(platform?: Platform): string {
  const targetPlatform = platform || getPlatform();
  const homeDir = os.homedir();

  switch (targetPlatform) {
    case 'darwin':
    case 'linux':
      return path.join(homeDir, '.codeium', 'windsurf', 'mcp_config.json');
    case 'win32':
      return path.join(homeDir, '.codeium', 'windsurf', 'mcp_config.json');
    default:
      throw new Error(`Unsupported platform: ${targetPlatform}`);
  }
}

/**
 * Get GitHub Copilot CLI MCP configuration path
 *
 * @param platform - Target platform (defaults to current platform)
 * @returns Copilot CLI config path
 */
export function getCopilotCliPath(platform?: Platform): string {
  const targetPlatform = platform || getPlatform();

  switch (targetPlatform) {
    case 'darwin':
    case 'linux':
      return path.join(getXdgConfigHome(), 'github-copilot', 'mcp.json');
    case 'win32':
      return path.join(os.homedir(), '.config', 'github-copilot', 'mcp.json');
    default:
      throw new Error(`Unsupported platform: ${targetPlatform}`);
  }
}

/**
 * Get JetBrains GitHub Copilot plugin MCP configuration path
 *
 * @param platform - Target platform (defaults to current platform)
 * @returns JetBrains Copilot config path
 */
export function getJetBrainsCopilotPath(platform?: Platform): string {
  const targetPlatform = platform || getPlatform();

  switch (targetPlatform) {
    case 'darwin':
      // TODO: Research macOS path for JetBrains Copilot plugin
      // Placeholder based on typical JetBrains structure
      return path.join(os.homedir(), 'Library', 'Application Support', 'github-copilot', 'intellij', 'mcp.json');
    case 'linux':
      // TODO: Research Linux path for JetBrains Copilot plugin
      // Placeholder based on XDG conventions
      return path.join(getXdgConfigHome(), 'github-copilot', 'intellij', 'mcp.json');
    case 'win32':
      // Confirmed path from user
      return path.join(
        process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
        'github-copilot',
        'intellij',
        'mcp.json'
      );
    default:
      throw new Error(`Unsupported platform: ${targetPlatform}`);
  }
}

/**
 * Get JetBrains GitHub Copilot plugin workspace MCP configuration path
 *
 * JetBrains Copilot uses .vscode/mcp.json for workspace-level config
 *
 * @param workspaceRoot - Workspace root directory (defaults to cwd)
 * @returns JetBrains Copilot workspace config path
 */
export function getJetBrainsCopilotWorkspacePath(workspaceRoot?: string): string {
  const root = workspaceRoot || process.cwd();
  return path.join(root, '.vscode', 'mcp.json');
}

/**
 * Get backup directory path
 *
 * @returns Backup directory path
 */
export function getBackupDir(): string {
  // Allow override for testing
  if (process.env.OVERTURE_BACKUP_DIR) {
    return process.env.OVERTURE_BACKUP_DIR;
  }

  const platform = getPlatform();

  if (platform === 'linux') {
    return path.join(getXdgConfigHome(), 'overture', 'backups');
  }

  return path.join(os.homedir(), '.config', 'overture', 'backups');
}

/**
 * Get process lock file path
 *
 * @returns Lock file path
 */
export function getLockFilePath(): string {
  const platform = getPlatform();

  if (platform === 'linux') {
    return path.join(getXdgConfigHome(), 'overture', 'overture.lock');
  }

  return path.join(os.homedir(), '.config', 'overture', 'overture.lock');
}

/**
 * Find the nearest .overture directory by walking up from startDir
 *
 * Searches from the starting directory upward through parent directories
 * until .overture/config.yaml is found or filesystem root is reached.
 *
 * @param startDir - Directory to start searching from (defaults to cwd)
 * @returns Project root directory (containing .overture/) or null if not found
 *
 * @example
 * ```typescript
 * // Current directory: /home/user/projects/my-app/src
 * // Project structure:
 * //   /home/user/projects/my-app/.overture/config.yaml
 * findProjectRoot()
 * // Returns: '/home/user/projects/my-app'
 *
 * // Current directory: /home/user
 * findProjectRoot()
 * // Returns: null (no .overture/ found)
 * ```
 */
export function findProjectRoot(startDir?: string): string | null {
  let currentDir = path.resolve(startDir || process.cwd());
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const configPath = path.join(currentDir, '.overture', 'config.yaml');

    // Check if .overture/config.yaml exists at this level
    if (fs.existsSync(configPath)) {
      return currentDir;
    }

    // Move up one directory
    const parentDir = path.dirname(currentDir);

    // Prevent infinite loop if dirname returns same path
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  // Check root directory as last resort
  const rootConfigPath = path.join(root, '.overture', 'config.yaml');
  if (fs.existsSync(rootConfigPath)) {
    return root;
  }

  return null;
}

/**
 * Check if currently in an Overture project directory
 *
 * Determines if the current working directory (or ancestor) contains
 * a .overture/config.yaml file.
 *
 * @param startDir - Directory to check from (defaults to cwd)
 * @returns True if in a project directory
 *
 * @example
 * ```typescript
 * // In project directory
 * isInProject() // => true
 *
 * // Outside project
 * isInProject() // => false
 * ```
 */
export function isInProject(startDir?: string): boolean {
  return findProjectRoot(startDir) !== null;
}

/**
 * Get client config path by client name
 *
 * Unified function to get config path for any supported client.
 *
 * @param clientName - Name of the client
 * @param platform - Target platform (optional)
 * @param projectRoot - Project root for project-level configs (optional)
 * @returns Config file path
 */
export function getClientConfigPath(
  clientName: ClientName,
  platform?: Platform,
  projectRoot?: string
): string | { user: string; project: string } {
  switch (clientName) {
    case 'claude-code':
      return {
        user: getClaudeCodeGlobalPath(platform),
        project: getClaudeCodeProjectPath(projectRoot),
      };
    case 'claude-desktop':
      return getClaudeDesktopPath(platform);
    case 'vscode':
      return {
        user: getVSCodeGlobalPath(platform),
        project: getVSCodeWorkspacePath(projectRoot),
      };
    case 'cursor':
      return {
        user: getCursorGlobalPath(platform),
        project: getCursorProjectPath(projectRoot),
      };
    case 'windsurf':
      return getWindsurfPath(platform);
    case 'copilot-cli':
      return getCopilotCliPath(platform);
    case 'jetbrains-copilot':
      return {
        user: getJetBrainsCopilotPath(platform),
        project: getJetBrainsCopilotWorkspacePath(projectRoot),
      };
    default:
      throw new Error(`Unknown client: ${clientName}`);
  }
}
