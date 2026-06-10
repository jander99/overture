// Detector output types (CLI-side).
// The domain types (PlatformId, InstallMarker, McpLocation, ...) moved
// to @overture/agents. This file contains only the types emitted by the
// detector and consumed by the CLI's CLI/JSON output formatters.
import type {
  DetectionConfidence,
  DetectionStrategy,
  InstallMarker,
  MatchedExecutable,
  MatchedMcpLocation,
  McpLocation,
  McpSupport,
  PlatformId,
  ReasonCode,
} from '@overture/agents';

export type { HostPlatform } from '@overture/agents';

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
