"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interceptReport = interceptReport;
exports.interceptReportForReact = interceptReportForReact;
const NUM_ARGS_NODE_MESSAGE = 2;
/**
 * Modifies the behavior of `context.report(descriptor)` for a given rule.
 *
 * Useful for performing additional checks before reporting an issue.
 *
 * @param rule the original rule
 * @param onReport replacement for `context.report(descr)`
 *                 invocations used inside of the rule
 * @param contextOverrider optional function to change the default context overriding mechanism
 */
function interceptReport(rule, onReport, contextOverrider) {
    return {
        // meta should be defined only when it's defined on original rule, otherwise NodeRuleTester will fail
        ...(!!rule.meta && { meta: rule.meta }),
        create(originalContext) {
            let interceptingContext;
            if (contextOverrider == null) {
                interceptingContext = {
                    id: originalContext.id,
                    options: originalContext.options,
                    settings: originalContext.settings,
                    parserPath: originalContext.parserPath,
                    parserOptions: originalContext.parserOptions,
                    sourceCode: originalContext.sourceCode,
                    cwd: originalContext.cwd,
                    filename: originalContext.filename,
                    physicalFilename: originalContext.physicalFilename,
                    languageOptions: originalContext.languageOptions,
                    getCwd() {
                        return originalContext.cwd;
                    },
                    getPhysicalFilename() {
                        return originalContext.physicalFilename;
                    },
                    getFilename() {
                        return originalContext.filename;
                    },
                    getSourceCode() {
                        return originalContext.sourceCode;
                    },
                    // @ts-ignore
                    getSource(...args) {
                        return originalContext.sourceCode.getText(...args);
                    },
                    report(...args) {
                        let descr = undefined;
                        if (args.length === 1) {
                            descr = args[0];
                        }
                        else if (args.length === NUM_ARGS_NODE_MESSAGE && typeof args[1] === 'string') {
                            // not declared in the `.d.ts`, but used in practice by rules written in JS
                            descr = {
                                node: args[0],
                                message: args[1],
                            };
                        }
                        if (descr) {
                            onReport(originalContext, descr);
                        }
                    },
                };
            }
            else {
                interceptingContext = contextOverrider(originalContext, onReport);
            }
            return rule.create(interceptingContext);
        },
    };
}
// interceptReport() by default doesn't work with the React plugin
// as the rules fail to find the context getFirstTokens() function.
function interceptReportForReact(rule, onReport) {
    return interceptReport(rule, onReport, contextOverriderForReact);
}
function contextOverriderForReact(context, onReport) {
    const overriddenReportContext = {
        report(reportDescriptor) {
            onReport(context, reportDescriptor);
        },
    };
    Object.setPrototypeOf(overriddenReportContext, context);
    return overriddenReportContext;
}
