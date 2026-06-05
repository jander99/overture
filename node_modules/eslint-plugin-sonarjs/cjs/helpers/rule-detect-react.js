"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectReactRule = void 0;
const detectReactSelector = [
    ':matches(',
    [
        'CallExpression[callee.name="require"][arguments.0.value="react"]',
        'CallExpression[callee.name="require"][arguments.0.value="create-react-class"]',
        'ImportDeclaration[source.value="react"]',
    ].join(','),
    ')',
].join('');
exports.detectReactRule = {
    meta: {
        messages: {
            reactDetected: 'React detected',
        },
    },
    create(context) {
        return {
            [detectReactSelector](node) {
                context.report({
                    messageId: 'reactDetected',
                    node,
                });
            },
        };
    },
};
