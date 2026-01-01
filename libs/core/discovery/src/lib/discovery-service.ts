/**
 * Discovery Service
 *
 * Orchestrates CLI detection with WSL2 support and YAML configuration overrides.
 * Provides unified discovery across native detection, config overrides, and WSL2 fallback.
 *
 * @module lib/discovery-service
 */

import type { ProcessPort, EnvironmentPort } from '@overture/ports-process';
import type {
  Platform,
  DiscoveryConfig,
  ClientName,
  DiscoveryReport,
  ClientDiscoveryResult,
  WSL2EnvironmentInfo,
  ClientAdapter,
} from '@overture/config-types';
import { BinaryDetector } from './binary-detector.js';
import { WSL2Detector, WINDOWS_DEFAULT_PATHS } from './wsl2-detector.js';

/**
 * Detection source constants
 */
const SOURCE_CONFIG_OVERRIDE = 'config-override' as const;
const SOURCE_WSL2_FALLBACK = 'wsl2-fallback' as const;
const SOURCE_NATIVE = 'native' as const;

/**
 * Discovery Service Dependencies
 */
export interface DiscoveryServiceDeps {
  processPort: ProcessPort;
  environmentPort: EnvironmentPort;
  fileExists: (path: string) => boolean;
  readFile: (path: string) => string;
  readDir: (path: string) => string[];
  isDirectory: (path: string) => boolean;
  joinPath: (...paths: string[]) => string;
  expandTilde: (path: string) => string;
}

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
  private deps: DiscoveryServiceDeps;

  /**
   * Create a new discovery service
   *
   * @param deps - Service dependencies (ports and utilities)
   * @param config - Discovery configuration (optional, defaults to enabled with auto-WSL2 detection)
   */
  constructor(deps: DiscoveryServiceDeps, config?: DiscoveryConfig) {
    this.deps = deps;
    this.config = config || { enabled: true };

    this.binaryDetector = new BinaryDetector(
      deps.processPort,
      deps.environmentPort,
      deps.fileExists,
      deps.readFile,
    );

    this.wsl2Detector = new WSL2Detector(
      deps.processPort,
      deps.environmentPort,
      deps.fileExists,
      deps.readFile,
      deps.readDir,
      deps.isDirectory,
      deps.joinPath,
    );
  }

  /**
   * Run full discovery across all registered clients
   *
   * @param adapters - Array of client adapters to discover
   * @returns Discovery report with environment info and all client results
   *
   * @example
   * ```typescript
   * const service = new DiscoveryService(deps);
   * const report = await service.discoverAll(adapters);
   *
   * console.log(`Detected ${report.summary.detected} of ${report.summary.totalClients} clients`);
   * if (report.environment.isWSL2) {
   *   console.log(`Running in WSL2 (${report.environment.wsl2Info?.distroName})`);
   * }
   * ```
   */
  async discoverAll(adapters: ClientAdapter[]): Promise<DiscoveryReport> {
    const platform = this.deps.environmentPort.platform() as Platform;
    const wsl2Info = await this.detectEnvironment();
    const isWSL2 = wsl2Info.isWSL2 && this.config.wsl2_auto_detect !== false;

    const clients: ClientDiscoveryResult[] = [];
    let wsl2Detections = 0;

    for (const adapter of adapters) {
      const result = await this.discoverClient(
        adapter,
        platform,
        isWSL2 ? wsl2Info : undefined,
      );
      clients.push(result);

      if (result.source === SOURCE_WSL2_FALLBACK) {
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
   * Discover a specific client by adapter
   *
   * @param adapter - Client adapter to discover
   * @returns Discovery result for the client
   */
  async discoverByAdapter(
    adapter: ClientAdapter,
  ): Promise<ClientDiscoveryResult> {
    const platform = this.deps.environmentPort.platform() as Platform;
    const wsl2Info = await this.detectEnvironment();
    const isWSL2 = wsl2Info.isWSL2 && this.config.wsl2_auto_detect !== false;

    return this.discoverClient(
      adapter,
      platform,
      isWSL2 ? wsl2Info : undefined,
    );
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
    wsl2Info?: WSL2EnvironmentInfo,
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
        source: SOURCE_CONFIG_OVERRIDE,
        environment: platform,
      };
    }

    // Check for config override first (binary_path or app_bundle_path)
    if (clientOverride?.binary_path || clientOverride?.app_bundle_path) {
      const overrideResult = await this.detectFromOverride(
        adapter,
        clientOverride,
        platform,
      );
      if (overrideResult.detection.status === 'found') {
        return overrideResult;
      }
      // If override path not found, continue with other detection methods
    }

    // Standard native detection
    const nativeResult = await this.binaryDetector.detectClient(
      adapter,
      platform,
    );

    if (nativeResult.status === 'found') {
      return {
        client: adapter.name,
        detection: nativeResult,
        source: SOURCE_NATIVE,
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
    override: {
      binary_path?: string;
      config_path?: string;
      app_bundle_path?: string;
    },
    platform: Platform,
  ): Promise<ClientDiscoveryResult> {
    const binaryPath = override.binary_path
      ? this.deps.expandTilde(override.binary_path)
      : undefined;
    const configPath = override.config_path
      ? this.deps.expandTilde(override.config_path)
      : undefined;
    const appBundlePath = override.app_bundle_path
      ? this.deps.expandTilde(override.app_bundle_path)
      : undefined;

    // Check binary path
    if (binaryPath && this.deps.fileExists(binaryPath)) {
      return {
        client: adapter.name,
        detection: {
          status: 'found',
          binaryPath,
          configPath,
          warnings: ['Detected via config override'],
        },
        source: SOURCE_CONFIG_OVERRIDE,
        environment: platform,
      };
    }

    // Check app bundle path
    if (appBundlePath && this.deps.fileExists(appBundlePath)) {
      return {
        client: adapter.name,
        detection: {
          status: 'found',
          appBundlePath,
          configPath,
          warnings: ['Detected via config override (app bundle)'],
        },
        source: SOURCE_CONFIG_OVERRIDE,
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
    wsl2Info: WSL2EnvironmentInfo,
  ): Promise<ClientDiscoveryResult | null> {
    const windowsProfile = wsl2Info.windowsUserProfile;
    if (!windowsProfile) {
      return null;
    }

    const wsl2ConfigPath =
      this.config.wsl2?.windows_config_paths?.[adapter.name];

    // Check for binary in Windows paths
    const binaryResult = await this.detectWSL2Binary(
      adapter,
      windowsProfile,
      wsl2ConfigPath,
    );
    if (binaryResult) {
      return binaryResult;
    }

    // Check for app bundles (GUI apps)
    return this.detectWSL2AppBundle(adapter, windowsProfile, wsl2ConfigPath);
  }

  /**
   * Detect WSL2 binary in Windows paths
   */
  private async detectWSL2Binary(
    adapter: ClientAdapter,
    windowsProfile: string,
    wsl2ConfigPath?: string,
  ): Promise<ClientDiscoveryResult | null> {
    const windowsPaths = this.getWSL2BinaryPaths(adapter, windowsProfile);

    for (const searchPath of windowsPaths) {
      if (this.deps.fileExists(searchPath)) {
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
          source: SOURCE_WSL2_FALLBACK,
          environment: 'wsl2',
          windowsPath: searchPath,
          configSource: 'windows',
        };
      }
    }

    return null;
  }

  /**
   * Get WSL2 binary paths to check
   */
  private getWSL2BinaryPaths(
    adapter: ClientAdapter,
    windowsProfile: string,
  ): string[] {
    const windowsPaths = this.wsl2Detector.getWindowsInstallPaths(
      adapter.name,
      windowsProfile,
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

    return windowsPaths;
  }

  /**
   * Detect WSL2 app bundle
   */
  private detectWSL2AppBundle(
    adapter: ClientAdapter,
    windowsProfile: string,
    wsl2ConfigPath?: string,
  ): ClientDiscoveryResult | null {
    const appBundlePaths = this.getWindowsAppBundlePaths(
      adapter.name,
      windowsProfile,
    );

    for (const appPath of appBundlePaths) {
      if (this.deps.fileExists(appPath)) {
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
          source: SOURCE_WSL2_FALLBACK,
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
    _windowsProfile: string,
  ): string[] {
    // GUI application paths
    // Note: All currently supported clients (claude-code, copilot-cli, opencode) are CLI-only
    // Using explicit checks to avoid object injection warnings

    const paths: string[] = [];
    const guiAppPaths: Partial<Record<ClientName, string[]>> = {};

    // Use explicit property access for security
    let clientPaths: string[] | undefined;
    switch (client) {
    case 'claude-code': {
      clientPaths = guiAppPaths['claude-code'];
    
    break;
    }
    case 'copilot-cli': {
      clientPaths = guiAppPaths['copilot-cli'];
    
    break;
    }
    case 'opencode': {
      clientPaths = guiAppPaths.opencode;
    
    break;
    }
    // No default
    }

    if (clientPaths) {
      paths.push(...clientPaths);
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

  /**
   * Get the binary detector instance
   *
   * @returns BinaryDetector instance used by this discovery service
   */
  getBinaryDetector(): BinaryDetector {
    return this.binaryDetector;
  }
}

/**
 * Create a discovery service instance
 *
 * @param deps - Service dependencies (ports and utilities)
 * @param config - Discovery configuration (optional)
 * @returns DiscoveryService instance
 */
export function createDiscoveryService(
  deps: DiscoveryServiceDeps,
  config?: DiscoveryConfig,
): DiscoveryService {
  return new DiscoveryService(deps, config);
}
