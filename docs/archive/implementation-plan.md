# Overture CLI - TypeScript Implementation Plan

> ⚠️ **HISTORICAL DOCUMENT - v0.1 IMPLEMENTATION PLAN**
> This was the original implementation plan for Overture v0.1. The features described here have been implemented, though the actual implementation may differ from this plan.

## Overview

This document provides a comprehensive, step-by-step plan for implementing the Overture CLI tool using TypeScript, following best practices for enterprise-grade CLI development.

---

## 1. Project Structure

```
apps/cli/src/
├── main.ts                          # Entry point, CLI initialization
├── cli/                             # CLI layer (Commander.js handlers)
│   ├── index.ts                     # Commander program setup
│   ├── commands/
│   │   ├── init.ts                  # overture init
│   │   ├── sync.ts                  # overture sync
│   │   ├── mcp.ts                   # overture mcp list/enable
│   │   └── validate.ts              # overture validate
│   └── middleware/
│       ├── error-handler.ts         # Global error handling
│       └── config-loader.ts         # Pre-load config for commands
├── core/                            # Service layer (business logic)
│   ├── config-manager.ts            # Read/write/merge config files
│   ├── plugin-installer.ts          # Execute plugin installations
│   ├── generator.ts                 # Generate .mcp.json and CLAUDE.md
│   ├── validator.ts                 # Validate config and MCPs
│   └── mcp-registry.ts              # Plugin → MCP mappings
├── domain/                          # Domain layer (types, schemas)
│   ├── schemas.ts                   # Zod schemas
│   ├── types.ts                     # TypeScript interfaces
│   ├── errors.ts                    # Custom error classes
│   └── constants.ts                 # Constants and defaults
├── infrastructure/                  # Infrastructure layer
│   ├── fs-utils.ts                  # File system operations
│   ├── process-executor.ts          # Execute shell commands
│   ├── template-loader.ts           # Load and render templates
│   └── path-resolver.ts             # Cross-platform path handling
├── templates/                       # File templates
│   ├── config.yaml.hbs              # Handlebars template for config
│   ├── claude-md.hbs                # CLAUDE.md template
│   └── mcp-json.hbs                 # .mcp.json template
└── utils/                           # Shared utilities
    ├── logger.ts                    # Structured logging
    ├── prompts.ts                   # User interaction (inquirer)
    └── format.ts                    # Output formatting (chalk)
```

**Design Principles:**
- **Layered Architecture**: Clear separation between CLI, service, domain, and infrastructure layers
- **Single Responsibility**: Each module has one clear purpose
- **Dependency Inversion**: Core logic doesn't depend on infrastructure (file system, process execution)
- **Testability**: Infrastructure can be mocked for unit testing

---

## 2. Module Breakdown

### 2.1 Domain Layer

#### `domain/schemas.ts`
**Purpose:** Zod schemas for runtime validation and type inference.

```typescript
import { z } from 'zod';

// MCP Server schema
export const McpServerSchema = z.object({
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  scope: z.enum(['global', 'project']),
  enabled: z.boolean().default(true),
});

// Plugin schema
export const PluginSchema = z.object({
  marketplace: z.string(),
  enabled: z.boolean().default(true),
  mcps: z.array(z.string()),
});

// Project metadata schema
export const ProjectSchema = z.object({
  name: z.string(),
  type: z.string().optional(),
  description: z.string().optional(),
});

// Main configuration schema
export const OvertureConfigSchema = z.object({
  version: z.string().default('1.0'),
  project: ProjectSchema.optional(),
  plugins: z.record(PluginSchema),
  mcp: z.record(McpServerSchema),
});

// MCP JSON output schema
export const McpJsonSchema = z.object({
  mcpServers: z.record(z.object({
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
  })),
});
```

#### `domain/types.ts`
**Purpose:** TypeScript interfaces inferred from Zod schemas.

```typescript
import type { z } from 'zod';
import {
  OvertureConfigSchema,
  McpServerSchema,
  PluginSchema,
  McpJsonSchema
} from './schemas';

// Infer types from schemas
export type OvertureConfig = z.infer<typeof OvertureConfigSchema>;
export type McpServer = z.infer<typeof McpServerSchema>;
export type Plugin = z.infer<typeof PluginSchema>;
export type McpJson = z.infer<typeof McpJsonSchema>;

// Additional types for internal use
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  suggestion?: string;
}

export interface ValidationWarning {
  message: string;
  context?: string;
}

export interface GeneratorResult {
  mcpJson: McpJson;
  claudeMd: string;
  filesWritten: string[];
}

export interface PluginMcpMapping {
  pluginName: string;
  requiredMcps: string[];
  recommendedMcps: string[];
  usageHints: PluginUsageHint[];
}

export interface PluginUsageHint {
  context: string;
  preferMcp: string;
  reason: string;
}
```

#### `domain/errors.ts`
**Purpose:** Custom error classes with context.

```typescript
export class OvertureError extends Error {
  constructor(
    message: string,
    public code: string,
    public exitCode: number = 1
  ) {
    super(message);
    this.name = 'OvertureError';
  }
}

export class ConfigError extends OvertureError {
  constructor(message: string, public filePath?: string) {
    super(message, 'CONFIG_ERROR', 2);
    this.name = 'ConfigError';
  }
}

export class ValidationError extends OvertureError {
  constructor(message: string, public issues: string[] = []) {
    super(message, 'VALIDATION_ERROR', 3);
    this.name = 'ValidationError';
  }
}

export class PluginError extends OvertureError {
  constructor(message: string, public pluginName?: string) {
    super(message, 'PLUGIN_ERROR', 4);
    this.name = 'PluginError';
  }
}

export class McpError extends OvertureError {
  constructor(message: string, public mcpName?: string) {
    super(message, 'MCP_ERROR', 5);
    this.name = 'McpError';
  }
}
```

