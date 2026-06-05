"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripBOM = stripBOM;
exports.toUnixPath = toUnixPath;
exports.isRoot = isRoot;
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
const path_1 = __importDefault(require("path"));
/**
 * Byte Order Marker
 */
const BOM_BYTE = 0xfeff;
/**
 * Removes any Byte Order Marker (BOM) from a string's head
 *
 * A string's head is nothing else but its first character.
 *
 * @param str the input string
 * @returns the stripped string
 */
function stripBOM(str) {
    if (str.charCodeAt(0) === BOM_BYTE) {
        return str.slice(1);
    }
    return str;
}
/**
 * Converts a path to Unix format
 * @param path the path to convert
 * @returns the converted path
 */
function toUnixPath(path) {
    return path.replace(/[\\/]+/g, '/');
}
function isRoot(file) {
    const result = path_1.default.parse(file);
    return toUnixPath(file) === toUnixPath(result.root);
}
