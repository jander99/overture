import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { EnvironmentFormatter } from './environment-formatter.js';
import type { OutputPort } from '@overture/ports-output';
import type { EnvironmentCheckResult } from '@overture/diagnostics-types';

describe('EnvironmentFormatter', () => {
  let output: OutputPort;
  let formatter: EnvironmentFormatter;
  let consoleLogSpy: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    output = {
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    formatter = new EnvironmentFormatter(output);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('formatEnvironment', () => {
    it('should display WSL2 environment with distro name', () => {
      const environment: EnvironmentCheckResult = {
        platform: 'linux' as const,
        isWSL2: true,
        wsl2Info: {
          distroName: 'Ubuntu-22.04',
          windowsUserProfile: '/mnt/c/Users/testuser',
        },
      };

      formatter.formatEnvironment(environment);

      expect(output.info).toHaveBeenCalledWith(
        expect.stringContaining('Environment:'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('WSL2'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ubuntu-22.04'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Windows User:'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('/mnt/c/Users/testuser'),
      );
    });

    it('should display WSL2 environment without Windows user profile', () => {
      const environment: EnvironmentCheckResult = {
        platform: 'linux' as const,
        isWSL2: true,
        wsl2Info: {
          distroName: 'Debian',
        },
      };

      formatter.formatEnvironment(environment);

      expect(output.info).toHaveBeenCalledWith(
        expect.stringContaining('Environment:'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('WSL2'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Debian'),
      );
      // Should be called twice: platform line and empty line (no Windows User line)
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });

    it('should display "Unknown" when distro name is not available', () => {
      const environment: EnvironmentCheckResult = {
        platform: 'linux' as const,
        isWSL2: true,
        wsl2Info: {},
      };

      formatter.formatEnvironment(environment);

      expect(output.info).toHaveBeenCalledWith(
        expect.stringContaining('Environment:'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('WSL2'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown'),
      );
    });

    it('should display "Unknown" when wsl2Info is undefined', () => {
      const environment: EnvironmentCheckResult = {
        platform: 'linux' as const,
        isWSL2: true,
      };

      formatter.formatEnvironment(environment);

      expect(output.info).toHaveBeenCalledWith(
        expect.stringContaining('Environment:'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown'),
      );
    });

    it('should not display anything for non-WSL2 environment', () => {
      const environment: EnvironmentCheckResult = {
        platform: 'linux' as const,
        isWSL2: false,
      };

      formatter.formatEnvironment(environment);

      expect(output.info).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not display anything for macOS environment', () => {
      const environment: EnvironmentCheckResult = {
        platform: 'darwin' as const,
        isWSL2: false,
      };

      formatter.formatEnvironment(environment);

      expect(output.info).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not display anything for Windows environment', () => {
      const environment: EnvironmentCheckResult = {
        platform: 'win32' as const,
        isWSL2: false,
      };

      formatter.formatEnvironment(environment);

      expect(output.info).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });
});
