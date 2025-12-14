/**
 * Discovery Types
 *
 * Types for CLI discovery, WSL2 detection, and discovery reports.
 *
 * @module @overture/config-types
 * @version 1.0
 */

import type {
  ClientName,
  Platform,
  DetectionEnvironment,
  BinaryDetectionResult,
} from './config.types.js';

/**
 * WSL2 environment detection result
 *
 * Contains information about the WSL2 environment when detected.
 *
 * @example
 * ```typescript
 * {
 *   isWSL2: true,
 *   distroName: 'Ubuntu',
 *   windowsUserProfile: '/mnt/c/Users/jeff',
 *   windowsVersion: '10.0.22631'
 * }
 * ```
 */
export interface WSL2EnvironmentInfo {
  /**
   * Whether running in WSL2 environment
   */
  isWSL2: boolean;

  /**
   * WSL2 distribution name (from WSL_DISTRO_NAME env var)
   * @example "Ubuntu", "Debian", "Ubuntu-22.04"
   */
  distroName?: string;

  /**
   * Windows user profile path (translated to WSL2 mount path)
   * @example "/mnt/c/Users/jeff"
   */
  windowsUserProfile?: string;

  /**
   * Windows version string (if detectable)
   * @example "10.0.22631"
   */
  windowsVersion?: string;
}

/**
 * Detection source indicating how the client was discovered
 */
export type DetectionSource = 'native' | 'wsl2-fallback' | 'config-override';

/**
 * Config source indicating where the config file was found
 */
export type ConfigSource = 'linux' | 'windows';

/**
 * Discovery result for a single client with extended metadata
 *
 * Extends the base BinaryDetectionResult with discovery-specific information
 * including how and where the client was detected.
 *
 * @example
 * ```typescript
 * {
 *   client: 'claude-desktop',
 *   detection: { status: 'found', appBundlePath: '/mnt/c/Users/jeff/AppData/...' },
 *   source: 'wsl2-fallback',
 *   environment: 'wsl2',
 *   windowsPath: 'C:\\Users\\jeff\\AppData\\Local\\Programs\\Claude\\Claude.exe'
 * }
 * ```
 */
export interface ClientDiscoveryResult {
  /**
   * Client name that was discovered
   */
  client: ClientName;

  /**
   * Binary detection result with status, paths, and version
   */
  detection: BinaryDetectionResult;

  /**
   * How the client was detected
   * - native: Found via standard PATH/binary detection
   * - wsl2-fallback: Found via Windows paths from WSL2
   * - config-override: Found via user-specified path in config
   */
  source: DetectionSource;

  /**
   * Environment where detection occurred
   */
  environment: DetectionEnvironment;

  /**
   * Original Windows path (for WSL2 detections)
   * @example "C:\\Users\\jeff\\AppData\\Local\\Programs\\Claude\\Claude.exe"
   */
  windowsPath?: string;

  /**
   * Where the config file was found (for WSL2 environments)
   */
  configSource?: ConfigSource;
}

/**
 * Full discovery report with environment info and all client results
 *
 * Returned by DiscoveryService.discoverAll() with comprehensive
 * information about the detection environment and all clients.
 *
 * @example
 * ```typescript
 * {
 *   environment: {
 *     platform: 'linux',
 *     isWSL2: true,
 *     wsl2Info: { distroName: 'Ubuntu', windowsUserProfile: '/mnt/c/Users/jeff' }
 *   },
 *   clients: [...],
 *   summary: { totalClients: 9, detected: 5, notFound: 4, wsl2Detections: 3 }
 * }
 * ```
 */
export interface DiscoveryReport {
  /**
   * Environment information
   */
  environment: {
    /**
     * Detected platform
     */
    platform: Platform;

    /**
     * Whether running in WSL2
     */
    isWSL2: boolean;

    /**
     * WSL2-specific information (only present if isWSL2 is true)
     */
    wsl2Info?: WSL2EnvironmentInfo;
  };

  /**
   * Discovery results for each client
   */
  clients: ClientDiscoveryResult[];

  /**
   * Summary statistics
   */
  summary: {
    /**
     * Total number of clients checked
     */
    totalClients: number;

    /**
     * Number of clients detected (status === 'found')
     */
    detected: number;

    /**
     * Number of clients not found (status === 'not-found')
     */
    notFound: number;

    /**
     * Number of clients detected via WSL2 fallback
     */
    wsl2Detections: number;
  };
}

/**
 * Default installation paths per client per platform
 *
 * Used by discovery service to check known installation locations.
 */
export interface DefaultInstallationPaths {
  [client: string]: {
    /**
     * Binary paths by platform
     */
    binary: Partial<Record<Platform | 'wsl2', string[]>>;

    /**
     * App bundle paths by platform
     */
    appBundle: Partial<Record<Platform | 'wsl2', string[]>>;

    /**
     * Config file path by platform
     */
    config: Partial<Record<Platform | 'wsl2', string>>;
  };
}

/**
 * Windows default paths for common clients
 *
 * Standard Windows installation locations that can be checked from WSL2.
 */
export interface WindowsDefaultPaths {
  /**
   * Client name
   */
  client: ClientName;

  /**
   * Paths relative to Windows user profile (e.g., AppData/Local/Programs/...)
   * These will be joined with the detected windowsUserProfile
   */
  profileRelativePaths: string[];

  /**
   * Absolute Windows paths (e.g., /mnt/c/Program Files/...)
   * Already translated to WSL2 mount format
   */
  absolutePaths: string[];

  /**
   * Config file path relative to Windows user profile
   */
  configPath?: string;
}
