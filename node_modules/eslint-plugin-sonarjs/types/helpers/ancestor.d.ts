import type { TSESTree } from '@typescript-eslint/utils';
import { Rule, SourceCode } from 'eslint';
import estree, { Node } from 'estree';
export declare function findFirstMatchingLocalAncestor(node: TSESTree.Node, predicate: (node: TSESTree.Node) => boolean): TSESTree.Node | undefined;
export declare function findFirstMatchingAncestor(node: TSESTree.Node, predicate: (node: TSESTree.Node) => boolean): TSESTree.Node | undefined;
export declare function localAncestorsChain(node: TSESTree.Node): TSESTree.Node[];
export declare function ancestorsChain(node: TSESTree.Node, boundaryTypes: Set<string>): TSESTree.Node[];
export declare function getParent(context: Rule.RuleContext, node: estree.Node): import("estree-jsx").JSXAttribute | estree.SimpleLiteral | estree.RegExpLiteral | estree.BigIntLiteral | import("estree-jsx").JSXOpeningElement | import("estree-jsx").JSXSpreadAttribute | import("estree-jsx").JSXIdentifier | import("estree-jsx").JSXNamespacedName | import("estree-jsx").JSXExpressionContainer | import("estree-jsx").JSXElement | import("estree-jsx").JSXFragment | import("estree-jsx").JSXMemberExpression | import("estree-jsx").JSXOpeningFragment | estree.Property | estree.CatchClause | estree.ClassDeclaration | estree.ClassExpression | estree.ClassBody | estree.Identifier | estree.ArrayExpression | estree.ArrowFunctionExpression | estree.AssignmentExpression | estree.AwaitExpression | estree.BinaryExpression | estree.SimpleCallExpression | estree.NewExpression | estree.ChainExpression | estree.ConditionalExpression | estree.FunctionExpression | estree.ImportExpression | estree.LogicalExpression | estree.MemberExpression | estree.MetaProperty | estree.ObjectExpression | estree.SequenceExpression | estree.TaggedTemplateExpression | estree.TemplateLiteral | estree.ThisExpression | estree.UnaryExpression | estree.UpdateExpression | estree.YieldExpression | estree.FunctionDeclaration | estree.MethodDefinition | estree.ImportDeclaration | estree.ExportNamedDeclaration | estree.ExportDefaultDeclaration | estree.ExportAllDeclaration | estree.ImportSpecifier | estree.ImportDefaultSpecifier | estree.ImportNamespaceSpecifier | estree.ExportSpecifier | estree.ObjectPattern | estree.ArrayPattern | estree.RestElement | estree.AssignmentPattern | estree.PrivateIdentifier | estree.Program | estree.PropertyDefinition | estree.SpreadElement | estree.ExpressionStatement | estree.BlockStatement | estree.StaticBlock | estree.EmptyStatement | estree.DebuggerStatement | estree.WithStatement | estree.ReturnStatement | estree.LabeledStatement | estree.BreakStatement | estree.ContinueStatement | estree.IfStatement | estree.SwitchStatement | estree.ThrowStatement | estree.TryStatement | estree.WhileStatement | estree.DoWhileStatement | estree.ForStatement | estree.ForInStatement | estree.ForOfStatement | estree.VariableDeclaration | estree.Super | estree.SwitchCase | estree.TemplateElement | estree.VariableDeclarator | import("estree-jsx").JSXEmptyExpression | import("estree-jsx").JSXClosingElement | import("estree-jsx").JSXClosingFragment | import("estree-jsx").JSXText | undefined;
/**
 * Returns the parent of an ESLint node
 *
 * This function assumes that an ESLint node exposes a parent property,
 * which is always defined. However, it's better to use `getParent` if
 * it is possible to retrieve the parent based on the rule context.
 *
 * It should eventually disappear once we come up with a proper solution
 * against the conflicting typings between ESLint and TypeScript ESLint
 * when it comes to the parent of a node.
 *
 * @param node an ESLint node
 * @returns the parent node
 */
export declare function getNodeParent(node: Node): Node;
/**
 * Returns the direct children of a node
 * @param node the node to get the children
 * @param visitorKeys the visitor keys provided by the source code
 * @returns the node children
 */
export declare function childrenOf(node: estree.Node, visitorKeys: SourceCode.VisitorKeys): estree.Node[];
