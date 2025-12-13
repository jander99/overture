/**
 * Discovery Service Tests
 *
 * Tests for the DiscoveryService that orchestrates CLI detection
 * with WSL2 support and YAML configuration overrides.
 *
 * @module core/discovery-service.spec
 */

import { DiscoveryService } from './discovery-service';
import { BinaryDetector } from './binary-detector';
import { wsl2Detector } from './wsl2-detector';
import { adapterRegistry } from '../adapters/adapter-registry';
import type { ClientAdapter } from '../adapters/client-adapter.interface';
import type { DiscoveryConfig } from '../domain/config.types';
import * as fs from 'fs';

// Mock dependencies
jest.mock('./binary-detector');
jest.mock('./wsl2-detector', () => ({
  WSL2Detector: jest.fn(),
  wsl2Detector: {
    detectEnvironment: jest.fn(),
    getWindowsInstallPaths: jest.fn(),
    getWindowsConfigPath: jest.fn(),
    resetCache: jest.fn(),
  },
  WINDOWS_DEFAULT_PATHS: {
    'claude-code': { binaryPaths: [], configPath: 'AppData/Roaming/Claude/mcp.json' },
    'claude-desktop': { binaryPaths: [], configPath: 'AppData/Roaming/Claude/claude_desktop_config.json' },
  },
}));
jest.mock('../adapters/adapter-registry');
jest.mock('fs');

const mockBinaryDetectorInstance = {
  detectClient: jest.fn(),
  detectBinary: jest.fn(),
  detectAppBundle: jest.fn(),
  validateConfigFile: jest.fn(),
};

(BinaryDetector as jest.Mock).mockImplementation(() => mockBinaryDetectorInstance);

