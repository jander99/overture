/**
 * @overture/formatters
 *
 * ClientsFormatter - Formats client installation detection results
 *
 * Responsibilities:
 * - Format client detection results with colors and status indicators
 * - Display client versions, paths, and configurations
 * - Show warnings and recommendations for missing clients
 * - Handle WSL2 detection display
 */

import type { OutputPort } from '@overture/ports-output';
import type {
  ClientsCheckResult,
  ClientCheckResult,
} from '@overture/diagnostics-types';
import type { ClientName } from '@overture/config-types';
import chalk from 'chalk';
import { getInstallRecommendation } from '../helpers/recommendations.js';

/**
 * ClientsFormatter - Formats client detection results for display
 */
export class ClientsFormatter {
  constructor(private readonly output: OutputPort) {}

  /**
   * Format and output client detection results
   */
  formatClientResults(
    clientsResult: ClientsCheckResult,
    verbose: boolean,
  ): void {
    this.output.info(chalk.bold('Checking client installations...\n'));

    for (const client of clientsResult.clients) {
      this.formatSingleClient(client, verbose);
      console.log(''); // Blank line between clients
    }
  }

  /**
   * Format a single client result
   */
  private formatSingleClient(
    client: ClientCheckResult,
    verbose: boolean,
  ): void {
    switch (client.status) {
      case 'found':
        this.formatFoundClient(client, verbose);
        break;
      case 'not-found':
        this.formatMissingClient(client);
        break;
      case 'skipped':
        this.formatSkippedClient(client);
        break;
    }
  }

  /**
   * Format a found client
   */
  private formatFoundClient(client: ClientCheckResult, verbose: boolean): void {
    const versionStr = client.version ? chalk.dim(` (${client.version})`) : '';
    const pathStr = client.binaryPath || client.appBundlePath || '';
    const wsl2Tag =
      client.source === 'wsl2-fallback' ? chalk.cyan(' [WSL2: Windows]') : '';

    this.output.success(
      `${chalk.green('✓')} ${chalk.bold(client.client)}${versionStr}${wsl2Tag} - ${chalk.dim(pathStr)}`,
    );

    this.formatClientConfig(client);
    this.formatWindowsPath(client, verbose);
    this.formatClientWarnings(client, verbose);
  }

  /**
   * Format client configuration status
   */
  private formatClientConfig(client: ClientCheckResult): void {
    if (client.configPath) {
      const configStatus = client.configValid
        ? chalk.green('valid')
        : chalk.yellow('invalid');
      console.log(`  Config: ${client.configPath} (${configStatus})`);
    }
  }

  /**
   * Format Windows path for WSL2 detections
   */
  private formatWindowsPath(client: ClientCheckResult, verbose: boolean): void {
    if (client.windowsPath && verbose) {
      console.log(
        `  ${chalk.dim('Windows path:')} ${chalk.dim(client.windowsPath)}`,
      );
    }
  }

  /**
   * Format client warnings
   */
  private formatClientWarnings(
    client: ClientCheckResult,
    verbose: boolean,
  ): void {
    if (client.warnings && client.warnings.length > 0 && verbose) {
      client.warnings.forEach((warning) => {
        this.output.warn(`  ${chalk.yellow('⚠')} ${warning}`);
      });
    }
  }

  /**
   * Format a missing client
   */
  private formatMissingClient(client: ClientCheckResult): void {
    this.output.error(
      `${chalk.red('✗')} ${chalk.bold(client.client)} - not installed`,
    );

    const recommendation = getInstallRecommendation(
      client.client as ClientName,
    );
    if (recommendation) {
      console.log(`  ${chalk.dim('→')} ${chalk.dim(recommendation)}`);
    }
  }

  /**
   * Format a skipped client
   */
  private formatSkippedClient(client: ClientCheckResult): void {
    console.log(
      `${chalk.gray('○')} ${chalk.bold(client.client)} - ${chalk.dim('skipped')}`,
    );
  }

  /**
   * Format clients summary section
   */
  formatClientsSummary(
    clientsDetected: number,
    totalClients: number,
    clientsMissing: number,
    wsl2Detections: number,
  ): void {
    console.log(
      `  Clients detected: ${chalk.green(clientsDetected)} / ${totalClients}`,
    );
    console.log(`  Clients missing:  ${chalk.red(clientsMissing)}`);

    if (wsl2Detections > 0) {
      console.log(`  WSL2 detections:  ${chalk.cyan(wsl2Detections)}`);
    }
  }

  /**
   * Format configs summary section
   */
  formatConfigsSummary(configsValid: number, configsInvalid: number): void {
    console.log(`  Configs valid:    ${chalk.green(configsValid)}`);
    if (configsInvalid > 0) {
      console.log(`  Configs invalid:  ${chalk.yellow(configsInvalid)}`);
    }
  }
}
