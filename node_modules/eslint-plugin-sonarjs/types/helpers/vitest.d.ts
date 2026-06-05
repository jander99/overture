import type { Rule } from 'eslint';
import type estree from 'estree';
import { ParserServicesWithTypeInformation } from '@typescript-eslint/utils';
import ts from 'typescript';
export declare namespace Vitest {
    function isImported(context: Rule.RuleContext): boolean;
    function isAssertion(context: Rule.RuleContext, node: estree.Node): boolean;
    function isTSAssertion(services: ParserServicesWithTypeInformation, node: ts.Node): boolean;
}
