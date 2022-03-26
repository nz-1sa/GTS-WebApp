import * as GTS from "./gts";
import Express from 'express';
export declare class WebServerHelper {
    private uuidRegister;
    constructor();
    registerHandler(webapp: Express.Application, url: string, requiredParams: string[], work: Function): void;
    handleRequest(req: Express.Request, res: Express.Response, requestUrl: string, requiredParams: string[], work: Function): Promise<void>;
    attachWeblogsInterface(web: WebServerHelper, webapp: Express.Application): void;
    requireTransactionHash(req: Express.Request, res: Express.Response): GTS.DM.CheckedValue<string>;
    requireNetwork(req: Express.Request, res: Express.Response): GTS.DM.CheckedValue<string>;
    requireBech32Address(req: Express.Request, res: Express.Response): GTS.DM.CheckedValue<string>;
    requireHex(req: Express.Request, res: Express.Response): GTS.DM.CheckedValue<string>;
    requireData(req: Express.Request, res: Express.Response): GTS.DM.CheckedValue<string>;
    requireId(req: Express.Request, res: Express.Response): GTS.DM.CheckedValue<string>;
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