const mockAdapterRegistry = adapterRegistry as jest.Mocked<typeof adapterRegistry>;
const mockWsl2Detector = wsl2Detector as jest.Mocked<typeof wsl2Detector>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let mockAdapter: jest.Mocked<ClientAdapter>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations
    mockWsl2Detector.detectEnvironment.mockResolvedValue({ isWSL2: false });
    mockWsl2Detector.getWindowsInstallPaths.mockReturnValue([]);
    mockWsl2Detector.getWindowsConfigPath.mockReturnValue(undefined);

    // Create mock adapter
    mockAdapter = {
      name: 'claude-code' as any,
      schemaRootKey: 'mcpServers',
      getBinaryNames: jest.fn(() => ['claude']),
      getAppBundlePaths: jest.fn(() => []),
      requiresBinary: jest.fn(() => true),
      detectConfigPath: jest.fn(() => '/home/user/.config/claude/mcp.json'),
      readConfig: jest.fn(),
      writeConfig: jest.fn(),
      convertFromOverture: jest.fn(),
      supportsTransport: jest.fn(),
      needsEnvVarExpansion: jest.fn(),
    } as unknown as jest.Mocked<ClientAdapter>;

    // Mock adapter registry
    mockAdapterRegistry.getAll.mockReturnValue([mockAdapter]);
    mockAdapterRegistry.get.mockReturnValue(mockAdapter);

    // Default: native detection succeeds
    mockBinaryDetectorInstance.detectClient.mockResolvedValue({
      status: 'found',
      binaryPath: '/usr/local/bin/claude',
      version: '2.1.0',
      warnings: [],
    });

    mockFs.existsSync.mockReturnValue(false);

    service = new DiscoveryService();
  });

  describe('constructor', () => {
    it('should create service with default config', () => {
      const svc = new DiscoveryService();
      expect(svc.getConfig()).toEqual({ enabled: true });
    });

    it('should create service with custom config', () => {
      const config: DiscoveryConfig = {
        enabled: true,
        timeout: 10000,
        wsl2_auto_detect: false,
      };
      const svc = new DiscoveryService(config);
      expect(svc.getConfig()).toEqual(config);
    });
  });

  describe('discoverAll', () => {
    it('should discover all registered clients', async () => {
      const report = await service.discoverAll();

      expect(report.clients).toHaveLength(1);
      expect(report.clients[0].client).toBe('claude-code');
      expect(report.clients[0].detection.status).toBe('found');
      expect(report.summary.detected).toBe(1);
      expect(report.summary.notFound).toBe(0);
    });

    it('should include environment info in report', async () => {
      const report = await service.discoverAll();

      expect(report.environment.platform).toBeDefined();
      expect(report.environment.isWSL2).toBe(false);
    });

    it('should include WSL2 info when in WSL2 environment', async () => {
      mockWsl2Detector.detectEnvironment.mockResolvedValue({
        isWSL2: true,
        distroName: 'Ubuntu',
        windowsUserProfile: '/mnt/c/Users/jeff',
      });

      const report = await service.discoverAll();

      expect(report.environment.isWSL2).toBe(true);
      expect(report.environment.wsl2Info?.distroName).toBe('Ubuntu');
    });

    it('should handle multiple clients', async () => {
      const mockAdapter2: jest.Mocked<ClientAdapter> = {
        name: 'vscode' as any,
        schemaRootKey: 'servers',
        getBinaryNames: jest.fn(() => ['code']),
        getAppBundlePaths: jest.fn(() => []),
        requiresBinary: jest.fn(() => true),
        detectConfigPath: jest.fn(() => '/home/user/.config/Code/User/mcp.json'),
        readConfig: jest.fn(),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
      } as unknown as jest.Mocked<ClientAdapter>;

      mockAdapterRegistry.getAll.mockReturnValue([mockAdapter, mockAdapter2]);

      const report = await service.discoverAll();

      expect(report.clients).toHaveLength(2);
      expect(report.summary.totalClients).toBe(2);
    });

    it('should count not-found clients', async () => {
      mockBinaryDetectorInstance.detectClient.mockResolvedValue({
        status: 'not-found',
        warnings: [],
      });

      const report = await service.discoverAll();

      expect(report.summary.detected).toBe(0);
      expect(report.summary.notFound).toBe(1);
    });
  });

  describe('discoverByName', () => {
    it('should discover specific client by name', async () => {
      const result = await service.discoverByName('claude-code');

      expect(result.client).toBe('claude-code');
      expect(result.detection.status).toBe('found');
    });

    it('should throw error for unknown client', async () => {
      mockAdapterRegistry.get.mockReturnValue(undefined);

      await expect(service.discoverByName('unknown' as any)).rejects.toThrow(
        'No adapter registered for client: unknown'
      );
    });
  });

  describe('discoverClient', () => {
    it('should detect client via native detection', async () => {
      const result = await service.discoverClient(mockAdapter, 'linux');

      expect(result.client).toBe('claude-code');
      expect(result.detection.status).toBe('found');
      expect(result.source).toBe('native');
      expect(result.environment).toBe('linux');
    });

    it('should use config override when specified', async () => {
      const config: DiscoveryConfig = {
        enabled: true,
        clients: {
          'claude-code': {
            binary_path: '/custom/claude',
          },
        },
      };
      service.updateConfig(config);
      mockFs.existsSync.mockReturnValue(true);

      const result = await service.discoverClient(mockAdapter, 'linux');

      expect(result.detection.status).toBe('found');
      expect(result.source).toBe('config-override');
      expect(result.detection.binaryPath).toBe('/custom/claude');
    });

    it('should skip disabled client', async () => {
      const config: DiscoveryConfig = {
        enabled: true,
        clients: {
          'claude-code': {
            enabled: false,
          },
        },
      };
      service.updateConfig(config);

      const result = await service.discoverClient(mockAdapter, 'linux');

      expect(result.detection.status).toBe('skipped');
      expect(result.source).toBe('config-override');
    });

    it('should fall back to native when config override path not found', async () => {
      const config: DiscoveryConfig = {
        enabled: true,
        clients: {
          'claude-code': {
            binary_path: '/nonexistent/claude',
          },
        },
      };
      service.updateConfig(config);
      mockFs.existsSync.mockReturnValue(false);

      const result = await service.discoverClient(mockAdapter, 'linux');

      // Falls back to native detection which succeeds
      expect(result.detection.status).toBe('found');
      expect(result.source).toBe('native');
    });

    it('should detect app bundle via config override', async () => {
      const config: DiscoveryConfig = {
        enabled: true,
        clients: {
          'claude-code': {
            app_bundle_path: '/Applications/Claude.app',
          },
        },
      };
      service.updateConfig(config);
      mockFs.existsSync.mockImplementation((path: any) => {
        return path === '/Applications/Claude.app';
      });

      const result = await service.discoverClient(mockAdapter, 'darwin');

      expect(result.detection.status).toBe('found');
      expect(result.source).toBe('config-override');
      expect(result.detection.appBundlePath).toBe('/Applications/Claude.app');
    });

    it('should include config path from override', async () => {
      const config: DiscoveryConfig = {
        enabled: true,
        clients: {
          'claude-code': {
            binary_path: '/custom/claude',
            config_path: '/custom/config.json',
          },
        },
      };
      service.updateConfig(config);
      mockFs.existsSync.mockReturnValue(true);

      const result = await service.discoverClient(mockAdapter, 'linux');

      expect(result.detection.configPath).toBe('/custom/config.json');
    });
  });

  describe('WSL2 fallback detection', () => {
    const wsl2Info = {
      isWSL2: true,
      distroName: 'Ubuntu',
      windowsUserProfile: '/mnt/c/Users/jeff',
    };

    beforeEach(() => {
      // Native detection fails
      mockBinaryDetectorInstance.detectClient.mockResolvedValue({
        status: 'not-found',
        warnings: [],
      });
    });

    it('should detect via WSL2 fallback when native fails', async () => {
      mockWsl2Detector.getWindowsInstallPaths.mockReturnValue([
        '/mnt/c/Users/jeff/AppData/Local/Programs/claude-code/claude.exe',
      ]);
      mockWsl2Detector.getWindowsConfigPath.mockReturnValue(
        '/mnt/c/Users/jeff/AppData/Roaming/Claude/mcp.json'
      );
      mockFs.existsSync.mockReturnValue(true);

      const result = await service.discoverClient(mockAdapter, 'linux', wsl2Info);

      expect(result.detection.status).toBe('found');
      expect(result.source).toBe('wsl2-fallback');
      expect(result.environment).toBe('wsl2');
      expect(result.windowsPath).toBeDefined();
    });

    it('should return not-found when WSL2 fallback also fails', async () => {
      mockWsl2Detector.getWindowsInstallPaths.mockReturnValue([
        '/mnt/c/nonexistent/path',
      ]);
      mockFs.existsSync.mockReturnValue(false);

      const result = await service.discoverClient(mockAdapter, 'linux', wsl2Info);

      expect(result.detection.status).toBe('not-found');
      expect(result.source).toBe('native');
    });

    it('should not attempt WSL2 fallback without windowsUserProfile', async () => {
      const partialWsl2Info = {
        isWSL2: true,
        distroName: 'Ubuntu',
      };

      const result = await service.discoverClient(mockAdapter, 'linux', partialWsl2Info);

      expect(result.detection.status).toBe('not-found');
      expect(mockWsl2Detector.getWindowsInstallPaths).not.toHaveBeenCalled();
    });

    it('should use WSL2 config path override when specified', async () => {
      const config: DiscoveryConfig = {
        enabled: true,
        wsl2: {
          windows_config_paths: {
            'claude-code': '/mnt/c/Custom/config.json',
          },
        },
      };
      service.updateConfig(config);

      mockWsl2Detector.getWindowsInstallPaths.mockReturnValue([
        '/mnt/c/Users/jeff/AppData/Local/Programs/claude-code/claude.exe',
      ]);
      mockFs.existsSync.mockReturnValue(true);

      const result = await service.discoverClient(mockAdapter, 'linux', wsl2Info);

      expect(result.detection.status).toBe('found');
      expect(result.detection.configPath).toBe('/mnt/c/Custom/config.json');
    });

    it('should track WSL2 detections in discoverAll summary', async () => {
      mockWsl2Detector.detectEnvironment.mockResolvedValue(wsl2Info);
      mockWsl2Detector.getWindowsInstallPaths.mockReturnValue([
        '/mnt/c/Users/jeff/AppData/Local/Programs/claude-code/claude.exe',
      ]);
      mockFs.existsSync.mockReturnValue(true);

      const report = await service.discoverAll();

      expect(report.summary.wsl2Detections).toBe(1);
    });
  });

  describe('detectEnvironment', () => {
    it('should auto-detect when no environment forced', async () => {
      await service.discoverAll();

      expect(mockWsl2Detector.detectEnvironment).toHaveBeenCalled();
    });

    it('should force WSL2 mode when environment is wsl2', async () => {
      const config: DiscoveryConfig = {
        enabled: true,
        environment: 'wsl2',
      };
      service.updateConfig(config);

      mockWsl2Detector.detectEnvironment.mockResolvedValue({
        isWSL2: false, // Real detection says no, but we force it
        distroName: 'Ubuntu',
        windowsUserProfile: '/mnt/c/Users/jeff',
      });

      const report = await service.discoverAll();

      expect(report.environment.isWSL2).toBe(true);
    });

    it('should force native mode when environment is non-WSL2', async () => {
      const config: DiscoveryConfig = {
        enabled: true,
        environment: 'linux',
      };
      service.updateConfig(config);

      mockWsl2Detector.detectEnvironment.mockResolvedValue({
        isWSL2: true, // Real detection says yes, but we force native
        distroName: 'Ubuntu',
        windowsUserProfile: '/mnt/c/Users/jeff',
      });

      const report = await service.discoverAll();

      expect(report.environment.isWSL2).toBe(false);
    });

    it('should respect wsl2_auto_detect: false', async () => {
      const config: DiscoveryConfig = {
        enabled: true,
        wsl2_auto_detect: false,
      };
      service.updateConfig(config);

      mockWsl2Detector.detectEnvironment.mockResolvedValue({
        isWSL2: true,
        distroName: 'Ubuntu',
        windowsUserProfile: '/mnt/c/Users/jeff',
      });

      const report = await service.discoverAll();

      expect(report.environment.isWSL2).toBe(false);
    });
  });

  describe('updateConfig and getConfig', () => {
    it('should update configuration', () => {
      const newConfig: DiscoveryConfig = {
        enabled: false,
        timeout: 10000,
      };

      service.updateConfig(newConfig);

      expect(service.getConfig()).toEqual(newConfig);
    });
  });

  describe('GUI app detection via WSL2', () => {
    const wsl2Info = {
      isWSL2: true,
      distroName: 'Ubuntu',
      windowsUserProfile: '/mnt/c/Users/jeff',
    };

    beforeEach(() => {
      mockBinaryDetectorInstance.detectClient.mockResolvedValue({
        status: 'not-found',
        warnings: [],
      });
      mockWsl2Detector.getWindowsInstallPaths.mockReturnValue([]);
    });

    it('should detect GUI apps via app bundle path', async () => {
      mockFs.existsSync.mockImplementation((path: any) => {
        // GUI app found at Windows path
        if (path === '/mnt/c/Users/jeff/AppData/Local/Programs/Claude/Claude.exe') {
          return true;
        }
        return false;
      });

      // Simulate claude-desktop adapter
      const guiAdapter = {
        ...mockAdapter,
        name: 'claude-desktop' as any,
      } as jest.Mocked<ClientAdapter>;

      const result = await service.discoverClient(guiAdapter, 'linux', wsl2Info);

      expect(result.detection.status).toBe('found');
      expect(result.source).toBe('wsl2-fallback');
      expect(result.detection.appBundlePath).toBeDefined();
    });
  });

  describe('tilde expansion', () => {
    it('should expand tilde in binary_path', async () => {
      const config: DiscoveryConfig = {
        enabled: true,
        clients: {
          'claude-code': {
            binary_path: '~/.local/bin/claude',
          },
        },
      };
      service.updateConfig(config);

      // Mock that the expanded path exists
      mockFs.existsSync.mockImplementation((path: any) => {
        // The path should be expanded from ~ to actual home dir
        return path.includes('.local/bin/claude') && !path.startsWith('~');
      });

      const result = await service.discoverClient(mockAdapter, 'linux');

      expect(result.detection.status).toBe('found');
      expect(result.source).toBe('config-override');
      // The binary path should not start with ~
      expect(result.detection.binaryPath).not.toMatch(/^~/);
    });
  });
});
