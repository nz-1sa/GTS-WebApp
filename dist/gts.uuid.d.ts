import * as GTS from "./gts.webapp";
export declare function newUUID(): Promise<string>;
export declare function addTestUUIDs(sessionUUID: string): Promise<GTS.WrappedResult<boolean>>;
