import type { Rule } from 'eslint';
import type estree from 'estree';
import type { ParserServicesWithTypeInformation } from '@typescript-eslint/utils';
import ts from 'typescript';
export declare namespace Chai {
    function isImported(context: Rule.RuleContext): boolean;
    function isTSAssertion(services: ParserServicesWithTypeInformation, node: ts.Node): boolean;
    function isAssertion(context: Rule.RuleContext, node: estree.Node): boolean;
}
