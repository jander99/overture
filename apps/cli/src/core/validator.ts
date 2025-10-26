import { ProcessExecutor } from '../infrastructure/process-executor';
import type { OvertureConfig, ValidationResult, ValidationError, ValidationWarning } from '../domain/types';
import { OvertureConfigSchema } from '../domain/schemas';

/**
 * Validator service for Overture configuration
 *
 * Provides comprehensive validation of:
 * - Configuration schema compliance
 * - MCP server availability and configuration
 * - Plugin reference integrity
 */
export class Validator {
  /**
   * Validate configuration schema using Zod
   *
   * @param config - Unknown configuration object to validate
   * @returns ValidationResult with schema validation errors
   */
  static validateSchema(config: unknown): ValidationResult {
    const result = OvertureConfigSchema.safeParse(config);

    if (result.success) {
      return { valid: true, errors: [], warnings: [] };
    }

    const errors: ValidationError[] = result.error.issues.map((err: any) => ({
      field: err.path.join('.'),
      message: err.message,
      suggestion: this.getSuggestion(err),
    }));

    return { valid: false, errors, warnings: [] };
  }

  /**
   * Validate MCP server availability and configuration
   *
   * Checks:
   * - Command existence on PATH
   * - Environment variable references
   *
   * @param config - Validated Overture configuration
   * @returns ValidationResult with MCP-specific errors and warnings
   */
  static async validateMcpServers(
    config: OvertureConfig
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const [name, mcp] of Object.entries(config.mcp)) {
      // Skip disabled MCP servers
      if (mcp.enabled === false) continue;

      // Check if command exists on PATH
      if (mcp.command) {
        const exists = await ProcessExecutor.commandExists(mcp.command);

        if (!exists) {
          errors.push({
            field: `mcp.${name}.command`,
            message: `Command '${mcp.command}' not found on PATH`,
            suggestion: `Install the MCP server or update the command path`,
          });
        }
      } else {
        warnings.push({
          message: `MCP server '${name}' has no command specified`,
          context: `mcp.${name}`,
        });
      }

      // Check environment variable references
      if (mcp.env) {
        for (const [envVar, value] of Object.entries(mcp.env)) {
          // Check for ${VAR_NAME} pattern
          if (value.startsWith('${') && value.endsWith('}')) {
            const varName = value.slice(2, -1);
            if (!process.env[varName]) {
              warnings.push({
                message: `Environment variable '${varName}' is not set`,
                context: `mcp.${name}.env.${envVar}`,
              });
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate plugin MCP references
   *
   * Ensures plugins reference MCPs that are defined in configuration
   *
   * @param config - Validated Overture configuration
   * @returns ValidationResult with plugin reference warnings
   */
  static validatePluginReferences(
    config: OvertureConfig
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const [pluginName, plugin] of Object.entries(config.plugins)) {
      // Check if referenced MCPs exist in config
      for (const mcpName of plugin.mcps) {
        if (!config.mcp[mcpName]) {
          warnings.push({
            message: `Plugin '${pluginName}' references MCP '${mcpName}' which is not configured`,
            context: `plugins.${pluginName}.mcps`,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Run all validations
   *
   * Executes schema, MCP server, and plugin reference validation
   * in sequence and aggregates results.
   *
   * @param config - Overture configuration to validate
   * @returns Aggregated ValidationResult from all validators
   */
  static async validateAll(config: OvertureConfig): Promise<ValidationResult> {
    const schemaResult = this.validateSchema(config);
    const mcpResult = await this.validateMcpServers(config);
    const pluginResult = this.validatePluginReferences(config);

    return {
      valid: schemaResult.valid && mcpResult.valid && pluginResult.valid,
      errors: [
        ...schemaResult.errors,
        ...mcpResult.errors,
        ...pluginResult.errors,
      ],
      warnings: [
        ...schemaResult.warnings,
        ...mcpResult.warnings,
        ...pluginResult.warnings,
      ],
    };
  }

  /**
   * Generate helpful suggestions for Zod validation errors
   *
   * @param error - Zod error object
   * @returns Suggestion string or undefined
   */
  private static getSuggestion(error: any): string | undefined {
    // Provide helpful suggestions based on error type
    if (error.code === 'invalid_type') {
      return `Expected ${error.expected}, got ${error.received}`;
    }

    if (error.code === 'invalid_enum_value') {
      return `Valid options are: ${error.options.join(', ')}`;
    }

    if (error.code === 'too_small') {
      return `Minimum ${error.minimum} ${error.type} required`;
    }

    if (error.code === 'too_big') {
      return `Maximum ${error.maximum} ${error.type} allowed`;
    }

    return undefined;
  }
}
