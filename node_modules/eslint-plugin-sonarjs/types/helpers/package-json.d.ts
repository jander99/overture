import { type PackageJson } from 'type-fest';
import { Minimatch } from 'minimatch';
import { type Filesystem } from './find-up.js';
export declare const PACKAGE_JSON = "package.json";
type MinimatchDependency = {
    name: Minimatch;
    version?: string;
};
type NamedDependency = {
    name: string;
    version?: string;
};
type Dependency = MinimatchDependency | NamedDependency;
/**
 * Cache for the available dependencies by dirname. Exported for tests
 */
export declare const cache: Map<string, Set<Dependency>>;
export declare function getClosestPackageJSONDir(filename: string, cwd: string): string;
/**
 * Retrieve the dependencies of all the package.json files available for the given file.
 *
 * @param filename context.filename
 * @param cwd working dir, will search up to that root
 * @returns
 */
export declare function getDependencies(filename: string, cwd: string): Set<string | Minimatch>;
export declare function fillCacheWithNewPath(dirname: string, manifests: PackageJson[]): Set<string | Minimatch>;
/**
 * In the case of SonarIDE, when a package.json file changes, the cache can become obsolete.
 */
export declare function clearDependenciesCache(): void;
export declare function getDependenciesFromPackageJson(content: PackageJson): Set<Dependency>;
/**
 * Returns the project manifests that are used to resolve the dependencies imported by
 * the module named `filename`, up to the passed working directory.
 */
export declare const getManifests: (dir: string, workingDirectory?: string, fileSystem?: Filesystem) => Array<PackageJson>;
export {};
