import * as GTS from "./gts";
export declare function newUUID(): Promise<string>;
export declare function addTestUUIDs(sessionUUID: string): Promise<GTS.DM.WrappedResult<boolean>>;
