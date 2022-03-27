import * as GTS from "./gts";
import Express from 'express';
export declare class WebServerHelper {
    private uuidRegister;
    private siteRoot;
    constructor(pSiteRoot: string);
    getFile(fileName: string): string;
    registerHandler(webapp: Express.Application, url: string, requiredParams: string[], work: Function): Promise<void>;
    private handleRequest;
    attachWeblogsInterface(web: WebServerHelper, webapp: Express.Application): void;
    private requireTransactionHash;
    private requireNetwork;
    private requireBech32Address;
    private requireHex;
    private requireHexList;
    private requireId;
}
export declare class WebResponse {
    success: boolean;
    errorMessage: string;
    logMessage: string;
    data: string;
    constructor(pSuccess: boolean, pErrorMessage: string, pLogMessage: string, pData: string);
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
