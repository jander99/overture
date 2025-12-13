/**
 * Discovery Service
 *
 * Orchestrates CLI detection with WSL2 support and YAML configuration overrides.
 * Provides unified discovery across native detection, config overrides, and WSL2 fallback.
 *
 * @module core/discovery-service
 * @version 1.0
 */

import * as fs from 'fs';
import type { ClientAdapter } from '../adapters/client-adapter.interface';
import type {
  Platform,
  DiscoveryConfig,
  ClientName,
} from '../domain/config.types';
import type {
  DiscoveryReport,
  ClientDiscoveryResult,
  WSL2EnvironmentInfo,
} from '../domain/discovery.types';
import { BinaryDetector } from './binary-detector';
import { WSL2Detector, wsl2Detector, WINDOWS_DEFAULT_PATHS } from './wsl2-detector';
import { adapterRegistry } from '../adapters/adapter-registry';
import { getPlatform, expandTilde } from './path-resolver';

/**
 * Discovery Service
 *
 * Orchestrates detection across all registered clients with support for:
 * - Native binary detection (which/where)
 * - YAML configuration overrides
 * - WSL2 fallback detection via Windows paths
 */
export class DiscoveryService {
  private binaryDetector: BinaryDetector;
  private wsl2Detector: WSL2Detector;
  private config: DiscoveryConfig;

  /**
   * Create a new discovery service
   *
   * @param config - Discovery configuration (optional, defaults to enabled with auto-WSL2 detection)
   */
  constructor(config?: DiscoveryConfig) {
    this.binaryDetector = new BinaryDetector();
    this.wsl2Detector = wsl2Detector;
    this.config = config || { enabled: true };
  }

  /**
   * Run full discovery across all registered clients
   *
   * @returns Discovery report with environment info and all client results
   *
   * @example
   * ```typescript
   * const service = new DiscoveryService();
   * const report = await service.discoverAll();
   *
   * console.log(`Detected ${report.summary.detected} of ${report.summary.totalClients} clients`);
   * if (report.environment.isWSL2) {
   *   console.log(`Running in WSL2 (${report.environment.wsl2Info?.distroName})`);
   * }
   * ```
   */
  async discoverAll(): Promise<DiscoveryReport> {
    const platform = getPlatform();
    const wsl2Info = await this.detectEnvironment();
    const isWSL2 =
      wsl2Info.isWSL2 && (this.config.wsl2_auto_detect !== false);

    const clients: ClientDiscoveryResult[] = [];
    let wsl2Detections = 0;

    for (const adapter of adapterRegistry.getAll()) {
      const result = await this.discoverClient(
        adapter,
        platform,
        isWSL2 ? wsl2Info : undefined
      );
      clients.push(result);

      if (result.source === 'wsl2-fallback') {
        wsl2Detections++;
      }
    }

    return {
      environment: {
        platform,
        isWSL2,
        wsl2Info: isWSL2 ? wsl2Info : undefined,
      },
      clients,
      summary: {
        totalClients: clients.length,
        detected: clients.filter((c) => c.detection.status === 'found').length,
        notFound: clients.filter((c) => c.detection.status === 'not-found')
          .length,
        wsl2Detections,
      },
    };
  }

  /**
   * Discover a specific client by name
   *
   * @param clientName - Name of the client to discover
   * @returns Discovery result for the client
   * @throws Error if client not found in registry
   */
  async discoverByName(clientName: ClientName): Promise<ClientDiscoveryResult> {
    const adapter = adapterRegistry.get(clientName);
    if (!adapter) {
      throw new Error(`No adapter registered for client: ${clientName}`);
    }

    const platform = getPlatform();
    const wsl2Info = await this.detectEnvironment();
    const isWSL2 =
      wsl2Info.isWSL2 && (this.config.wsl2_auto_detect !== false);

    return this.discoverClient(adapter, platform, isWSL2 ? wsl2Info : undefined);
  }

