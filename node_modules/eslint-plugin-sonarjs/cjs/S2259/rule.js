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
// https://sonarsource.github.io/rspec/#/rspec/S2259/javascript
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
var Null;
(function (Null) {
    Null[Null["confirmed"] = 0] = "confirmed";
    Null[Null["discarded"] = 1] = "discarded";
    Null[Null["unknown"] = 2] = "unknown";
})(Null || (Null = {}));
function isNull(n) {
    return (0, index_js_1.isNullLiteral)(n) || (0, index_js_1.isUndefined)(n);
}
const equalOperators = ['==', '==='];
const notEqualOperators = ['!=', '!=='];
exports.rule = {
    meta: (0, index_js_1.generateMeta)(meta, {
        messages: {
            nullDereference: 'TypeError can be thrown as "{{symbol}}" might be null or undefined here.',
            shortCircuitError: 'TypeError can be thrown as expression might be null or undefined here.',
        },
    }),
    create(context) {
        if (!(0, index_js_1.isRequiredParserServices)(context.sourceCode.parserServices)) {
            return {};
        }
        const alreadyRaisedSymbols = new Set();
        return {
            MemberExpression(node) {
                const { object, optional } = node;
                if (!optional) {
                    checkNullDereference(object, context, alreadyRaisedSymbols);
                }
            },
            'LogicalExpression MemberExpression'(node) {
                const { object, optional } = node;
                if (!optional) {
                    const ancestors = context.sourceCode.getAncestors(node);
                    const enclosingLogicalExpression = ancestors.find(n => n.type === 'LogicalExpression');
                    checkLogicalNullDereference(enclosingLogicalExpression, object, context);
                }
            },
            ForOfStatement(node) {
                const { right } = node;
                checkNullDereference(right, context, alreadyRaisedSymbols);
            },
            'Program:exit'() {
                alreadyRaisedSymbols.clear();
            },
        };
    },
};
function getNullState(expr, node, context) {
    const { left, right } = expr;
    if ((isNull(right) &&
        (0, index_js_1.areEquivalent)(left, node, context.sourceCode)) ||
        (isNull(left) &&
            (0, index_js_1.areEquivalent)(right, node, context.sourceCode))) {
        if (notEqualOperators.includes(expr.operator)) {
            return Null.discarded;
        }
        if (equalOperators.includes(expr.operator)) {
            return Null.confirmed;
        }
    }
    return Null.unknown;
}
function checkLogicalNullDereference(expr, node, context) {
    if (expr.left.type === 'BinaryExpression') {
        const nullState = getNullState(expr.left, node, context);
        if ((nullState === Null.confirmed && expr.operator === '&&') ||
            (nullState === Null.discarded && expr.operator === '||')) {
            context.report({
                messageId: 'shortCircuitError',
                node,
            });
        }
    }
}
function isWrittenInInnerFunction(symbol, fn) {
    return symbol.references.some(ref => {
        if (ref.isWrite() && ref.identifier.hasOwnProperty('parent')) {
            const enclosingFn = (0, index_js_1.findFirstMatchingAncestor)(ref.identifier, node => index_js_1.functionLike.has(node.type));
            return enclosingFn && enclosingFn !== fn;
        }
        return false;
    });
}
function checkNullDereference(node, context, alreadyRaisedSymbols) {
    if (node.type !== 'Identifier') {
        return;
    }
    const scope = context.sourceCode.getScope(node);
    const symbol = scope.references.find(v => v.identifier === node)?.resolved;
    if (!symbol) {
        return;
    }
    const enclosingFunction = context.sourceCode
        .getAncestors(node)
        .find(n => index_js_1.functionLike.has(n.type));
    if (!alreadyRaisedSymbols.has(symbol) &&
        !isWrittenInInnerFunction(symbol, enclosingFunction) &&
        (0, index_js_1.isUndefinedOrNull)(node, context.sourceCode.parserServices)) {
        alreadyRaisedSymbols.add(symbol);
        context.report({
            messageId: 'nullDereference',
            data: {
                symbol: node.name,
            },
            node,
        });
    }
}
