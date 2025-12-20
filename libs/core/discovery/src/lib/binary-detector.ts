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
  ClientAdapter
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
    private readonly readFile: (path: string) => string
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
    platform: Platform
  ): Promise<BinaryDetectionResult> {
    const warnings: string[] = [];
    let binaryPath: string | undefined;
    let version: string | undefined;
    let appBundlePath: string | undefined;
    let configPath: string | undefined;
    let configValid: boolean | undefined;

    // Check for CLI binaries
    const binaryNames = client.getBinaryNames();
    if (binaryNames.length > 0) {
      const binaryResult = await this.detectBinary(binaryNames[0]);
      if (binaryResult.found) {
        binaryPath = binaryResult.path;
        version = binaryResult.version;
      } else if (client.requiresBinary()) {
        // Required binary not found
        return {
          status: 'not-found',
          warnings: [`Required binary '${binaryNames[0]}' not found in PATH`],
        };
      } else {
        warnings.push(`Binary '${binaryNames[0]}' not found in PATH`);
      }
    }

    // Check for app bundles
    const appBundlePaths = client.getAppBundlePaths(platform);
    if (appBundlePaths.length > 0) {
      const appBundleResult = await this.detectAppBundle(appBundlePaths);
      if (appBundleResult.found) {
        appBundlePath = appBundleResult.path;
      } else if (!binaryPath) {
        // No binary and no app bundle
        return {
          status: 'not-found',
          warnings: [
            `Application not found. Checked paths: ${appBundlePaths.join(', ')}`,
          ],
        };
      } else {
        warnings.push(
          `Application bundle not found (binary available). Checked paths: ${appBundlePaths.join(', ')}`
        );
      }
    }

    // If neither binary nor app bundle found
    if (!binaryPath && !appBundlePath) {
      return {
        status: 'not-found',
        warnings: ['Client not detected on system'],
      };
    }

    // Check config file validity
    const detectedConfigPath = client.detectConfigPath(platform);
    if (detectedConfigPath) {
      const configPathToCheck =
        typeof detectedConfigPath === 'string'
          ? detectedConfigPath
          : detectedConfigPath.user;

      configPath = configPathToCheck;
      configValid = this.validateConfigFile(configPathToCheck);

      if (!configValid) {
        warnings.push(
          `Config file exists but is invalid JSON: ${configPathToCheck}`
        );
      }
    }

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
    binaryName: string
  ): Promise<{ found: boolean; path?: string; version?: string }> {
    try {
      // Check if binary exists in PATH
      const exists = await Promise.race([
        this.processPort.commandExists(binaryName),
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), DETECTION_TIMEOUT)
        ),
      ]);

      if (!exists) {
        return { found: false };
      }

      // Get binary path
      const platform = this.environmentPort.platform();
      const whichCommand = platform === 'win32' ? 'where' : 'which';
      const whichResult = await Promise.race([
        this.processPort.exec(whichCommand, [binaryName]),
        new Promise<{ stdout: string; stderr: string; exitCode: number }>(
          (resolve) =>
            setTimeout(
              () => resolve({ stdout: '', stderr: '', exitCode: 1 }),
              DETECTION_TIMEOUT
            )
        ),
      ]);

      const binaryPath =
        whichResult.exitCode === 0 ? whichResult.stdout.trim().split('\n')[0] : undefined;

      // Try to get version
      let version: string | undefined;
      try {
        const versionResult = await Promise.race([
          this.processPort.exec(binaryName, ['--version']),
          new Promise<{ stdout: string; stderr: string; exitCode: number }>(
            (resolve) =>
              setTimeout(
                () => resolve({ stdout: '', stderr: '', exitCode: 1 }),
                DETECTION_TIMEOUT
              )
          ),
        ]);

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
    paths: string[]
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
    const semverMatch = firstLine.match(/(\d+\.\d+\.\d+)/);
    if (semverMatch) {
      return semverMatch[1];
    }

    // Try to extract simple version (vx.y.z or x.y.z)
    const simpleMatch = firstLine.match(/v?(\d+\.\d+(?:\.\d+)?)/);
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
  readFile: (path: string) => string
): BinaryDetector {
  return new BinaryDetector(processPort, environmentPort, fileExists, readFile);
}
