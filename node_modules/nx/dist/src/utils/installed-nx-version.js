"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInstalledNxVersion = getInstalledNxVersion;
const tslib_1 = require("tslib");
const node_module_1 = tslib_1.__importStar(require("node:module"));
const fileutils_1 = require("./fileutils");
const workspace_root_1 = require("./workspace-root");
const installation_directory_1 = require("./installation-directory");
/**
 * Resolve the workspace's installed `nx` version, or `null` if no installed
 * `nx` can be located. Routed through a cache-shielded, self-reference-free
 * `require.resolve` so the answer always reflects the workspace's
 * `node_modules`/PnP store rather than whichever `nx` package happens to be
 * loaded in the current process. See nrwl/nx#35444.
 */
function getInstalledNxVersion() {
    const nxPackageJsonPath = resolvePackageJsonWithoutCachePollution('nx', (0, installation_directory_1.getNxRequirePaths)(workspace_root_1.workspaceRoot));
    if (!nxPackageJsonPath) {
        return null;
    }
    try {
        return (0, fileutils_1.readJsonFile)(nxPackageJsonPath).version ?? null;
    }
    catch {
        return null;
    }
}
/**
 * Resolve `<packageName>/package.json` via Node's CJS resolver while
 * neutralising both ways `require.resolve(req, { paths })` can lie about
 * the `paths` argument:
 *
 *   1. Process-wide `Module._pathCache` — swapped out for the duration of
 *      the call, so any cache entries written are discarded and any
 *      previously-poisoned entries are not read. Without this, an
 *      in-process load of a second `nx` package (e.g. the temp `nx@latest`
 *      install used by the daemon's AI-agents and console-status checks)
 *      can poison the cache key this call uses and make us read the temp
 *      path instead of the workspace path.
 *
 *   2. Package self-reference — when a file inside package `nx` calls
 *      `require.resolve('nx/...')`, Node returns that calling package's
 *      own file regardless of `paths`. We avoid that by issuing the
 *      resolve from a `createRequire` rooted at a synthetic path that is
 *      outside any package, so the resolver has no "self" to reference
 *      and must honour `paths`.
 *
 * Node's single-threaded synchronous execution means `require.resolve` does
 * not yield, so no other code in the process can observe the swapped cache.
 */
function resolvePackageJsonWithoutCachePollution(packageName, requirePaths) {
    // `_pathCache` is an internal Node API not exposed in @types/node.
    const realCache = node_module_1.default._pathCache;
    node_module_1.default._pathCache = Object.create(null);
    try {
        const detachedRequire = (0, node_module_1.createRequire)('/__nx_detached_resolver__/x.js');
        return detachedRequire.resolve(`${packageName}/package.json`, {
            paths: requirePaths,
        });
    }
    catch {
        return null;
    }
    finally {
        node_module_1.default._pathCache = realCache;
    }
}
