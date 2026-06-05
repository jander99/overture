import type estree from 'estree';
import type { Rule } from 'eslint';
export declare function removeNodeWithLeadingWhitespaces(context: Rule.RuleContext, node: estree.Node, fixer: Rule.RuleFixer, removeUntil?: number): Rule.Fix;
