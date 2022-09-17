/// <reference types="node" />
import * as GTS from "./gts";
import * as WS from "./gts.webserver";
import * as Express from 'express';
export declare function pause(ms: number): Promise<void>;
export declare class CancellableDelay {
    timeout: NodeJS.Timeout;
    promise: Promise<void>;
    constructor(pTimeout: NodeJS.Timeout, pPromise: Promise<void>);
}
export declare function delayCancellable(ms: number): Promise<CancellableDelay>;
export declare function multiThreadDoOnce<T>(purpose: string, uuid: string, action: Function): Promise<T>;
export declare function doAllAsync(jobs: Function[], uuid: string, purpose: string): Promise<void>;
export declare function singleLock<T>(purpose: string, uuid: string, action: Function, doLog?: boolean): Promise<T>;
export declare function sequencedStartLock<T>(purpose: string, uuid: string, reqSequence: number, expectedSequence: number, seqCheck: Function, action: Function, doLog?: boolean): Promise<T>;
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
    function addThreadingLog(log: ThreadingLog, uuid: string): Promise<GTS.DM.WrappedResult<void>>;
    function getThreadingLogs(uuid: string): Promise<GTS.DM.WrappedResult<ThreadingLog[]>>;
    function pruneThreadinglogs(uuid: string, id: string): Promise<GTS.DM.WrappedResult<void>>;
    function actionSequence(uuid: string, purpose: string, reqSequence: number): Promise<GTS.DM.WrappedResult<boolean>>;
}
