"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getManifests = exports.cache = exports.PACKAGE_JSON = void 0;
exports.getClosestPackageJSONDir = getClosestPackageJSONDir;
exports.getDependencies = getDependencies;
exports.fillCacheWithNewPath = fillCacheWithNewPath;
exports.clearDependenciesCache = clearDependenciesCache;
exports.getDependenciesFromPackageJson = getDependenciesFromPackageJson;
/*
 * SonarQube JavaScript Plugin
 * Copyright (C) 2011-2025 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the Sonar Source-Available License Version 1, as published by SonarSource SA.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the Sonar Source-Available License for more details.
 *
 * You should have received a copy of the Sonar Source-Available License
 * along with this program; if not, see https://sonarsource.com/license/ssal/
 */
const posix_1 = __importDefault(require("path/posix"));
const files_js_1 = require("./files.js");
const minimatch_1 = require("minimatch");
const find_up_js_1 = require("./find-up.js");
const fs_1 = __importDefault(require("fs"));
exports.PACKAGE_JSON = 'package.json';
/**
 * The {@link FindUp} instance dedicated to retrieving `package.json` files
 */
const findPackageJsons = (0, find_up_js_1.createFindUp)(exports.PACKAGE_JSON);
const DefinitelyTyped = '@types/';
/**
 * Cache for the available dependencies by dirname. Exported for tests
 */
exports.cache = new Map();
/**
 * Cache for dirName (of a source file) to the dirName of the closest package.json
 */
const dirNameToClosestPackageJSONCache = new Map();
function getClosestPackageJSONDir(filename, cwd) {
    const dirname = posix_1.default.dirname((0, files_js_1.toUnixPath)(filename));
    if (!dirNameToClosestPackageJSONCache.has(dirname)) {
        const files = findPackageJsons(dirname, cwd, fs_1.default);
        // take the longest filepath as that will be the closest package.json to the provided file
        dirNameToClosestPackageJSONCache.set(dirname, files
            .map(file => file.path)
            .reduce((prev, current) => (prev.length > current.length ? prev : current), cwd));
    }
    return dirNameToClosestPackageJSONCache.get(dirname);
}
/**
 * Retrieve the dependencies of all the package.json files available for the given file.
 *
 * @param filename context.filename
 * @param cwd working dir, will search up to that root
 * @returns
 */
function getDependencies(filename, cwd) {
    const closestPackageJSONDirName = getClosestPackageJSONDir(filename, cwd);
    if (!exports.cache.has(closestPackageJSONDirName)) {
        fillCacheWithNewPath(closestPackageJSONDirName, (0, exports.getManifests)(closestPackageJSONDirName, cwd, fs_1.default));
    }
    return new Set([...exports.cache.get(closestPackageJSONDirName)].map(item => item.name));
}
function fillCacheWithNewPath(dirname, manifests) {
    const result = new Set();
    exports.cache.set(dirname, result);
    manifests.forEach(manifest => {
        const manifestDependencies = getDependenciesFromPackageJson(manifest);
        manifestDependencies.forEach(dependency => {
            result.add(dependency);
        });
    });
    return new Set([...result].map(item => item.name));
}
/**
 * In the case of SonarIDE, when a package.json file changes, the cache can become obsolete.
 */
function clearDependenciesCache() {
    exports.cache.clear();
    dirNameToClosestPackageJSONCache.clear();
}
function getDependenciesFromPackageJson(content) {
    const result = new Set();
    if (content.name) {
        addDependencies(result, { [content.name]: '*' });
    }
    if (content.dependencies !== undefined) {
        addDependencies(result, content.dependencies);
    }
    if (content.devDependencies !== undefined) {
        addDependencies(result, content.devDependencies);
    }
    if (content.peerDependencies !== undefined) {
        addDependencies(result, content.peerDependencies);
    }
    if (content.optionalDependencies !== undefined) {
        addDependencies(result, content.optionalDependencies);
    }
    if (content._moduleAliases !== undefined) {
        addDependencies(result, content._moduleAliases);
    }
    if (Array.isArray(content.workspaces)) {
        addDependenciesArray(result, content.workspaces);
    }
    else if (content.workspaces?.packages) {
        addDependenciesArray(result, content.workspaces?.packages);
    }
    return result;
}
function addDependencies(result, dependencies, isGlob = false) {
    Object.keys(dependencies)
        .filter(name => {
        // Add this filter, as the PackageJson.Dependency can be any arbitrary JSON contrary to the claimed Record<String, String> typing.
        const value = dependencies[name];
        return typeof value === 'string' || typeof value === 'undefined';
    })
        .forEach(name => addDependency(result, name, isGlob, dependencies[name]));
}
function addDependenciesArray(result, dependencies, isGlob = true) {
    dependencies.forEach(name => addDependency(result, name, isGlob));
}
function addDependency(result, dependency, isGlob, version) {
    if (isGlob) {
        result.add({
            name: new minimatch_1.Minimatch(dependency, { nocase: true, matchBase: true }),
            version,
        });
    }
    else {
        result.add({
            name: dependency.startsWith(DefinitelyTyped)
                ? dependency.substring(DefinitelyTyped.length)
                : dependency,
            version,
        });
    }
}
/**
 * Returns the project manifests that are used to resolve the dependencies imported by
 * the module named `filename`, up to the passed working directory.
 */
const getManifests = (dir, workingDirectory, fileSystem) => {
    const files = findPackageJsons(dir, workingDirectory, fileSystem);
    return files.map(file => {
        const content = file.content;
        try {
            return JSON.parse((0, files_js_1.stripBOM)(content.toString()));
        }
        catch (error) {
            console.debug(`Error parsing file ${file.path}: ${error}`);
            return {};
        }
    });
};
exports.getManifests = getManifests;
