import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientsChecker } from './clients-checker.js';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { AdapterRegistry } from '@overture/client-adapters';
import type { Platform, ClientName } from '@overture/config-types';

describe('ClientsChecker', () => {
  let clientsChecker: ClientsChecker;
  let mockFilesystem: FilesystemPort;
  let mockAdapterRegistry: AdapterRegistry;

  beforeEach(() => {
    mockFilesystem = {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      exists: vi.fn(),
      mkdir: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      rm: vi.fn(),
    };

    mockAdapterRegistry = {
      get: vi.fn(),
      register: vi.fn(),
      getAll: vi.fn(),
      getAllNames: vi.fn(),
      detectInstalledClients: vi.fn(),
      getInstalledAdapters: vi.fn(),
      has: vi.fn(),
      clear: vi.fn(),
      size: 0,
    } as unknown as AdapterRegistry;

    clientsChecker = new ClientsChecker(mockFilesystem, mockAdapterRegistry);
  });

  describe('checkClients', () => {
    it('should detect found clients with valid configs', async () => {
      const platform: Platform = 'linux';
      const projectRoot = '/home/user/project';

      const discoveryReport = {
        clients: [
          {
            client: 'claude-code' as ClientName,
            detection: {
              status: 'found',
              binaryPath: '/usr/local/bin/claude',
              version: '2.1.0',
              warnings: [],
            },
            source: 'native',
          },
        ],
      };

      const mockAdapter = {
        detectConfigPath: vi.fn().mockReturnValue('/home/user/.claude.json'),
      };

      vi.mocked(mockAdapterRegistry.get).mockReturnValue(
        mockAdapter as unknown as ReturnType<AdapterRegistry['get']>,
      );
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue(
        '{"mcpServers": {}}',
      );

      const result = await clientsChecker.checkClients(
        discoveryReport,
        platform,
        projectRoot,
      );

      expect(result.clients).toHaveLength(1);
      expect(result.clients[0]).toMatchObject({
        client: 'claude-code',
        status: 'found',
        binaryPath: '/usr/local/bin/claude',
        version: '2.1.0',
        configPath: '/home/user/.claude.json',
        configValid: true,
        source: 'native',
      });

      expect(result.summary).toEqual({
        clientsDetected: 1,
        clientsMissing: 0,
        wsl2Detections: 0,
        configsValid: 1,
        configsInvalid: 0,
      });
    });

    it('should detect missing clients', async () => {
      const platform: Platform = 'linux';
      const projectRoot = null;

      const discoveryReport = {
        clients: [
          {
            client: 'copilot-cli' as ClientName,
            detection: {
              status: 'not-found',
              warnings: [],
            },
            source: 'native',
          },
        ],
      };

      const mockAdapter = {
        detectConfigPath: vi.fn().mockReturnValue('/home/user/.copilot.json'),
      };

      vi.mocked(mockAdapterRegistry.get).mockReturnValue(
        mockAdapter as unknown as ReturnType<AdapterRegistry['get']>,
      );
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const result = await clientsChecker.checkClients(
        discoveryReport,
        platform,
        projectRoot,
      );

      expect(result.clients).toHaveLength(1);
      expect(result.clients[0]).toMatchObject({
        client: 'copilot-cli',
        status: 'not-found',
        configPath: '/home/user/.copilot.json',
        configValid: false,
      });

      expect(result.summary).toEqual({
        clientsDetected: 0,
        clientsMissing: 1,
        wsl2Detections: 0,
        configsValid: 0,
        configsInvalid: 1,
      });
    });

    it('should count WSL2 detections correctly', async () => {
      const platform: Platform = 'linux';
      const projectRoot = null;

      const discoveryReport = {
        clients: [
          {
            client: 'claude-code' as ClientName,
            detection: {
              status: 'found',
              binaryPath: '/mnt/c/Program Files/Claude/claude.exe',
              version: '2.1.0',
              warnings: [],
            },
            source: 'wsl2-fallback',
            environment: 'wsl2',
            windowsPath: 'C:\\Program Files\\Claude\\claude.exe',
          },
        ],
      };

      const mockAdapter = {
        detectConfigPath: vi.fn().mockReturnValue('/home/user/.claude.json'),
      };

      vi.mocked(mockAdapterRegistry.get).mockReturnValue(
        mockAdapter as unknown as ReturnType<AdapterRegistry['get']>,
      );
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('{}');

      const result = await clientsChecker.checkClients(
        discoveryReport,
        platform,
        projectRoot,
      );

      expect(result.clients[0]).toMatchObject({
        client: 'claude-code',
        status: 'found',
        source: 'wsl2-fallback',
        environment: 'wsl2',
        windowsPath: 'C:\\Program Files\\Claude\\claude.exe',
      });

      expect(result.summary).toEqual({
        clientsDetected: 1,
        clientsMissing: 0,
        wsl2Detections: 1,
        configsValid: 1,
        configsInvalid: 0,
      });
    });

    it('should handle multiple clients with mixed statuses', async () => {
      const platform: Platform = 'darwin';
      const projectRoot = '/Users/user/project';

      const discoveryReport = {
        clients: [
          {
            client: 'claude-code' as ClientName,
            detection: {
              status: 'found',
              binaryPath: '/usr/local/bin/claude',
              version: '2.1.0',
              warnings: [],
            },
            source: 'native',
          },
          {
            client: 'copilot-cli' as ClientName,
            detection: {
              status: 'not-found',
              warnings: [],
            },
            source: 'native',
          },
          {
            client: 'opencode' as ClientName,
            detection: {
              status: 'found',
              binaryPath: '/usr/local/bin/opencode',
              version: '1.0.0',
              warnings: [],
            },
            source: 'native',
          },
        ],
      };

      const mockAdapter1 = {
        detectConfigPath: vi.fn().mockReturnValue('/Users/user/.claude.json'),
      };
      const mockAdapter2 = {
        detectConfigPath: vi.fn().mockReturnValue('/Users/user/.copilot.json'),
      };
      const mockAdapter3 = {
        detectConfigPath: vi.fn().mockReturnValue('/Users/user/opencode.json'),
      };

      vi.mocked(mockAdapterRegistry.get)
        .mockReturnValueOnce(
          mockAdapter1 as unknown as ReturnType<AdapterRegistry['get']>,
        )
        .mockReturnValueOnce(
          mockAdapter2 as unknown as ReturnType<AdapterRegistry['get']>,
        )
        .mockReturnValueOnce(
          mockAdapter3 as unknown as ReturnType<AdapterRegistry['get']>,
        );

      vi.mocked(mockFilesystem.exists)
        .mockResolvedValueOnce(true) // claude-code config exists
        .mockResolvedValueOnce(false) // copilot-cli config missing
        .mockResolvedValueOnce(true); // opencode config exists

      vi.mocked(mockFilesystem.readFile)
        .mockResolvedValueOnce('{"mcpServers": {}}') // valid JSON
        .mockResolvedValueOnce('{"mcpServers": {}}'); // valid JSON

      const result = await clientsChecker.checkClients(
        discoveryReport,
        platform,
        projectRoot,
      );

      expect(result.clients).toHaveLength(3);
      expect(result.summary).toEqual({
        clientsDetected: 2,
        clientsMissing: 1,
        wsl2Detections: 0,
        configsValid: 2,
        configsInvalid: 1,
      });
    });

    it('should handle invalid JSON in config files', async () => {
      const platform: Platform = 'linux';
      const projectRoot = null;

      const discoveryReport = {
        clients: [
          {
            client: 'claude-code' as ClientName,
            detection: {
              status: 'found',
              binaryPath: '/usr/local/bin/claude',
              version: '2.1.0',
              warnings: [],
            },
            source: 'native',
          },
        ],
      };

      const mockAdapter = {
        detectConfigPath: vi.fn().mockReturnValue('/home/user/.claude.json'),
      };

      vi.mocked(mockAdapterRegistry.get).mockReturnValue(
        mockAdapter as unknown as ReturnType<AdapterRegistry['get']>,
      );
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('invalid json {');

      const result = await clientsChecker.checkClients(
        discoveryReport,
        platform,
        projectRoot,
      );

      expect(result.clients[0]).toMatchObject({
        configValid: false,
      });

      expect(result.summary).toEqual({
        clientsDetected: 1,
        clientsMissing: 0,
        wsl2Detections: 0,
        configsValid: 0,
        configsInvalid: 1,
      });
    });

    it('should handle adapter returning object with user path', async () => {
      const platform: Platform = 'linux';
      const projectRoot = '/home/user/project';

      const discoveryReport = {
        clients: [
          {
            client: 'opencode' as ClientName,
            detection: {
              status: 'found',
              binaryPath: '/usr/local/bin/opencode',
              version: '1.0.0',
              warnings: [],
            },
            source: 'native',
          },
        ],
      };

      const mockAdapter = {
        detectConfigPath: vi.fn().mockReturnValue({
          user: '/home/user/.config/opencode/opencode.json',
          project: '/home/user/project/opencode.json',
        }),
      };

      vi.mocked(mockAdapterRegistry.get).mockReturnValue(
        mockAdapter as unknown as ReturnType<AdapterRegistry['get']>,
      );
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('{"mcp": {}}');

      const result = await clientsChecker.checkClients(
        discoveryReport,
        platform,
        projectRoot,
      );

      expect(result.clients[0]).toMatchObject({
        configPath: '/home/user/.config/opencode/opencode.json',
        configValid: true,
      });
    });

    it('should handle adapter without detectConfigPath method', async () => {
      const platform: Platform = 'linux';
      const projectRoot = null;

      const discoveryReport = {
        clients: [
          {
            client: 'claude-code' as ClientName,
            detection: {
              status: 'found',
              binaryPath: '/usr/local/bin/claude',
              version: '2.1.0',
              warnings: [],
            },
            source: 'native',
          },
        ],
      };

      const mockAdapter = {};

      vi.mocked(mockAdapterRegistry.get).mockReturnValue(
        mockAdapter as unknown as ReturnType<AdapterRegistry['get']>,
      );

      const result = await clientsChecker.checkClients(
        discoveryReport,
        platform,
        projectRoot,
      );

      expect(result.clients[0]).toMatchObject({
        configPath: undefined,
        configValid: false,
      });

      expect(result.summary.configsValid).toBe(0);
      expect(result.summary.configsInvalid).toBe(0);
    });

    it('should handle skipped clients', async () => {
      const platform: Platform = 'linux';
      const projectRoot = null;

      const discoveryReport = {
        clients: [
          {
            client: 'claude-code' as ClientName,
            detection: {
              status: 'skipped',
              warnings: [],
            },
            source: 'native',
          },
        ],
      };

      const mockAdapter = {
        detectConfigPath: vi.fn().mockReturnValue('/home/user/.claude.json'),
      };

      vi.mocked(mockAdapterRegistry.get).mockReturnValue(
        mockAdapter as unknown as ReturnType<AdapterRegistry['get']>,
      );
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const result = await clientsChecker.checkClients(
        discoveryReport,
        platform,
        projectRoot,
      );

      expect(result.clients[0]).toMatchObject({
        status: 'skipped',
      });

      expect(result.summary).toEqual({
        clientsDetected: 0,
        clientsMissing: 0,
        wsl2Detections: 0,
        configsValid: 0,
        configsInvalid: 1,
      });
    });

    it('should handle warnings from detection', async () => {
      const platform: Platform = 'darwin';
      const projectRoot = null;

      const discoveryReport = {
        clients: [
          {
            client: 'claude-code' as ClientName,
            detection: {
              status: 'found',
              binaryPath: '/usr/local/bin/claude',
              version: '2.1.0',
              warnings: ['Version mismatch', 'Config needs update'],
            },
            source: 'native',
          },
        ],
      };

      const mockAdapter = {
        detectConfigPath: vi.fn().mockReturnValue('/Users/user/.claude.json'),
      };

      vi.mocked(mockAdapterRegistry.get).mockReturnValue(
        mockAdapter as unknown as ReturnType<AdapterRegistry['get']>,
      );
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('{}');

      const result = await clientsChecker.checkClients(
        discoveryReport,
        platform,
        projectRoot,
      );

      expect(result.clients[0].warnings).toEqual([
        'Version mismatch',
        'Config needs update',
      ]);
    });

    it('should handle filesystem read errors gracefully', async () => {
      const platform: Platform = 'linux';
      const projectRoot = null;

      const discoveryReport = {
        clients: [
          {
            client: 'claude-code' as ClientName,
            detection: {
              status: 'found',
              binaryPath: '/usr/local/bin/claude',
              version: '2.1.0',
              warnings: [],
            },
            source: 'native',
          },
        ],
      };

      const mockAdapter = {
        detectConfigPath: vi.fn().mockReturnValue('/home/user/.claude.json'),
      };

      vi.mocked(mockAdapterRegistry.get).mockReturnValue(
        mockAdapter as unknown as ReturnType<AdapterRegistry['get']>,
      );
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockRejectedValue(
        new Error('Permission denied'),
      );

      const result = await clientsChecker.checkClients(
        discoveryReport,
        platform,
        projectRoot,
      );

      expect(result.clients[0]).toMatchObject({
        configValid: false,
      });
    });

    it('should handle app bundle path', async () => {
      const platform: Platform = 'darwin';
      const projectRoot = null;

      const discoveryReport = {
        clients: [
          {
            client: 'claude-code' as ClientName,
            detection: {
              status: 'found',
              appBundlePath: '/Applications/Claude.app',
              version: '2.1.0',
              warnings: [],
            },
            source: 'native',
          },
        ],
      };

      const mockAdapter = {
        detectConfigPath: vi.fn().mockReturnValue('/Users/user/.claude.json'),
      };

      vi.mocked(mockAdapterRegistry.get).mockReturnValue(
        mockAdapter as unknown as ReturnType<AdapterRegistry['get']>,
      );
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('{}');

      const result = await clientsChecker.checkClients(
        discoveryReport,
        platform,
        projectRoot,
      );

      expect(result.clients[0]).toMatchObject({
        appBundlePath: '/Applications/Claude.app',
      });
    });
  });

  describe('validateConfigFile', () => {
    it('should return true for valid JSON config', async () => {
      const mockAdapter = {
        detectConfigPath: vi.fn().mockReturnValue('/home/user/.claude.json'),
      };

      vi.mocked(mockAdapterRegistry.get).mockReturnValue(
        mockAdapter as unknown as ReturnType<AdapterRegistry['get']>,
      );
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue(
        '{"mcpServers": {}}',
      );

      // Call the public method that uses the private validateConfigFile
      const result = await clientsChecker.checkClients(
        {
          clients: [
            {
              client: 'claude-code' as ClientName,
              detection: {
                status: 'found',
                binaryPath: '/usr/bin/claude',
                version: '1.0.0',
                warnings: [],
              },
              source: 'native',
            },
          ],
        },
        'linux',
        null,
      );

      expect(result.clients[0].configValid).toBe(true);
    });

    it('should return false for non-existent config', async () => {
      const mockAdapter = {
        detectConfigPath: vi.fn().mockReturnValue('/home/user/.claude.json'),
      };

      vi.mocked(mockAdapterRegistry.get).mockReturnValue(
        mockAdapter as unknown as ReturnType<AdapterRegistry['get']>,
      );
      vi.mocked(mockFilesystem.exists).mockResolvedValue(false);

      const result = await clientsChecker.checkClients(
        {
          clients: [
            {
              client: 'claude-code' as ClientName,
              detection: {
                status: 'found',
                binaryPath: '/usr/bin/claude',
                version: '1.0.0',
                warnings: [],
              },
              source: 'native',
            },
          ],
        },
        'linux',
        null,
      );

      expect(result.clients[0].configValid).toBe(false);
    });

    it('should return false for invalid JSON', async () => {
      const mockAdapter = {
        detectConfigPath: vi.fn().mockReturnValue('/home/user/.claude.json'),
      };

      vi.mocked(mockAdapterRegistry.get).mockReturnValue(
        mockAdapter as unknown as ReturnType<AdapterRegistry['get']>,
      );
      vi.mocked(mockFilesystem.exists).mockResolvedValue(true);
      vi.mocked(mockFilesystem.readFile).mockResolvedValue('not valid json');

      const result = await clientsChecker.checkClients(
        {
          clients: [
            {
              client: 'claude-code' as ClientName,
              detection: {
                status: 'found',
                binaryPath: '/usr/bin/claude',
                version: '1.0.0',
                warnings: [],
              },
              source: 'native',
            },
          ],
        },
        'linux',
        null,
      );

      expect(result.clients[0].configValid).toBe(false);
    });
  });
});
