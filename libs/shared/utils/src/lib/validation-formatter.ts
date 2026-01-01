/**
 * Configuration Validation Error Formatter
 *
 * Transforms Zod validation errors into user-friendly messages with:
 * - Clear error descriptions
 * - JSON path highlighting (e.g., mcp.github.transport)
 * - Actionable suggestions for common errors
 * - Validation summary with error/warning counts
 *
 * @module @overture/utils/validation-formatter
 */

import type { ZodIssue } from 'zod';
import chalk from 'chalk';

/**
 * Categorized validation error
 */
export interface ValidationError {
  path: string;
  message: string;
  suggestion?: string;
  type:
    | 'required'
    | 'invalid_type'
    | 'invalid_enum'
    | 'unrecognized_keys'
    | 'custom'
    | 'other';
}

/**
 * Validation summary result
 */
export interface ValidationSummary {
  errors: ValidationError[];
  warnings: ValidationError[];
  passed: string[];
  totalErrors: number;
  totalWarnings: number;
  isValid: boolean;
}

/**
 * Format a JSON path from Zod issue
 */
function formatPath(path: PropertyKey[]): string {
  if (path.length === 0) return 'config';
  return path.map((p) => String(p)).join('.');
}

/**
 * Generate a suggestion based on error type and path
 */
function generateSuggestion(issue: ZodIssue): string | undefined {
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- Default case handles all other Zod error codes
  switch (issue.code) {
    case 'invalid_type':
      return handleInvalidTypeSuggestion(issue);
    case 'too_small':
      return handleTooSmallSuggestion(issue);
    case 'unrecognized_keys':
      return handleUnrecognizedKeysSuggestion(issue);
    case 'custom':
      return undefined;
    default:
      return handleEnumSuggestion(issue);
  }
}

function handleInvalidTypeSuggestion(issue: ZodIssue): string | undefined {
  if (issue.code !== 'invalid_type') return undefined;

  if (
    issue.expected === 'string' &&
    'received' in issue &&
    (issue as unknown as Record<string, unknown>).received === 'undefined'
  ) {
    return `Add missing field to configuration`;
  }
  if (issue.expected === 'array') {
    return `Change to array format: []`;
  }
  const received =
    'received' in issue
      ? (issue as unknown as Record<string, unknown>).received
      : 'unknown';
  return `Change type from ${received} to ${issue.expected}`;
}

function handleTooSmallSuggestion(issue: ZodIssue): string | undefined {
  if ('minimum' in issue && issue.minimum === 1) {
    return `Provide a non-empty value`;
  }
  return undefined;
}

function handleUnrecognizedKeysSuggestion(issue: ZodIssue): string | undefined {
  if (!('keys' in issue)) return undefined;

  const keys = issue.keys as string[];
  if (keys.includes('scope')) {
    return `Remove deprecated 'scope' field (scope is now implicit based on file location)`;
  }
  return `Remove unknown ${keys.length === 1 ? 'field' : 'fields'}: ${keys.join(', ')}`;
}

function handleEnumSuggestion(issue: ZodIssue): string | undefined {
  if ('options' in issue) {
    const validOptions =
      (issue as unknown as Record<string, unknown>).options || [];
    return `Use one of: ${(validOptions as string[]).join(', ')}`;
  }
  return undefined;
}

/**
 * Categorize Zod issue into error type
 */
function categorizeIssue(issue: ZodIssue): ValidationError['type'] {
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- Default case handles all other Zod error codes
  switch (issue.code) {
    case 'invalid_type':
      if ('received' in issue && issue.received === 'undefined') {
        return 'required';
      }
      return 'invalid_type';

    case 'unrecognized_keys':
      return 'unrecognized_keys';

    case 'custom':
      return 'custom';

    default:
      // Handle enum-related errors by checking for 'options' property
      if ('options' in issue || 'expected' in issue) {
        return 'invalid_enum';
      }
      return 'other';
  }
}

/**
 * Convert Zod issues to structured validation errors
 */
export function parseZodErrors(issues: ZodIssue[]): ValidationError[] {
  return issues.map((issue) => ({
    path: formatPath(issue.path),
    message: issue.message,
    suggestion: generateSuggestion(issue),
    type: categorizeIssue(issue),
  }));
}

/**
 * Format a single validation error for display
 */
export function formatError(error: ValidationError): string {
  const icon = chalk.red('\u2717');
  const pathFormatted = chalk.cyan(error.path);
  const message = error.message;

  let output = `  ${icon} ${pathFormatted} - ${message}`;

  if (error.suggestion) {
    output += `\n    ${chalk.gray('\u2192')} ${error.suggestion}`;
  }

  return output;
}

/**
 * Format multiple validation errors for display
 */
export function formatErrors(
  errors: ValidationError[],
  title = 'Schema Errors',
): string {
  if (errors.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.red(`${title} (${errors.length}):`));
  errors.forEach((error) => {
    lines.push(formatError(error));
  });

  return lines.join('\n');
}

/**
 * Format validation summary with counts
 */
export function formatValidationSummary(summary: ValidationSummary): string {
  const lines: string[] = [];

  // Header
  lines.push(...formatSummaryHeader(summary.isValid));

  // Errors
  if (summary.errors.length > 0) {
    lines.push(formatErrors(summary.errors));
  }

  // Warnings
  if (summary.warnings.length > 0) {
    lines.push(...formatWarnings(summary.warnings));
  }

  // Summary line
  lines.push('');
  lines.push(formatSummaryLine(summary));

  return lines.join('\n');
}