#### `domain/constants.ts`
**Purpose:** Application constants and defaults.

```typescript
import * as path from 'path';
import * as os from 'os';

export const OVERTURE_DIR = '.overture';
export const CONFIG_FILE = 'config.yaml';
export const CONFIG_PATH = path.join(OVERTURE_DIR, CONFIG_FILE);

export const MCP_JSON_FILE = '.mcp.json';
export const CLAUDE_MD_FILE = 'CLAUDE.md';

export const GLOBAL_CONFIG_DIR = path.join(
  os.homedir(),
  '.config',
  'overture'
);

export const DEFAULT_CONFIG_VERSION = '1.0';

export const PROJECT_TYPES = [
  'python-backend',
  'typescript-frontend',
  'node-backend',
  'fullstack',
  'data-science',
  'kubernetes',
] as const;

export const CLAUDE_MD_HEADER = `# CLAUDE.md

<!-- Generated by Overture CLI - Do not edit this section directly -->
<!-- Custom sections below this comment will be preserved -->

`;
```

### 2.2 Infrastructure Layer

#### `infrastructure/fs-utils.ts`
**Purpose:** Cross-platform file system operations.

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigError } from '../domain/errors';

export class FsUtils {
  /**
   * Read file as string with error handling
   */
  static async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new ConfigError(
        `Failed to read file: ${error.message}`,
        filePath
      );
    }
  }

  /**
   * Write file with directory creation
   */
  static async writeFile(filePath: string, content: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      throw new ConfigError(
        `Failed to write file: ${error.message}`,
        filePath
      );
    }
  }

  /**
   * Check if file exists
   */
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure directory exists
   */
  static async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  /**
   * Find file by walking up directory tree
   */
  static async findUp(
    fileName: string,
    startDir: string = process.cwd()
  ): Promise<string | null> {
    let currentDir = path.resolve(startDir);
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
      const filePath = path.join(currentDir, fileName);
      if (await this.exists(filePath)) {
        return filePath;
      }
      currentDir = path.dirname(currentDir);
    }

    return null;
  }
}
```

#### `infrastructure/process-executor.ts`
**Purpose:** Execute shell commands with cross-platform support.

```typescript
import { execa, type ExecaChildProcess } from 'execa';
import { PluginError } from '../domain/errors';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class ProcessExecutor {
  /**
   * Execute command and return result
   */
  static async exec(
    command: string,
    args: string[] = [],
    options: { cwd?: string; env?: Record<string, string> } = {}
  ): Promise<ExecResult> {
    try {
      const result = await execa(command, args, {
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
        reject: false, // Don't throw on non-zero exit
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    } catch (error) {
      throw new PluginError(
        `Command execution failed: ${error.message}`
      );
    }
  }

  /**
   * Check if command exists on PATH
   */
  static async commandExists(command: string): Promise<boolean> {
    try {
      const result = await this.exec(
        process.platform === 'win32' ? 'where' : 'which',
        [command]
      );
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Execute with real-time output streaming
   */
  static spawn(
    command: string,
    args: string[] = [],
    options: { cwd?: string; env?: Record<string, string> } = {}
  ): ExecaChildProcess {
    return execa(command, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: 'inherit', // Stream output to terminal
    });
  }
}
```

#### `infrastructure/template-loader.ts`
**Purpose:** Load and render Handlebars templates.

```typescript
import * as Handlebars from 'handlebars';
import * as path from 'path';
import { FsUtils } from './fs-utils';

export class TemplateLoader {
  private static templateDir = path.join(__dirname, '..', 'templates');

  /**
   * Render template with data
   */
  static async render(
    templateName: string,
    data: Record<string, unknown>
  ): Promise<string> {
    const templatePath = path.join(this.templateDir, templateName);
    const templateContent = await FsUtils.readFile(templatePath);
    const template = Handlebars.compile(templateContent);
    return template(data);
  }

  /**
   * Register custom Handlebars helpers
   */
  static registerHelpers(): void {
    Handlebars.registerHelper('json', (context) => {
      return JSON.stringify(context, null, 2);
    });

    Handlebars.registerHelper('yaml', (context) => {
      // Simple YAML serialization (or use js-yaml)
      return JSON.stringify(context, null, 2);
    });
  }
}

// Register helpers on module load
TemplateLoader.registerHelpers();
```

### 2.3 Core Layer

#### `core/config-manager.ts`
**Purpose:** Load, merge, and save configuration files.

```typescript
import * as yaml from 'js-yaml';
import * as path from 'path';
import { FsUtils } from '../infrastructure/fs-utils';
import { OvertureConfigSchema, type OvertureConfig } from '../domain/schemas';
import { ConfigError } from '../domain/errors';
import { CONFIG_PATH, GLOBAL_CONFIG_DIR } from '../domain/constants';

export class ConfigManager {
  /**
   * Load project configuration
   */
  static async loadProjectConfig(
    projectDir: string = process.cwd()
  ): Promise<OvertureConfig | null> {
    const configPath = path.join(projectDir, CONFIG_PATH);

    if (!(await FsUtils.exists(configPath))) {
      return null;
    }

    return this.loadConfigFromFile(configPath);
  }

  /**
   * Load global configuration
   */
  static async loadGlobalConfig(): Promise<OvertureConfig | null> {
    const configPath = path.join(GLOBAL_CONFIG_DIR, 'config.yaml');

    if (!(await FsUtils.exists(configPath))) {
      return null;
    }

    return this.loadConfigFromFile(configPath);
  }

  /**
   * Load and validate config from file
   */
  private static async loadConfigFromFile(
    filePath: string
  ): Promise<OvertureConfig> {
    try {
      const content = await FsUtils.readFile(filePath);
      const parsed = yaml.load(content);

      // Validate with Zod
      const result = OvertureConfigSchema.safeParse(parsed);

      if (!result.success) {
        throw new ConfigError(
          `Invalid configuration: ${result.error.message}`,
          filePath
        );
      }

      return result.data;
    } catch (error) {
      if (error instanceof ConfigError) throw error;

      throw new ConfigError(
        `Failed to parse YAML: ${error.message}`,
        filePath
      );
    }
  }

  /**
   * Merge global and project configs
   */
  static mergeConfigs(
    global: OvertureConfig | null,
    project: OvertureConfig | null
  ): OvertureConfig {
    if (!global && !project) {
      throw new ConfigError('No configuration found');
    }

    // Project config takes precedence
    return {
      version: project?.version || global?.version || '1.0',
      project: project?.project,
      plugins: {
        ...global?.plugins,
        ...project?.plugins,
      },
      mcp: {
        ...global?.mcp,
        ...project?.mcp,
      },
    };
  }

  /**
   * Save configuration to file
   */
  static async saveConfig(
    config: OvertureConfig,
    filePath: string
  ): Promise<void> {
    try {
      const yamlContent = yaml.dump(config, {
        indent: 2,
        lineWidth: 80,
        noRefs: true,
      });

      await FsUtils.writeFile(filePath, yamlContent);
    } catch (error) {
      throw new ConfigError(
        `Failed to save configuration: ${error.message}`,
        filePath
      );
    }
  }

  /**
   * Initialize new project configuration
   */
  static async initializeConfig(
    projectDir: string,
    projectType?: string
  ): Promise<OvertureConfig> {
    const config: OvertureConfig = {
      version: '1.0',
      project: {
        name: path.basename(projectDir),
        type: projectType,
      },
      plugins: {},
      mcp: {},
    };

    const configPath = path.join(projectDir, CONFIG_PATH);
    await this.saveConfig(config, configPath);

    return config;
  }
}
```

#### `core/plugin-installer.ts`
**Purpose:** Install Claude Code plugins.

```typescript
import { ProcessExecutor } from '../infrastructure/process-executor';
import { PluginError } from '../domain/errors';
import { Logger } from '../utils/logger';

export interface PluginInstallResult {
  pluginName: string;
  marketplace: string;
  success: boolean;
  message: string;
}

export class PluginInstaller {
  /**
   * Install a plugin using `claude plugin install`
   */
  static async installPlugin(
    pluginName: string,
    marketplace: string
  ): Promise<PluginInstallResult> {
    const fullName = `${pluginName}@${marketplace}`;

    Logger.info(`Installing plugin: ${fullName}`);

    try {
      // Check if claude CLI exists
      const claudeExists = await ProcessExecutor.commandExists('claude');

      if (!claudeExists) {
        throw new PluginError(
          'Claude CLI not found. Please install Claude Code first.',
          pluginName
        );
      }

      // Execute plugin install
      const result = await ProcessExecutor.exec('claude', [
        'plugin',
        'install',
        fullName,
      ]);

      if (result.exitCode !== 0) {
        return {
          pluginName,
          marketplace,
          success: false,
          message: result.stderr || 'Installation failed',
        };
      }

      return {
        pluginName,
        marketplace,
        success: true,
        message: 'Plugin installed successfully',
      };
    } catch (error) {
      if (error instanceof PluginError) throw error;

      throw new PluginError(
        `Failed to install plugin: ${error.message}`,
        pluginName
      );
    }
  }

  /**
   * Install multiple plugins
   */
  static async installPlugins(
    plugins: Array<{ name: string; marketplace: string }>
  ): Promise<PluginInstallResult[]> {
    const results: PluginInstallResult[] = [];

    for (const plugin of plugins) {
      try {
        const result = await this.installPlugin(
          plugin.name,
          plugin.marketplace
        );
        results.push(result);
      } catch (error) {
        results.push({
          pluginName: plugin.name,
          marketplace: plugin.marketplace,
          success: false,
          message: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Check if plugin is installed
   */
  static async isPluginInstalled(pluginName: string): Promise<boolean> {
    try {
      const result = await ProcessExecutor.exec('claude', [
        'plugin',
        'list',
      ]);

      return result.stdout.includes(pluginName);
    } catch {
      return false;
    }
  }
}
```

#### `core/generator.ts`
**Purpose:** Generate .mcp.json and CLAUDE.md files.

```typescript
import * as path from 'path';
import { FsUtils } from '../infrastructure/fs-utils';
import { TemplateLoader } from '../infrastructure/template-loader';
import type { OvertureConfig, McpJson, GeneratorResult } from '../domain/types';
import { MCP_JSON_FILE, CLAUDE_MD_FILE } from '../domain/constants';
import { Logger } from '../utils/logger';

export class Generator {
  /**
   * Generate .mcp.json from configuration
   */
  static generateMcpJson(config: OvertureConfig): McpJson {
    const mcpServers: Record<string, any> = {};

    // Include only enabled MCP servers with project or global scope
    for (const [name, mcp] of Object.entries(config.mcp)) {
      if (mcp.enabled !== false && mcp.command) {
        mcpServers[name] = {
          command: mcp.command,
          ...(mcp.args && { args: mcp.args }),
          ...(mcp.env && { env: mcp.env }),
        };
      }
    }

    return { mcpServers };
  }

  /**
   * Generate CLAUDE.md content
   */
  static async generateClaudeMd(config: OvertureConfig): Promise<string> {
    const templateData = {
      projectName: config.project?.name || 'Project',
      projectType: config.project?.type,
      projectDescription: config.project?.description,
      plugins: Object.entries(config.plugins).map(([name, plugin]) => ({
        name,
        marketplace: plugin.marketplace,
        enabled: plugin.enabled !== false,
        mcps: plugin.mcps,
      })),
      mcps: Object.entries(config.mcp).map(([name, mcp]) => ({
        name,
        enabled: mcp.enabled !== false,
        scope: mcp.scope,
        command: mcp.command,
      })),
    };

    return await TemplateLoader.render('claude-md.hbs', templateData);
  }

  /**
   * Preserve custom sections in existing CLAUDE.md
   */
  static async preserveCustomSections(
    newContent: string,
    existingPath: string
  ): Promise<string> {
    if (!(await FsUtils.exists(existingPath))) {
      return newContent;
    }

    const existingContent = await FsUtils.readFile(existingPath);

    // Find custom section marker
    const customMarker = '<!-- Custom sections below this comment will be preserved -->';
    const markerIndex = existingContent.indexOf(customMarker);

    if (markerIndex === -1) {
      return newContent; // No custom sections to preserve
    }

    // Extract custom content
    const customContent = existingContent.substring(
      markerIndex + customMarker.length
    );

    // Append to new content
    return newContent + '\n\n' + customContent;
  }

  /**
   * Generate all files
   */
  static async generateFiles(
    config: OvertureConfig,
    outputDir: string = process.cwd()
  ): Promise<GeneratorResult> {
    Logger.info('Generating configuration files...');

    // Generate .mcp.json
    const mcpJson = this.generateMcpJson(config);
    const mcpJsonPath = path.join(outputDir, MCP_JSON_FILE);
    await FsUtils.writeFile(
      mcpJsonPath,
      JSON.stringify(mcpJson, null, 2)
    );
    Logger.success(`Generated ${MCP_JSON_FILE}`);

    // Generate CLAUDE.md
    let claudeMd = await this.generateClaudeMd(config);
    const claudeMdPath = path.join(outputDir, CLAUDE_MD_FILE);
    claudeMd = await this.preserveCustomSections(claudeMd, claudeMdPath);
    await FsUtils.writeFile(claudeMdPath, claudeMd);
    Logger.success(`Generated ${CLAUDE_MD_FILE}`);

    return {
      mcpJson,
      claudeMd,
      filesWritten: [mcpJsonPath, claudeMdPath],
    };
  }
}
```

#### `core/validator.ts`
**Purpose:** Validate configuration and MCP availability.

```typescript
import { ProcessExecutor } from '../infrastructure/process-executor';
import type { OvertureConfig, ValidationResult, ValidationError, ValidationWarning } from '../domain/types';
import { OvertureConfigSchema } from '../domain/schemas';

export class Validator {
  /**
   * Validate configuration schema
   */
  static validateSchema(config: unknown): ValidationResult {
    const result = OvertureConfigSchema.safeParse(config);

    if (result.success) {
      return { valid: true, errors: [], warnings: [] };
    }

    const errors: ValidationError[] = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
      suggestion: this.getSuggestion(err),
    }));

    return { valid: false, errors, warnings: [] };
  }

  /**
   * Validate MCP server availability
   */
  static async validateMcpServers(
    config: OvertureConfig
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const [name, mcp] of Object.entries(config.mcp)) {
      if (mcp.enabled === false) continue;

      // Check if command exists
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

      // Check environment variables
      if (mcp.env) {
        for (const [envVar, value] of Object.entries(mcp.env)) {
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
   * Validate plugin references
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

  private static getSuggestion(error: any): string | undefined {
    // Provide helpful suggestions based on error type
    if (error.code === 'invalid_type') {
      return `Expected ${error.expected}, got ${error.received}`;
    }
    return undefined;
  }
}
```

### 2.4 Utilities

#### `utils/logger.ts`
**Purpose:** Structured logging with colors.

```typescript
import chalk from 'chalk';

export class Logger {
  static info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  static success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  static warn(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  static error(message: string): void {
    console.error(chalk.red('✗'), message);
  }

  static debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(chalk.gray('→'), message);
    }
  }

  static nl(): void {
    console.log();
  }
}
```

#### `utils/prompts.ts`
**Purpose:** User interaction prompts.

```typescript
import inquirer from 'inquirer';

export class Prompts {
  static async confirm(message: string, defaultValue = true): Promise<boolean> {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message,
        default: defaultValue,
      },
    ]);
    return confirmed;
  }

  static async select<T extends string>(
    message: string,
    choices: Array<{ name: string; value: T }>
  ): Promise<T> {
    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message,
        choices,
      },
    ]);
    return selected;
  }

  static async multiSelect<T extends string>(
    message: string,
    choices: Array<{ name: string; value: T; checked?: boolean }>
  ): Promise<T[]> {
    const { selected } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message,
        choices,
      },
    ]);
    return selected;
  }

  static async input(
    message: string,
    defaultValue?: string
  ): Promise<string> {
    const { value } = await inquirer.prompt([
      {
        type: 'input',
        name: 'value',
        message,
        default: defaultValue,
      },
    ]);
    return value;
  }
}
```

### 2.5 CLI Layer

#### `cli/commands/init.ts`
**Purpose:** Initialize Overture configuration.

```typescript
import * as path from 'path';
import { Command } from 'commander';
import { ConfigManager } from '../../core/config-manager';
import { Logger } from '../../utils/logger';
import { Prompts } from '../../utils/prompts';
import { PROJECT_TYPES, CONFIG_PATH } from '../../domain/constants';
import { FsUtils } from '../../infrastructure/fs-utils';

