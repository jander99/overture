import type { Rule } from 'eslint';
type ReportOverrider = (context: Rule.RuleContext, reportDescriptor: Rule.ReportDescriptor) => void;
type ContextOverrider = (context: Rule.RuleContext, onReport: ReportOverrider) => Rule.RuleContext;
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
export declare function interceptReport(rule: Rule.RuleModule, onReport: ReportOverrider, contextOverrider?: ContextOverrider): Rule.RuleModule;
export declare function interceptReportForReact(rule: Rule.RuleModule, onReport: ReportOverrider): Rule.RuleModule;
export {};
