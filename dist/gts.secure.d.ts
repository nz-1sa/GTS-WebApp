import * as GTS from "./gts";
import * as WS from "./gts.webserver";
import * as Express from 'express';
export declare function attachWebInterface(web: WS.WebServerHelper, webapp: Express.Application): void;
export declare function getSessionId(uuid: string, requestIp: string, cookies: GTS.DM.HashTable<string>): Promise<string>;
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
    nonceBase: number;
    logoutSeed: number;
    seqReqSeed: number;
    password: string;
    seq: number;
    chkSum: string;
    constructor(pId: number, pSessionId: string, pCreated: Date, pLastSeen: Date, pIp: string, pStatus: SessionStatus, pCaptcha: number, pNonceBase: number, pLogoutSeed: number, pSeqReqSeed: number, pPassword: string, pSeq: number, pChkSum: string);
    genHash(): string;
    toString(): string;
    toJSON(): object;
    verifyValuesAreValid(): [boolean, string];
    static fromStrings(id: string, sessionId: string, created: string, lastSeen: string, ip: string, status: string, captcha: string, nonceBase: string, logoutSeed: string, seqReqSeed: string, password: string, seq: string, chkSum: string): Session | null;
    static isProposedSessionIdUnique(uuid: string, sessionId: string): Promise<GTS.DM.WrappedResult<boolean>>;
    static expireOldSessionsInDB(uuid: string): Promise<GTS.DM.WrappedResult<boolean>>;
    static updateSessionLastSeenInDB(uuid: string, sessionId: string): Promise<GTS.DM.WrappedResult<boolean>>;
    static getSessionFromDB(uuid: string, sessionId: string): Promise<GTS.DM.WrappedResult<Session>>;
    static checkAndIncrementSequenceInDB(sessionId: string, reqSequence: number, uuid: string): Promise<GTS.DM.WrappedResult<string>>;
    static fetchAllFromDB(uuid: string): Promise<GTS.DM.WrappedResult<Session[]>>;
    addToDB(uuid: string): Promise<GTS.DM.WrappedResult<null>>;
    updateDB(uuid: string): Promise<GTS.DM.WrappedResult<null>>;
    deleteFromDB(uuid: string): Promise<GTS.DM.WrappedResult<void>>;
    initialiseCaptcha(uuid: string, sessionId: string): void;
    static hasSession(uuid: string, requestIp: string, cookies: GTS.DM.HashTable<string>): Promise<[boolean, Session?]>;
    static isLoggedIn(uuid: string, requestIp: string, cookies: GTS.DM.HashTable<string>): Promise<boolean>;
    private static randomPassChar;
    static genSessionPassword(): Promise<string>;
}
export declare class LoginAccount {
    id: number;
    ident: string;
    email: string;
    passHash: string;
    activeSessionId: string;
    chkSum: string;
    constructor(pId?: number, pIdent?: string, pEmail?: string, pPassHash?: string, pActiveSessionId?: string, pChkSum?: string);
    genHash(): string;
    toString(): string;
    toJSON(): object;
    verifyValuesAreValid(): [boolean, string];
    static fromStrings(id: string, ident: string, email: string, passHash: string, activeSessionId: string, chkSum: string): LoginAccount | null;
    static fetchAllFromDB(uuid: string): Promise<GTS.DM.WrappedResult<LoginAccount[]>>;
    addToDB(uuid: string): Promise<GTS.DM.WrappedResult<null>>;
    updateDB(uuid: string): Promise<GTS.DM.WrappedResult<null>>;
    deleteFromDB(uuid: string): Promise<GTS.DM.WrappedResult<void>>;
    static getPassHash(uuid: string, ident: string): Promise<GTS.DM.WrappedResult<[string, string]>>;
    static setActiveSessionId(uuid: string, ident: string, activesessionid: string): Promise<GTS.DM.WrappedResult<void>>;
}
