/**
 * Binary Detector Service
 *
 * Detects AI development client binaries and application bundles on the system.
 * Checks for:
 * - CLI binaries in PATH (using which/where)
 * - Application bundles (macOS .app, Windows .exe, Linux binaries)
 * - Version information (via --version flag)
 * - Config file validity (JSON parsing)
 *
 * @module lib/binary-detector
 */

import type { ProcessPort, EnvironmentPort } from '@overture/ports-process';
import type {
  Platform,
  BinaryDetectionResult,
  ClientAdapter,
} from '@overture/config-types';

/**
 * Binary detection timeout (5 seconds)
 */
const DETECTION_TIMEOUT = 5000;

/**
 * Binary Detector Service
 *
 * Provides methods to detect client binaries, app bundles, and validate configurations.
 */
export class BinaryDetector {
  constructor(
    private readonly processPort: ProcessPort,
    private readonly environmentPort: EnvironmentPort,
    private readonly fileExists: (path: string) => boolean,
    private readonly readFile: (path: string) => string,
  ) {}

  /**
   * Detect a client's binary/app bundle and validate its configuration
   *
   * @param client - Client adapter to detect
   * @param platform - Target platform
   * @returns Detection result with status, paths, version, and warnings
   *
   * @example
   * ```typescript
   * const detector = new BinaryDetector(processPort, environmentPort, fs.existsSync, fs.readFileSync);
   * const result = await detector.detectClient(claudeCodeAdapter, 'darwin');
   * // {
   * //   status: 'found',
   * //   binaryPath: '/usr/local/bin/claude',
   * //   version: '2.1.0',
   * //   configPath: '/Users/user/.claude.json',
   * //   configValid: true,
   * //   warnings: []
   * // }
   * ```
   */
  async detectClient(
    client: ClientAdapter,
    platform: Platform,
  ): Promise<BinaryDetectionResult> {
    const warnings: string[] = [];

    // Check for CLI binaries
    const binaryResult = await this.detectBinaryForClient(client, warnings);
    if (binaryResult.notFound) {
      return binaryResult.notFound;
    }
    const binaryPath = binaryResult.binaryPath;
    const version = binaryResult.version;

    // Check for app bundles
    const appBundleResult = await this.detectAppBundleForClient(
      client,
      platform,
      binaryPath,
      warnings,
    );
    if (appBundleResult.notFound) {
      return appBundleResult.notFound;
    }
    const appBundlePath = appBundleResult.appBundlePath;

    // If neither binary nor app bundle found
    if (!binaryPath && !appBundlePath) {
      return {
        status: 'not-found',
        warnings: ['Client not detected on system'],
      };
    }

    // Check config file validity
    const { configPath, configValid } = this.validateClientConfig(
      client,
      platform,
      warnings,
    );

    return {
      status: 'found',
      binaryPath,
      version,
      appBundlePath,
      configPath,
      configValid,
      warnings,
    };
  }

  /**
   * Detect binary for client
   */
  private async detectBinaryForClient(
    client: ClientAdapter,
    warnings: string[],
  ): Promise<{
    binaryPath?: string;
    version?: string;
    notFound?: BinaryDetectionResult;
  }> {
    const binaryNames = client.getBinaryNames();
    if (binaryNames.length === 0) {
      return {};
    }

    const binaryResult = await this.detectBinary(binaryNames[0]);
    if (binaryResult.found) {
      return {
        binaryPath: binaryResult.path,
        version: binaryResult.version,
      };
    }

    if (client.requiresBinary()) {
      return {
        notFound: {
          status: 'not-found',
          warnings: [`Required binary '${binaryNames[0]}' not found in PATH`],
        },
      };
    }

    warnings.push(`Binary '${binaryNames[0]}' not found in PATH`);
    return {};
  }

  /**
   * Detect app bundle for client
   */
  private async detectAppBundleForClient(
    client: ClientAdapter,
    platform: Platform,
    binaryPath: string | undefined,
    warnings: string[],
  ): Promise<{
    appBundlePath?: string;
    notFound?: BinaryDetectionResult;
  }> {
    const appBundlePaths = client.getAppBundlePaths(platform);
    if (appBundlePaths.length === 0) {
      return {};
    }

    const appBundleResult = await this.detectAppBundle(appBundlePaths);
    if (appBundleResult.found) {
      return { appBundlePath: appBundleResult.path };
    }

    if (!binaryPath) {
      return {
        notFound: {
          status: 'not-found',
          warnings: [
            `Application not found. Checked paths: ${appBundlePaths.join(', ')}`,
          ],
        },
      };
    }

    warnings.push(
      `Application bundle not found (binary available). Checked paths: ${appBundlePaths.join(', ')}`,
    );
    return {};
  }

  /**
   * Validate client config file
   */
  private validateClientConfig(
    client: ClientAdapter,
    platform: Platform,
    warnings: string[],
  ): {
    configPath?: string;
    configValid?: boolean;
  } {
    const detectedConfigPath = client.detectConfigPath(platform);
    if (!detectedConfigPath) {
      return {};
    }

    const configPath =
      typeof detectedConfigPath === 'string'
        ? detectedConfigPath
        : detectedConfigPath.user;

    const configValid = this.validateConfigFile(configPath);

    if (!configValid) {
      warnings.push(`Config file exists but is invalid JSON: ${configPath}`);
    }

    return { configPath, configValid };
  }

