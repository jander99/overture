/**
 * DiscoveryService Tests
 *
 * @module lib/discovery-service.spec
 */

import { describe, it, expect } from 'vitest';
import { createDiscoveryService } from './discovery-service.js';
import type { DiscoveryServiceDeps } from './discovery-service.js';
import {
  createMockProcessPort,
  createMockEnvironmentPort,
  createMockFilesystem,
  createFilesystemFunctions,
  createMockAdapter,
  joinPath,
  expandTilde,
} from './test-helpers.js';

describe('DiscoveryService', () => {
  function createTestDeps(
    overrides: Partial<DiscoveryServiceDeps> = {},
  ): DiscoveryServiceDeps {
    const fs = createMockFilesystem();
    const { fileExists, readFile, readDir, isDirectory } =
      createFilesystemFunctions(fs);

    return {
      processPort: createMockProcessPort(),
      environmentPort: createMockEnvironmentPort('linux'),
      fileExists,
      readFile,
      readDir,
      isDirectory,
      joinPath,
      expandTilde,
      ...overrides,
    };
  }

  describe('discoverAll', () => {
    it('should discover all clients and return report', async () => {
      const execResults = new Map([
        [
          'which claude',
          { stdout: '/usr/local/bin/claude\n', stderr: '', exitCode: 0 },
        ],
        ['claude --version', { stdout: '2.1.0\n', stderr: '', exitCode: 0 }],
      ]);
      const commandExists = new Map([['claude', true]]);

      const processPort = createMockProcessPort(execResults, commandExists);
      const deps = createTestDeps({ processPort });

      const adapters = [
        createMockAdapter('claude-code', {
          getBinaryNames: () => ['claude'],
        }),
        createMockAdapter('vscode', {
          getBinaryNames: () => ['code'],
        }),
      ];

      const service = createDiscoveryService(deps);
      const report = await service.discoverAll(adapters);

      expect(report.environment.platform).toBe('linux');
      expect(report.environment.isWSL2).toBe(false);
      expect(report.clients).toHaveLength(2);
      expect(report.summary.totalClients).toBe(2);
      expect(report.summary.detected).toBe(1);
      expect(report.summary.notFound).toBe(1);
    });

    it('should detect WSL2 environment when present', async () => {
      const environmentPort = createMockEnvironmentPort('linux', {
        WSL_DISTRO_NAME: 'Ubuntu',
      });

      const fs = createMockFilesystem();
      fs.directories.add('/mnt/c/Users');
      fs.directories.add('/mnt/c/Users/jeff');
      fs.directories.add('/mnt/c/Users/jeff/Desktop');

      const { fileExists, readFile, readDir, isDirectory } =
        createFilesystemFunctions(fs);

      const deps = createTestDeps({
        environmentPort,
        fileExists,
        readFile,
        readDir,
        isDirectory,
      });

      const adapters = [createMockAdapter('claude-code')];
      const service = createDiscoveryService(deps);
      const report = await service.discoverAll(adapters);

      expect(report.environment.isWSL2).toBe(true);
      expect(report.environment.wsl2Info?.distroName).toBe('Ubuntu');
      expect(report.environment.wsl2Info?.windowsUserProfile).toBe(
        '/mnt/c/Users/jeff',
      );
    });
  });

  describe('discoverByAdapter', () => {
    it('should discover single client', async () => {
      const execResults = new Map([
        [
          'which claude',
          { stdout: '/usr/local/bin/claude\n', stderr: '', exitCode: 0 },
        ],
        ['claude --version', { stdout: '2.1.0\n', stderr: '', exitCode: 0 }],
      ]);
      const commandExists = new Map([['claude', true]]);

      const processPort = createMockProcessPort(execResults, commandExists);
      const deps = createTestDeps({ processPort });

      const adapter = createMockAdapter('claude-code', {
        getBinaryNames: () => ['claude'],
      });

      const service = createDiscoveryService(deps);
      const result = await service.discoverByAdapter(adapter);

      expect(result.client).toBe('claude-code');
      expect(result.detection.status).toBe('found');
      expect(result.source).toBe('native');
    });
  });

  describe('config overrides', () => {
    it('should skip discovery when client is disabled', async () => {
      const deps = createTestDeps();
      const adapter = createMockAdapter('claude-code');

      const config = {
        enabled: true,
        clients: {
          'claude-code': { enabled: false },
        },
      };

      const service = createDiscoveryService(deps, config);
      const result = await service.discoverByAdapter(adapter);

      expect(result.detection.status).toBe('skipped');
      expect(result.source).toBe('config-override');
    });

    it('should use binary_path override when specified', async () => {
      const fs = createMockFilesystem();
      fs.files.set('/custom/path/to/claude', '#!/bin/bash');

      const { fileExists, readFile, readDir, isDirectory } =
        createFilesystemFunctions(fs);
      const deps = createTestDeps({
        fileExists,
        readFile,
        readDir,
        isDirectory,
      });

      const adapter = createMockAdapter('claude-code');

      const config = {
        enabled: true,
        clients: {
          'claude-code': {
            binary_path: '/custom/path/to/claude',
          },
        },
      };

      const service = createDiscoveryService(deps, config);
      const result = await service.discoverByAdapter(adapter);

      expect(result.detection.status).toBe('found');
      expect(result.detection.binaryPath).toBe('/custom/path/to/claude');
      expect(result.source).toBe('config-override');
    });

    it('should expand tilde in override paths', async () => {
      const fs = createMockFilesystem();
      fs.files.set('/home/testuser/bin/claude', '#!/bin/bash');

      const { fileExists, readFile, readDir, isDirectory } =
        createFilesystemFunctions(fs);
      const deps = createTestDeps({
        fileExists,
        readFile,
        readDir,
        isDirectory,
      });

      const adapter = createMockAdapter('claude-code');

      const config = {
        enabled: true,
        clients: {
          'claude-code': {
            binary_path: '~/bin/claude',
          },
        },
      };

      const service = createDiscoveryService(deps, config);
      const result = await service.discoverByAdapter(adapter);

      expect(result.detection.status).toBe('found');
      expect(result.detection.binaryPath).toBe('/home/testuser/bin/claude');
    });
  });

  describe('WSL2 fallback detection', () => {
    it('should detect via WSL2 when native detection fails', async () => {
      const environmentPort = createMockEnvironmentPort('linux', {
        WSL_DISTRO_NAME: 'Ubuntu',
      });

      const fs = createMockFilesystem();
      fs.directories.add('/mnt/c/Users');
      fs.directories.add('/mnt/c/Users/jeff');
      fs.directories.add('/mnt/c/Users/jeff/Desktop');
      fs.files.set(
        '/mnt/c/Users/jeff/AppData/Local/Programs/claude-code/claude.exe',
        'exe',
      );

      const { fileExists, readFile, readDir, isDirectory } =
        createFilesystemFunctions(fs);

      const deps = createTestDeps({
        environmentPort,
        fileExists,
        readFile,
        readDir,
        isDirectory,
      });

      const adapter = createMockAdapter('claude-code', {
        getBinaryNames: () => ['claude'],
      });

      const service = createDiscoveryService(deps);
      const result = await service.discoverByAdapter(adapter);

      expect(result.detection.status).toBe('found');
      expect(result.source).toBe('wsl2-fallback');
      expect(result.environment).toBe('wsl2');
      expect(result.windowsPath).toBeDefined();
    });

    it('should respect wsl2_auto_detect config', async () => {
      const environmentPort = createMockEnvironmentPort('linux', {
        WSL_DISTRO_NAME: 'Ubuntu',
      });

      const fs = createMockFilesystem();
      fs.directories.add('/mnt/c/Users');
      fs.directories.add('/mnt/c/Users/jeff');

      const { fileExists, readFile, readDir, isDirectory } =
        createFilesystemFunctions(fs);

      const deps = createTestDeps({
        environmentPort,
        fileExists,
        readFile,
        readDir,
        isDirectory,
      });

      const adapter = createMockAdapter('claude-code');

      const config = {
        enabled: true,
        wsl2_auto_detect: false,
      };

      const service = createDiscoveryService(deps, config);
      const report = await service.discoverAll([adapter]);

      expect(report.environment.isWSL2).toBe(false);
      expect(report.summary.wsl2Detections).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('should update service configuration', () => {
      const deps = createTestDeps();
      const service = createDiscoveryService(deps, { enabled: true });

      const newConfig = { enabled: false };
      service.updateConfig(newConfig);

      expect(service.getConfig()).toEqual(newConfig);
    });
  });
});
