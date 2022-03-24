import * as GTS from "./gts.webapp";
import * as WS from "./gts.webserver";
import Express from 'express';
export declare function multiThreadDoOnce<T>(purpose: string, uuid: string, action: Function): Promise<T>;
export declare function doAllAsync(jobs: Function[], uuid: string, purpose: string): Promise<void>;
export declare function singleLock<T>(purpose: string, uuid: string, action: Function, doLog?: boolean): Promise<T>;
export declare function throttle<T>(uuid: string, purpose: string, delay: number, action: Function, doLog?: boolean): Promise<T>;
export declare function doWithTimeout<T>(uuid: string, timeout: number, action: Function): Promise<T>;
export declare function attachThreadingDebugInterface(web: WS.WebServerHelper, webapp: Express.Application): void;
export declare class ThreadingLog {
    dbId: number;
    threadingId: number;
    threadingGroup: number;
    uuid: string;
    type: string;
    purpose: string;
    action: string;
    loggedAt: number;
    constructor();
    setVals(pDbId: number, pThreadingId: number, pThreadingGroup: number, pUuid: string, pType: string, pPurpose: string, pAction: string, pLoggedAt: number): ThreadingLog;
    setNew(pThreadingId: number, pThreadingGroup: number, pUuid: string, pType: string, pPurpose: string, pAction: string): ThreadingLog;
}
export declare namespace DB {
    function addThreadingLog(log: ThreadingLog, uuid: string): Promise<GTS.WrappedResult<void>>;
    function getThreadingLogs(uuid: string): Promise<GTS.WrappedResult<ThreadingLog[]>>;
    function pruneThreadinglogs(uuid: string, id: string): Promise<GTS.WrappedResult<void>>;
}