  /**
   * Detect a binary in PATH and get its version
   *
   * @param binaryName - Name of binary to detect
   * @returns Detection result with found status, path, and version
   *
   * @example
   * ```typescript
   * const result = await detector.detectBinary('claude');
   * // { found: true, path: '/usr/local/bin/claude', version: '2.1.0' }
   * ```
   */
  async detectBinary(
    binaryName: string,
  ): Promise<{ found: boolean; path?: string; version?: string }> {
    try {
      // Check if binary exists in PATH with timeout
      let timeoutId: NodeJS.Timeout | undefined;
      const exists = await Promise.race([
        this.processPort.commandExists(binaryName),
        new Promise<boolean>((resolve) => {
          timeoutId = setTimeout(() => resolve(false), DETECTION_TIMEOUT);
        }),
      ]);
      if (timeoutId) clearTimeout(timeoutId);

      if (!exists) {
        return { found: false };
      }

      // Get binary path with timeout
      const platform = this.environmentPort.platform();
      const whichCommand = platform === 'win32' ? 'where' : 'which';
      let whichTimeoutId: NodeJS.Timeout | undefined;
      const whichResult = await Promise.race([
        this.processPort.exec(whichCommand, [binaryName]),
        new Promise<{ stdout: string; stderr: string; exitCode: number }>(
          (resolve) => {
            whichTimeoutId = setTimeout(
              () => resolve({ stdout: '', stderr: '', exitCode: 1 }),
              DETECTION_TIMEOUT,
            );
          },
        ),
      ]);
      if (whichTimeoutId) clearTimeout(whichTimeoutId);

      const binaryPath =
        whichResult.exitCode === 0
          ? whichResult.stdout.trim().split('\n')[0]
          : undefined;

      // Try to get version with timeout
      let version: string | undefined;
      try {
        let versionTimeoutId: NodeJS.Timeout | undefined;
        const versionResult = await Promise.race([
          this.processPort.exec(binaryName, ['--version']),
          new Promise<{ stdout: string; stderr: string; exitCode: number }>(
            (resolve) => {
              versionTimeoutId = setTimeout(
                () => resolve({ stdout: '', stderr: '', exitCode: 1 }),
                DETECTION_TIMEOUT,
              );
            },
          ),
        ]);
        if (versionTimeoutId) clearTimeout(versionTimeoutId);

        if (versionResult.exitCode === 0) {
          version = this.parseVersion(versionResult.stdout);
        }
      } catch {
        // Version detection failed, but binary exists
      }

      return {
        found: true,
        path: binaryPath,
        version,
      };
    } catch {
      return { found: false };
    }
  }

  /**
   * Detect an application bundle by checking filesystem
   *
   * @param paths - Array of possible app bundle paths to check
   * @returns Detection result with found status and path
   *
   * @example
   * ```typescript
   * const result = await detector.detectAppBundle(['/Applications/Claude.app']);
   * // { found: true, path: '/Applications/Claude.app' }
   * ```
   */
  async detectAppBundle(
    paths: string[],
  ): Promise<{ found: boolean; path?: string }> {
    for (const appPath of paths) {
      if (this.fileExists(appPath)) {
        return { found: true, path: appPath };
      }
    }

    return { found: false };
  }

  /**
   * Validate a config file (check if it's valid JSON)
   *
   * @param configPath - Path to config file
   * @returns True if file exists and is valid JSON
   *
   * @example
   * ```typescript
   * const valid = detector.validateConfigFile('/Users/user/.claude.json');
   * // true
   * ```
   */
  validateConfigFile(configPath: string): boolean {
    try {
      if (!this.fileExists(configPath)) {
        return false;
      }

      const content = this.readFile(configPath);
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse version string from command output
   *
   * Handles various version formats:
   * - "2.1.0"
   * - "v2.1.0"
   * - "Claude Code 2.1.0"
   * - "version 2.1.0"
   *
   * @param output - Command output containing version
   * @returns Parsed version string or undefined
   */
  private parseVersion(output: string): string | undefined {
    const lines = output.trim().split('\n');
    const firstLine = lines[0];

    // Try to extract semantic version (x.y.z)
    // Using a bounded regex to prevent ReDoS attacks
    const semverMatch = firstLine.match(/(\d{1,5}\.\d{1,5}\.\d{1,5})/);
    if (semverMatch) {
      return semverMatch[1];
    }

    // Try to extract simple version (vx.y.z or x.y.z)
    // Match with explicit alternatives to avoid backtracking
    const simpleMatch = firstLine.match(/v?(\d{1,5}\.\d{1,5}(?:\.\d{1,5}|$))/);
    if (simpleMatch) {
      return simpleMatch[1];
    }

    // Return first line if it looks like a version
    if (/^\d/.test(firstLine) || /^v\d/.test(firstLine)) {
      return firstLine.trim();
    }

    return undefined;
  }
}

/**
 * Create a binary detector instance
 *
 * @param processPort - Process execution port
 * @param environmentPort - Environment information port
 * @param fileExists - Function to check if file exists
 * @param readFile - Function to read file contents
 * @returns BinaryDetector instance
 */
export function createBinaryDetector(
  processPort: ProcessPort,
  environmentPort: EnvironmentPort,
  fileExists: (path: string) => boolean,
  readFile: (path: string) => string,
): BinaryDetector {
  return new BinaryDetector(processPort, environmentPort, fileExists, readFile);
}
