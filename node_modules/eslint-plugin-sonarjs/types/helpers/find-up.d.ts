import fs from 'fs';
export interface Filesystem {
    readdirSync: (typeof fs)['readdirSync'];
    readFileSync: (typeof fs)['readFileSync'];
    statSync: (typeof fs)['statSync'];
}
interface File {
    readonly path: string;
    readonly content: Buffer | string;
}
type FindUp = (from: string, to?: string, filesystem?: Filesystem) => Array<File>;
/**
 * Create an instance of FindUp.
 */
export declare const createFindUp: (pattern: string) => FindUp;
export {};
