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
// https://sonarsource.github.io/rspec/#/rspec/S2301/javascript
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
const message = 'Provide multiple methods instead of using "{{parameterName}}" to determine which action to take.';
/**
 * A suspect test node is a test node that is the only child of a function body
 */
exports.rule = {
    meta: (0, index_js_1.generateMeta)(meta, {
        messages: {
            message,
        },
    }),
    create: context => {
        if (!(0, index_js_1.isRequiredParserServices)(context.sourceCode.parserServices)) {
            return {};
        }
        const suspectTestNodes = [];
        const suspectBodies = [];
        const suspectReturnStatements = [];
        const handleFunctionBody = (node) => {
            const statements = node.body;
            if (statements.length === 1) {
                suspectBodies.push(statements[0]);
            }
        };
        const isAChildOf = (identifier, node) => {
            if (identifier.parent === node) {
                return true;
            }
            if (identifier.parent === null) {
                return false;
            }
            return isAChildOf(identifier.parent, node);
        };
        return {
            FunctionDeclaration: node => {
                handleFunctionBody(node.body);
            },
            FunctionExpression: node => {
                handleFunctionBody(node.body);
            },
            ArrowFunctionExpression: node => {
                if (node.body.type === 'BlockStatement') {
                    handleFunctionBody(node.body);
                }
            },
            Identifier: node => {
                // An identifier is suspect if it is a direct or indirect child of a suspect node,
                // or if it is a suspect node itself
                const isSuspect = suspectTestNodes.find(testNode => {
                    return testNode === node || isAChildOf(node, testNode);
                }) !== undefined;
                if (!isSuspect) {
                    return;
                }
                const variable = (0, index_js_1.getVariableFromIdentifier)(node, context.sourceCode.getScope(node));
                if (variable) {
                    const definition = variable.defs[variable.defs.length - 1];
                    if (definition?.type === 'Parameter') {
                        const type = (0, index_js_1.getTypeFromTreeNode)(definition.name, context.sourceCode.parserServices);
                        const definitionParent = definition.name.parent;
                        if ((0, index_js_1.isBooleanType)(type) && definitionParent?.type !== 'Property') {
                            (0, index_js_1.report)(context, {
                                message,
                                loc: node.loc,
                                data: {
                                    parameterName: variable.name,
                                },
                            }, [
                                (0, index_js_1.toSecondaryLocation)(definition.name, `Parameter "${variable.name}" was declared here`),
                            ]);
                        }
                    }
                }
            },
            ConditionalExpression: node => {
                /**
                 * A conditional expression is suspect if it is the direct child of a suspect body or the direct child of a suspect return statement
                 */
                const parent = node.parent;
                if (suspectBodies.includes(parent) || suspectReturnStatements.includes(parent)) {
                    suspectTestNodes.push(node.test);
                }
            },
            IfStatement: node => {
                if (suspectBodies.includes(node) && node.alternate) {
                    suspectTestNodes.push(node.test);
                }
            },
            'IfStatement:exit': node => {
                if (suspectBodies.includes(node) && node.alternate) {
                    suspectTestNodes.pop();
                }
            },
            ReturnStatement: node => {
                if (suspectBodies.includes(node)) {
                    suspectReturnStatements.push(node);
                }
            },
            'ReturnStatement:exit': node => {
                if (suspectBodies.includes(node)) {
                    suspectReturnStatements.pop();
                }
            },
        };
    },
};
