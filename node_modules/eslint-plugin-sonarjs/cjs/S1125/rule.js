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
// https://sonarsource.github.io/rspec/#/rspec/S1125
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
    meta: (0, index_js_1.generateMeta)(meta, {
        messages: {
            removeUnnecessaryBoolean: 'Refactor the code to avoid using this boolean literal.',
        },
    }),
    create(context) {
        return {
            BinaryExpression(expression) {
                if (expression.operator === '==' || expression.operator === '!=') {
                    checkBooleanLiteral(expression.left);
                    checkBooleanLiteral(expression.right);
                }
            },
            LogicalExpression(expression) {
                checkBooleanLiteral(expression.left);
                if (expression.operator === '&&') {
                    checkBooleanLiteral(expression.right);
                }
                // ignore `x || true` and `x || false` expressions outside of conditional expressions and `if` statements
                const parent = expression.parent;
                if (expression.operator === '||' &&
                    ((parent.type === 'ConditionalExpression' && parent.test === expression) ||
                        parent.type === 'IfStatement')) {
                    checkBooleanLiteral(expression.right);
                }
            },
            UnaryExpression(unaryExpression) {
                if (unaryExpression.operator === '!') {
                    checkBooleanLiteral(unaryExpression.argument);
                }
            },
        };
        function checkBooleanLiteral(expression) {
            if ((0, index_js_1.isBooleanLiteral)(expression)) {
                context.report({ messageId: 'removeUnnecessaryBoolean', node: expression });
            }
        }
    },
};