export function createInitCommand(): Command {
  return new Command('init')
    .description('Initialize Overture configuration')
    .option('-t, --type <type>', 'Project type')
    .option('-f, --force', 'Overwrite existing configuration')
    .action(async (options) => {
      const projectDir = process.cwd();
      const configPath = path.join(projectDir, CONFIG_PATH);

      // Check if config already exists
      if (await FsUtils.exists(configPath) && !options.force) {
        Logger.error('Configuration already exists');
        Logger.info(`Use --force to overwrite or edit ${CONFIG_PATH}`);
        process.exit(1);
      }

      // Prompt for project type if not provided
      let projectType = options.type;
      if (!projectType) {
        projectType = await Prompts.select(
          'Select project type:',
          PROJECT_TYPES.map((type) => ({ name: type, value: type }))
        );
      }

      // Initialize config
      Logger.info('Initializing Overture configuration...');
      const config = await ConfigManager.initializeConfig(
        projectDir,
        projectType
      );

      Logger.success('Configuration created!');
      Logger.info(`Edit ${CONFIG_PATH} to add plugins and MCP servers`);
      Logger.info('Run `overture sync` to generate .mcp.json and CLAUDE.md');
    });
}
```

#### `cli/commands/sync.ts`
**Purpose:** Sync plugins and generate files.

```typescript
import { Command } from 'commander';
import { ConfigManager } from '../../core/config-manager';
import { PluginInstaller } from '../../core/plugin-installer';
import { Generator } from '../../core/generator';
import { Logger } from '../../utils/logger';

