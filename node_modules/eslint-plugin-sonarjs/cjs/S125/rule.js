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
// https://sonarsource.github.io/rspec/#/rspec/S125/javascript
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
const eslint_1 = require("eslint");
const index_js_1 = require("../helpers/index.js");
const meta = __importStar(require("./generated-meta.js"));
const index_js_2 = require("../helpers/recognizers/index.js");
const path_1 = __importDefault(require("path"));
const EXCLUDED_STATEMENTS = ['BreakStatement', 'LabeledStatement', 'ContinueStatement'];
const recognizer = new index_js_2.CodeRecognizer(0.9, new index_js_2.JavaScriptFootPrint());
exports.rule = {
    meta: (0, index_js_1.generateMeta)(meta, {
        messages: {
            commentedCode: 'Remove this commented out code.',
            commentedCodeFix: 'Remove this commented out code',
        },
        hasSuggestions: true,
    }),
    create(context) {
        function getGroupedComments(comments) {
            const groupedComments = [];
            let currentGroup = [];
            for (const comment of comments) {
                if (comment.type === 'Block') {
                    groupedComments.push({ value: comment.value, nodes: [comment] });
                }
                else if (currentGroup.length === 0 ||
                    areAdjacentLineComments(currentGroup[currentGroup.length - 1], comment)) {
                    currentGroup.push(comment);
                }
                else {
                    groupedComments.push({
                        value: currentGroup.map(lineComment => lineComment.value).join('\n'),
                        nodes: currentGroup,
                    });
                    currentGroup = [comment];
                }
            }
            if (currentGroup.length > 0) {
                groupedComments.push({
                    value: currentGroup.map(lineComment => lineComment.value).join('\n'),
                    nodes: currentGroup,
                });
            }
            return groupedComments;
        }
        function areAdjacentLineComments(previous, next) {
            const nextCommentLine = next.loc.start.line;
            if (previous.loc.start.line + 1 === nextCommentLine) {
                const nextCodeToken = context.sourceCode.getTokenAfter(previous);
                return !nextCodeToken || nextCodeToken.loc.start.line > nextCommentLine;
            }
            return false;
        }
        return {
            'Program:exit': () => {
                const groupedComments = getGroupedComments(context.sourceCode.getAllComments());
                groupedComments.forEach(groupComment => {
                    const rawTextTrimmed = groupComment.value.trim();
                    if (rawTextTrimmed !== '}' &&
                        containsCode(injectMissingBraces(rawTextTrimmed), context)) {
                        context.report({
                            messageId: 'commentedCode',
                            loc: getCommentLocation(groupComment.nodes),
                            suggest: [
                                {
                                    messageId: 'commentedCodeFix',
                                    fix(fixer) {
                                        const start = groupComment.nodes[0].range[0];
                                        const end = groupComment.nodes[groupComment.nodes.length - 1].range[1];
                                        return fixer.removeRange([start, end]);
                                    },
                                },
                            ],
                        });
                    }
                });
            },
        };
    },
};
function isExpressionExclusion(statement, code) {
    if (statement.type === 'ExpressionStatement') {
        const expression = statement.expression;
        if (expression.type === 'Identifier' ||
            expression.type === 'SequenceExpression' ||
            isUnaryPlusOrMinus(expression) ||
            isExcludedLiteral(expression) ||
            !code.getLastToken(statement, token => token.value === ';')) {
            return true;
        }
    }
    return false;
}
function isExclusion(parsedBody, code) {
    if (parsedBody.length === 1) {
        const singleStatement = parsedBody[0];
        return (EXCLUDED_STATEMENTS.includes(singleStatement.type) ||
            isReturnThrowExclusion(singleStatement) ||
            isExpressionExclusion(singleStatement, code));
    }
    return false;
}
function containsCode(value, context) {
    if (!couldBeJsCode(value) || !context.languageOptions.parser) {
        return false;
    }
    try {
        const options = {
            ...context.languageOptions?.parserOptions,
            filePath: `placeholder${path_1.default.extname(context.filename)}`,
            programs: undefined,
            project: undefined,
        };
        //In case of Vue parser: we will use the JS/TS parser instead of the Vue parser
        const parser = context.languageOptions?.parserOptions?.parser ?? context.languageOptions?.parser;
        const result = 'parse' in parser ? parser.parse(value, options) : parser.parseForESLint(value, options).ast;
        const parseResult = new eslint_1.SourceCode(value, result);
        return parseResult.ast.body.length > 0 && !isExclusion(parseResult.ast.body, parseResult);
    }
    catch (exception) {
        return false;
    }
    function couldBeJsCode(input) {
        return recognizer.extractCodeLines(input.split('\n')).length > 0;
    }
}
function injectMissingBraces(value) {
    const openCurlyBraceNum = (value.match(/{/g) ?? []).length;
    const closeCurlyBraceNum = (value.match(/}/g) ?? []).length;
    const missingBraces = openCurlyBraceNum - closeCurlyBraceNum;
    if (missingBraces > 0) {
        return value + Array(missingBraces).fill('}').join('');
    }
    else if (missingBraces < 0) {
        return Array(-missingBraces).fill('{').join('') + value;
    }
    else {
        return value;
    }
}
function getCommentLocation(nodes) {
    return {
        start: nodes[0].loc.start,
        end: nodes[nodes.length - 1].loc.end,
    };
}
function isReturnThrowExclusion(statement) {
    if (statement.type === 'ReturnStatement' || statement.type === 'ThrowStatement') {
        return statement.argument == null || statement.argument.type === 'Identifier';
    }
    return false;
}
function isUnaryPlusOrMinus(expression) {
    return (expression.type === 'UnaryExpression' &&
        (expression.operator === '+' || expression.operator === '-'));
}
function isExcludedLiteral(expression) {
    if (expression.type === 'Literal') {
        return typeof expression.value === 'string' || typeof expression.value === 'number';
    }
    return false;
}