function formatSummaryHeader(isValid: boolean): string[] {
  if (isValid) {
    return ['', chalk.green('\u2713 Configuration is valid'), ''];
  }
  return ['', chalk.red('\u2717 Configuration validation failed')];
}

function formatWarnings(warnings: ValidationError[]): string[] {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.yellow(`Warnings (${warnings.length}):`));
  warnings.forEach((warning) => {
    const icon = chalk.yellow('\u26A0');
    lines.push(`  ${icon} ${chalk.cyan(warning.path)} - ${warning.message}`);
    if (warning.suggestion) {
      lines.push(`    ${chalk.gray('\u2192')} ${warning.suggestion}`);
    }
  });
  return lines;
}

function formatSummaryLine(summary: ValidationSummary): string {
  if (summary.isValid && summary.totalWarnings === 0) {
    return chalk.green(`Summary: No errors or warnings`);
  }
  if (summary.isValid && summary.totalWarnings > 0) {
    return chalk.yellow(
      `Summary: ${summary.totalWarnings} ${summary.totalWarnings === 1 ? 'warning' : 'warnings'}`,
    );
  }
  const parts: string[] = [];
  if (summary.totalErrors > 0) {
    parts.push(
      chalk.red(
        `${summary.totalErrors} ${summary.totalErrors === 1 ? 'error' : 'errors'}`,
      ),
    );
  }
  if (summary.totalWarnings > 0) {
    parts.push(
      chalk.yellow(
        `${summary.totalWarnings} ${summary.totalWarnings === 1 ? 'warning' : 'warnings'}`,
      ),
    );
  }
  return `Summary: ${parts.join(', ')}`;
}

/**
 * Create validation summary from errors and warnings
 */
export function createValidationSummary(
  errors: ValidationError[],
  warnings: ValidationError[] = [],
  passed: string[] = [],
): ValidationSummary {
  return {
    errors,
    warnings,
    passed,
    totalErrors: errors.length,
    totalWarnings: warnings.length,
    isValid: errors.length === 0,
  };
}

/**
 * Format comprehensive validation report with sections
 */
export interface ValidationReport {
  sections: Array<{
    title: string;
    passed: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
  }>;
}

export function formatValidationReport(report: ValidationReport): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold('Configuration Validation Results'));
  lines.push(chalk.gray('\u2501'.repeat(50)));

  for (const section of report.sections) {
    lines.push(...formatReportSection(section));
  }

  lines.push('');
  lines.push(chalk.gray('\u2501'.repeat(50)));
  lines.push(formatOverallSummary(report));
  lines.push('');

  return lines.join('\n');
}

function formatReportSection(
  section: ValidationReport['sections'][0],
): string[] {
  const lines: string[] = [];
  lines.push('');

  const icon = getSectionIcon(section);
  const title = formatSectionTitle(icon, section);
  lines.push(title);

  // Show errors
  section.errors.forEach((error) => {
    lines.push(formatError(error));
  });

  // Show warnings
  section.warnings.forEach((warning) => {
    const warnIcon = chalk.yellow('\u26A0');
    lines.push(
      `  ${warnIcon} ${chalk.cyan(warning.path)} - ${warning.message}`,
    );
    if (warning.suggestion) {
      lines.push(`    ${chalk.gray('\u2192')} ${warning.suggestion}`);
    }
  });

  return lines;
}

function getSectionIcon(section: ValidationReport['sections'][0]): string {
  if (section.passed && section.warnings.length === 0) {
    return chalk.green('\u2713');
  }
  if (section.errors.length > 0) {
    return chalk.red('\u2717');
  }
  return chalk.yellow('\u26A0');
}

function formatSectionTitle(
  icon: string,
  section: ValidationReport['sections'][0],
): string {
  let title = `${icon} ${section.title}`;
  if (section.errors.length > 0) {
    title += chalk.red(
      ` (${section.errors.length} ${section.errors.length === 1 ? 'error' : 'errors'})`,
    );
  }
  if (section.warnings.length > 0) {
    title += chalk.yellow(
      ` (${section.warnings.length} ${section.warnings.length === 1 ? 'warning' : 'warnings'})`,
    );
  }
  return title;
}

function formatOverallSummary(report: ValidationReport): string {
  const totalErrors = report.sections.reduce(
    (sum, s) => sum + s.errors.length,
    0,
  );
  const totalWarnings = report.sections.reduce(
    (sum, s) => sum + s.warnings.length,
    0,
  );

  if (totalErrors === 0 && totalWarnings === 0) {
    return chalk.green('Summary: \u2713 All validations passed');
  }

  const parts: string[] = [];
  if (totalErrors > 0) {
    parts.push(
      chalk.red(
        `\u2717 ${totalErrors} ${totalErrors === 1 ? 'error' : 'errors'}`,
      ),
    );
  }
  if (totalWarnings > 0) {
    parts.push(
      chalk.yellow(
        `\u26A0 ${totalWarnings} ${totalWarnings === 1 ? 'warning' : 'warnings'}`,
      ),
    );
  }
  return `Summary: ${parts.join(', ')}`;
}
