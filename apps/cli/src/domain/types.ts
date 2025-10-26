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
