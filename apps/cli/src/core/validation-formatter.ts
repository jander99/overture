/**
 * Configuration Validation Error Formatter
 *
 * Transforms Zod validation errors into user-friendly messages with:
 * - Clear error descriptions
 * - JSON path highlighting (e.g., mcp.github.transport)
 * - Actionable suggestions for common errors
 * - Validation summary with error/warning counts
 *
 * @module core/validation-formatter
 */

import { ZodIssue } from 'zod';
import chalk from 'chalk';

/**
 * Categorized validation error
 */
export interface ValidationError {
  path: string;
  message: string;
  suggestion?: string;
  type: 'required' | 'invalid_type' | 'invalid_enum' | 'unrecognized_keys' | 'custom' | 'other';
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
function formatPath(path: (string | number)[]): string {
  if (path.length === 0) return 'config';
  return path.join('.');
}

/**
 * Generate a suggestion based on error type and path
 */
function generateSuggestion(issue: ZodIssue): string | undefined {
  const path = formatPath(issue.path);

  switch (issue.code) {
    case 'invalid_type':
      if (issue.expected === 'string' && issue.received === 'undefined') {
        return `Add missing field to configuration`;
      }
      if (issue.expected === 'array') {
        return `Change to array format: []`;
      }
      return `Change type from ${issue.received} to ${issue.expected}`;

    case 'invalid_enum_value':
      const validOptions = 'options' in issue ? issue.options : [];
      return `Use one of: ${validOptions.join(', ')}`;

    case 'too_small':
      if (issue.type === 'string' && 'minimum' in issue && issue.minimum === 1) {
        return `Provide a non-empty value`;
      }
      return undefined;

    case 'unrecognized_keys':
      const keys = 'keys' in issue ? issue.keys : [];
      if (keys.includes('scope')) {
        return `Remove deprecated 'scope' field (scope is now implicit based on file location)`;
      }
      return `Remove unknown ${keys.length === 1 ? 'field' : 'fields'}: ${keys.join(', ')}`;

    case 'custom':
      return undefined;

    default:
      return undefined;
  }
}

/**
 * Categorize Zod issue into error type
 */
function categorizeIssue(issue: ZodIssue): ValidationError['type'] {
  switch (issue.code) {
    case 'invalid_type':
      if ('received' in issue && issue.received === 'undefined') {
        return 'required';
      }
      return 'invalid_type';

    case 'invalid_enum_value':
    case 'invalid_literal':
      return 'invalid_enum';

    case 'unrecognized_keys':
      return 'unrecognized_keys';

    case 'custom':
      return 'custom';

    default:
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
  const icon = chalk.red('✗');
  const pathFormatted = chalk.cyan(error.path);
  const message = error.message;

  let output = `  ${icon} ${pathFormatted} - ${message}`;

  if (error.suggestion) {
    output += `\n    ${chalk.gray('→')} ${error.suggestion}`;
  }

  return output;
}

/**
 * Format multiple validation errors for display
 */
export function formatErrors(errors: ValidationError[], title = 'Schema Errors'): string {
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
  if (summary.isValid) {
    lines.push('');
    lines.push(chalk.green('✓ Configuration is valid'));
    lines.push('');
  } else {
    lines.push('');
    lines.push(chalk.red('✗ Configuration validation failed'));
  }

  // Errors
  if (summary.errors.length > 0) {
    lines.push(formatErrors(summary.errors));
  }

  // Warnings
  if (summary.warnings.length > 0) {
    lines.push('');
    lines.push(chalk.yellow(`Warnings (${summary.warnings.length}):`));
    summary.warnings.forEach((warning) => {
      const icon = chalk.yellow('⚠');
      lines.push(`  ${icon} ${chalk.cyan(warning.path)} - ${warning.message}`);
      if (warning.suggestion) {
        lines.push(`    ${chalk.gray('→')} ${warning.suggestion}`);
      }
    });
  }

  // Summary line
  lines.push('');
  if (summary.isValid && summary.totalWarnings === 0) {
    lines.push(chalk.green(`Summary: No errors or warnings`));
  } else if (summary.isValid && summary.totalWarnings > 0) {
    lines.push(chalk.yellow(`Summary: ${summary.totalWarnings} ${summary.totalWarnings === 1 ? 'warning' : 'warnings'}`));
  } else {
    const parts: string[] = [];
    if (summary.totalErrors > 0) {
      parts.push(chalk.red(`${summary.totalErrors} ${summary.totalErrors === 1 ? 'error' : 'errors'}`));
    }
    if (summary.totalWarnings > 0) {
      parts.push(chalk.yellow(`${summary.totalWarnings} ${summary.totalWarnings === 1 ? 'warning' : 'warnings'}`));
    }
    lines.push(`Summary: ${parts.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Create validation summary from errors and warnings
 */
export function createValidationSummary(
  errors: ValidationError[],
  warnings: ValidationError[] = [],
  passed: string[] = []
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
  lines.push(chalk.gray('━'.repeat(50)));

  for (const section of report.sections) {
    lines.push('');

    const icon = section.passed && section.warnings.length === 0
      ? chalk.green('✓')
      : section.errors.length > 0
      ? chalk.red('✗')
      : chalk.yellow('⚠');

    let title = `${icon} ${section.title}`;
    if (section.errors.length > 0) {
      title += chalk.red(` (${section.errors.length} ${section.errors.length === 1 ? 'error' : 'errors'})`);
    }
    if (section.warnings.length > 0) {
      title += chalk.yellow(` (${section.warnings.length} ${section.warnings.length === 1 ? 'warning' : 'warnings'})`);
    }

    lines.push(title);

    // Show errors
    section.errors.forEach((error) => {
      lines.push(formatError(error));
    });

    // Show warnings
    section.warnings.forEach((warning) => {
      const warnIcon = chalk.yellow('⚠');
      lines.push(`  ${warnIcon} ${chalk.cyan(warning.path)} - ${warning.message}`);
      if (warning.suggestion) {
        lines.push(`    ${chalk.gray('→')} ${warning.suggestion}`);
      }
    });
  }

  lines.push('');
  lines.push(chalk.gray('━'.repeat(50)));

  // Overall summary
  const totalErrors = report.sections.reduce((sum, s) => sum + s.errors.length, 0);
  const totalWarnings = report.sections.reduce((sum, s) => sum + s.warnings.length, 0);

  if (totalErrors === 0 && totalWarnings === 0) {
    lines.push(chalk.green('Summary: ✓ All validations passed'));
  } else {
    const parts: string[] = [];
    if (totalErrors > 0) {
      parts.push(chalk.red(`✗ ${totalErrors} ${totalErrors === 1 ? 'error' : 'errors'}`));
    }
    if (totalWarnings > 0) {
      parts.push(chalk.yellow(`⚠ ${totalWarnings} ${totalWarnings === 1 ? 'warning' : 'warnings'}`));
    }
    lines.push(`Summary: ${parts.join(', ')}`);
  }

  lines.push('');

  return lines.join('\n');
}
