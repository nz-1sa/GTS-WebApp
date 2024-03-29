import * as GTS from "./gts";
declare class CancellableDelay {
    timeout: number;
    promise: Promise<void>;
    constructor(pTimeout: number, pPromise: Promise<void>);
}
export interface IAsyncAction {
    (resolve: Function): Promise<void>;
}
export declare class DelayedResult<T> {
    private p2;
    reject(message: string): void;
    constructor(pPromise: Promise<T>);
    getResult(): Promise<T>;
    static createDelayedResult<T>(pAction: IAsyncAction): Promise<[Function, DelayedResult<T>]>;
}
export declare class QuedJob<T> {
    started: boolean;
    subFunc: Function;
    dRes: DelayedResult<T>;
    constructor(f: Function, dr: DelayedResult<T>);
    run(): Promise<void>;
    isStarted(): boolean;
    getResult(): Promise<T>;
    reject(message: string): void;
}
export declare class Concurrency {
    static pause(ms: number): Promise<void>;
    private static limitOneAtATimePromises;
    static limitToOneAtATime<T>(purpose: string, fn: Function, ...args: any[]): Promise<DelayedResult<T>>;
    private static limitXAtATimeQues;
    static limitXAtATime<T>(purpose: string, fn: Function, ...args: any[]): Promise<DelayedResult<T>>;
    static finishedLimitedJob(purpose: string, job: any): Promise<void>;
    static startCancellableDelay(ms: number): Promise<CancellableDelay>;
    static doFuncOrTimeout<T>(timeout: number, action: Function): Promise<[T, boolean]>;
    static throttleJob<T>(minDuration: number, action: Function): Promise<T>;
    private static cachedDoOnceValues;
    private static currentDoOnceReqeusts;
    static doOnce<T>(purpose: string, action: Function, cacheDuration: number): Promise<T | void>;
    static executeJobNotifyAndCacheResult<T>(purpose: string, action: Function, cacheDuration: number): Promise<void>;
    static doAllAsync<T>(jobs: Function[]): Promise<T[]>;
    private static expectedSequenceLookup;
    static inMemorySequenceTracking(purpose: string, sequence: number): GTS.DM.WrappedResult<string>;
    private static sequencedJobsWaiting;
    static doSequencedJob<T>(purpose: string, sequence: number, action: Function, actionArgs?: any[], seqCheckAndIncr?: Function, seqCheckArgs?: any[]): Promise<T>;
}
export {};
