/**
 * Base error class for all Overture errors.
 *
 * @remarks
 * All custom error classes in Overture extend from this base class.
 * Provides standardized error codes, exit codes, and JSON serialization.
 */
export class OvertureError extends Error {
  constructor(
    message: string,
    public code: string,
    public exitCode: number = 1
  ) {
    super(message);
    this.name = 'OvertureError';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      exitCode: this.exitCode,
      stack: this.stack,
    };
  }
}

/**
 * Error thrown when configuration file operations fail.
 *
 * @remarks
 * Used for YAML parsing errors, missing config files, and schema violations.
 */
export class ConfigError extends OvertureError {
  constructor(message: string, public filePath?: string) {
    super(message, 'CONFIG_ERROR', 2);
    this.name = 'ConfigError';
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      filePath: this.filePath,
    };
  }
}

/**
 * Error thrown when validation fails.
 *
 * @remarks
 * Used for schema validation errors and constraint violations.
 * Can contain multiple issues for aggregate validation results.
 */
export class ValidationError extends OvertureError {
  constructor(message: string, public issues: string[] = []) {
    super(message, 'VALIDATION_ERROR', 3);
    this.name = 'ValidationError';
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      issues: this.issues,
    };
  }
}

/**
 * Error thrown when plugin operations fail.
 *
 * @remarks
 * Used for plugin installation, loading, and execution errors.
 */
export class PluginError extends OvertureError {
  constructor(message: string, public pluginName?: string) {
    super(message, 'PLUGIN_ERROR', 4);
    this.name = 'PluginError';
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      pluginName: this.pluginName,
    };
  }
}

/**
 * Error thrown when MCP server operations fail.
 *
 * @remarks
 * Used for MCP server startup, validation, and communication errors.
 */
export class McpError extends OvertureError {
  constructor(message: string, public mcpName?: string) {
    super(message, 'MCP_ERROR', 5);
    this.name = 'McpError';
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      mcpName: this.mcpName,
    };
  }
}