export function createSyncCommand(): Command {
  return new Command('sync')
    .description('Install plugins and generate .mcp.json and CLAUDE.md')
    .option('--skip-plugins', 'Skip plugin installation')
    .action(async (options) => {
      try {
        // Load configuration
        Logger.info('Loading configuration...');
        const projectConfig = await ConfigManager.loadProjectConfig();
        const globalConfig = await ConfigManager.loadGlobalConfig();
        const config = ConfigManager.mergeConfigs(globalConfig, projectConfig);

        // Install plugins
        if (!options.skipPlugins) {
          const pluginsToInstall = Object.entries(config.plugins)
            .filter(([_, plugin]) => plugin.enabled !== false)
            .map(([name, plugin]) => ({
              name,
              marketplace: plugin.marketplace,
            }));

          if (pluginsToInstall.length > 0) {
            Logger.info(`Installing ${pluginsToInstall.length} plugin(s)...`);
            const results = await PluginInstaller.installPlugins(
              pluginsToInstall
            );

            // Report results
            const failed = results.filter((r) => !r.success);
            if (failed.length > 0) {
              Logger.warn(`${failed.length} plugin(s) failed to install`);
              failed.forEach((r) => {
                Logger.error(`${r.pluginName}: ${r.message}`);
              });
            }
          }
        }

        // Generate files
        const result = await Generator.generateFiles(config);

        Logger.nl();
        Logger.success('Sync complete!');
        Logger.info('Files generated:');
        result.filesWritten.forEach((file) => {
          Logger.info(`  - ${file}`);
        });
      } catch (error) {
        Logger.error(`Sync failed: ${error.message}`);
        process.exit(error.exitCode || 1);
      }
    });
}
```

#### `cli/commands/validate.ts`
**Purpose:** Validate configuration.

```typescript
import { Command } from 'commander';
import { ConfigManager } from '../../core/config-manager';
import { Validator } from '../../core/validator';
import { Logger } from '../../utils/logger';

