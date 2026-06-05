"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sinon = void 0;
const index_js_1 = require("./index.js");
const typescript_1 = __importDefault(require("typescript"));
var Sinon;
(function (Sinon) {
    function isImported(context) {
        return ((0, index_js_1.getRequireCalls)(context).some(r => r.arguments[0].type === 'Literal' && r.arguments[0].value === 'sinon') || (0, index_js_1.getImportDeclarations)(context).some(i => i.source.value === 'sinon'));
    }
    Sinon.isImported = isImported;
    function isAssertion(context, node) {
        return isAssertUsage(context, node);
    }
    Sinon.isAssertion = isAssertion;
    function isTSAssertion(services, node) {
        if (node.kind !== typescript_1.default.SyntaxKind.CallExpression) {
            return false;
        }
        const fqn = (0, index_js_1.getFullyQualifiedNameTS)(services, node);
        return isFQNAssertion(fqn);
    }
    Sinon.isTSAssertion = isTSAssertion;
    function isAssertUsage(context, node) {
        // assert.<expr>(), sinon.assert.<expr>()
        const fqn = extractFQNforCallExpression(context, node);
        return isFQNAssertion(fqn);
    }
    function isFQNAssertion(fqn) {
        if (!fqn) {
            return false;
        }
        const names = fqn.split('.');
        return names.length === 3 && names[0] === 'sinon' && names[1] === 'assert';
    }
    function extractFQNforCallExpression(context, node) {
        if (node.type !== 'CallExpression') {
            return undefined;
        }
        return (0, index_js_1.getFullyQualifiedName)(context, node);
    }
})(Sinon || (exports.Sinon = Sinon = {}));
