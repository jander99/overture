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
// https://sonarsource.github.io/rspec/#/rspec/S2234/javascript
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
        const services = context.sourceCode.parserServices;
        const canResolveType = (0, index_js_1.isRequiredParserServices)(services);
        function checkArguments(functionCall) {
            const resolvedFunction = resolveFunctionDeclaration(functionCall);
            if (!resolvedFunction) {
                return;
            }
            const { params: functionParameters, declaration: functionDeclaration } = resolvedFunction;
            const argumentNames = functionCall.arguments.map(arg => {
                const argument = arg;
                return argument.type === 'Identifier' ? argument.name : undefined;
            });
            for (let argumentIndex = 0; argumentIndex < argumentNames.length; argumentIndex++) {
                const argumentName = argumentNames[argumentIndex];
                if (argumentName) {
                    const swappedArgumentName = getSwappedArgumentName(argumentNames, functionParameters, argumentName, argumentIndex, functionCall);
                    if (swappedArgumentName &&
                        !areComparedArguments([argumentName, swappedArgumentName], functionCall)) {
                        raiseIssue(argumentName, swappedArgumentName, functionDeclaration, functionCall);
                        return;
                    }
                }
            }
        }
        function areComparedArguments(argumentNames, node) {
            function getName(node) {
                switch (node.type) {
                    case 'Identifier':
                        return node.name;
                    case 'CallExpression':
                        return getName(node.callee);
                    case 'MemberExpression':
                        return getName(node.object);
                    default:
                        return undefined;
                }
            }
            function checkComparedArguments(lhs, rhs) {
                return ([lhs, rhs].map(getName).filter(name => name && argumentNames.includes(name)).length ===
                    argumentNames.length);
            }
            const maybeIfStmt = context.sourceCode
                .getAncestors(node)
                .reverse()
                .find(ancestor => ancestor.type === 'IfStatement');
            if (maybeIfStmt) {
                const { test } = maybeIfStmt;
                switch (test.type) {
                    case 'BinaryExpression': {
                        const binExpr = test;
                        if (['==', '!=', '===', '!==', '<', '<=', '>', '>='].includes(binExpr.operator)) {
                            const { left: lhs, right: rhs } = binExpr;
                            return checkComparedArguments(lhs, rhs);
                        }
                        break;
                    }
                    case 'CallExpression': {
                        const callExpr = test;
                        if (callExpr.arguments.length === 1 && callExpr.callee.type === 'MemberExpression') {
                            const [lhs, rhs] = [callExpr.callee.object, callExpr.arguments[0]];
                            return checkComparedArguments(lhs, rhs);
                        }
                        break;
                    }
                }
            }
            return false;
        }
        function resolveFunctionDeclaration(node) {
            if (canResolveType) {
                return resolveFromTSSignature(node);
            }
            let functionDeclaration = null;
            if ((0, index_js_1.isFunctionNode)(node.callee)) {
                functionDeclaration = node.callee;
            }
            else if (node.callee.type === 'Identifier') {
                functionDeclaration = (0, index_js_1.resolveFromFunctionReference)(context, node.callee);
            }
            if (!functionDeclaration) {
                return null;
            }
            return {
                params: extractFunctionParameters(functionDeclaration),
                declaration: functionDeclaration,
            };
        }
        function resolveFromTSSignature(node) {
            const signature = (0, index_js_1.getSignatureFromCallee)(node, services);
            if (signature?.declaration) {
                return {
                    params: signature.parameters.map(param => param.name),
                    declaration: services.tsNodeToESTreeNodeMap.get(signature.declaration),
                };
            }
            return null;
        }
        function getSwappedArgumentName(argumentNames, functionParameters, argumentName, argumentIndex, node) {
            const indexInFunctionDeclaration = functionParameters.findIndex(functionParameterName => functionParameterName === argumentName);
            if (indexInFunctionDeclaration >= 0 && indexInFunctionDeclaration !== argumentIndex) {
                const potentiallySwappedArgument = argumentNames[indexInFunctionDeclaration];
                if (potentiallySwappedArgument &&
                    potentiallySwappedArgument === functionParameters[argumentIndex] &&
                    haveCompatibleTypes(node.arguments[argumentIndex], node.arguments[indexInFunctionDeclaration])) {
                    return potentiallySwappedArgument;
                }
            }
            return null;
        }
        function haveCompatibleTypes(arg1, arg2) {
            if (canResolveType) {
                const type1 = normalizeType((0, index_js_1.getTypeAsString)(arg1, services));
                const type2 = normalizeType((0, index_js_1.getTypeAsString)(arg2, services));
                return type1 === type2;
            }
            return true;
        }
        function raiseIssue(arg1, arg2, functionDeclaration, node) {
            (0, index_js_1.report)(context, {
                message: `Arguments '${arg1}' and '${arg2}' have the same names but not the same order as the function parameters.`,
                loc: getParametersClauseLocation(node.arguments),
            }, getSecondaryLocations(functionDeclaration));
        }
        return {
            NewExpression: (node) => {
                checkArguments(node);
            },
            CallExpression: (node) => {
                checkArguments(node);
            },
        };
    },
};
function extractFunctionParameters(functionDeclaration) {
    return functionDeclaration.params.map(param => {
        const identifiers = (0, index_js_1.resolveIdentifiers)(param);
        if (identifiers.length === 1 && identifiers[0]) {
            return identifiers[0].name;
        }
        return undefined;
    });
}
function getSecondaryLocations(functionDeclaration) {
    if (functionDeclaration?.params && functionDeclaration.params.length > 0) {
        const { start, end } = getParametersClauseLocation(functionDeclaration.params);
        return [(0, index_js_1.toSecondaryLocation)({ loc: { start, end } }, 'Formal parameters')];
    }
    return [];
}
function getParametersClauseLocation(parameters) {
    const firstParam = parameters[0];
    const lastParam = parameters[parameters.length - 1];
    return { start: firstParam.loc.start, end: lastParam.loc.end };
}
function normalizeType(typeAsString) {
    switch (typeAsString) {
        case 'String':
            return 'string';
        case 'Boolean':
            return 'boolean';
        case 'Number':
            return 'number';
        default:
            return typeAsString;
    }
}
