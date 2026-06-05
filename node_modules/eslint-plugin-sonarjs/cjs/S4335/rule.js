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
// https://sonarsource.github.io/rspec/#/rspec/S4335/javascript
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
const typescript_1 = __importDefault(require("typescript"));
const index_js_1 = require("../helpers/index.js");
const meta = __importStar(require("./generated-meta.js"));
exports.rule = {
    meta: (0, index_js_1.generateMeta)(meta, {
        messages: {
            removeIntersection: 'Remove this type without members or change this type intersection.',
            simplifyIntersection: 'Simplify this intersection as it always has type "{{type}}".',
        },
    }),
    create(context) {
        const services = context.sourceCode.parserServices;
        if ((0, index_js_1.isRequiredParserServices)(services)) {
            return {
                TSIntersectionType: (node) => {
                    const intersection = node;
                    const anyOrNever = intersection.types.find(typeNode => ['TSAnyKeyword', 'TSNeverKeyword'].includes(typeNode.type));
                    if (anyOrNever) {
                        context.report({
                            messageId: 'simplifyIntersection',
                            data: {
                                type: anyOrNever.type === 'TSAnyKeyword' ? 'any' : 'never',
                            },
                            node,
                        });
                    }
                    else {
                        intersection.types.forEach(typeNode => {
                            const tp = services.program
                                .getTypeChecker()
                                .getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(typeNode));
                            if (isTypeWithoutMembers(tp)) {
                                context.report({
                                    messageId: 'removeIntersection',
                                    node: typeNode,
                                });
                            }
                        });
                    }
                },
            };
        }
        return {};
    },
};
function isTypeWithoutMembers(tp) {
    return isNullLike(tp) || (isEmptyInterface(tp) && isStandaloneInterface(tp.symbol));
}
function isNullLike(tp) {
    return (Boolean(tp.flags & typescript_1.default.TypeFlags.Null) ||
        Boolean(tp.flags & typescript_1.default.TypeFlags.Undefined) ||
        Boolean(tp.flags & typescript_1.default.TypeFlags.Void));
}
function isEmptyInterface(tp) {
    return (tp.getProperties().length === 0 &&
        (!tp.declaredIndexInfos ||
            tp.declaredIndexInfos.length === 0));
}
function isStandaloneInterface(typeSymbol) {
    // there is no declarations for `{}`
    // otherwise check that none of declarations has a heritage clause (`extends X` or `implements X`)
    if (!typeSymbol) {
        return false;
    }
    const { declarations } = typeSymbol;
    return (!declarations ||
        declarations.every(declaration => {
            return (isInterfaceDeclaration(declaration) && (declaration.heritageClauses ?? []).length === 0);
        }));
}
function isInterfaceDeclaration(declaration) {
    return declaration.kind === typescript_1.default.SyntaxKind.InterfaceDeclaration;
}
