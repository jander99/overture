"use strict";
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
const index_js_1 = require("../helpers/index.js");
const supertest_js_1 = require("../helpers/supertest.js");
const meta = __importStar(require("./generated-meta.js"));
const typescript_1 = __importDefault(require("typescript"));
/**
 * We assume that the user is using a single assertion library per file,
 * this is why we are not saving if an assertion has been performed for
 * libX and the imported library was libY.
 */
exports.rule = {
    meta: (0, index_js_1.generateMeta)(meta),
    create(context) {
        if (!(index_js_1.Chai.isImported(context) ||
            index_js_1.Sinon.isImported(context) ||
            index_js_1.Vitest.isImported(context) ||
            supertest_js_1.Supertest.isImported(context))) {
            return {};
        }
        const visitedNodes = new Map();
        const visitedTSNodes = new Map();
        return {
            'CallExpression:exit': (node) => {
                const testCase = index_js_1.Mocha.extractTestCase(node);
                if (testCase !== null) {
                    checkAssertions(testCase, context, visitedNodes, visitedTSNodes);
                }
            },
        };
    },
};
function checkAssertions(testCase, context, visitedNodes, visitedTSNodes) {
    const { node, callback } = testCase;
    const visitor = new TestCaseAssertionVisitor(context);
    const parserServices = context.sourceCode.parserServices;
    let hasAssertions = false;
    if ((0, index_js_1.isRequiredParserServices)(parserServices)) {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(callback);
        hasAssertions = visitor.visitTSNode(parserServices, tsNode, visitedTSNodes);
    }
    else {
        hasAssertions = visitor.visit(context, callback.body, visitedNodes);
    }
    if (!hasAssertions) {
        context.report({ node, message: 'Add at least one assertion to this test case.' });
    }
}
class TestCaseAssertionVisitor {
    constructor(context) {
        this.context = context;
        this.visitorKeys = context.sourceCode.visitorKeys;
    }
    visitTSNode(services, node, visitedTSNodes) {
        if (visitedTSNodes.has(node)) {
            return visitedTSNodes.get(node);
        }
        visitedTSNodes.set(node, false);
        if (isGlobalTSAssertion(services, node) ||
            index_js_1.Chai.isTSAssertion(services, node) ||
            index_js_1.Sinon.isTSAssertion(services, node) ||
            supertest_js_1.Supertest.isTSAssertion(services, node) ||
            index_js_1.Vitest.isTSAssertion(services, node)) {
            visitedTSNodes.set(node, true);
            return true;
        }
        let nodeHasAssertions = false;
        if (node.kind === typescript_1.default.SyntaxKind.CallExpression) {
            const callNode = services.program
                .getTypeChecker()
                .getResolvedSignature(node);
            if (callNode?.declaration) {
                nodeHasAssertions ||= this.visitTSNode(services, callNode.declaration, visitedTSNodes);
            }
        }
        node.forEachChild(child => {
            nodeHasAssertions ||= this.visitTSNode(services, child, visitedTSNodes);
        });
        visitedTSNodes.set(node, nodeHasAssertions);
        return nodeHasAssertions;
    }
    visit(context, node, visitedNodes) {
        if (visitedNodes.has(node)) {
            return visitedNodes.get(node);
        }
        visitedNodes.set(node, false);
        if (index_js_1.Chai.isAssertion(context, node) ||
            index_js_1.Sinon.isAssertion(context, node) ||
            index_js_1.Vitest.isAssertion(context, node) ||
            supertest_js_1.Supertest.isAssertion(context, node) ||
            isGlobalAssertion(context, node)) {
            visitedNodes.set(node, true);
            return true;
        }
        let nodeHasAssertions = false;
        if ((0, index_js_1.isFunctionCall)(node)) {
            const { callee } = node;
            const functionDef = (0, index_js_1.resolveFunction)(this.context, callee);
            if (functionDef) {
                nodeHasAssertions ||= this.visit(context, functionDef.body, visitedNodes);
            }
        }
        for (const child of (0, index_js_1.childrenOf)(node, this.visitorKeys)) {
            nodeHasAssertions ||= this.visit(context, child, visitedNodes);
        }
        visitedNodes.set(node, nodeHasAssertions);
        return nodeHasAssertions;
    }
}
function isGlobalTSAssertion(services, node) {
    if (node.kind !== typescript_1.default.SyntaxKind.CallExpression) {
        return false;
    }
    const callExpressionNode = node;
    // check for global expect
    if (isGlobalExpectExpression(callExpressionNode)) {
        return true;
    }
    return isFunctionCallFromNodeAssertTS(services, node);
}
function isGlobalExpectExpression(node) {
    if (node.expression.kind !== typescript_1.default.SyntaxKind.PropertyAccessExpression) {
        return false;
    }
    const propertyAccessExpression = node.expression;
    if (propertyAccessExpression.expression.kind !== typescript_1.default.SyntaxKind.CallExpression) {
        return false;
    }
    const innerCallExpression = propertyAccessExpression.expression;
    return (innerCallExpression.expression.kind === typescript_1.default.SyntaxKind.Identifier &&
        innerCallExpression.expression.text === 'expect');
}
function isFunctionCallFromNodeAssertTS(services, node) {
    const fqn = (0, index_js_1.getFullyQualifiedNameTS)(services, node);
    return fqn ? fqn?.startsWith('assert') : false;
}
function isGlobalAssertion(context, node) {
    if ((0, index_js_1.isFunctionCall)(node) && node.callee.name === 'expect') {
        return true;
    }
    return isFunctionCallFromNodeAssert(context, node);
}
function isFunctionCallFromNodeAssert(context, node) {
    const fullyQualifiedName = (0, index_js_1.getFullyQualifiedName)(context, node);
    return fullyQualifiedName?.split('.')[0] === 'assert';
}
