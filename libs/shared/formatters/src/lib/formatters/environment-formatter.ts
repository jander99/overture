import type { OutputPort } from '@overture/ports-output';
import type { EnvironmentCheckResult } from '@overture/diagnostics-types';
import chalk from 'chalk';

/**
 * EnvironmentFormatter - Formats environment information
 *
 * Displays platform information, with special handling for WSL2 environments.
 * Uses OutputPort for structured output and chalk for colored terminal output.
 */
export class EnvironmentFormatter {
  constructor(private readonly output: OutputPort) {}

  /**
   * Format and output environment information
   *
   * When running on WSL2, displays:
   * - Platform as "WSL2" with distro name
   * - Windows user profile path (if available)
   *
   * For non-WSL2 environments, no output is generated.
   *
   * @param environment - Environment check result from diagnostics
   */
  formatEnvironment(environment: EnvironmentCheckResult): void {
    if (environment.isWSL2) {
      this.output.info(chalk.bold('\nEnvironment:\n'));
      console.log(
        `  Platform: ${chalk.cyan('WSL2')} (${environment.wsl2Info?.distroName || 'Unknown'})`,
      );
      if (environment.wsl2Info?.windowsUserProfile) {
        console.log(
          `  Windows User: ${chalk.dim(environment.wsl2Info.windowsUserProfile)}`,
        );
      }
      console.log('');
    }
  }
}
