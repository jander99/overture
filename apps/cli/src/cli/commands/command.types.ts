/**
 * Command-specific type definitions
 *
 * This file contains TypeScript interfaces for CLI command helper functions
 * that don't fit in the main domain types.
 *
 * @module cli/commands/types
 */

import type { ConfigLoader , PathResolver } from '@overture/config-core';
import type { FilesystemPort } from '@overture/ports-filesystem';
import type { OutputPort } from '@overture/ports-output';
import type { ImportService } from '@overture/import-core';
import type { McpServerConfig } from '@overture/config-types';

/**
 * Dependencies for MCP command helper functions
 */
export interface McpCommandDeps {
  configLoader: ConfigLoader;
  pathResolver: PathResolver;
  filesystem: FilesystemPort;
  output: OutputPort;
}

/**
 * MCP server display item with scope information
 */
export interface McpDisplayItem {
  name: string;
  config: McpServerConfig;
  scope: 'global' | 'project';
}

/**
 * Options for MCP list command
 */
export interface McpListOptions {
  scope?: string;
  client?: string;
}

/**
 * Dependencies for import command helper functions
 */
export interface ImportCommandDeps {
  importService: ImportService;
  pathResolver: PathResolver;
  output: OutputPort;
}

/**
 * Options for import detection mode
 */
export interface ImportDetectOptions {
  detect?: boolean;
  client?: string;
  format?: 'text' | 'table' | 'json';
}

/**
 * Options for import interactive mode
 */
export interface ImportInteractiveOptions {
  client?: string;
  interactive?: boolean;
  dryRun?: boolean;
}

/**
 * Combined import command options
 */
export type ImportCommandOptions = ImportDetectOptions &
  ImportInteractiveOptions;
