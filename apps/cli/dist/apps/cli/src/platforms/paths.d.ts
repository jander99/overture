import type { HostPlatform, InstallMarker, MatchedExecutable, PathResolutionContext } from './types.js';
export declare function resolveMarkerPath(marker: InstallMarker, ctx: PathResolutionContext): string;
export declare function markerExists(marker: InstallMarker, ctx: PathResolutionContext): Promise<boolean>;
export interface FindExecutablesOptions {
    pathString: string;
    platform: HostPlatform;
    pathext?: string;
    wslWindowsPath?: string;
}
export declare function findExecutablesInPath(names: readonly string[], options: FindExecutablesOptions): Promise<MatchedExecutable[]>;
//# sourceMappingURL=paths.d.ts.map