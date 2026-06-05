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
// https://sonarsource.github.io/rspec/#/rspec/S2137/javascript
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
const illegalNames = ['arguments'];
const objectPrototypeProperties = [
    'constructor',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toLocaleString',
    'toString',
    'valueOf',
];
const deprecatedNames = ['escape', 'unescape'];
const getDeclarationIssue = (redeclareType) => (name) => ({
    messageId: 'forbidDeclaration',
    data: { symbol: name, type: redeclareType },
});
const getModificationIssue = (functionName) => ({
    messageId: 'removeModification',
    data: { symbol: functionName },
});
exports.rule = {
    meta: (0, index_js_1.generateMeta)(meta, {
        messages: {
            removeModification: 'Remove the modification of "{{symbol}}".',
            forbidDeclaration: 'Do not use "{{symbol}}" to declare a {{type}} - use another name.',
        },
    }),
    create(context) {
        return {
            'FunctionDeclaration, FunctionExpression'(node) {
                const func = node;
                reportBadUsageOnFunction(func, func.id, context);
            },
            ArrowFunctionExpression(node) {
                reportBadUsageOnFunction(node, undefined, context);
            },
            VariableDeclaration(node) {
                node.declarations.forEach(decl => {
                    reportGlobalShadowing(decl.id, getDeclarationIssue('variable'), context, decl.init != null);
                });
            },
            UpdateExpression(node) {
                reportGlobalShadowing(node.argument, getModificationIssue, context, true);
            },
            AssignmentExpression(node) {
                reportGlobalShadowing(node.left, getModificationIssue, context, true);
            },
            CatchClause(node) {
                reportGlobalShadowing(node.param, getDeclarationIssue('variable'), context, true);
            },
        };
    },
};
function reportBadUsageOnFunction(func, id, context) {
    reportGlobalShadowing(id, getDeclarationIssue('function'), context, true);
    func.params.forEach(p => {
        reportGlobalShadowing(p, getDeclarationIssue('parameter'), context, false);
    });
}
function reportGlobalShadowing(node, buildMessageAndData, context, isWrite) {
    if (node) {
        switch (node.type) {
            case 'Identifier': {
                if (isGlobalShadowing(node.name, isWrite) && !isShadowingException(node.name)) {
                    context.report({
                        node,
                        ...buildMessageAndData(node.name),
                    });
                }
                break;
            }
            case 'RestElement':
                reportGlobalShadowing(node.argument, buildMessageAndData, context, true);
                break;
            case 'ObjectPattern':
                node.properties.forEach(prop => {
                    if (prop.type === 'Property') {
                        reportGlobalShadowing(prop.value, buildMessageAndData, context, true);
                    }
                    else {
                        reportGlobalShadowing(prop.argument, buildMessageAndData, context, true);
                    }
                });
                break;
            case 'ArrayPattern':
                node.elements.forEach(elem => {
                    reportGlobalShadowing(elem, buildMessageAndData, context, true);
                });
                break;
            case 'AssignmentPattern':
                reportGlobalShadowing(node.left, buildMessageAndData, context, true);
                break;
        }
    }
}
function isGlobalShadowing(name, isWrite) {
    return isIllegalName(name) || isBuiltInName(name) || isUndefinedShadowing(isWrite, name);
}
function isIllegalName(name) {
    return illegalNames.includes(name);
}
function isBuiltInName(name) {
    return index_js_1.globalsByLibraries.builtin.includes(name);
}
function isUndefinedShadowing(isWrite, name) {
    return isWrite && name === 'undefined';
}
function isShadowingException(name) {
    return isObjectPrototypeProperty(name) || isDeprecatedName(name);
}
function isObjectPrototypeProperty(name) {
    return objectPrototypeProperties.includes(name);
}
function isDeprecatedName(name) {
    return deprecatedNames.includes(name);
}