export function createValidateCommand(): Command {
  return new Command('validate')
    .description('Validate Overture configuration')
    .action(async () => {
      try {
        // Load configuration
        Logger.info('Loading configuration...');
        const projectConfig = await ConfigManager.loadProjectConfig();
        const globalConfig = await ConfigManager.loadGlobalConfig();
        const config = ConfigManager.mergeConfigs(globalConfig, projectConfig);

        // Validate
        Logger.info('Validating configuration...');
        const result = await Validator.validateAll(config);

        // Report errors
        if (result.errors.length > 0) {
          Logger.nl();
          Logger.error('Validation errors:');
          result.errors.forEach((err) => {
            Logger.error(`  ${err.field}: ${err.message}`);
            if (err.suggestion) {
              Logger.info(`    → ${err.suggestion}`);
            }
          });
        }

        // Report warnings
        if (result.warnings.length > 0) {
          Logger.nl();
          Logger.warn('Warnings:');
          result.warnings.forEach((warn) => {
            Logger.warn(`  ${warn.message}`);
            if (warn.context) {
              Logger.info(`    (${warn.context})`);
            }
          });
        }

        // Summary
        Logger.nl();
        if (result.valid) {
          Logger.success('Configuration is valid!');
          process.exit(0);
        } else {
          Logger.error('Configuration has errors');
          process.exit(3);
        }
      } catch (error) {
        Logger.error(`Validation failed: ${error.message}`);
        process.exit(error.exitCode || 1);
      }
    });
}
```

#### `cli/commands/mcp.ts`
**Purpose:** MCP management commands.

```typescript
import { Command } from 'commander';
import { ConfigManager } from '../../core/config-manager';
import { Logger } from '../../utils/logger';
import { CONFIG_PATH } from '../../domain/constants';
import * as path from 'path';