  /**
   * Discover a single client with fallback strategies
   *
   * Detection order:
   * 1. Config override (if binary_path specified in YAML)
   * 2. Native detection via BinaryDetector
   * 3. WSL2 fallback (if in WSL2 and native detection failed)
   *
   * @param adapter - Client adapter
   * @param platform - Target platform
   * @param wsl2Info - WSL2 environment info (if in WSL2)
   * @returns Discovery result with detection info and source
   */
  async discoverClient(
    adapter: ClientAdapter,
    platform: Platform,
    wsl2Info?: WSL2EnvironmentInfo
  ): Promise<ClientDiscoveryResult> {
    // Check if discovery is disabled for this client
    const clientOverride = this.config.clients?.[adapter.name];
    if (clientOverride?.enabled === false) {
      return {
        client: adapter.name,
        detection: {
          status: 'skipped',
          warnings: ['Discovery disabled for this client in config'],
        },
        source: 'config-override',
        environment: platform,
      };
    }

    // Check for config override first (binary_path or app_bundle_path)
    if (clientOverride?.binary_path || clientOverride?.app_bundle_path) {
      const overrideResult = await this.detectFromOverride(
        adapter,
        clientOverride,
        platform
      );
      if (overrideResult.detection.status === 'found') {
        return overrideResult;
      }
      // If override path not found, continue with other detection methods
    }

    // Standard native detection
    const nativeResult = await this.binaryDetector.detectClient(
      adapter,
      platform
    );

    if (nativeResult.status === 'found') {
      return {
        client: adapter.name,
        detection: nativeResult,
        source: 'native',
        environment: platform,
      };
    }

    // WSL2 fallback if native detection failed
    if (wsl2Info?.isWSL2 && wsl2Info.windowsUserProfile) {
      const wsl2Result = await this.detectViaWSL2(adapter, wsl2Info);
      if (wsl2Result) {
        return wsl2Result;
      }
    }

    // Not found by any method
    return {
      client: adapter.name,
      detection: nativeResult,
      source: 'native',
      environment: platform,
    };
  }

  /**
   * Detect environment (WSL2 or native)
   *
   * Respects config.environment override if specified.
   *
   * @returns WSL2 environment information
   */
  private async detectEnvironment(): Promise<WSL2EnvironmentInfo> {
    // Check for forced environment in config
    if (this.config.environment === 'wsl2') {
      // Force WSL2 mode
      const actualInfo = await this.wsl2Detector.detectEnvironment();
      return {
        isWSL2: true,
        distroName: actualInfo.distroName,
        windowsUserProfile: actualInfo.windowsUserProfile,
      };
    }

    // If environment is set to a non-WSL2 value (darwin, linux, win32), force native mode
    // Note: We've already handled 'wsl2' above and returned, so if environment is set here,
    // it must be one of the native platform values
    if (this.config.environment) {
      return { isWSL2: false };
    }

    // Auto-detect
    return this.wsl2Detector.detectEnvironment();
  }

  /**
   * Detect from YAML override configuration
   *
   * @param adapter - Client adapter
   * @param override - Override configuration from YAML
   * @param platform - Target platform
   * @returns Discovery result from override
   */
  private async detectFromOverride(
    adapter: ClientAdapter,
    override: { binary_path?: string; config_path?: string; app_bundle_path?: string },
    platform: Platform
  ): Promise<ClientDiscoveryResult> {
    const binaryPath = override.binary_path
      ? expandTilde(override.binary_path)
      : undefined;
    const configPath = override.config_path
      ? expandTilde(override.config_path)
      : undefined;
    const appBundlePath = override.app_bundle_path
      ? expandTilde(override.app_bundle_path)
      : undefined;

    // Check binary path
    if (binaryPath && fs.existsSync(binaryPath)) {
      return {
        client: adapter.name,
        detection: {
          status: 'found',
          binaryPath,
          configPath,
          warnings: ['Detected via config override'],
        },
        source: 'config-override',
        environment: platform,
      };
    }

    // Check app bundle path
    if (appBundlePath && fs.existsSync(appBundlePath)) {
      return {
        client: adapter.name,
        detection: {
          status: 'found',
          appBundlePath,
          configPath,
          warnings: ['Detected via config override (app bundle)'],
        },
        source: 'config-override',
        environment: platform,
      };
    }

    // Override path not found
    return {
      client: adapter.name,
      detection: {
        status: 'not-found',
        warnings: [
          `Override path not found: ${binaryPath || appBundlePath || 'no path specified'}`,
        ],
      },
      source: 'config-override',
      environment: platform,
    };
  }

