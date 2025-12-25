/**
 * Path Resolution Service
 *
 * Cross-platform path resolution for Overture configuration files and client configs.
 * Supports XDG Base Directory specification on Linux and platform-specific conventions
 * on macOS and Windows.
 *
 * **ARCHITECTURE:**
 * This service uses dependency injection to receive infrastructure dependencies
 * (EnvironmentPort, FilesystemPort) rather than directly importing Node.js modules.
 *
 * @module lib/path-resolver
 * @version 3.0
 */

import type { EnvironmentPort } from '@overture/ports-process';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { Platform, ClientName } from '@overture/config-types';
import { ValidationError, McpError } from '@overture/errors';

/**
 * Path resolver service for configuration files
 *
 * Provides platform-aware path resolution for:
 * - User global configuration
 * - Project-level configuration
 * - Client configuration files (Claude Code, Claude Desktop, VS Code, etc.)
 * - Backup and lock files
 *
 * @example
 * ```typescript
 * import { PathResolver } from '@overture/config-core';
 * import { NodeEnvironmentAdapter } from '@overture/adapters-node';
 * import { NodeFilesystemAdapter } from '@overture/adapters-node';
 *
 * const environment = new NodeEnvironmentAdapter();
 * const filesystem = new NodeFilesystemAdapter();
 * const resolver = new PathResolver(environment, filesystem);
 *
 * const userConfigPath = resolver.getUserConfigPath();
 * const projectRoot = await resolver.findProjectRoot();
 * ```
 */
export class PathResolver {
  constructor(
    private environment: EnvironmentPort,
    private filesystem: FilesystemPort,
  ) {}

  /**
   * Get the current platform
   * @returns Platform identifier
   */
  getPlatform(): Platform {
    return this.environment.platform();
  }

