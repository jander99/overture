/**
 * @overture/formatters
 *
 * ClientsFormatter unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientsFormatter } from './clients-formatter.js';
import type { OutputPort } from '@overture/ports-output';
import type {
  ClientsCheckResult,
  ClientCheckResult,
} from '@overture/diagnostics-types';

describe('ClientsFormatter', () => {
  let output: OutputPort;
  let formatter: ClientsFormatter;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    output = {
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    formatter = new ClientsFormatter(output);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('formatClientResults', () => {
    it('should format empty client results', () => {
      const clientsResult: ClientsCheckResult = {
        clients: [],
        summary: {
          clientsDetected: 0,
          clientsMissing: 0,
          wsl2Detections: 0,
          configsValid: 0,
          configsInvalid: 0,
        },
      };

      formatter.formatClientResults(clientsResult, false);

      expect(output.info).toHaveBeenCalledWith(
        expect.stringContaining('Checking client installations'),
      );
    });

    it('should format found client with version', () => {
      const client: ClientCheckResult = {
        client: 'claude-code',
        status: 'found',
        binaryPath: '/usr/local/bin/claude-code',
        version: '1.0.0',
        configPath: '/home/user/.claude.json',
        configValid: true,
      };

      const clientsResult: ClientsCheckResult = {
        clients: [client],
        summary: {
          clientsDetected: 1,
          clientsMissing: 0,
          wsl2Detections: 0,
          configsValid: 1,
          configsInvalid: 0,
        },
      };

      formatter.formatClientResults(clientsResult, false);

      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('claude-code'),
      );
      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('1.0.0'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('.claude.json'),
      );
    });

    it('should format found client with WSL2 tag', () => {
      const client: ClientCheckResult = {
        client: 'opencode',
        status: 'found',
        binaryPath: '/mnt/c/Program Files/OpenCode/opencode.exe',
        version: '0.5.0',
        configPath: '/home/user/.config/opencode/opencode.json',
        configValid: true,
        source: 'wsl2-fallback',
        windowsPath: 'C:\\Program Files\\OpenCode\\opencode.exe',
      };

      const clientsResult: ClientsCheckResult = {
        clients: [client],
        summary: {
          clientsDetected: 1,
          clientsMissing: 0,
          wsl2Detections: 1,
          configsValid: 1,
          configsInvalid: 0,
        },
      };

      formatter.formatClientResults(clientsResult, false);

      expect(output.success).toHaveBeenCalledWith(
        expect.stringContaining('[WSL2: Windows]'),
      );
    });

    it('should format found client with warnings in verbose mode', () => {
      const client: ClientCheckResult = {
        client: 'copilot-cli',
        status: 'found',
        binaryPath: '/usr/local/bin/copilot',
        version: '2.0.0',
        configPath: '/home/user/.config/github-copilot/mcp.json',
        configValid: false,
        warnings: ['Config file has invalid JSON', 'Missing required field'],
      };

      const clientsResult: ClientsCheckResult = {
        clients: [client],
        summary: {
          clientsDetected: 1,
          clientsMissing: 0,
          wsl2Detections: 0,
          configsValid: 0,
          configsInvalid: 1,
        },
      };

      formatter.formatClientResults(clientsResult, true);

      expect(output.warn).toHaveBeenCalledWith(
        expect.stringContaining('Config file has invalid JSON'),
      );
      expect(output.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing required field'),
      );
    });

    it('should not format warnings in non-verbose mode', () => {
      const client: ClientCheckResult = {
        client: 'copilot-cli',
        status: 'found',
        binaryPath: '/usr/local/bin/copilot',
        configPath: '/home/user/.config/github-copilot/mcp.json',
        configValid: true,
        warnings: ['Some warning'],
      };

      const clientsResult: ClientsCheckResult = {
        clients: [client],
        summary: {
          clientsDetected: 1,
          clientsMissing: 0,
          wsl2Detections: 0,
          configsValid: 1,
          configsInvalid: 0,
        },
      };

      formatter.formatClientResults(clientsResult, false);

      expect(output.warn).not.toHaveBeenCalled();
    });

    it('should format missing client with recommendation', () => {
      const client: ClientCheckResult = {
        client: 'claude-code',
        status: 'not-found',
        configValid: false,
      };

      const clientsResult: ClientsCheckResult = {
        clients: [client],
        summary: {
          clientsDetected: 0,
          clientsMissing: 1,
          wsl2Detections: 0,
          configsValid: 0,
          configsInvalid: 0,
        },
      };

      formatter.formatClientResults(clientsResult, false);

      expect(output.error).toHaveBeenCalledWith(
        expect.stringContaining('not installed'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('claude.com'),
      );
    });

    it('should format skipped client', () => {
      const client: ClientCheckResult = {
        client: 'opencode',
        status: 'skipped',
        configValid: false,
      };

      const clientsResult: ClientsCheckResult = {
        clients: [client],
        summary: {
          clientsDetected: 0,
          clientsMissing: 0,
          wsl2Detections: 0,
          configsValid: 0,
          configsInvalid: 0,
        },
      };

      formatter.formatClientResults(clientsResult, false);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('skipped'),
      );
    });

    it('should format multiple clients', () => {
      const clientsResult: ClientsCheckResult = {
        clients: [
          {
            client: 'claude-code',
            status: 'found',
            binaryPath: '/usr/local/bin/claude-code',
            configValid: true,
          },
          {
            client: 'copilot-cli',
            status: 'not-found',
            configValid: false,
          },
          {
            client: 'opencode',
            status: 'skipped',
            configValid: false,
          },
        ],
        summary: {
          clientsDetected: 1,
          clientsMissing: 1,
          wsl2Detections: 0,
          configsValid: 1,
          configsInvalid: 0,
        },
      };

      formatter.formatClientResults(clientsResult, false);

      expect(output.success).toHaveBeenCalledTimes(1);
      expect(output.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('formatClientsSummary', () => {
    it('should format clients summary with all clients found', () => {
      formatter.formatClientsSummary(3, 3, 0, 0);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Clients detected:'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Clients missing:'),
      );
    });

    it('should format clients summary with missing clients', () => {
      formatter.formatClientsSummary(2, 3, 1, 0);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Clients missing:'),
      );
    });

    it('should format clients summary with WSL2 detections', () => {
      formatter.formatClientsSummary(2, 3, 1, 2);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('WSL2 detections:'),
      );
    });

    it('should not show WSL2 detections when zero', () => {
      formatter.formatClientsSummary(3, 3, 0, 0);

      const wsl2Calls = consoleSpy.mock.calls.filter((call: unknown[]) =>
        String(call[0]).includes('WSL2'),
      );
      expect(wsl2Calls.length).toBe(0);
    });
  });

  describe('formatConfigsSummary', () => {
    it('should format configs summary with all valid', () => {
      formatter.formatConfigsSummary(3, 0);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configs valid:'),
      );
    });

    it('should format configs summary with invalid configs', () => {
      formatter.formatConfigsSummary(2, 1);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configs invalid:'),
      );
    });

    it('should not show invalid configs when zero', () => {
      formatter.formatConfigsSummary(3, 0);

      const invalidCalls = consoleSpy.mock.calls.filter((call: unknown[]) =>
        String(call[0]).includes('invalid'),
      );
      expect(invalidCalls.length).toBe(0);
    });
  });
});
