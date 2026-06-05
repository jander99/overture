"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Express = void 0;
const index_js_1 = require("./index.js");
/**
 * This modules provides utilities for writing rules about Express.js.
 */
var Express;
(function (Express) {
    const EXPRESS = 'express';
    /**
     * Checks whether the declaration looks somewhat like `<id> = express()`
     * and returns `<id>` if it matches.
     */
    function attemptFindAppInstantiation(varDecl, context) {
        const rhs = varDecl.init;
        if (rhs && rhs.type === 'CallExpression' && (0, index_js_1.getFullyQualifiedName)(context, rhs) === EXPRESS) {
            const pattern = varDecl.id;
            return pattern.type === 'Identifier' ? pattern : undefined;
        }
        return undefined;
    }
    Express.attemptFindAppInstantiation = attemptFindAppInstantiation;
    /**
     * Checks whether the function injects an instantiated app and is exported like `module.exports = function(app) {}`
     * or `module.exports.property = function(app) {}`, and returns app if it matches.
     */
    function attemptFindAppInjection(functionDef, context, node) {
        const app = functionDef.params.find(param => param.type === 'Identifier' && param.name === 'app');
        if (app) {
            const parent = (0, index_js_1.getParent)(context, node);
            if (parent?.type === 'AssignmentExpression') {
                const { left } = parent;
                if (left.type === 'MemberExpression' &&
                    ((0, index_js_1.isModuleExports)(left) || (0, index_js_1.isModuleExports)(left.object))) {
                    return app;
                }
            }
        }
        return undefined;
    }
    Express.attemptFindAppInjection = attemptFindAppInjection;
    /**
     * Checks whether the expression looks somewhat like `app.use(m1, [m2, m3], ..., mN)`,
     * where one of `mK`-nodes satisfies the given predicate.
     */
    function isUsingMiddleware(context, callExpression, app, middlewareNodePredicate) {
        if ((0, index_js_1.isMethodInvocation)(callExpression, app.name, 'use', 1)) {
            const flattenedArgs = (0, index_js_1.flattenArgs)(context, callExpression.arguments);
            return Boolean(flattenedArgs.find(middlewareNodePredicate));
        }
        return false;
    }
    Express.isUsingMiddleware = isUsingMiddleware;
    /**
     * Checks whether a node looks somewhat like `require('m')()` for
     * some middleware `m` from the list of middlewares.
     */
    function isMiddlewareInstance(context, middlewares, n) {
        if (n.type === 'CallExpression') {
            const fqn = (0, index_js_1.getFullyQualifiedName)(context, n);
            return middlewares.some(middleware => middleware === fqn);
        }
        return false;
    }
    Express.isMiddlewareInstance = isMiddlewareInstance;
    /**
     * Rule factory for detecting sensitive settings that are passed to
     * middlewares eventually used by Express.js applications:
     *
     * app.use(
     *   middleware(settings)
     * )
     *
     * or
     *
     * app.use(
     *   middleware.method(settings)
     * )
     *
     * @param sensitivePropertyFinder - a function looking for a sensitive setting on a middleware call
     * @param message - the reported message when an issue is raised
     * @param meta - the rule metadata
     * @returns a rule module that raises issues when a sensitive property is found
     */
    function SensitiveMiddlewarePropertyRule(sensitivePropertyFinder, message, meta = {}) {
        return {
            meta,
            create(context) {
                let app;
                let sensitiveProperties;
                function isExposing(middlewareNode) {
                    return Boolean(sensitiveProperties.push(...findSensitiveProperty(middlewareNode)));
                }
                function findSensitiveProperty(middlewareNode) {
                    if (middlewareNode.type === 'CallExpression') {
                        return sensitivePropertyFinder(context, middlewareNode);
                    }
                    return [];
                }
                return {
                    Program: () => {
                        app = null;
                        sensitiveProperties = [];
                    },
                    CallExpression: (node) => {
                        if (app) {
                            const callExpr = node;
                            const isSafe = !isUsingMiddleware(context, callExpr, app, isExposing);
                            if (!isSafe) {
                                for (const sensitive of sensitiveProperties) {
                                    (0, index_js_1.report)(context, {
                                        node: callExpr,
                                        message,
                                    }, [(0, index_js_1.toSecondaryLocation)(sensitive)]);
                                }
                                sensitiveProperties = [];
                            }
                        }
                    },
                    VariableDeclarator: (node) => {
                        if (!app) {
                            const varDecl = node;
                            const instantiatedApp = attemptFindAppInstantiation(varDecl, context);
                            if (instantiatedApp) {
                                app = instantiatedApp;
                            }
                        }
                    },
                    ':function': (node) => {
                        if (!app) {
                            const functionDef = node;
                            const injectedApp = attemptFindAppInjection(functionDef, context, node);
                            if (injectedApp) {
                                app = injectedApp;
                            }
                        }
                    },
                };
            },
        };
    }
    Express.SensitiveMiddlewarePropertyRule = SensitiveMiddlewarePropertyRule;
})(Express || (exports.Express = Express = {}));
