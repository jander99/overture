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
// https://sonarsource.github.io/rspec/#/rspec/S1488
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
const typescript_1 = require("typescript");
exports.rule = {
    meta: (0, index_js_1.generateMeta)(meta, {
        messages: {
            doImmediateAction: 'Immediately {{action}} this expression instead of assigning it to the temporary variable "{{variable}}".',
        },
        fixable: 'code',
    }),
    create(context) {
        return {
            BlockStatement(node) {
                processStatements(node, node.body);
            },
            SwitchCase(node) {
                processStatements(node, node.consequent);
            },
        };
        function processStatements(node, statements) {
            if (statements.length > 1) {
                const last = statements[statements.length - 1];
                const returnedIdentifier = getOnlyReturnedVariable(last);
                const lastButOne = statements[statements.length - 2];
                const declaredIdentifier = getOnlyDeclaredVariable(lastButOne);
                if (returnedIdentifier && declaredIdentifier) {
                    const sameVariable = getVariables(node, context).find(variable => {
                        return (variable.references.find(ref => ref.identifier === returnedIdentifier) !==
                            undefined &&
                            variable.references.find(ref => ref.identifier === declaredIdentifier.id) !==
                                undefined);
                    });
                    const id = lastButOne.declarations[0].id;
                    if (hasJSDoc(id) || isNamedFunctionExpression(id)) {
                        // 1) The temporary variable might be due to adding the jsdoc. Skip in this case.
                        // 2) The temporary variable might be a name of a function, which helps with recognizing in a call stack.
                        return;
                    }
                    // there must be only one "read" - in `return` or `throw`
                    if (sameVariable && sameVariable.references.filter(ref => ref.isRead()).length === 1) {
                        context.report({
                            messageId: 'doImmediateAction',
                            data: {
                                action: last.type === 'ReturnStatement' ? 'return' : 'throw',
                                variable: returnedIdentifier.name,
                            },
                            node: declaredIdentifier.init,
                            fix: fixer => fix(fixer, last, lastButOne, declaredIdentifier.init, returnedIdentifier),
                        });
                    }
                }
            }
        }
        function fix(fixer, last, lastButOne, expressionToReturn, returnedExpression) {
            const expressionText = context.sourceCode.getText(expressionToReturn);
            const rangeToRemoveStart = lastButOne.range[0];
            const commentsBetweenStatements = context.sourceCode.getCommentsAfter(lastButOne);
            const rangeToRemoveEnd = commentsBetweenStatements.length > 0
                ? commentsBetweenStatements[0].range[0]
                : last.range[0];
            return [
                fixer.removeRange([rangeToRemoveStart, rangeToRemoveEnd]),
                fixer.replaceText(returnedExpression, expressionText),
            ];
        }
        function getOnlyReturnedVariable(node) {
            return (node.type === 'ReturnStatement' || node.type === 'ThrowStatement') &&
                node.argument &&
                (0, index_js_1.isIdentifier)(node.argument)
                ? node.argument
                : undefined;
        }
        function getOnlyDeclaredVariable(node) {
            if (node.type === 'VariableDeclaration' && node.declarations.length === 1) {
                const { id, init } = node.declarations[0];
                if (id.type === 'Identifier' && init && !id.typeAnnotation) {
                    return { id, init };
                }
            }
            return undefined;
        }
        function getVariables(node, context) {
            const { variableScope, variables: currentScopeVariables } = context.sourceCode.getScope(node);
            if (variableScope === context.sourceCode.getScope(node)) {
                return currentScopeVariables;
            }
            else {
                return currentScopeVariables.concat(variableScope.variables);
            }
        }
        function hasJSDoc(node) {
            const services = context.sourceCode.parserServices;
            if (!(0, index_js_1.isRequiredParserServices)(services)) {
                return false;
            }
            return !!(0, typescript_1.getJSDocType)(services.esTreeNodeToTSNodeMap.get(node));
        }
        function isNamedFunctionExpression(node) {
            const services = context.sourceCode.parserServices;
            if (!(0, index_js_1.isRequiredParserServices)(services)) {
                return false;
            }
            return (0, index_js_1.isFunction)(node, services);
        }
    },
};
