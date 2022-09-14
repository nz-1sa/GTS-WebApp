import * as GTS from "./gts";
import * as WS from "./gts.webserver";
import * as Express from 'express';
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
    status: SessionStatus;
    captcha: number;
    nonce: number;
    password: string;
    chkSum: string;
    constructor(pId: number, pSessionId: string, pCreated: Date, pLastSeen: Date, pIp: string, pStatus: SessionStatus, pCaptcha: number, pNonce: number, pPassword: string, pChkSum: string);
    static attachWebInterface(web: WS.WebServerHelper, webapp: Express.Application): void;
    genHash(): string;
    toString(): string;
    toJSON(): object;
    verifyValuesAreValid(): [boolean, string];
    static fromStrings(id: string, sessionId: string, created: string, lastSeen: string, ip: string, status: string, captcha: string, nonce: string, password: string, chkSum: string): Session | null;
    static isProposedSessionIdUnique(uuid: string, sessionId: string): Promise<GTS.DM.WrappedResult<boolean>>;
    static getSessionFromDB(uuid: string, sessionId: string): Promise<GTS.DM.WrappedResult<Session>>;
    static fetchAllFromDB(uuid: string): Promise<GTS.DM.WrappedResult<Session[]>>;
    addToDB(uuid: string): Promise<GTS.DM.WrappedResult<null>>;
    updateDB(uuid: string): Promise<GTS.DM.WrappedResult<null>>;
    deleteFromDB(uuid: string): Promise<GTS.DM.WrappedResult<void>>;
    initialiseCaptcha(uuid: string, sessionId: string): void;
    static hasSession(uuid: string, requestIp: string, cookies: GTS.DM.HashTable<string>): Promise<[boolean, Session?]>;
    static isLoggedIn(uuid: string, requestIp: string, cookies: GTS.DM.HashTable<string>): Promise<boolean>;
    private static randomPassChar;
    private static genSessionPassword;
}
