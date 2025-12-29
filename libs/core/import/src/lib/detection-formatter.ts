/**
 * Detection Formatter
 *
 * Formats detection results in various output formats (text, JSON, table).
 *
 * @module @overture/import-core/detection-formatter
 */

import type {
  DetectionResult,
  ManagedMcpDetection,
} from '@overture/config-types';
import { formatConflict } from './conflict-detector.js';

/**
 * Formatter for detection results
 */
export class DetectionFormatter {
  /**
   * Format detection results as human-readable text
   */
  formatText(result: DetectionResult, verbose = false): string {
    const lines: string[] = [];

    // Header
    this.addHeader(lines);

    // Client Status
    this.addClientStatus(result, verbose, lines);

    // Separator
    lines.push('━'.repeat(60));
    lines.push('');

    // Parse Errors
    this.addParseErrors(result, lines);

    // Managed MCPs
    this.addManagedMcps(result, lines);

    // Unmanaged MCPs
    this.addUnmanagedMcps(result, verbose, lines);

    // Conflicts
    this.addConflicts(result, lines);

    // Separator
    lines.push('━'.repeat(60));
    lines.push('');

    // Summary
    this.addSummary(result, lines);

    // Next steps
    this.addNextSteps(result, lines);

    return lines.join('\n');
  }

  /**
   * Add header section
   */
  private addHeader(lines: string[]): void {
    lines.push('🔍 Detecting MCP Configurations');
    lines.push('');
  }

  /**
   * Add client status section
   */
  private addClientStatus(
    result: DetectionResult,
    verbose: boolean,
    lines: string[],
  ): void {
    lines.push('Scanning clients...');
    for (const client of result.clients) {
      const icon = client.detected ? '✓' : '⊘';
      const version = client.version ? ` (v${client.version})` : '';
      const status = client.detected ? '' : ' (not detected)';
      lines.push(`${icon} ${client.name}${version}${status}`);

      if (verbose) {
        this.addClientConfigPaths(client.configPaths, lines);
      }
    }
    lines.push('');
  }

  /**
   * Add client config paths (verbose mode)
   */
  private addClientConfigPaths(
    configPaths: Array<{
      path: string;
      parseStatus: string;
    }>,
    lines: string[],
  ): void {
    for (const configPath of configPaths) {
      const statusIcon =
        configPath.parseStatus === 'valid'
          ? '✓'
          : configPath.parseStatus === 'not-found'
            ? '⊘'
            : '❌';
      const statusText =
        configPath.parseStatus === 'valid'
          ? 'exists, readable'
          : configPath.parseStatus === 'not-found'
            ? 'not found'
            : 'parse error';
      lines.push(
        `  • Config: ${this.shortenPath(configPath.path)} ${statusIcon} ${statusText}`,
      );
    }
  }

  /**
   * Add parse errors section
   */
  private addParseErrors(result: DetectionResult, lines: string[]): void {
    if (result.mcps.parseErrors.length === 0) return;

    lines.push(`❌ Parse Errors (${result.mcps.parseErrors.length}):`);
    for (const error of result.mcps.parseErrors) {
      const location = error.error.line ? ` at line ${error.error.line}` : '';
      lines.push(`  • ${error.client}: ${this.shortenPath(error.configPath)}`);
      lines.push(`    └─ Error${location}: ${error.error.message}`);
      lines.push(`    └─ Fix the syntax error before importing`);
    }
    lines.push('');
  }

  /**
   * Add managed MCPs section
   */
  private addManagedMcps(result: DetectionResult, lines: string[]): void {
    if (result.mcps.managed.length === 0) return;

    lines.push(`✓ Managed by Overture (${result.mcps.managed.length}):`);
    for (const mcp of result.mcps.managed) {
      const sources = mcp.sources.map((s) => s.client).join(', ');
      const scopeInfo = this.getMcpScopeInfo(mcp);
      lines.push(`  • ${mcp.name} (${sources})${scopeInfo}`);
    }
    lines.push('');
  }

  /**
   * Add unmanaged MCPs section
   */
  private addUnmanagedMcps(
    result: DetectionResult,
    verbose: boolean,
    lines: string[],
  ): void {
    if (result.mcps.unmanaged.length === 0) return;

    lines.push(`⚠ Unmanaged (${result.mcps.unmanaged.length}):`);
    for (const mcp of result.mcps.unmanaged) {
      const location = this.shortenPath(mcp.source.filePath);
      lines.push(`  • ${mcp.name} (${mcp.source.client}: ${location})`);

      if (verbose) {
        this.addUnmanagedMcpDetails(mcp, lines);
      }
    }
    lines.push('');
  }

