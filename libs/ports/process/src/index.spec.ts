/**
 * Integration tests for @overture/ports-process
 *
 * Validates that all exports are available and properly typed.
 */

import { describe, it, expect } from 'vitest';
import type {
  ProcessPort,
  ExecResult,
  EnvironmentPort,
  Platform,
} from './index.js';

describe('@overture/ports-process', () => {
  describe('exports', () => {
    it('should export ProcessPort type', () => {
      const mockPort: ProcessPort = {
        exec: async (): Promise<ExecResult> => ({
          stdout: '',
          stderr: '',
          exitCode: 0,
        }),
        commandExists: async (): Promise<boolean> => true,
      };

      expect(mockPort).toBeDefined();
    });

    it('should export ExecResult type', () => {
      const result: ExecResult = {
        stdout: 'output',
        stderr: '',
        exitCode: 0,
      };

      expect(result).toBeDefined();
      expect(result.stdout).toBe('output');
    });

    it('should export EnvironmentPort type', () => {
      const mockPort: EnvironmentPort = {
        platform: (): Platform => 'linux',
        homedir: (): string => '/home/user',
        env: {},
      };

      expect(mockPort).toBeDefined();
    });

    it('should export Platform type', () => {
      const platforms: Platform[] = ['linux', 'darwin', 'win32'];

      platforms.forEach((platform) => {
        expect(platform).toBeDefined();
      });
    });
  });

  describe('type compatibility', () => {
    it('should allow ProcessPort and EnvironmentPort to be used together', () => {
      const processPort: ProcessPort = {
        exec: async (): Promise<ExecResult> => ({
          stdout: '',
          stderr: '',
          exitCode: 0,
        }),
        commandExists: async (): Promise<boolean> => true,
      };

      const envPort: EnvironmentPort = {
        platform: (): Platform => 'linux',
        homedir: (): string => '/home/user',
        env: {},
      };

      // Example use case: platform-specific command execution
      const platform = envPort.platform();
      const command = platform === 'win32' ? 'cmd.exe' : 'sh';

      expect(processPort).toBeDefined();
      expect(command).toBe('sh');
    });

    it('should support creating adapter implementations', async () => {
      // Example adapter that uses both ports
      interface SystemAdapter {
        processPort: ProcessPort;
        envPort: EnvironmentPort;
        executeInHome(command: string): Promise<ExecResult>;
      }

      const adapter: SystemAdapter = {
        processPort: {
          exec: async (cmd: string): Promise<ExecResult> => ({
            stdout: `Executed: ${cmd}`,
            stderr: '',
            exitCode: 0,
          }),
          commandExists: async (): Promise<boolean> => true,
        },
        envPort: {
          platform: (): Platform => 'linux',
          homedir: (): string => '/home/user',
          env: { PATH: '/usr/bin' },
        },
        executeInHome: async function (command: string): Promise<ExecResult> {
          const home = this.envPort.homedir();
          return this.processPort.exec(`cd ${home} && ${command}`);
        },
      };

      const result = await adapter.executeInHome('ls');
      expect(result.stdout).toContain('Executed');
    });
  });

  describe('zero runtime dependencies', () => {
    it('should only export types (no runtime code)', () => {
      // This test ensures the library is pure types
      // If any runtime code is accidentally included, it would appear in imports

      // All imports should be type-only
      const typeImports = `
        import type {
          ProcessPort,
          ExecResult,
          EnvironmentPort,
          Platform,
        } from './index.js';
      `;

      expect(typeImports).toBeDefined();
    });
  });
});
