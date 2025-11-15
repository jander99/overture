/**
 * Binary Detector Tests
 *
 * Comprehensive tests for binary and app bundle detection functionality.
 *
 * @module core/binary-detector.spec
 */

import { BinaryDetector } from './binary-detector';
import { ProcessExecutor } from '../infrastructure/process-executor';
import type { ClientAdapter } from '../adapters/client-adapter.interface';
import type { Platform } from '../domain/config.types';
import * as fs from 'fs';

// Mock dependencies
jest.mock('../infrastructure/process-executor');
jest.mock('fs');

const mockProcessExecutor = ProcessExecutor as jest.Mocked<typeof ProcessExecutor>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('BinaryDetector', () => {
  let detector: BinaryDetector;
  const platform: Platform = 'linux';

  beforeEach(() => {
    jest.clearAllMocks();
    detector = new BinaryDetector();
  });

  describe('detectClient', () => {
    let mockAdapter: jest.Mocked<ClientAdapter>;

    beforeEach(() => {
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
      } as any;
    });

    it('should detect CLI-only client with binary found', async () => {
      jest.spyOn(detector, 'detectBinary').mockResolvedValue({
        found: true,
        path: '/usr/local/bin/claude',
        version: '2.1.0',
      });
      jest.spyOn(detector, 'validateConfigFile').mockReturnValue(true);

      const result = await detector.detectClient(mockAdapter, platform);

      expect(result.status).toBe('found');
      expect(result.binaryPath).toBe('/usr/local/bin/claude');
      expect(result.version).toBe('2.1.0');
      expect(result.configValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect CLI-only client with binary not found', async () => {
      jest.spyOn(detector, 'detectBinary').mockResolvedValue({
        found: false,
      });

      const result = await detector.detectClient(mockAdapter, platform);

      expect(result.status).toBe('not-found');
      expect(result.binaryPath).toBeUndefined();
      expect(result.version).toBeUndefined();
    });

    it('should detect GUI app with app bundle found', async () => {
      mockAdapter.getBinaryNames.mockReturnValue([]);
      mockAdapter.getAppBundlePaths.mockReturnValue(['/Applications/Claude.app']);
      mockAdapter.requiresBinary.mockReturnValue(false);
      jest.spyOn(detector, 'detectAppBundle').mockResolvedValue({
        found: true,
        path: '/Applications/Claude.app',
      });
      jest.spyOn(detector, 'validateConfigFile').mockReturnValue(true);

      const result = await detector.detectClient(mockAdapter, platform);

      expect(result.status).toBe('found');
      expect(result.appBundlePath).toBe('/Applications/Claude.app');
    });

    it('should detect hybrid client with either binary or app bundle', async () => {
      mockAdapter.getBinaryNames.mockReturnValue(['windsurf']);
      mockAdapter.getAppBundlePaths.mockReturnValue(['/Applications/Windsurf.app']);
      mockAdapter.requiresBinary.mockReturnValue(false);

      // Binary not found, but app bundle found
      jest.spyOn(detector, 'detectBinary').mockResolvedValue({
        found: false,
      });
      jest.spyOn(detector, 'detectAppBundle').mockResolvedValue({
        found: true,
        path: '/Applications/Windsurf.app',
      });
      jest.spyOn(detector, 'validateConfigFile').mockReturnValue(true);

      const result = await detector.detectClient(mockAdapter, platform);

      expect(result.status).toBe('found');
      expect(result.appBundlePath).toBe('/Applications/Windsurf.app');
    });

    it('should check multiple binary names', async () => {
      mockAdapter.getBinaryNames.mockReturnValue(['idea', 'pycharm', 'webstorm']);
      jest.spyOn(detector, 'detectBinary').mockResolvedValue({
        found: true,
        path: '/usr/bin/pycharm',
        version: '2023.3',
      });
      jest.spyOn(detector, 'validateConfigFile').mockReturnValue(true);

      const result = await detector.detectClient(mockAdapter, platform);

      expect(result.status).toBe('found');
      expect(result.version).toBe('2023.3');
    });

    it('should warn about invalid config file', async () => {
      jest.spyOn(detector, 'detectBinary').mockResolvedValue({
        found: true,
        path: '/usr/bin/test',
        version: '1.0.0',
      });
      jest.spyOn(detector, 'validateConfigFile').mockReturnValue(false);

      const result = await detector.detectClient(mockAdapter, platform);

      expect(result.status).toBe('found');
      expect(result.configValid).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Config file exists but is invalid'))).toBe(true);
    });

    it('should handle config path as object', async () => {
      mockAdapter.detectConfigPath.mockReturnValue({
        user: '/home/user/.config/claude/mcp.json',
        project: '/project/.claude/mcp.json',
      });
      jest.spyOn(detector, 'detectBinary').mockResolvedValue({
        found: true,
        path: '/usr/bin/claude',
        version: '1.0.0',
      });
      jest.spyOn(detector, 'validateConfigFile').mockReturnValue(true);

      const result = await detector.detectClient(mockAdapter, platform);

      expect(result.status).toBe('found');
      expect(result.configPath).toBe('/home/user/.config/claude/mcp.json');
    });

    it('should return not-found when binary required but not found', async () => {
      mockAdapter.requiresBinary.mockReturnValue(true);
      jest.spyOn(detector, 'detectBinary').mockResolvedValue({
        found: false,
      });

      const result = await detector.detectClient(mockAdapter, platform);

      expect(result.status).toBe('not-found');
    });

    it('should return found when binary not required and app bundle exists', async () => {
      mockAdapter.getBinaryNames.mockReturnValue([]);
      mockAdapter.getAppBundlePaths.mockReturnValue(['/Applications/App.app']);
      mockAdapter.requiresBinary.mockReturnValue(false);
      jest.spyOn(detector, 'detectAppBundle').mockResolvedValue({
        found: true,
        path: '/Applications/App.app',
      });
      jest.spyOn(detector, 'validateConfigFile').mockReturnValue(true);

      const result = await detector.detectClient(mockAdapter, platform);

      expect(result.status).toBe('found');
    });
  });

  describe('edge cases', () => {
    it('should handle adapter with no binary names or app paths', async () => {
      const mockAdapter: jest.Mocked<ClientAdapter> = {
        name: 'test' as any,
        schemaRootKey: 'mcpServers',
        getBinaryNames: jest.fn(() => []),
        getAppBundlePaths: jest.fn(() => []),
        requiresBinary: jest.fn(() => false),
        detectConfigPath: jest.fn(() => '/path/to/config.json'),
        readConfig: jest.fn(),
        writeConfig: jest.fn(),
        convertFromOverture: jest.fn(),
        supportsTransport: jest.fn(),
        needsEnvVarExpansion: jest.fn(),
      } as any;

      const result = await detector.detectClient(mockAdapter, platform);

      expect(result.status).toBe('not-found');
      expect(result.warnings).toContain('Client not detected on system');
    });
  });
});