  /**
   * Add unmanaged MCP details (verbose mode)
   */
  private addUnmanagedMcpDetails(
    mcp: {
      command: string;
      args: string[];
      env?: Record<string, string>;
      transport?: string;
      suggestedScope: string;
      envVarsToSet?: string[];
    },
    lines: string[],
  ): void {
    lines.push(`    └─ Command: ${mcp.command}`);
    lines.push(`    └─ Args: ${JSON.stringify(mcp.args)}`);
    if (mcp.env && Object.keys(mcp.env).length > 0) {
      const envStr = JSON.stringify(mcp.env);
      const maskedEnv = this.maskSecrets(envStr);
      lines.push(`    └─ Env: ${maskedEnv}`);
    }
    lines.push(`    └─ Transport: ${mcp.transport || 'stdio'}`);
    lines.push(`    └─ Suggested scope: ${mcp.suggestedScope}`);
    if (mcp.envVarsToSet && mcp.envVarsToSet.length > 0) {
      lines.push(
        `    └─ Warning: Environment variable(s) must be set: ${mcp.envVarsToSet.join(', ')}`,
      );
    }
  }

  /**
   * Add conflicts section
   */
  private addConflicts(result: DetectionResult, lines: string[]): void {
    if (result.mcps.conflicts.length === 0) return;

    lines.push(`⚠️  Conflicts (${result.mcps.conflicts.length}):`);
    for (const conflict of result.mcps.conflicts) {
      const formatted = formatConflict(conflict);
      const indented = formatted
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n');
      lines.push(indented);
    }
    lines.push('');
  }

  /**
   * Add summary section
   */
  private addSummary(result: DetectionResult, lines: string[]): void {
    lines.push('📊 Summary:');
    lines.push(`  Clients scanned:      ${result.summary.clientsScanned}`);
    if (result.summary.totalMcps > 0) {
      lines.push(`  Total MCPs found:     ${result.summary.totalMcps}`);
      lines.push(`  Managed by Overture:  ${result.summary.managed}`);
      lines.push(`  Available to import:  ${result.summary.unmanaged}`);
    }
    if (result.summary.conflicts > 0) {
      lines.push(`  Conflicts:            ${result.summary.conflicts}`);
    }
    if (result.summary.parseErrors > 0) {
      lines.push(`  Parse errors:         ${result.summary.parseErrors}`);
    }
    lines.push('');
  }

  /**
   * Add next steps section
   */
  private addNextSteps(result: DetectionResult, lines: string[]): void {
    if (result.summary.parseErrors > 0) {
      lines.push('⚠️  Fix parse errors before running import');
    } else if (result.summary.unmanaged > 0) {
      lines.push('💡 Next steps:');
      lines.push(
        `  • Run 'overture import' to import ${result.summary.unmanaged} unmanaged MCP(s)`,
      );
    } else if (
      result.summary.managed > 0 &&
      result.summary.unmanaged === 0 &&
      result.summary.conflicts === 0
    ) {
      lines.push('✅ All MCPs are already managed by Overture');
    } else if (result.summary.totalMcps === 0) {
      lines.push('ℹ️  No MCPs found in client configurations');
    }
  }

  /**
   * Format detection results as JSON
   */
  formatJson(result: DetectionResult): string {
    return JSON.stringify(result, null, 2);
  }

