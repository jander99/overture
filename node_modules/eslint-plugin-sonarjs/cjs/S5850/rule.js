"use strict";
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
// https://sonarsource.github.io/rspec/#/rspec/S5850/javascript
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.rule = void 0;
const index_js_1 = require("../helpers/index.js");
const meta = __importStar(require("./generated-meta.js"));
const rule_template_js_1 = require("../helpers/regex/rule-template.js");
var Position;
(function (Position) {
    Position[Position["BEGINNING"] = 0] = "BEGINNING";
    Position[Position["END"] = 1] = "END";
})(Position || (Position = {}));
exports.rule = (0, rule_template_js_1.createRegExpRule)(context => {
    return {
        onPatternEnter: (pattern) => {
            const { alternatives } = pattern;
            if (alternatives.length > 1 &&
                (anchoredAt(alternatives, Position.BEGINNING) || anchoredAt(alternatives, Position.END)) &&
                notAnchoredElseWhere(alternatives)) {
                context.reportRegExpNode({
                    message: 'Group parts of the regex together to make the intended operator precedence explicit.',
                    node: context.node,
                    regexpNode: pattern,
                });
            }
        },
    };
}, (0, index_js_1.generateMeta)(meta));
function anchoredAt(alternatives, position) {
    const itemIndex = position === Position.BEGINNING ? 0 : alternatives.length - 1;
    const firstOrLast = alternatives[itemIndex];
    return isAnchored(firstOrLast, position);
}
function notAnchoredElseWhere(alternatives) {
    if (isAnchored(alternatives[0], Position.END) ||
        isAnchored(alternatives[alternatives.length - 1], Position.BEGINNING)) {
        return false;
    }
    for (const alternative of alternatives.slice(1, alternatives.length - 1)) {
        if (isAnchored(alternative, Position.BEGINNING) || isAnchored(alternative, Position.END)) {
            return false;
        }
    }
    return true;
}
function isAnchored(alternative, position) {
    const { elements } = alternative;
    if (elements.length === 0) {
        return false;
    }
    const index = position === Position.BEGINNING ? 0 : elements.length - 1;
    const firstOrLast = elements[index];
    return isAnchor(firstOrLast);
}
function isAnchor(element) {
    return element.type === 'Assertion' && (element.kind === 'start' || element.kind === 'end');
}
