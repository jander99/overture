"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Vitest = void 0;
const index_js_1 = require("./index.js");
const typescript_1 = __importDefault(require("typescript"));
var Vitest;
(function (Vitest) {
    function isImported(context) {
        return ((0, index_js_1.getRequireCalls)(context).some(r => r.arguments[0].type === 'Literal' && r.arguments[0].value === 'vitest') || (0, index_js_1.getImportDeclarations)(context).some(i => i.source.value === 'vitest'));
    }
    Vitest.isImported = isImported;
    function isAssertion(context, node) {
        const fullyQualifiedName = extractFQNforCallExpression(context, node);
        return isFQNAssertion(fullyQualifiedName);
    }
    Vitest.isAssertion = isAssertion;
    function isTSAssertion(services, node) {
        if (node.kind !== typescript_1.default.SyntaxKind.CallExpression) {
            return false;
        }
        const fqn = (0, index_js_1.getFullyQualifiedNameTS)(services, node);
        return isFQNAssertion(fqn);
    }
    Vitest.isTSAssertion = isTSAssertion;
    function isFQNAssertion(fqn) {
        if (!fqn) {
            return false;
        }
        const validAssertionCalls = ['vitest.expect', 'vitest.expectTypeOf', 'vitest.assertType'];
        return validAssertionCalls.some(callPrefix => fqn.startsWith(callPrefix));
    }
    function extractFQNforCallExpression(context, node) {
        if (node.type !== 'CallExpression') {
            return undefined;
        }
        return (0, index_js_1.getFullyQualifiedName)(context, node);
    }
})(Vitest || (exports.Vitest = Vitest = {}));
