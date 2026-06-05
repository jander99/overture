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
// https://sonarsource.github.io/rspec/#/rspec/S2310/javascript
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
        function checkLoop(updateNode, extractCounters, loopBody) {
            const counters = [];
            extractCounters(updateNode, counters);
            counters.forEach(counter => checkCounter(counter, loopBody));
        }
        function checkCounter(counter, block) {
            const variable = (0, index_js_1.getVariableFromName)(context, counter.name, block);
            if (!variable) {
                return;
            }
            variable.references.forEach(ref => {
                if (ref.isWrite() && isUsedInsideBody(ref.identifier, block)) {
                    (0, index_js_1.report)(context, {
                        node: ref.identifier,
                        message: `Remove this assignment of "${counter.name}".`,
                    }, [(0, index_js_1.toSecondaryLocation)(counter, 'Counter variable update')]);
                }
            });
        }
        return {
            'ForStatement > BlockStatement': (node) => {
                const forLoop = (0, index_js_1.getParent)(context, node);
                if (forLoop.update) {
                    checkLoop(forLoop.update, collectCountersFor, node);
                }
            },
            'ForInStatement > BlockStatement, ForOfStatement > BlockStatement': (node) => {
                const { left } = (0, index_js_1.getParent)(context, node);
                checkLoop(left, collectCountersForX, node);
            },
        };
    },
};
function collectCountersForX(updateExpression, counters) {
    if (updateExpression.type === 'VariableDeclaration') {
        updateExpression.declarations.forEach(decl => collectCountersForX(decl.id, counters));
    }
    else {
        (0, index_js_1.resolveIdentifiers)(updateExpression, true).forEach(id => counters.push(id));
    }
}
function collectCountersFor(updateExpression, counters) {
    let counter = undefined;
    if (updateExpression.type === 'AssignmentExpression') {
        counter = updateExpression.left;
    }
    else if (updateExpression.type === 'UpdateExpression') {
        counter = updateExpression.argument;
    }
    else if (updateExpression.type === 'SequenceExpression') {
        updateExpression.expressions.forEach(e => collectCountersFor(e, counters));
    }
    if (counter && counter.type === 'Identifier') {
        counters.push(counter);
    }
}
function isUsedInsideBody(id, loopBody) {
    const bodyRange = loopBody.range;
    return id.range && bodyRange && id.range[0] > bodyRange[0] && id.range[1] < bodyRange[1];
}
