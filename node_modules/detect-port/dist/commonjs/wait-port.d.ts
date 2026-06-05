export declare class WaitPortRetryError extends Error {
    retries: number;
    count: number;
    constructor(message: string, retries: number, count: number, options?: ErrorOptions);
}
export interface WaitPortOptions {
    retryInterval?: number;
    retries?: number;
}
export declare function waitPort(port: number, options?: WaitPortOptions): Promise<boolean>;
