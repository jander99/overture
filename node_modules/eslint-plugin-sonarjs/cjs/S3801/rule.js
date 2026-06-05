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
// https://sonarsource.github.io/rspec/#/rspec/S3801/javascript
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
exports.rule = {
    meta: (0, index_js_1.generateMeta)(meta),
    create(context) {
        const sourceCode = context.sourceCode;
        const functionContextStack = [];
        const checkOnFunctionExit = (node) => checkFunctionLikeDeclaration(node, functionContextStack[functionContextStack.length - 1]);
        // tracks the segments we've traversed in the current code path
        let currentSegments;
        // tracks all current segments for all open paths
        const allCurrentSegments = [];
        function checkFunctionLikeDeclaration(node, functionContext) {
            if (!functionContext ||
                (!!node.returnType &&
                    declaredReturnTypeContainsVoidOrNeverTypes(node.returnType.typeAnnotation))) {
                return;
            }
            checkFunctionForImplicitReturn(functionContext);
            if (hasInconsistentReturns(functionContext)) {
                const secondaryLocations = getSecondaryLocations(functionContext, node);
                (0, index_js_1.report)(context, {
                    message: `Refactor this function to use "return" consistently.`,
                    loc: (0, index_js_1.getMainFunctionTokenLocation)(node, (0, index_js_1.getParent)(context, node), context),
                }, secondaryLocations);
            }
        }
        function checkFunctionForImplicitReturn(functionContext) {
            // As this method is called at the exit point of a function definition, the current
            // segments are the ones leading to the exit point at the end of the function. If they
            // are reachable, it means there is an implicit return.
            functionContext.containsImplicitReturn = Array.from(currentSegments).some(segment => segment.reachable);
        }
        function getSecondaryLocations(functionContext, node) {
            const secondaryLocations = functionContext.returnStatements
                .slice()
                .map(returnStatement => (0, index_js_1.toSecondaryLocation)(returnStatement, returnStatement.argument ? 'Return with value' : 'Return without value'));
            if (functionContext.containsImplicitReturn) {
                const closeCurlyBraceToken = sourceCode.getLastToken(node, token => token.value === '}');
                if (!!closeCurlyBraceToken) {
                    secondaryLocations.push((0, index_js_1.toSecondaryLocation)(closeCurlyBraceToken, 'Implicit return without value'));
                }
            }
            return secondaryLocations;
        }
        return {
            onCodePathStart(codePath) {
                functionContextStack.push({
                    codePath,
                    containsReturnWithValue: false,
                    containsReturnWithoutValue: false,
                    containsImplicitReturn: false,
                    returnStatements: [],
                });
                allCurrentSegments.push(currentSegments);
                currentSegments = new Set();
            },
            onCodePathEnd() {
                functionContextStack.pop();
                currentSegments = allCurrentSegments.pop();
            },
            onCodePathSegmentStart(segment) {
                currentSegments.add(segment);
            },
            onCodePathSegmentEnd(segment) {
                currentSegments.delete(segment);
            },
            onUnreachableCodePathSegmentStart(segment) {
                currentSegments.add(segment);
            },
            onUnreachableCodePathSegmentEnd(segment) {
                currentSegments.delete(segment);
            },
            ReturnStatement(node) {
                const currentContext = functionContextStack[functionContextStack.length - 1];
                if (!!currentContext) {
                    const returnStatement = node;
                    currentContext.containsReturnWithValue =
                        currentContext.containsReturnWithValue || !!returnStatement.argument;
                    currentContext.containsReturnWithoutValue =
                        currentContext.containsReturnWithoutValue || !returnStatement.argument;
                    currentContext.returnStatements.push(returnStatement);
                }
            },
            'FunctionDeclaration:exit': checkOnFunctionExit,
            'FunctionExpression:exit': checkOnFunctionExit,
            'ArrowFunctionExpression:exit': checkOnFunctionExit,
        };
    },
};
function hasInconsistentReturns(functionContext) {
    return (functionContext.containsReturnWithValue &&
        (functionContext.containsReturnWithoutValue || functionContext.containsImplicitReturn));
}
function declaredReturnTypeContainsVoidOrNeverTypes(returnTypeNode) {
    return (isVoidType(returnTypeNode) ||
        (returnTypeNode.type === 'TSUnionType' &&
            returnTypeNode.types.some(declaredReturnTypeContainsVoidOrNeverTypes)));
}
function isVoidType(typeNode) {
    return (typeNode.type === 'TSUndefinedKeyword' ||
        typeNode.type === 'TSVoidKeyword' ||
        typeNode.type === 'TSNeverKeyword');
}