  /**
   * Format detection results as ASCII table
   */
  formatTable(result: DetectionResult): string {
    const lines: string[] = [];

    // Table header
    const border = '┼';
    const topLeft = '┌';
    const topRight = '┐';
    const bottomLeft = '└';
    const bottomRight = '┘';
    const horizontal = '─';
    const vertical = '│';

    const cols = {
      name: 17,
      status: 15,
      source: 41,
      parse: 14,
    };

    // Top border
    lines.push(
      `${topLeft}${horizontal.repeat(cols.name)}${border}${horizontal.repeat(cols.status)}${border}${horizontal.repeat(cols.source)}${border}${horizontal.repeat(cols.parse)}${topRight}`,
    );

    // Header row
    lines.push(
      `${vertical} ${'MCP Name'.padEnd(cols.name - 2)} ${vertical} ${'Status'.padEnd(cols.status - 2)} ${vertical} ${'Source'.padEnd(cols.source - 2)} ${vertical} ${'Parse Status'.padEnd(cols.parse - 2)} ${vertical}`,
    );

    // Header separator
    lines.push(
      `${vertical}${horizontal.repeat(cols.name)}${border}${horizontal.repeat(cols.status)}${border}${horizontal.repeat(cols.source)}${border}${horizontal.repeat(cols.parse)}${vertical}`,
    );

    // Managed MCPs
    for (const mcp of result.mcps.managed) {
      const name = this.truncate(mcp.name, cols.name - 2);
      const status = '✓ Managed';
      const sources =
        mcp.sources.length > 1
          ? `${mcp.sources[0].client} +${mcp.sources.length - 1}`
          : mcp.sources[0].client;
      const source = this.truncate(sources, cols.source - 2);
      const parseStatus = '✓ Valid';

      lines.push(
        `${vertical} ${name.padEnd(cols.name - 2)} ${vertical} ${status.padEnd(cols.status - 2)} ${vertical} ${source.padEnd(cols.source - 2)} ${vertical} ${parseStatus.padEnd(cols.parse - 2)} ${vertical}`,
      );
    }

    // Unmanaged MCPs
    for (const mcp of result.mcps.unmanaged) {
      const name = this.truncate(mcp.name, cols.name - 2);
      const status = '⚠ Unmanaged';
      const source = this.truncate(
        `${mcp.source.client}: ${this.shortenPath(mcp.source.filePath)}`,
        cols.source - 2,
      );
      const parseStatus = '✓ Valid';

      lines.push(
        `${vertical} ${name.padEnd(cols.name - 2)} ${vertical} ${status.padEnd(cols.status - 2)} ${vertical} ${source.padEnd(cols.source - 2)} ${vertical} ${parseStatus.padEnd(cols.parse - 2)} ${vertical}`,
      );
    }

    // Conflicts
    for (const conflict of result.mcps.conflicts) {
      const name = this.truncate(conflict.name, cols.name - 2);
      const status = '⚠ Conflict';
      const source = this.truncate(
        `${conflict.sources.length} sources (${conflict.reason})`,
        cols.source - 2,
      );
      const parseStatus = '✓ Valid';

      lines.push(
        `${vertical} ${name.padEnd(cols.name - 2)} ${vertical} ${status.padEnd(cols.status - 2)} ${vertical} ${source.padEnd(cols.source - 2)} ${vertical} ${parseStatus.padEnd(cols.parse - 2)} ${vertical}`,
      );
    }

    // Parse errors
    for (const error of result.mcps.parseErrors) {
      const name = this.truncate('(parse error)', cols.name - 2);
      const status = '❌ Error';
      const source = this.truncate(
        `${error.client}: ${this.shortenPath(error.configPath)}`,
        cols.source - 2,
      );
      const parseStatus = '❌ Parse err';

      lines.push(
        `${vertical} ${name.padEnd(cols.name - 2)} ${vertical} ${status.padEnd(cols.status - 2)} ${vertical} ${source.padEnd(cols.source - 2)} ${vertical} ${parseStatus.padEnd(cols.parse - 2)} ${vertical}`,
      );
    }

    // Bottom border
    lines.push(
      `${bottomLeft}${horizontal.repeat(cols.name)}${border}${horizontal.repeat(cols.status)}${border}${horizontal.repeat(cols.source)}${border}${horizontal.repeat(cols.parse)}${bottomRight}`,
    );

    lines.push('');
    lines.push(
      `Summary: ${result.summary.totalMcps} MCPs (${result.summary.managed} managed, ${result.summary.unmanaged} unmanaged, ${result.summary.conflicts} conflicts, ${result.summary.parseErrors} errors)`,
    );

    return lines.join('\n');
  }

  /**
   * Shorten file path for display
   */
  private shortenPath(path: string): string {
    return path.replace(process.env.HOME || '', '~');
  }

  /**
   * Truncate string to max length
   */
  private truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 3) + '...';
  }

  /**
   * Get MCP scope information
   */
  private getMcpScopeInfo(mcp: ManagedMcpDetection): string {
    const hasProject = mcp.sources.some(
      (s) =>
        s.locationType === 'project' || s.locationType === 'directory-override',
    );
    return hasProject ? ' [project]' : '';
  }

  /**
   * Mask secrets in string
   */
  private maskSecrets(str: string): string {
    // Mask common secret patterns
    return str
      .replace(
        /"(sk-[A-Za-z0-9]{20,})"/g,
        (_, key) =>
          `"${key.substring(0, 8)}...${key.substring(key.length - 4)}"`,
      )
      .replace(
        /"(ghp_[A-Za-z0-9]{36})"/g,
        (_, key) =>
          `"${key.substring(0, 8)}...${key.substring(key.length - 4)}"`,
      )
      .replace(
        /"(xoxb-[A-Za-z0-9-]{50,})"/g,
        (_, key) =>
          `"${key.substring(0, 10)}...${key.substring(key.length - 4)}"`,
      );
  }
}
