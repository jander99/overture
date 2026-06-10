// Public @overture/agents surface.
//
// Re-exports the per-file agent registry, the AgentDefinition contract,
// and all public read/parse helpers + *McpConfig types. Lower-level
// schema primitives (McpServerMap, StringMap, StdioServerBase,
// RemoteServerBase, PermissiveConfigObject, McpLocationFormat) stay
// internal to the package — consumers go through the AgentDefinition
// surface and the per-agent read/parse functions.
//
// Order matters: the aggregate below pins the agent id order via the
// canonical positional index that downstream consumers (CLI JSON
// output, future tools) rely on. The legacy `platformRegistry` shim in
// apps/cli re-exports this same array by reference.
export type {
  PlatformId,
  DetectionConfidence,
  MarkerKind,
  PathBase,
  McpLocationScope,
  McpLocationFormat,
  DetectionStrategy,
  McpSupport,
  ReasonCode,
  InstallMarker,
  McpLocation,
  MatchedExecutable,
  MatchedMcpLocation,
  PlatformRegistryEntry,
  PathResolutionContext,
  HostPlatform,
} from './types.js';
