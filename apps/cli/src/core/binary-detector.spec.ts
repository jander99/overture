import type { Mock, Mocked, MockedObject, MockedFunction, MockInstance } from 'vitest';
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
vi.mock('../infrastructure/process-executor');
vi.mock('fs');

const mockProcessExecutor = ProcessExecutor as Mocked<typeof ProcessExecutor>;
const mockFs = fs as Mocked<typeof fs>;

describe('BinaryDetector', () => {
  let detector: BinaryDetector;
  const platform: Platform = 'linux';

  beforeEach(() => {
    vi.clearAllMocks();
    detector = new BinaryDetector();
  });

  describe('detectClient', () => {
    let mockAdapter: MockedObject<ClientAdapter>;

    beforeEach(() => {
      mockAdapter = {
        name: 'claude-code' as any,
        schemaRootKey: 'mcpServers',
        getBinaryNames: vi.fn(() => ['claude']),
        getAppBundlePaths: vi.fn(() => []),
        requiresBinary: vi.fn(() => true),
        detectConfigPath: vi.fn(() => '/home/user/.config/claude/mcp.json'),
        readConfig: vi.fn(),
        writeConfig: vi.fn(),
        convertFromOverture: vi.fn(),
        supportsTransport: vi.fn(),
        needsEnvVarExpansion: vi.fn(),
      } as any;
    });

    it('should detect CLI-only client with binary found', async () => {
      vi.spyOn(detector, 'detectBinary').mockResolvedValue({
        found: true,
        path: '/usr/local/bin/claude',
        version: '2.1.0',
      });
      vi.spyOn(detector, 'validateConfigFile').mockReturnValue(true);

      const result = await detector.detectClient(mockAdapter, platform);

      expect(result.status).toBe('found');
      expect(result.binaryPath).toBe('/usr/local/bin/claude');
      expect(result.version).toBe('2.1.0');
      expect(result.configValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect CLI-only client with binary not found', async () => {
      vi.spyOn(detector, 'detectBinary').mockResolvedValue({
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
      vi.spyOn(detector, 'detectAppBundle').mockResolvedValue({
        found: true,
        path: '/Applications/Claude.app',
      });
      vi.spyOn(detector, 'validateConfigFile').mockReturnValue(true);

      const result = await detector.detectClient(mockAdapter, platform);

      expect(result.status).toBe('found');
      expect(result.appBundlePath).toBe('/Applications/Claude.app');
    });

    it('should detect hybrid client with either binary or app bundle', async () => {
      mockAdapter.getBinaryNames.mockReturnValue(['windsurf']);
      mockAdapter.getAppBundlePaths.mockReturnValue(['/Applications/Windsurf.app']);
      mockAdapter.requiresBinary.mockReturnValue(false);

      // Binary not found, but app bundle found
      vi.spyOn(detector, 'detectBinary').mockResolvedValue({
        found: false,
      });
      vi.spyOn(detector, 'detectAppBundle').mockResolvedValue({
        found: true,
        path: '/Applications/Windsurf.app',
      });
      vi.spyOn(detector, 'validateConfigFile').mockReturnValue(true);

      const result = await detector.detectClient(mockAdapter, platform);

      expect(result.status).toBe('found');
      expect(result.appBundlePath).toBe('/Applications/Windsurf.app');
    });

    it('should check multiple binary names', async () => {
      mockAdapter.getBinaryNames.mockReturnValue(['idea', 'pycharm', 'webstorm']);
      vi.spyOn(detector, 'detectBinary').mockResolvedValue({
        found: true,
        path: '/usr/bin/pycharm',
        version: '2023.3',
      });
      vi.spyOn(detector, 'validateConfigFile').mockReturnValue(true);

      const result = await detector.detectClient(mockAdapter, platform);

      expect(result.status).toBe('found');
      expect(result.version).toBe('2023.3');
    });

    it('should warn about invalid config file', async () => {
      vi.spyOn(detector, 'detectBinary').mockResolvedValue({
        found: true,
        path: '/usr/bin/test',
        version: '1.0.0',
      });
      vi.spyOn(detector, 'validateConfigFile').mockReturnValue(false);

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
      vi.spyOn(detector, 'detectBinary').mockResolvedValue({
        found: true,
        path: '/usr/bin/claude',
        version: '1.0.0',
      });
      vi.spyOn(detector, 'validateConfigFile').mockReturnValue(true);

      const result = await detector.detectClient(mockAdapter, platform);

      expect(result.status).toBe('found');
      expect(result.configPath).toBe('/home/user/.config/claude/mcp.json');
    });

    it('should return not-found when binary required but not found', async () => {
      mockAdapter.requiresBinary.mockReturnValue(true);
      vi.spyOn(detector, 'detectBinary').mockResolvedValue({
        found: false,
      });

      const result = await detector.detectClient(mockAdapter, platform);

      expect(result.status).toBe('not-found');
    });

    it('should return found when binary not required and app bundle exists', async () => {
      mockAdapter.getBinaryNames.mockReturnValue([]);
      mockAdapter.getAppBundlePaths.mockReturnValue(['/Applications/App.app']);
      mockAdapter.requiresBinary.mockReturnValue(false);
      vi.spyOn(detector, 'detectAppBundle').mockResolvedValue({
        found: true,
        path: '/Applications/App.app',
      });
      vi.spyOn(detector, 'validateConfigFile').mockReturnValue(true);

      const result = await detector.detectClient(mockAdapter, platform);

      expect(result.status).toBe('found');
    });
  });

  describe('edge cases', () => {
    it('should handle adapter with no binary names or app paths', async () => {
      const mockAdapter: MockedObject<ClientAdapter> = {
        name: 'test' as any,
        schemaRootKey: 'mcpServers',
        getBinaryNames: vi.fn(() => []),
        getAppBundlePaths: vi.fn(() => []),
        requiresBinary: vi.fn(() => false),
        detectConfigPath: vi.fn(() => '/path/to/config.json'),
        readConfig: vi.fn(),
        writeConfig: vi.fn(),
        convertFromOverture: vi.fn(),
        supportsTransport: vi.fn(),
        needsEnvVarExpansion: vi.fn(),
      } as any;

      const result = await detector.detectClient(mockAdapter, platform);

      expect(result.status).toBe('not-found');
      expect(result.warnings).toContain('Client not detected on system');
    });
  });
});
