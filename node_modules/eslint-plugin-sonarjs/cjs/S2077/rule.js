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
// https://sonarsource.github.io/rspec/#/rspec/S2077/javascript
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
const dbModules = ['pg', 'mysql', 'mysql2', 'sequelize'];
exports.rule = {
    meta: (0, index_js_1.generateMeta)(meta, {
        messages: {
            safeQuery: `Make sure that executing SQL queries is safe here.`,
        },
    }),
    create(context) {
        let isDbModuleImported = false;
        return {
            Program() {
                // init flag for each file
                isDbModuleImported = false;
            },
            ImportDeclaration(node) {
                const { source } = node;
                if (dbModules.includes(String(source.value))) {
                    isDbModuleImported = true;
                }
            },
            CallExpression(node) {
                const call = node;
                const { callee, arguments: args } = call;
                if ((0, index_js_1.isRequireModule)(call, ...dbModules)) {
                    isDbModuleImported = true;
                    return;
                }
                if (isDbModuleImported &&
                    (0, index_js_1.isMemberWithProperty)(callee, 'query') &&
                    isQuestionable(args[0])) {
                    context.report({
                        messageId: 'safeQuery',
                        node: callee,
                    });
                }
            },
        };
    },
};
function isQuestionable(sqlQuery) {
    if (!sqlQuery) {
        return false;
    }
    if (isTemplateWithVar(sqlQuery)) {
        return true;
    }
    if (isConcatenation(sqlQuery)) {
        return isVariableConcat(sqlQuery);
    }
    return (sqlQuery.type === 'CallExpression' && (0, index_js_1.isMemberWithProperty)(sqlQuery.callee, 'concat', 'replace'));
}
function isVariableConcat(node) {
    const { left, right } = node;
    if (!isHardcodedLiteral(right)) {
        return true;
    }
    if (isConcatenation(left)) {
        return isVariableConcat(left);
    }
    return !isHardcodedLiteral(left);
}
function isTemplateWithVar(node) {
    return node.type === 'TemplateLiteral' && node.expressions.length !== 0;
}
function isTemplateWithoutVar(node) {
    return node.type === 'TemplateLiteral' && node.expressions.length === 0;
}
function isConcatenation(node) {
    return node.type === 'BinaryExpression' && node.operator === '+';
}
function isHardcodedLiteral(node) {
    return node.type === 'Literal' || isTemplateWithoutVar(node);
}
