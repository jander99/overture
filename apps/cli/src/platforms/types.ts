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

export type HostPlatform = 'linux' | 'darwin' | 'win32';
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

export interface PlatformRegistryEntry {
  id: PlatformId;
  displayName: string;
  installMarkers: InstallMarker[];
  mcpLocations: McpLocation[];
  defaultConfidence: DetectionConfidence;
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
  reason?: string;
}

export interface DetectJsonOutput {
  platforms: PlatformDetectionResult[];
}