  /**
   * Expand tilde (~) to user home directory
   *
   * @param filepath - Path potentially starting with ~
   * @returns Expanded path with home directory
   *
   * @example
   * ```typescript
   * resolver.expandTilde('~/.config/overture.yml')
   * // Returns: '/home/user/.config/overture.yml' (Linux)
   * // Returns: '/Users/user/.config/overture.yml' (macOS)
   * // Returns: 'C:\\Users\\user\\.config\\overture.yml' (Windows)
   * ```
   */
  expandTilde(filepath: string): string {
    if (!filepath.startsWith('~')) {
      return filepath;
    }

    const homeDir = this.getHomeDir();
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
  getXdgConfigHome(): string {
    return (
      this.environment.env.XDG_CONFIG_HOME ||
      this.joinPaths(this.getHomeDir(), '.config')
    );
  }

  /**
   * Get XDG_DATA_HOME directory (Linux only)
   *
   * Returns the XDG_DATA_HOME environment variable if set,
   * otherwise defaults to ~/.local/share
   *
   * @returns XDG data directory path
   */
  getXdgDataHome(): string {
    return (
      this.environment.env.XDG_DATA_HOME ||
      this.joinPaths(this.getHomeDir(), '.local', 'share')
    );
  }

  /**
   * Get home directory
   *
   * This function checks environment.env.HOME first (for testability),
   * then falls back to environment.homedir()
   *
   * @returns Home directory path
   */
  getHomeDir(): string {
    return this.environment.env.HOME || this.environment.homedir();
  }

  /**
   * Get user global Overture configuration path
   *
   * Returns platform-specific path for user global config (primary .yaml):
   * - Linux: $XDG_CONFIG_HOME/overture/config.yaml or ~/.config/overture/config.yaml
   * - macOS: ~/.config/overture/config.yaml
   * - Windows: %USERPROFILE%\.config\overture\config.yaml
   *
   * @returns User config file path (primary .yaml extension)
   */
  getUserConfigPath(): string {
    const platform = this.getPlatform();

    if (platform === 'linux') {
      return this.joinPaths(this.getXdgConfigHome(), 'overture', 'config.yaml');
    }

    // macOS and Windows both use ~/.config/overture
    return this.joinPaths(
      this.getHomeDir(),
      '.config',
      'overture',
      'config.yaml',
    );
  }

  /**
   * Get fallback user global configuration path with .yml extension
   *
   * @returns User config file path with .yml extension (fallback)
   */
  getUserConfigPathYml(): string {
    const platform = this.getPlatform();

    if (platform === 'linux') {
      return this.joinPaths(this.getXdgConfigHome(), 'overture', 'config.yml');
    }

    // macOS and Windows both use ~/.config/overture
    return this.joinPaths(
      this.getHomeDir(),
      '.config',
      'overture',
      'config.yml',
    );
  }

  /**
   * Get legacy user global configuration path (for backward compatibility)
   *
   * @deprecated Use getUserConfigPath() instead
   * @returns Legacy user config file path (overture.yml)
   */
  getLegacyUserConfigPath(): string {
    const platform = this.getPlatform();

    if (platform === 'linux') {
      return this.joinPaths(this.getXdgConfigHome(), 'overture.yml');
    }

    // macOS and Windows both use ~/.config
    return this.joinPaths(this.getHomeDir(), '.config', 'overture.yml');
  }

  /**
   * Get project-level Overture configuration path
   *
   * @param projectRoot - Project root directory (defaults to cwd)
   * @returns Project config file path (primary .yaml extension)
   */
  getProjectConfigPath(projectRoot?: string): string {
    const root = projectRoot || this.environment.env.PWD || '/';
    return this.joinPaths(root, '.overture', 'config.yaml');
  }

  /**
   * Get fallback project-level configuration path with .yml extension
   *
   * @param projectRoot - Project root directory (defaults to cwd)
   * @returns Project config file path with .yml extension (fallback)
   */
  getProjectConfigPathYml(projectRoot?: string): string {
    const root = projectRoot || this.environment.env.PWD || '/';
    return this.joinPaths(root, '.overture', 'config.yml');
  }

  /**
   * Get Claude Code global configuration path
   *
   * According to official Claude Code docs (https://code.claude.com/docs/en/mcp.md),
   * Claude Code reads MCP configuration from ~/.claude.json (user scope), not
   * from XDG_CONFIG_HOME or other platform-specific locations.
   *
   * @param platform - Target platform (defaults to current platform)
   * @returns Claude Code global config path (~/.claude.json)
   */
  getClaudeCodeGlobalPath(_platform?: Platform): string {
    // Claude Code uses ~/.claude.json on all platforms for user-scope MCP config
    return this.joinPaths(this.getHomeDir(), '.claude.json');
  }

  /**
   * Get Claude Code project configuration path
   *
   * @param projectRoot - Project root directory (defaults to cwd)
   * @returns Claude Code project config path
   */
  getClaudeCodeProjectPath(projectRoot?: string): string {
    const root = projectRoot || this.environment.env.PWD || '/';
    return this.joinPaths(root, '.mcp.json');
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
  getClaudeDesktopPath(platform?: Platform): string {
    const targetPlatform = platform || this.getPlatform();

    switch (targetPlatform) {
      case 'darwin':
        return this.joinPaths(
          this.getHomeDir(),
          'Library',
          'Application Support',
          'Claude',
          'claude_desktop_config.json',
        );
      case 'linux':
        return this.joinPaths(
          this.getXdgConfigHome(),
          'Claude',
          'claude_desktop_config.json',
        );
      case 'win32':
        return this.joinPaths(
          this.environment.env.APPDATA ||
            this.joinPaths(this.getHomeDir(), 'AppData', 'Roaming'),
          'Claude',
          'claude_desktop_config.json',
        );
      default:
        throw new ValidationError(`Unsupported platform: ${targetPlatform}`);
    }
  }

  /**
   * Get VS Code global MCP configuration path
   *
   * @param platform - Target platform (defaults to current platform)
   * @returns VS Code global config path
   */
  getVSCodeGlobalPath(platform?: Platform): string {
    const targetPlatform = platform || this.getPlatform();

    switch (targetPlatform) {
      case 'darwin':
        return this.joinPaths(
          this.getHomeDir(),
          'Library',
          'Application Support',
          'Code',
          'User',
          'mcp.json',
        );
      case 'linux':
        return this.joinPaths(
          this.getXdgConfigHome(),
          'Code',
          'User',
          'mcp.json',
        );
      case 'win32':
        return this.joinPaths(
          this.environment.env.APPDATA ||
            this.joinPaths(this.getHomeDir(), 'AppData', 'Roaming'),
          'Code',
          'User',
          'mcp.json',
        );
      default:
        throw new ValidationError(`Unsupported platform: ${targetPlatform}`);
    }
  }

  /**
   * Get VS Code workspace MCP configuration path
   *
   * @param workspaceRoot - Workspace root directory (defaults to cwd)
   * @returns VS Code workspace config path
   */
  getVSCodeWorkspacePath(workspaceRoot?: string): string {
    const root = workspaceRoot || this.environment.env.PWD || '/';
    return this.joinPaths(root, '.vscode', 'mcp.json');
  }

  /**
   * Get Cursor global MCP configuration path
   *
   * @param platform - Target platform (defaults to current platform)
   * @returns Cursor global config path
   */
  getCursorGlobalPath(platform?: Platform): string {
    const targetPlatform = platform || this.getPlatform();
    const homeDir = this.getHomeDir();

    // Cursor uses ~/.cursor/mcp.json for global configuration on all platforms
    switch (targetPlatform) {
      case 'darwin':
      case 'linux':
      case 'win32':
        return this.joinPaths(homeDir, '.cursor', 'mcp.json');
      default:
        throw new ValidationError(`Unsupported platform: ${targetPlatform}`);
    }
  }

  /**
   * Get Cursor project MCP configuration path
   *
   * @param projectRoot - Project root directory (defaults to cwd)
   * @returns Cursor project config path
   */
  getCursorProjectPath(projectRoot?: string): string {
    const root = projectRoot || this.environment.env.PWD || '/';
    return this.joinPaths(root, '.cursor', 'mcp.json');
  }

  /**
   * Get Windsurf MCP configuration path
   *
   * @param platform - Target platform (defaults to current platform)
   * @returns Windsurf config path
   */
  getWindsurfPath(platform?: Platform): string {
    const targetPlatform = platform || this.getPlatform();
    const homeDir = this.getHomeDir();

    switch (targetPlatform) {
      case 'darwin':
      case 'linux':
      case 'win32':
        return this.joinPaths(
          homeDir,
          '.codeium',
          'windsurf',
          'mcp_config.json',
        );
      default:
        throw new ValidationError(`Unsupported platform: ${targetPlatform}`);
    }
  }

  /**
   * Get GitHub Copilot CLI MCP configuration path
   *
   * @param platform - Target platform (defaults to current platform)
   * @returns Copilot CLI config path
   */
  getCopilotCliPath(platform?: Platform): string {
    const targetPlatform = platform || this.getPlatform();
    const homeDir = this.getHomeDir();

    // Copilot CLI uses ~/.copilot/mcp-config.json by default
    // or $XDG_CONFIG_HOME/.copilot/mcp-config.json if XDG_CONFIG_HOME is set
    switch (targetPlatform) {
      case 'darwin':
      case 'linux': {
        // On Linux/macOS, when XDG_CONFIG_HOME is not set, use ~/.copilot directly
        // When XDG_CONFIG_HOME is set, use $XDG_CONFIG_HOME/.copilot
        const configBase = this.environment.env.XDG_CONFIG_HOME || homeDir;
        return this.joinPaths(configBase, '.copilot', 'mcp-config.json');
      }
      case 'win32':
        // On Windows, always use %USERPROFILE%\.copilot
        return this.joinPaths(homeDir, '.copilot', 'mcp-config.json');
      default:
        throw new ValidationError(`Unsupported platform: ${targetPlatform}`);
    }
  }

  /**
   * Get OpenAI Codex CLI MCP configuration path
   *
   * @param platform - Target platform (defaults to current platform)
   * @returns Codex CLI config path
   */
  getCodexPath(platform?: Platform): string {
    const targetPlatform = platform || this.getPlatform();
    const homeDir = this.getHomeDir();

    // Codex CLI uses ~/.codex/mcp-config.json on all platforms
    switch (targetPlatform) {
      case 'darwin':
      case 'linux':
      case 'win32':
        return this.joinPaths(homeDir, '.codex', 'mcp-config.json');
      default:
        throw new ValidationError(`Unsupported platform: ${targetPlatform}`);
    }
  }

  /**
   * Get Google Gemini CLI MCP configuration path
   *
   * @param platform - Target platform (defaults to current platform)
   * @returns Gemini CLI config path
   */
  getGeminiCliPath(platform?: Platform): string {
    const targetPlatform = platform || this.getPlatform();
    const homeDir = this.getHomeDir();

    // Gemini CLI uses ~/.gemini/mcp-config.json on all platforms
    switch (targetPlatform) {
      case 'darwin':
      case 'linux':
      case 'win32':
        return this.joinPaths(homeDir, '.gemini', 'mcp-config.json');
      default:
        throw new ValidationError(`Unsupported platform: ${targetPlatform}`);
    }
  }

  /**
   * Get JetBrains GitHub Copilot plugin MCP configuration path
   *
   * @param platform - Target platform (defaults to current platform)
   * @returns JetBrains Copilot config path
   */
  getJetBrainsCopilotPath(platform?: Platform): string {
    const targetPlatform = platform || this.getPlatform();

    switch (targetPlatform) {
      case 'darwin':
        // TODO: Research macOS path for JetBrains Copilot plugin
        // Placeholder based on typical JetBrains structure
        return this.joinPaths(
          this.getHomeDir(),
          'Library',
          'Application Support',
          'github-copilot',
          'intellij',
          'mcp.json',
        );
      case 'linux':
        // TODO: Research Linux path for JetBrains Copilot plugin
        // Placeholder based on XDG conventions
        return this.joinPaths(
          this.getXdgConfigHome(),
          'github-copilot',
          'intellij',
          'mcp.json',
        );
      case 'win32':
        // Confirmed path from user
        return this.joinPaths(
          this.environment.env.LOCALAPPDATA ||
            this.joinPaths(this.getHomeDir(), 'AppData', 'Local'),
          'github-copilot',
          'intellij',
          'mcp.json',
        );
      default:
        throw new ValidationError(`Unsupported platform: ${targetPlatform}`);
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
  getJetBrainsCopilotWorkspacePath(workspaceRoot?: string): string {
    const root = workspaceRoot || this.environment.env.PWD || '/';
    return this.joinPaths(root, '.vscode', 'mcp.json');
  }

  /**
   * Get backup directory path
   *
   * @returns Backup directory path
   */
  getBackupDir(): string {
    // Allow override for testing
    if (this.environment.env.OVERTURE_BACKUP_DIR) {
      return this.environment.env.OVERTURE_BACKUP_DIR;
    }

    const platform = this.getPlatform();

    if (platform === 'linux') {
      return this.joinPaths(this.getXdgConfigHome(), 'overture', 'backups');
    }

    return this.joinPaths(this.getHomeDir(), '.config', 'overture', 'backups');
  }

  /**
   * Get process lock file path
   *
   * @returns Lock file path
   */
  getLockFilePath(): string {
    const platform = this.getPlatform();

    if (platform === 'linux') {
      return this.joinPaths(
        this.getXdgConfigHome(),
        'overture',
        'overture.lock',
      );
    }

    return this.joinPaths(
      this.getHomeDir(),
      '.config',
      'overture',
      'overture.lock',
    );
  }

  /**
   * Find the nearest .overture directory by walking up from startDir
   *
   * Searches from the starting directory upward through parent directories
   * until .overture/config.yaml or .overture/config.yml is found or filesystem root is reached.
   *
   * @param startDir - Directory to start searching from (defaults to cwd)
   * @returns Project root directory (containing .overture/) or null if not found
   *
   * @example
   * ```typescript
   * // Current directory: /home/user/projects/my-app/src
   * // Project structure:
   * //   /home/user/projects/my-app/.overture/config.yaml
   * const root = await resolver.findProjectRoot()
   * // Returns: '/home/user/projects/my-app'
   *
   * // Current directory: /home/user
   * const root = await resolver.findProjectRoot()
   * // Returns: null (no .overture/ found)
   * ```
   */
  async findProjectRoot(startDir?: string): Promise<string | null> {
    let currentDir = this.resolvePath(
      startDir || this.environment.env.PWD || '/',
    );
    const root = this.parsePathRoot(currentDir);

    while (currentDir !== root) {
      const yamlPath = this.joinPaths(currentDir, '.overture', 'config.yaml');
      const ymlPath = this.joinPaths(currentDir, '.overture', 'config.yml');

      // Check if .overture/config.yaml or .overture/config.yml exists at this level
      if (
        (await this.filesystem.exists(yamlPath)) ||
        (await this.filesystem.exists(ymlPath))
      ) {
        return currentDir;
      }

      // Move up one directory
      const parentDir = this.dirname(currentDir);

      // Prevent infinite loop if dirname returns same path
      if (parentDir === currentDir) {
        break;
      }

      currentDir = parentDir;
    }

    // Check root directory as last resort
    const rootYamlPath = this.joinPaths(root, '.overture', 'config.yaml');
    const rootYmlPath = this.joinPaths(root, '.overture', 'config.yml');
    if (
      (await this.filesystem.exists(rootYamlPath)) ||
      (await this.filesystem.exists(rootYmlPath))
    ) {
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
   * await resolver.isInProject() // => true
   *
   * // Outside project
   * await resolver.isInProject() // => false
   * ```
   */
  async isInProject(startDir?: string): Promise<boolean> {
    return (await this.findProjectRoot(startDir)) !== null;
  }

  /**
   * Get dry-run output path for a client config
   *
   * Returns a path in the dist/ directory for dry-run mode output.
   * This allows users to preview changes without modifying actual config files.
   *
   * @param clientName - Name of the client
   * @param originalPath - Original config path
   * @returns Path in dist/ directory for dry-run output
   *
   * @example
   * ```typescript
   * const dryRunPath = resolver.getDryRunOutputPath(
   *   'claude-code',
   *   '/home/user/.claude.json'
   * );
   * // Returns: 'dist/dry-run/claude-code-mcp.json'
   * ```
   */
  getDryRunOutputPath(clientName: ClientName, originalPath: string): string {
    // Extract filename from original path
    const parts = originalPath.split('/');
    const filename = parts[parts.length - 1] || 'config.json';

    // Create dry-run path in dist/ directory
    return this.joinPaths('dist', 'dry-run', `${clientName}-${filename}`);
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
  getClientConfigPath(
    clientName: ClientName,
    platform?: Platform,
    projectRoot?: string,
  ): string | { user: string; project: string } {
    switch (clientName) {
      case 'claude-code':
        return {
          user: this.getClaudeCodeGlobalPath(platform),
          project: this.getClaudeCodeProjectPath(projectRoot),
        };
      case 'copilot-cli':
        return this.getCopilotCliPath(platform);
      case 'opencode':
        // OpenCode adapter handles its own path detection
        throw new McpError(
          `Use OpenCodeAdapter.detectConfigPath() instead`,
          clientName,
        );
      default:
        throw new McpError(`Unknown client: ${clientName}`, clientName);
    }
  }

  /**
   * Join path segments (platform-independent)
   *
   * Simple path joining that works across platforms.
   * Uses forward slash as separator and normalizes separators.
   */
  private joinPaths(...segments: string[]): string {
    return segments
      .join('/')
      .replace(/\/+/g, '/') // normalize multiple slashes
      .replace(/\/$/, ''); // remove trailing slash
  }

  /**
   * Resolve path to absolute path
   */
  private resolvePath(p: string): string {
    if (p.startsWith('/')) return p;
    if (p.startsWith('~')) return this.expandTilde(p);
    // For relative paths, join with PWD
    const cwd = this.environment.env.PWD || '/';
    return this.joinPaths(cwd, p);
  }

  /**
   * Get directory name from path
   */
  private dirname(p: string): string {
    const parts = p.split('/').filter((x) => x);
    if (parts.length === 0) return '/';
    return '/' + parts.slice(0, -1).join('/');
  }

  /**
   * Parse root from path
   */
  private parsePathRoot(_p: string): string {
    // Always return '/' as root for cross-platform compatibility
    return '/';
  }
}
