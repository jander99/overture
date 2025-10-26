import { z } from 'zod';

// MCP Server schema
export const McpServerSchema = z.object({
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
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
  plugins: z.record(z.string(), PluginSchema),
  mcp: z.record(z.string(), McpServerSchema),
});

// MCP JSON output schema
export const McpJsonSchema = z.object({
  mcpServers: z.record(z.string(), z.object({
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
  })),
});

// TypeScript types inferred from schemas
export type McpServer = z.infer<typeof McpServerSchema>;
export type Plugin = z.infer<typeof PluginSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type OvertureConfig = z.infer<typeof OvertureConfigSchema>;
export type McpJson = z.infer<typeof McpJsonSchema>;
