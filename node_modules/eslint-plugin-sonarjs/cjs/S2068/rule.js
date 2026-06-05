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
// https://sonarsource.github.io/rspec/#/rspec/S2068/javascript
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
exports.rule = void 0;
const index_js_1 = require("../helpers/index.js");
const path_1 = __importDefault(require("path"));
const meta = __importStar(require("./generated-meta.js"));
const DEFAULT_NAMES = ['password', 'pwd', 'passwd', 'passphrase'];
const messages = {
    reviewPassword: 'Review this potentially hard-coded password.',
};
exports.rule = {
    meta: (0, index_js_1.generateMeta)(meta, { messages }),
    create(context) {
        const dir = path_1.default.dirname(context.physicalFilename);
        const parts = dir.split(path_1.default.sep).map(part => part.toLowerCase());
        if (parts.includes('l10n')) {
            return {};
        }
        const variableNames = context.options[0]?.passwordWords ?? DEFAULT_NAMES;
        const lowerCaseVariableNames = variableNames.map(name => name.toLowerCase());
        const literalRegExp = lowerCaseVariableNames.map(name => new RegExp(`${name}=.+`));
        return {
            VariableDeclarator: (node) => {
                const declaration = node;
                checkAssignment(context, lowerCaseVariableNames, declaration.id, declaration.init);
            },
            AssignmentExpression: (node) => {
                const assignment = node;
                checkAssignment(context, lowerCaseVariableNames, assignment.left, assignment.right);
            },
            Property: (node) => {
                const property = node;
                checkAssignment(context, lowerCaseVariableNames, property.key, property.value);
            },
            Literal: (node) => {
                const literal = node;
                checkLiteral(context, literalRegExp, literal);
            },
        };
    },
};
function checkAssignment(context, patterns, variable, initializer) {
    if (initializer &&
        (0, index_js_1.isStringLiteral)(initializer) &&
        initializer.value.length > 0 &&
        patterns.some(pattern => context.sourceCode.getText(variable).toLowerCase().includes(pattern))) {
        context.report({
            messageId: 'reviewPassword',
            node: initializer,
        });
    }
}
function checkLiteral(context, patterns, literal) {
    if ((0, index_js_1.isStringLiteral)(literal) &&
        patterns.some(pattern => pattern.test(literal.value.toLowerCase()))) {
        context.report({
            messageId: 'reviewPassword',
            node: literal,
        });
    }
}
