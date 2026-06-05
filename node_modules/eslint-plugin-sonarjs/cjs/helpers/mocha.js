"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mocha = void 0;
const index_js_1 = require("./index.js");
var Mocha;
(function (Mocha) {
    const TEST_CONSTRUCTS = [
        'describe',
        'context',
        'it',
        'specify',
        'before',
        'after',
        'beforeEach',
        'afterEach',
    ];
    function isTestConstruct(node, constructs = TEST_CONSTRUCTS) {
        return constructs.some(construct => {
            return (node.type === 'CallExpression' &&
                ((0, index_js_1.isIdentifier)(node.callee, construct) ||
                    (node.callee.type === 'MemberExpression' &&
                        (0, index_js_1.isIdentifier)(node.callee.object, construct) &&
                        (0, index_js_1.isIdentifier)(node.callee.property, 'only', 'skip'))));
        });
    }
    Mocha.isTestConstruct = isTestConstruct;
    function extractTestCase(node) {
        if (isTestCase(node)) {
            const callExpr = node;
            const [, callback] = callExpr.arguments;
            if (callback && index_js_1.FUNCTION_NODES.includes(callback.type)) {
                return { node: callExpr.callee, callback: callback };
            }
        }
        return null;
    }
    Mocha.extractTestCase = extractTestCase;
    /**
     * returns true if the node is a test case
     *
     * @param node
     * @returns
     */
    function isTestCase(node) {
        return isTestConstruct(node, ['it', 'specify']);
    }
    Mocha.isTestCase = isTestCase;
    /**
     * returns true if the node is a describe block
     *
     * @param node
     * @returns
     */
    function isDescribeCase(node) {
        return isTestConstruct(node, ['describe']);
    }
    Mocha.isDescribeCase = isDescribeCase;
})(Mocha || (exports.Mocha = Mocha = {}));