export function createMcpCommand(): Command {
  const mcp = new Command('mcp')
    .description('Manage MCP servers');

  // List command
  mcp
    .command('list')
    .description('List configured MCP servers')
    .action(async () => {
      try {
        const config = await ConfigManager.loadProjectConfig();
        if (!config) {
          Logger.error('No configuration found');
          process.exit(2);
        }

        Logger.info('Configured MCP servers:');
        Logger.nl();

        for (const [name, mcp] of Object.entries(config.mcp)) {
          const status = mcp.enabled !== false ? '✓ enabled' : '✗ disabled';
          const scope = `[${mcp.scope}]`;
          Logger.info(`  ${name} ${scope} ${status}`);
          if (mcp.command) {
            Logger.debug(`    Command: ${mcp.command}`);
          }
        }
      } catch (error) {
        Logger.error(`Failed to list MCPs: ${error.message}`);
        process.exit(1);
      }
    });

  // Enable command
  mcp
    .command('enable <name>')
    .description('Enable a disabled MCP server')
    .action(async (name: string) => {
      try {
        const projectDir = process.cwd();
        const config = await ConfigManager.loadProjectConfig(projectDir);

        if (!config) {
          Logger.error('No configuration found');
          process.exit(2);
        }

        if (!config.mcp[name]) {
          Logger.error(`MCP server '${name}' not found in configuration`);
          process.exit(2);
        }

        config.mcp[name].enabled = true;

        await ConfigManager.saveConfig(
          config,
          path.join(projectDir, CONFIG_PATH)
        );

        Logger.success(`Enabled MCP server: ${name}`);
        Logger.info('Run `overture sync` to regenerate configuration');
      } catch (error) {
        Logger.error(`Failed to enable MCP: ${error.message}`);
        process.exit(1);
      }
    });

  return mcp;
}
```

#### `cli/index.ts`
**Purpose:** Set up Commander program.

```typescript
import { Command } from 'commander';
import { createInitCommand } from './commands/init';
import { createSyncCommand } from './commands/sync';
import { createValidateCommand } from './commands/validate';
import { createMcpCommand } from './commands/mcp';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('overture')
    .description('Orchestration layer for Claude Code plugins and MCP servers')
    .version('1.0.0');

  // Register commands
  program.addCommand(createInitCommand());
  program.addCommand(createSyncCommand());
  program.addCommand(createValidateCommand());
  program.addCommand(createMcpCommand());

  return program;
}
```

#### `main.ts`
**Purpose:** CLI entry point.

```typescript
#!/usr/bin/env node

import { createProgram } from './cli';
import { Logger } from './utils/logger';

