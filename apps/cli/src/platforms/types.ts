export type PlatformId =
  | 'claude-code'
  | 'claude-desktop'
  | 'opencode'
  | 'github-copilot-vscode'
  | 'github-copilot-cli'
  | 'github-copilot-cloud-agent'
  | 'cursor'
  | 'windsurf'
  | 'cline'
  | 'roo-code'
  | 'continue'
  | 'zed'
  | 'openai-codex'
  | 'aider';

import type { HostPlatform } from '@overture/os';
export type { HostPlatform };
export type DetectionConfidence = 'high' | 'medium' | 'low' | 'unsupported';
export type MarkerKind = 'file' | 'directory' | 'file-or-directory';
export type PathBase = 'home' | 'config' | 'workspace' | 'absolute';
export type McpLocationScope =
  | 'project'
  | 'user'
  | 'profile'
  | 'repository'
  | 'managed';
export type McpLocationFormat =
  | 'json'
  | 'jsonc'
  | 'yaml'
  | 'toml'
  | 'web-settings';

export type DetectionStrategy = 'binary-first' | 'marker-only';
export type McpSupport = 'supported' | 'unsupported' | 'unknown';
export type ReasonCode =
  | 'binary-found'
  | 'marker-found'
  | 'mcp-configured'
  | 'orphaned-mcp-config'
  | 'unsupported-no-local-signal'
  | 'unsupported-no-mcp-client'
  | 'not-detected'
  | 'parse-error';

export interface InstallMarker {
  id: string;
  kind: MarkerKind;
  base: PathBase;
  relativePath: string;
  platforms?: HostPlatform[];
  confidence: DetectionConfidence;
  reason: string;
}

export interface McpLocation {
  scope: McpLocationScope;
  base: PathBase;
  relativePath: string;
  platforms?: HostPlatform[];
  format: McpLocationFormat;
  topLevelKey?: string;
  notes?: string;
}

export interface MatchedExecutable {
  name: string;
  resolvedPath: string;
  source: 'path' | 'wsl' | 'windows';
}

export interface MatchedMcpLocation {
  id: string;
  resolvedPath: string;
  format: McpLocationFormat;
  topLevelKey?: string;
  nonEmpty: boolean;
  parseError?: string;
}

export interface PlatformRegistryEntry {
  id: PlatformId;
  displayName: string;
  installMarkers: InstallMarker[];
  mcpLocations: McpLocation[];
  defaultConfidence: DetectionConfidence;
  detectionStrategy: DetectionStrategy;
  mcpSupport: McpSupport;
  executableNames: readonly string[];
  reason?: string;
}

export interface PathResolutionContext {
  homeDir: string;
  configDir: string;
  workspaceDir: string;
  platform: HostPlatform;
}

export interface PlatformDetectionResult {
  id: PlatformId;
  displayName: string;
  installed: boolean;
  confidence: DetectionConfidence;
  matchedMarkers: string[];
  installMarkers: InstallMarker[];
  mcpLocations: McpLocation[];
  detectionStrategy: DetectionStrategy;
  mcpSupport: McpSupport;
  executableNames: readonly string[];
  matchedExecutables: readonly MatchedExecutable[];
  mcpConfigured: boolean;
  matchedMcpLocations: readonly MatchedMcpLocation[];
  orphanedMcpLocations: readonly MatchedMcpLocation[];
  reasonCode: ReasonCode;
  reason?: string;
}

export interface DetectJsonOutput {
  platforms: PlatformDetectionResult[];
}
