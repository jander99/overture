/**
 * Resolve the workspace's installed `nx` version, or `null` if no installed
 * `nx` can be located. Routed through a cache-shielded, self-reference-free
 * `require.resolve` so the answer always reflects the workspace's
 * `node_modules`/PnP store rather than whichever `nx` package happens to be
 * loaded in the current process. See nrwl/nx#35444.
 */
export declare function getInstalledNxVersion(): string | null;