  /**
   * Attempt detection via WSL2 Windows paths
   *
   * Checks known Windows installation locations for the client.
   *
   * @param adapter - Client adapter
   * @param wsl2Info - WSL2 environment info
   * @returns Discovery result if found, null otherwise
   */
  private async detectViaWSL2(
    adapter: ClientAdapter,
    wsl2Info: WSL2EnvironmentInfo
  ): Promise<ClientDiscoveryResult | null> {
    const windowsProfile = wsl2Info.windowsUserProfile;
    if (!windowsProfile) {
      return null;
    }

    // Check for WSL2 config override
    const wsl2ConfigPath = this.config.wsl2?.windows_config_paths?.[adapter.name];

    // Get Windows installation paths to check
    const windowsPaths = this.wsl2Detector.getWindowsInstallPaths(
      adapter.name,
      windowsProfile
    );

    // Add custom WSL2 binary paths from config
    if (this.config.wsl2?.windows_binary_paths) {
      for (const basePath of this.config.wsl2.windows_binary_paths) {
        const defaults = WINDOWS_DEFAULT_PATHS[adapter.name];
        if (defaults) {
          for (const relativePath of defaults.binaryPaths) {
            windowsPaths.push(`${basePath}/${relativePath.split('/').pop()}`);
          }
        }
      }
    }

    // Check each path
    for (const searchPath of windowsPaths) {
      if (fs.existsSync(searchPath)) {
        // Get config path
        const configPath =
          wsl2ConfigPath ||
          this.wsl2Detector.getWindowsConfigPath(adapter.name, windowsProfile);

        return {
          client: adapter.name,
          detection: {
            status: 'found',
            binaryPath: searchPath,
            configPath,
            warnings: [
              'Detected via WSL2 Windows path - may not be directly executable from WSL2',
            ],
          },
          source: 'wsl2-fallback',
          environment: 'wsl2',
          windowsPath: searchPath,
          configSource: 'windows',
        };
      }
    }

    // Check for app bundles (GUI apps)
    const appBundlePaths = this.getWindowsAppBundlePaths(adapter.name, windowsProfile);
    for (const appPath of appBundlePaths) {
      if (fs.existsSync(appPath)) {
        const configPath =
          wsl2ConfigPath ||
          this.wsl2Detector.getWindowsConfigPath(adapter.name, windowsProfile);

        return {
          client: adapter.name,
          detection: {
            status: 'found',
            appBundlePath: appPath,
            configPath,
            warnings: [
              'Detected Windows GUI application via WSL2 - config can be managed but app runs on Windows',
            ],
          },
          source: 'wsl2-fallback',
          environment: 'wsl2',
          windowsPath: appPath,
          configSource: 'windows',
        };
      }
    }

    return null;
  }

  /**
   * Get Windows app bundle paths for GUI applications
   *
   * @param client - Client name
   * @param windowsProfile - Windows user profile path
   * @returns Array of app bundle paths to check
   */
  private getWindowsAppBundlePaths(
    client: ClientName,
    windowsProfile: string
  ): string[] {
    const paths: string[] = [];

    // GUI application paths
    const guiAppPaths: Partial<Record<ClientName, string[]>> = {
      'claude-desktop': [
        `${windowsProfile}/AppData/Local/Programs/Claude/Claude.exe`,
        '/mnt/c/Program Files/Claude/Claude.exe',
      ],
      vscode: [
        `${windowsProfile}/AppData/Local/Programs/Microsoft VS Code/Code.exe`,
        '/mnt/c/Program Files/Microsoft VS Code/Code.exe',
      ],
      cursor: [
        `${windowsProfile}/AppData/Local/Programs/cursor/Cursor.exe`,
        `${windowsProfile}/AppData/Local/cursor/Cursor.exe`,
      ],
      windsurf: [
        `${windowsProfile}/AppData/Local/Programs/windsurf/Windsurf.exe`,
      ],
    };

    if (guiAppPaths[client]) {
      paths.push(...guiAppPaths[client]!);
    }

    return paths;
  }

  /**
   * Update discovery configuration
   *
   * @param config - New discovery configuration
   */
  updateConfig(config: DiscoveryConfig): void {
    this.config = config;
  }

  /**
   * Get current discovery configuration
   *
   * @returns Current discovery configuration
   */
  getConfig(): DiscoveryConfig {
    return this.config;
  }
}

/**
 * Global discovery service instance
 */
export const discoveryService = new DiscoveryService();
