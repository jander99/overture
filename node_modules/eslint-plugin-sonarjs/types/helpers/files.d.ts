/**
 * Removes any Byte Order Marker (BOM) from a string's head
 *
 * A string's head is nothing else but its first character.
 *
 * @param str the input string
 * @returns the stripped string
 */
export declare function stripBOM(str: string): string;
/**
 * Converts a path to Unix format
 * @param path the path to convert
 * @returns the converted path
 */
export declare function toUnixPath(path: string): string;
export declare function isRoot(file: string): boolean;
