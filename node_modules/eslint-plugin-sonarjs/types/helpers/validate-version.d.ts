/**
 * Minimum version per reference
 */
type MinimumVersions = {
    node?: string;
};
/**
 * Checks if context where the filename is located supports the provided
 * minimum versions.
 */
export declare function isSupported(dirname: string, minVersions: MinimumVersions): boolean;
export {};
