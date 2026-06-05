import type estree from 'estree';
export declare namespace Mocha {
    interface TestCase {
        node: estree.Node;
        callback: estree.Function;
    }
    function isTestConstruct(node: estree.Node, constructs?: string[]): boolean;
    function extractTestCase(node: estree.Node): TestCase | null;
    /**
     * returns true if the node is a test case
     *
     * @param node
     * @returns
     */
    function isTestCase(node: estree.Node): boolean;
    /**
     * returns true if the node is a describe block
     *
     * @param node
     * @returns
     */
    function isDescribeCase(node: estree.Node): boolean;
}
