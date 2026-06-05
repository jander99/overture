"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFindUp = void 0;
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
const Path = __importStar(require("node:path/posix"));
const minimatch_1 = require("minimatch");
const files_js_1 = require("./files.js");
const fs_1 = __importDefault(require("fs"));
/**
 * Create an instance of FindUp.
 */
const createFindUp = (pattern) => {
    const cache = new Map();
    const matcher = new minimatch_1.Minimatch(pattern);
    const findUp = (from, to, filesystem = fs_1.default) => {
        return _findUp((0, files_js_1.toUnixPath)(from), to ? (0, files_js_1.toUnixPath)(to) : undefined, filesystem);
    };
    const _findUp = (from, to, filesystem = fs_1.default) => {
        const results = [];
        if (from === '.') {
            // handle path.dirname returning "." in windows
            return results;
        }
        let cacheContent = cache.get(from);
        if (cacheContent === undefined) {
            cacheContent = [];
            cache.set(from, cacheContent);
            try {
                for (const entry of filesystem.readdirSync(from)) {
                    const fullEntryPath = Path.join(from, entry.toString());
                    const basename = Path.basename(fullEntryPath);
                    if (matcher.match(basename)) {
                        let stats;
                        // the resource may not be available
                        try {
                            stats = filesystem.statSync(fullEntryPath);
                        }
                        catch (error) {
                            // todo: this is testable and should be tested
                            stats = {
                                isFile: () => false,
                            };
                        }
                        if (stats.isFile()) {
                            cacheContent.push({
                                path: fullEntryPath,
                                content: filesystem.readFileSync(fullEntryPath),
                            });
                        }
                    }
                }
            }
            catch { }
        }
        results.push(...cacheContent);
        if (!(0, files_js_1.isRoot)(from) && from !== to) {
            const parent = Path.dirname(from);
            results.push(..._findUp(parent, to, filesystem));
        }
        return results;
    };
    return findUp;
};
exports.createFindUp = createFindUp;
