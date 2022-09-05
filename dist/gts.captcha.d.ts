import * as GTS from "./gts";
import * as WS from "./gts.webserver";
import * as Express from 'express';
export declare function hasSession(uuid: string, requestIp: string, cookies: GTS.DM.HashTable<string>): Promise<[boolean, Session?]>;
export declare function isLoggedIn(uuid: string, requestIp: string, cookies: GTS.DM.HashTable<string>): Promise<boolean>;
export declare function attachCaptcha(web: WS.WebServerHelper, webapp: Express.Application): void;
export declare enum SessionStatus {
    Initialised = 1,
    LoggedIn = 2,
    LoggedOut = 3,
    Expired = 4
}
export declare class Session {
    id: number;
    sessionId: string;
    created: Date;
    lastSeen: Date;
    ip: string;
    status: number;
    chkSum: string;
    constructor(pId: number, pSessionId: string, pCreated: Date, pLastSeen: Date, pIp: string, pStatus: number, pChkSum: string);
    genHash(): string;
    toString(): string;
    toJSON(): object;
    testId(): boolean;
    testSessionId(): boolean;
    testCreated(): boolean;
    testLastSeen(): boolean;
    testIp(): boolean;
    testStatus(): boolean;
    testChkSum(): boolean;
    static fromStrings(id: string, sessionId: string, created: string, lastSeen: string, ip: string, status: string, chkSum: string): Session | undefined;
}
export declare namespace DB {
    function fetchAllSession(uuid: string): Promise<GTS.DM.WrappedResult<Session[]>>;
    function getSession(uuid: string, sessionId: string): Promise<GTS.DM.WrappedResult<Session>>;
    function addSession(uuid: string, sessionId: string, created: Date, lastSeen: Date, ip: string, status: number): Promise<GTS.DM.WrappedResult<Session>>;
    function updateSession(uuid: string, id: number, sessionId: string, created: Date, lastSeen: Date, ip: string, status: number, chkSum: string): Promise<GTS.DM.WrappedResult<Session>>;
    function deleteSession(uuid: string, id: number): Promise<GTS.DM.WrappedResult<void>>;
}
