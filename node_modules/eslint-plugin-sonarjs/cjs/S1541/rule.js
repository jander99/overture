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
// https://sonarsource.github.io/rspec/#/rspec/S1541/javascript
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
const DEFAULT_THRESHOLD = 10;
exports.rule = {
    meta: (0, index_js_1.generateMeta)(meta),
    create(context) {
        const threshold = context.options[0]?.threshold ?? DEFAULT_THRESHOLD;
        let functionsWithParent;
        let functionsDefiningModule;
        let functionsImmediatelyInvoked;
        return {
            Program: () => {
                functionsWithParent = new Map();
                functionsDefiningModule = [];
                functionsImmediatelyInvoked = [];
            },
            'Program:exit': () => {
                functionsWithParent.forEach((parent, func) => {
                    if (!functionsDefiningModule.includes(func) &&
                        !functionsImmediatelyInvoked.includes(func)) {
                        raiseOnUnauthorizedComplexity(func, parent, threshold, context);
                    }
                });
            },
            'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression': (node) => functionsWithParent.set(node, (0, index_js_1.getParent)(context, node)),
            "CallExpression[callee.type='Identifier'][callee.name='define'] FunctionExpression": (node) => functionsDefiningModule.push(node),
            "NewExpression[callee.type='FunctionExpression'], CallExpression[callee.type='FunctionExpression']": (node) => functionsImmediatelyInvoked.push(node.callee),
        };
    },
};
function raiseOnUnauthorizedComplexity(node, parent, threshold, context) {
    const tokens = computeCyclomaticComplexity(node, parent, context);
    const complexity = tokens.length;
    if (complexity > threshold) {
        context.report({
            message: toEncodedMessage(complexity, threshold, tokens),
            loc: (0, index_js_1.getMainFunctionTokenLocation)(node, parent, context),
        });
    }
}
function toEncodedMessage(complexity, threshold, tokens) {
    const encodedMessage = {
        message: `Function has a complexity of ${complexity} which is greater than ${threshold} authorized.`,
        cost: complexity - threshold,
        secondaryLocations: tokens.map(node => toSecondaryLocation(node)),
    };
    return JSON.stringify(encodedMessage);
}
function toSecondaryLocation(token) {
    return {
        line: token.loc.start.line,
        column: token.loc.start.column,
        endLine: token.loc.end.line,
        endColumn: token.loc.end.column,
        message: '+1',
    };
}
function computeCyclomaticComplexity(node, parent, context) {
    const visitor = new FunctionComplexityVisitor(node, parent, context);
    visitor.visit();
    return visitor.getComplexityTokens();
}
class FunctionComplexityVisitor {
    constructor(root, parent, context) {
        this.root = root;
        this.parent = parent;
        this.context = context;
        this.tokens = [];
    }
    visit() {
        const visitNode = (node) => {
            const { sourceCode } = this.context;
            let token;
            if ((0, index_js_1.isFunctionNode)(node)) {
                if (node !== this.root) {
                    return;
                }
                else {
                    token = {
                        loc: (0, index_js_1.getMainFunctionTokenLocation)(node, this.parent, this.context),
                    };
                }
            }
            else {
                switch (node.type) {
                    case 'ConditionalExpression':
                        token = sourceCode.getFirstTokenBetween(node.test, node.consequent, token => token.value === '?');
                        break;
                    case 'SwitchCase':
                        // ignore default case
                        if (!node.test) {
                            break;
                        }
                    case 'IfStatement':
                    case 'ForStatement':
                    case 'ForInStatement':
                    case 'ForOfStatement':
                    case 'WhileStatement':
                    case 'DoWhileStatement':
                        token = sourceCode.getFirstToken(node);
                        break;
                    case 'LogicalExpression':
                        token = sourceCode.getTokenAfter(node.left, token => ['||', '&&'].includes(token.value) && token.type === 'Punctuator');
                        break;
                }
            }
            if (token) {
                this.tokens.push(token);
            }
            (0, index_js_1.childrenOf)(node, sourceCode.visitorKeys).forEach(visitNode);
        };
        visitNode(this.root);
    }
    getComplexityTokens() {
        return this.tokens;
    }
}
