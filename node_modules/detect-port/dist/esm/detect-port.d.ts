export type DetectPortCallback = (err: Error | null, port?: number) => void;
export interface PortConfig {
    port?: number | string;
    hostname?: string | undefined;
    callback?: DetectPortCallback;
}
export declare class IPAddressNotAvailableError extends Error {
    constructor(options?: ErrorOptions);
}
export declare function detectPort(port?: number | PortConfig | string): Promise<number>;
export declare function detectPort(callback: DetectPortCallback): void;
export declare function detectPort(port: number | PortConfig | string | undefined, callback: DetectPortCallback): void;
