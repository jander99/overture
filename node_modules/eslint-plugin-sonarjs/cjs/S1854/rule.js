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
// https://sonarsource.github.io/rspec/#/rspec/S1854/javascript
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
            removeAssignment: 'Remove this useless assignment to variable "{{variable}}".',
        },
    }),
    create(context) {
        const codePathStack = [];
        const liveVariablesMap = new Map();
        const readVariables = new Set();
        // map from Variable to CodePath ids where variable is used
        const variableUsages = new Map();
        const referencesUsedInDestructuring = new Set();
        const destructuringStack = [];
        const codePathSegments = [];
        let currentCodePathSegments = [];
        return {
            ':matches(AssignmentExpression, VariableDeclarator[init])': (node) => {
                pushAssignmentContext(node);
            },
            ':matches(AssignmentExpression, VariableDeclarator[init]):exit': () => {
                popAssignmentContext();
            },
            Identifier: (node) => {
                if (isEnumConstant(node)) {
                    return;
                }
                checkIdentifierUsage(node);
            },
            JSXIdentifier: (node) => {
                checkIdentifierUsage(node);
            },
            ObjectPattern: () => {
                destructuringStack.push(new DestructuringContext());
            },
            'ObjectPattern > Property > Identifier': (node) => {
                const destructuring = peek(destructuringStack);
                const { ref } = resolveReference(node);
                if (ref) {
                    destructuring.references.push(ref);
                }
            },
            'ObjectPattern > :matches(RestElement, ExperimentalRestProperty)': () => {
                peek(destructuringStack).hasRest = true;
            },
            'ObjectPattern:exit': () => {
                const destructuring = destructuringStack.pop();
                if (destructuring?.hasRest) {
                    destructuring.references.forEach(ref => referencesUsedInDestructuring.add(ref));
                }
            },
            'Program:exit': () => {
                (0, index_js_1.lva)(liveVariablesMap);
                liveVariablesMap.forEach(lva => {
                    checkSegment(lva);
                    reportNeverReadVariables(lva);
                });
            },
            // CodePath events
            onCodePathSegmentStart: (segment) => {
                liveVariablesMap.set(segment.id, new index_js_1.LiveVariables(segment));
                currentCodePathSegments.push(segment);
            },
            onCodePathStart: codePath => {
                pushContext(new CodePathContext(codePath));
                codePathSegments.push(currentCodePathSegments);
                currentCodePathSegments = [];
            },
            onCodePathSegmentEnd() {
                currentCodePathSegments.pop();
            },
            onCodePathEnd: () => {
                popContext();
                currentCodePathSegments = codePathSegments.pop() || [];
            },
        };
        function pushAssignmentContext(node) {
            peek(codePathStack).assignmentStack.push(new AssignmentContext(node));
        }
        function popAssignmentContext() {
            const assignment = peek(codePathStack).assignmentStack.pop();
            assignment.rhs.forEach(r => processReference(r));
            assignment.lhs.forEach(r => processReference(r));
        }
        function checkSegment(liveVariables) {
            const willBeRead = new Set(liveVariables.out);
            const references = [...liveVariables.references].reverse();
            references.forEach(ref => {
                const variable = ref.resolved;
                if (!variable) {
                    return;
                }
                if (ref.isWrite()) {
                    if (!willBeRead.has(variable) && shouldReport(ref)) {
                        report(ref);
                    }
                    willBeRead.delete(variable);
                }
                if (ref.isRead()) {
                    willBeRead.add(variable);
                }
            });
        }
        function reportNeverReadVariables(lva) {
            lva.references.forEach(ref => {
                if (shouldReportReference(ref) && !readVariables.has(ref.resolved)) {
                    report(ref);
                }
            });
        }
        function shouldReport(ref) {
            const variable = ref.resolved;
            return (variable &&
                shouldReportReference(ref) &&
                !variableUsedOutsideOfCodePath(variable) &&
                readVariables.has(variable));
        }
        function shouldReportReference(ref) {
            const variable = ref.resolved;
            return (variable &&
                isLocalVar(variable) &&
                !isReferenceWithBasicValue(ref) &&
                !isDefaultParameter(ref) &&
                !referencesUsedInDestructuring.has(ref) &&
                !variable.name.startsWith('_') &&
                !isIncrementOrDecrement(ref) &&
                !isNullAssignment(ref));
        }
        function isIncrementOrDecrement(ref) {
            const parent = ref.identifier.parent;
            return parent && parent.type === 'UpdateExpression';
        }
        function isNullAssignment(ref) {
            const parent = ref.identifier.parent;
            return (parent &&
                parent.type === 'AssignmentExpression' &&
                (0, index_js_1.isNullLiteral)(parent.right));
        }
        function isEnumConstant(node) {
            return context.sourceCode.getAncestors(node).some(n => n.type === 'TSEnumDeclaration');
        }
        function isDefaultParameter(ref) {
            if (ref.identifier.type !== 'Identifier') {
                return false;
            }
            const parent = ref.identifier.parent;
            return parent && parent.type === 'AssignmentPattern';
        }
        function isLocalVar(variable) {
            // @ts-ignore
            const scope = variable.scope;
            const node = scope.block;
            return node.type !== 'Program' && node.type !== 'TSModuleDeclaration';
        }
        function variableUsedOutsideOfCodePath(variable) {
            return variableUsages.get(variable).size > 1;
        }
        function isReferenceWithBasicValue(ref) {
            return ref.init && ref.writeExpr && isBasicValue(ref.writeExpr);
        }
        function isBasicValue(node) {
            switch (node.type) {
                case 'Literal':
                    return node.value === '' || [0, 1, null, true, false].includes(node.value);
                case 'Identifier':
                    return node.name === 'undefined';
                case 'UnaryExpression':
                    return isBasicValue(node.argument);
                case 'ObjectExpression':
                    return node.properties.length === 0;
                case 'ArrayExpression':
                    return node.elements.length === 0;
                default:
                    return false;
            }
        }
        function report(ref) {
            context.report({
                messageId: 'removeAssignment',
                data: {
                    variable: ref.identifier.name,
                },
                loc: ref.identifier.loc,
            });
        }
        function checkIdentifierUsage(node) {
            const { ref, variable } = node.type === 'Identifier' ? resolveReference(node) : resolveJSXReference(node);
            if (ref) {
                processReference(ref);
                if (variable) {
                    updateReadVariables(ref);
                }
            }
            if (variable) {
                updateVariableUsages(variable);
            }
        }
        function resolveJSXReference(node) {
            if (isJSXAttributeName(node)) {
                return {};
            }
            const jsxReference = new JSXReference(node, context.sourceCode.getScope(node));
            return { ref: jsxReference, variable: jsxReference.resolved };
        }
        function isJSXAttributeName(node) {
            const parent = node.parent;
            return parent && parent.type === 'JSXAttribute' && parent.name === node;
        }
        function processReference(ref) {
            const assignmentStack = peek(codePathStack).assignmentStack;
            if (assignmentStack.length > 0) {
                const assignment = peek(assignmentStack);
                assignment.add(ref);
            }
            else {
                [...currentCodePathSegments].forEach(segment => {
                    lvaForSegment(segment).add(ref);
                });
            }
        }
        function lvaForSegment(segment) {
            let lva;
            if (liveVariablesMap.has(segment.id)) {
                lva = liveVariablesMap.get(segment.id);
            }
            else {
                lva = new index_js_1.LiveVariables(segment);
                liveVariablesMap.set(segment.id, lva);
            }
            return lva;
        }
        function updateReadVariables(reference) {
            const variable = reference.resolved;
            if (reference.isRead()) {
                readVariables.add(variable);
            }
        }
        function updateVariableUsages(variable) {
            const codePathId = peek(codePathStack).codePath.id;
            if (variableUsages.has(variable)) {
                variableUsages.get(variable).add(codePathId);
            }
            else {
                variableUsages.set(variable, new Set([codePathId]));
            }
        }
        function popContext() {
            codePathStack.pop();
        }
        function pushContext(codePathContext) {
            codePathStack.push(codePathContext);
        }
        function resolveReference(node) {
            return resolveReferenceRecursively(node, context.sourceCode.getScope(node));
        }
        function resolveReferenceRecursively(node, scope, depth = 0) {
            if (scope === null || depth > 2) {
                return { ref: null, variable: null };
            }
            const ref = scope.references.find(r => r.identifier === node);
            if (ref) {
                return { ref, variable: ref.resolved };
            }
            else {
                // if it's not a reference, it can be just declaration without initializer
                const variable = scope.variables.find(v => v.defs.find(def => def.name === node));
                if (variable) {
                    return { ref: null, variable };
                }
                // we only need 1-level recursion, only for switch expression, which is likely a bug in eslint
                return resolveReferenceRecursively(node, scope.upper, depth + 1);
            }
        }
    },
};
class CodePathContext {
    constructor(codePath) {
        this.segments = new Map();
        this.assignmentStack = [];
        this.codePath = codePath;
    }
}
class DestructuringContext {
    constructor() {
        this.hasRest = false;
        this.references = [];
    }
}
class AssignmentContext {
    constructor(node) {
        this.lhs = new Set();
        this.rhs = new Set();
        this.node = node;
    }
    isRhs(node) {
        return this.node.type === 'AssignmentExpression'
            ? this.node.right === node
            : this.node.init === node;
    }
    isLhs(node) {
        return this.node.type === 'AssignmentExpression'
            ? this.node.left === node
            : this.node.id === node;
    }
    add(ref) {
        let parent = ref.identifier;
        while (parent) {
            if (this.isLhs(parent)) {
                this.lhs.add(ref);
                break;
            }
            if (this.isRhs(parent)) {
                this.rhs.add(ref);
                break;
            }
            parent = parent.parent;
        }
        if (parent === null) {
            throw new Error('failed to find assignment lhs/rhs');
        }
    }
}
class JSXReference {
    constructor(node, scope) {
        this.init = false;
        this.writeExpr = null;
        this.from = scope;
        this.identifier = node;
        this.resolved = findJSXVariableInScope(node, scope);
    }
    isRead() {
        return true;
    }
    isReadOnly() {
        return true;
    }
    isReadWrite() {
        return false;
    }
    isWrite() {
        return false;
    }
    isWriteOnly() {
        return false;
    }
}
function findJSXVariableInScope(node, scope) {
    return (scope &&
        (scope.variables.find(v => v.name === node.name) || findJSXVariableInScope(node, scope.upper)));
}
function peek(arr) {
    return arr[arr.length - 1];
}