async function main() {
  try {
    const program = createProgram();
    await program.parseAsync(process.argv);
  } catch (error) {
    Logger.error(`Unexpected error: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
```

---

## 3. Type Definitions Summary

All type definitions are derived from Zod schemas using `z.infer<typeof Schema>`:

```typescript
// Primary types
OvertureConfig      // Main configuration object
McpServer           // MCP server configuration
Plugin              // Plugin configuration
McpJson             // Output .mcp.json format

// Validation types
ValidationResult    // Validation outcome with errors/warnings
ValidationError     // Validation error with context
ValidationWarning   // Non-blocking validation warning

// Generator types
GeneratorResult     // Files generated and their paths

// Plugin registry types
PluginMcpMapping    // Plugin to MCP mapping
PluginUsageHint     // Usage guidance for Claude
```

---

## 4. Implementation Order

### Phase 1: Foundation (Days 1-2)

**Priority 1: Domain Layer**
1. Create `domain/constants.ts` - Easy wins, no dependencies
2. Create `domain/errors.ts` - Custom error classes
3. Create `domain/schemas.ts` - Zod schemas
4. Create `domain/types.ts` - TypeScript interfaces from schemas

**Priority 2: Infrastructure Utilities**
5. Create `infrastructure/fs-utils.ts` - File system operations
6. Create `utils/logger.ts` - Logging utility
7. Create `utils/format.ts` - Output formatting helpers

**Testing:** Write unit tests for schemas, error classes, and fs-utils.

### Phase 2: Core Services (Days 3-4)

**Priority 3: Configuration Management**
8. Create `core/config-manager.ts` - Load/save/merge configs
9. Test config manager with fixtures

**Priority 4: Infrastructure for Execution**
10. Create `infrastructure/process-executor.ts` - Execute commands
11. Create `infrastructure/template-loader.ts` - Template rendering
12. Create template files in `templates/`

**Priority 5: Business Logic**
13. Create `core/validator.ts` - Configuration validation
14. Create `core/plugin-installer.ts` - Plugin installation
15. Create `core/generator.ts` - File generation

**Testing:** Write integration tests for config manager + validator + generator.

### Phase 3: CLI Interface (Days 5-6)

**Priority 6: User Interaction**
16. Create `utils/prompts.ts` - User prompts (inquirer)

**Priority 7: CLI Commands**
17. Create `cli/commands/init.ts` - Initialize command
18. Create `cli/commands/sync.ts` - Sync command
19. Create `cli/commands/validate.ts` - Validate command
20. Create `cli/commands/mcp.ts` - MCP management commands

**Priority 8: CLI Setup**
21. Create `cli/index.ts` - Commander program setup
22. Create `main.ts` - Entry point

**Testing:** E2E tests in `apps/cli-e2e/` for each command.

### Phase 4: Templates & Polish (Day 7)

**Priority 9: Templates**
23. Create `templates/config.yaml.hbs` - Config template
24. Create `templates/claude-md.hbs` - CLAUDE.md template
25. Create `templates/mcp-json.hbs` - .mcp.json template (or use JSON.stringify)

**Priority 10: Final Testing**
26. Integration tests across all modules
27. E2E tests for real-world scenarios
28. Manual testing on different platforms

**Priority 11: Documentation**
29. Update README with installation and usage
30. Add inline documentation (TSDoc)
31. Create examples in `docs/examples/`

---

## 5. Testing Strategy

### 5.1 Unit Tests

**What to test:**
- Zod schema validation (valid/invalid inputs)
- Config merging logic
- Path resolution
- Error class construction
- Template rendering
- Utility functions

**Tools:**
- Jest (or Vitest if preferred)
- `ts-jest` for TypeScript support
- `memfs` for mocking file system

**Example test:**
```typescript
// config-manager.spec.ts
import { ConfigManager } from './config-manager';
import { vol } from 'memfs';

jest.mock('fs/promises');

describe('ConfigManager', () => {
  beforeEach(() => {
    vol.reset();
  });

  it('should load valid config', async () => {
    vol.fromJSON({
      '.overture/config.yaml': `
        version: "1.0"
        plugins: {}
        mcp: {}
      `,
    });

    const config = await ConfigManager.loadProjectConfig();
    expect(config).toBeDefined();
    expect(config.version).toBe('1.0');
  });

  it('should throw on invalid YAML', async () => {
    vol.fromJSON({
      '.overture/config.yaml': 'invalid: yaml: content:',
    });

    await expect(ConfigManager.loadProjectConfig()).rejects.toThrow();
  });
});
```

### 5.2 Integration Tests

**What to test:**
- Config manager + file system
- Validator + process executor
- Generator + template loader
- Plugin installer + process executor

**Example test:**
```typescript
// generator.integration.spec.ts
describe('Generator Integration', () => {
  it('should generate .mcp.json and CLAUDE.md', async () => {
    const config: OvertureConfig = {
      version: '1.0',
      plugins: {
        'python-development': {
          marketplace: 'claude-code-workflows',
          enabled: true,
          mcps: ['python-repl'],
        },
      },
      mcp: {
        'python-repl': {
          command: 'uvx',
          args: ['mcp-server-python-repl'],
          scope: 'project',
          enabled: true,
        },
      },
    };

    const result = await Generator.generateFiles(config, '/tmp/test');

    expect(result.filesWritten).toHaveLength(2);
    expect(result.mcpJson.mcpServers).toHaveProperty('python-repl');
    expect(result.claudeMd).toContain('python-development');
  });
});
```

### 5.3 E2E Tests

**What to test:**
- Complete CLI workflows
- Cross-command interactions
- File persistence

**Example test structure:**
```typescript
// apps/cli-e2e/src/cli.spec.ts
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Overture CLI E2E', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'overture-e2e-'));
    process.chdir(testDir);
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should initialize, sync, and validate', () => {
    // Initialize
    execSync('overture init --type python-backend', { cwd: testDir });
    expect(fs.existsSync('.overture/config.yaml')).toBe(true);

    // Sync (skip plugins in test)
    execSync('overture sync --skip-plugins', { cwd: testDir });
    expect(fs.existsSync('.mcp.json')).toBe(true);
    expect(fs.existsSync('CLAUDE.md')).toBe(true);

    // Validate
    const result = execSync('overture validate', { cwd: testDir });
    expect(result.toString()).toContain('valid');
  });
});
```

### 5.4 Mock Strategy

**File System:**
```typescript
import { vol } from 'memfs';
jest.mock('fs/promises');
```

**Process Execution:**
```typescript
jest.mock('../infrastructure/process-executor');

ProcessExecutor.exec = jest.fn().mockResolvedValue({
  stdout: 'success',
  stderr: '',
  exitCode: 0,
});
```

**Templates:**
```typescript
jest.mock('../infrastructure/template-loader');

TemplateLoader.render = jest.fn().mockResolvedValue('mocked content');
```

---

## 6. Error Handling

### 6.1 Error Classes

**Hierarchy:**
```
Error
└── OvertureError (base)
    ├── ConfigError (exit code 2)
    ├── ValidationError (exit code 3)
    ├── PluginError (exit code 4)
    └── McpError (exit code 5)
```

### 6.2 Error Handling Patterns

**In services:**
```typescript
// Throw specific errors
if (!configExists) {
  throw new ConfigError('Configuration not found', configPath);
}
```

**In CLI commands:**
```typescript
try {
  await someOperation();
} catch (error) {
  Logger.error(`Operation failed: ${error.message}`);

  if (error instanceof OvertureError) {
    process.exit(error.exitCode);
  }

  process.exit(1);
}
```

**Global error handler (middleware):**
```typescript
// cli/middleware/error-handler.ts
export function handleError(error: Error): never {
  if (error instanceof OvertureError) {
    Logger.error(error.message);

    if (error instanceof ValidationError && error.issues.length > 0) {
      Logger.nl();
      Logger.error('Issues:');
      error.issues.forEach((issue) => Logger.error(`  - ${issue}`));
    }

    process.exit(error.exitCode);
  }

  Logger.error(`Unexpected error: ${error.message}`);

  if (process.env.DEBUG) {
    console.error(error.stack);
  }

  process.exit(1);
}
```

### 6.3 User-Friendly Messages

**Success:**
```
✓ Configuration created!
✓ Generated .mcp.json
✓ Generated CLAUDE.md
```

**Errors:**
```
✗ Configuration not found
  → Run `overture init` to create a new configuration

✗ MCP server 'python-repl' command not found
  → Install with: uvx install mcp-server-python-repl
```

**Warnings:**
```
⚠ Environment variable 'GITHUB_TOKEN' is not set
  (mcp.github.env.GITHUB_TOKEN)
```

### 6.4 Validation Error Context

```typescript
interface ValidationError {
  field: string;          // 'mcp.python-repl.command'
  message: string;        // 'Command not found on PATH'
  suggestion?: string;    // 'Install with: uvx install ...'
}
```

---

## 7. Cross-Platform Compatibility

### 7.1 Path Handling

**Always use:**
```typescript
import * as path from 'path';

// Good
const configPath = path.join(dir, '.overture', 'config.yaml');

// Bad
const configPath = `${dir}/.overture/config.yaml`;
```

### 7.2 Command Execution

**Platform detection:**
```typescript
// process-executor.ts
static async commandExists(command: string): Promise<boolean> {
  const which = process.platform === 'win32' ? 'where' : 'which';
  const result = await this.exec(which, [command]);
  return result.exitCode === 0;
}
```

**Command extensions (Windows):**
```typescript
const command = process.platform === 'win32'
  ? 'npm.cmd'
  : 'npm';
```

### 7.3 Home Directory

```typescript
import * as os from 'os';

const homeDir = os.homedir(); // Not '~'
```

### 7.4 Line Endings

```typescript
import * as os from 'os';

const content = lines.join(os.EOL); // Platform-appropriate
```

### 7.5 File Permissions

```typescript
// Check platform before setting executable
if (process.platform !== 'win32') {
  await fs.chmod(filePath, 0o755);
}
```

---

## 8. Development Workflow

### 8.1 Initial Setup

```bash
# Install dependencies
npm install commander zod js-yaml chalk inquirer execa handlebars

# Install dev dependencies
npm install -D @types/node @types/js-yaml @types/inquirer \
  jest ts-jest @types/jest memfs
```

### 8.2 Development Loop

**Terminal 1 - Watch mode:**
```bash
nx build @overture/cli --watch
```

**Terminal 2 - Test watch:**
```bash
nx test @overture/cli --watch
```

**Terminal 3 - Manual testing:**
```bash
cd /tmp/test-project
node /path/to/overture/dist/apps/cli/main.js init
```

### 8.3 Incremental Development Checklist

For each module:

1. **Write types/interfaces** in `domain/types.ts`
2. **Write schemas** in `domain/schemas.ts` (if needed)
3. **Implement module** with proper error handling
4. **Write unit tests** - aim for >80% coverage
5. **Test manually** with real data
6. **Update integration tests** if needed
7. **Document** with TSDoc comments

### 8.4 Type Safety Workflow

**Enable strict mode in tsconfig.json:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

**Use Zod for runtime validation:**
```typescript
// Define schema
const schema = z.object({ name: z.string() });

// Infer type
type Data = z.infer<typeof schema>;

// Validate at runtime
const result = schema.safeParse(data);
if (result.success) {
  // data is now typed as Data
  console.log(result.data.name);
}
```

**Avoid `any`:**
```typescript
// Bad
function process(data: any) { ... }

// Good
function process(data: unknown) {
  if (typeof data === 'object' && data !== null) {
    // Type narrowing
  }
}
```

### 8.5 Debugging

**Enable debug logging:**
```bash
DEBUG=1 overture sync
```

**Use VS Code launch config:**
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug CLI",
  "program": "${workspaceFolder}/dist/apps/cli/main.js",
  "args": ["init"],
  "cwd": "/tmp/test-project",
  "console": "integratedTerminal"
}
```

---

## 9. Dependencies Summary

### Production Dependencies

```json
{
  "commander": "^11.0.0",     // CLI framework
  "zod": "^3.22.0",           // Schema validation
  "js-yaml": "^4.1.0",        // YAML parsing
  "chalk": "^5.3.0",          // Colored output
  "inquirer": "^9.2.0",       // Interactive prompts
  "execa": "^8.0.0",          // Process execution
  "handlebars": "^4.7.8"      // Templates
}
```

### Development Dependencies

```json
{
  "@types/node": "^20.0.0",
  "@types/js-yaml": "^4.0.0",
  "@types/inquirer": "^9.0.0",
  "jest": "^29.0.0",
  "ts-jest": "^29.0.0",
  "@types/jest": "^29.0.0",
  "memfs": "^4.6.0",          // Mock file system
  "typescript": "^5.3.0"
}
```

---

## 10. Next Steps After Implementation

### Phase 5: Plugin Registry (Future)

Create `core/mcp-registry.ts`:

```typescript
export const PLUGIN_MCP_REGISTRY: Record<string, PluginMcpMapping> = {
  'python-development': {
    pluginName: 'python-development',
    requiredMcps: ['filesystem'],
    recommendedMcps: ['python-repl', 'ruff', 'sqlite'],
    usageHints: [
      {
        context: 'executing Python code',
        preferMcp: 'python-repl',
        reason: 'Direct Python REPL integration',
      },
      {
        context: 'linting or formatting',
        preferMcp: 'ruff',
        reason: 'Fast Python linter',
      },
    ],
  },
  // ... more plugins
};
```

### Phase 6: Advanced Features

- **Auto-detection**: Detect project type from files (package.json, pyproject.toml)
- **Interactive init**: Wizard-style initialization with plugin recommendations
- **Plugin search**: `overture plugin search <keyword>`
- **MCP marketplace**: Discover and install MCPs from registry
- **Dry-run mode**: `overture sync --dry-run` to preview changes

---

## 11. Success Criteria

Implementation is complete when:

1. ✅ All five commands work (`init`, `sync`, `validate`, `mcp list`, `mcp enable`)
2. ✅ Configuration files are correctly parsed and generated
3. ✅ Plugin installation executes successfully
4. ✅ `.mcp.json` and `CLAUDE.md` are generated correctly
5. ✅ Validation catches errors and provides helpful messages
6. ✅ Unit test coverage >80%
7. ✅ E2E tests pass on Linux, macOS, and Windows
8. ✅ Error messages are user-friendly
9. ✅ TypeScript strict mode enabled with no errors
10. ✅ Documentation is complete and accurate

---

## Summary

This implementation plan provides:

1. **Clear module structure** - Layered architecture with separation of concerns
2. **Type-safe design** - Zod schemas + TypeScript strict mode
3. **Incremental development** - Build and test one module at a time
4. **Comprehensive testing** - Unit, integration, and E2E tests
5. **Cross-platform support** - Works on Windows, macOS, Linux
6. **Error handling** - Custom errors with helpful messages
7. **Development workflow** - Watch mode, debugging, manual testing

Follow the implementation order (Foundation → Core → CLI → Templates) and test thoroughly at each phase. The modular design allows for easy testing and future enhancements.
