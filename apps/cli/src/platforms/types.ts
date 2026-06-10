// Detector output types (CLI-side).
// The domain types (PlatformId, InstallMarker, McpLocation, ...) moved
// to @overture/agents. This file now contains only the types emitted by
// the detector and consumed by the CLI's CLI/JSON output formatters.
//
// TEMPORARY: re-export the domain types so the legacy `apps/cli/src/platforms/agents/*.ts`
// files keep compiling during the extraction refactor. These re-exports
// will be removed in the next commit when the agent files move to
// packages/agents/.
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

export type {
  DetectionConfidence,
  InstallMarker,
  MatchedExecutable,
  MatchedMcpLocation,
  McpLocation,
  McpSupport,
  PlatformId,
  ReasonCode,
  MarkerKind,
  PathBase,
  McpLocationScope,
  McpLocationFormat,
  DetectionStrategy,
  PlatformRegistryEntry,
  PathResolutionContext,
  HostPlatform,
} from '@overture/agents';

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
