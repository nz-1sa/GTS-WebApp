import * as GTS from "./gts";
import * as Express from 'express';
export declare class WebServerHelper {
    private uuidRegister;
    private siteRoot;
    constructor(pSiteRoot: string);
    getFile(fileName: string): string;
    registerHandler(webapp: Express.Application, url: string, requiredParams: string[], work: Function): Promise<void>;
    registerHandlerUnchecked(webapp: Express.Application, url: string, requiredParams: string[], work: Function): Promise<void>;
    registerAdminHandler(webapp: Express.Application, action: string, requiredParams: string[], work: Function): Promise<void>;
    private getUUID;
    private releaseUUID;
    private handleRequest;
    private handleRequestUnchecked;
    attachWeblogsInterface(web: WebServerHelper, webapp: Express.Application): void;
    private requireTransactionHash;
    private requireNetwork;
    private requireBech32Address;
    private requireHex;
    private requireHexList;
    private requireId;
    private requireCustom;
}
export declare class Cookie {
    name: string;
    value: string;
    expires: Date;
    domain: string;
    path: string;
    httpOnly: boolean;
    secure: boolean;
    constructor(pName: string, pValue: string);
    constructor(pName: string, pValue: string, pExpires: Date);
    constructor(pName: string, pValue: string, pExpires: Date, pDomain: string);
    constructor(pName: string, pValue: string, pExpires: Date, pDomain: string, pPath: string);
    constructor(pName: string, pValue: string, pExpires: Date, pDomain: string, pPath: string, pHttpOnly: boolean);
    getOptions(): object;
}
export declare class WebResponse {
    success: boolean;
    errorMessage: string;
    logMessage: string;
    data: string;
    cookies: Cookie[];
    constructor(pSuccess: boolean, pErrorMessage: string, pLogMessage: string, pData: string, pSetCookies?: Cookie[]);
}
export declare class Weblog {
    id: number;
    uuid: string;
    requestedAt: string;
    requestUrl: string;
    requestParams: string;
    responseSuccess: boolean;
    responseDuration: number;
    logMessage: string;
    errorMessage: string;
    constructor();
}
export declare namespace DB {
    function addWeblog(uuid: string, requestUrl: string, requestParams: string, responseSuccess: boolean, responseDuration: number, logMessage: string, errorMessage: string): Promise<GTS.DM.WrappedResult<void>>;
    function getWeblogs(uuid: string): Promise<GTS.DM.WrappedResult<Weblog[]>>;
    function pruneWeblogs(uuid: string, id: string): Promise<GTS.DM.WrappedResult<void>>;
}
