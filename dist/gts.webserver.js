"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DB = exports.Weblog = exports.WebResponse = exports.Cookie = exports.WebServerHelper = void 0;
const GTS = __importStar(require("./gts"));
const DBCore = __importStar(require("./gts.db"));
const UUID = __importStar(require("./gts.uuid"));
const gts_concurrency_1 = require("./gts.concurrency");
const Secure = __importStar(require("./gts.secure"));
const PATH = require('path');
const ejs = require('ejs');
const fs = require('fs');
class RenderEnvSettings {
    constructor(pWsh, pUuid, pRequestIp, pCookies, pUrl, pSessionId, pIsLoggedIn, pData) {
        this.uuid = '';
        this.requestIp = '';
        this.cookies = {};
        this.url = '';
        this.sessionId = '';
        this.isLoggedIn = false;
        this.data = {};
        this.uuid = pUuid;
        this.requestIp = pRequestIp;
        this.cookies = pCookies;
        this.url = pUrl;
        this.sessionId = pSessionId;
        this.isLoggedIn = pIsLoggedIn;
        this.data = pData;
        this.wsh = pWsh;
        this.adminInteger = function (name, value, regex, min, max, options, values) {
            let fileName = this.wsh.getFile('res/adminInteger.ejs');
            let template = fs.readFileSync(fileName, 'utf-8');
            return ejs.render(template, { name: name, value: value, regex: regex, min: min, max: max, options: options, values: values });
        };
        this.adminStringList = function (name, value, regex, min, max, options, values) {
            let fileName = this.wsh.getFile('res/adminStringList.ejs');
            let template = fs.readFileSync(fileName, 'utf-8');
            return ejs.render(template, { name: name, value: value, regex: regex, min: min, max: max, options: options, values: values });
        };
        this.adminEnum = function (name, value, regex, min, max, options, values) {
            let fileName = this.wsh.getFile('res/adminEnum.ejs');
            let template = fs.readFileSync(fileName, 'utf-8');
            return ejs.render(template, { name: name, value: value, regex: regex, min: min, max: max, options: options, values: values });
        };
        this.adminDateOnly = function (name, value, regex, min, max, options, values) {
            let fileName = this.wsh.getFile('res/adminDateOnly.ejs');
            let template = fs.readFileSync(fileName, 'utf-8');
            return ejs.render(template, { name: name, value: value, regex: regex, min: min, max: max, options: options, values: values });
        };
        this.adminDateTime = function (name, value, regex, min, max, options, values) {
            let fileName = this.wsh.getFile('res/adminDateTime.ejs');
            let template = fs.readFileSync(fileName, 'utf-8');
            return ejs.render(template, { name: name, value: value, regex: regex, min: min, max: max, options: options, values: values });
        };
        this.adminString = function (name, value, regex, min, max, options, values) {
            let fileName = this.wsh.getFile('res/adminString.ejs');
            let template = fs.readFileSync(fileName, 'utf-8');
            return ejs.render(template, { name: name, value: value, regex: regex, min: min, max: max, options: options, values: values });
        };
    }
}
class EjsSettings {
    constructor() {
        this.ad = [];
        this.pd = [];
    }
}
class WebServerHelper {
    // initialise a new uuid register when the WebServerHelper is instantiated
    constructor(pSiteRoot) {
        this.siteRoot = '';
        this.adminHandlers = {};
        this.uuidRegister = {};
        this.siteRoot = pSiteRoot; // set where files are served from
    }
    // get a file in reference to the website root
    getFile(fileName) {
        return PATH.join(this.siteRoot, fileName);
    }
    // register how to hanle a web request; the url to listen on, required parameters to be sent, and the function to do
    registerHandler(webapp, url, requiredParams, work) {
        return __awaiter(this, void 0, void 0, function* () {
            webapp.get(url, (req, res) => __awaiter(this, void 0, void 0, function* () {
                yield this.handleRequest(req, res, url, requiredParams, work);
            }));
        });
    }
    // register how to hanle a web request; the url to listen on, required parameters to be sent, and the function to do. Params are not checked
    registerHandlerPost(webapp, url, requiredParams, work) {
        return __awaiter(this, void 0, void 0, function* () {
            webapp.post(url, (req, res) => __awaiter(this, void 0, void 0, function* () {
                yield this.handleRequestPost(req, res, url, requiredParams, work);
            }));
        });
    }
    registerHandlerGet(webapp, url, requiredParams, work) {
        return __awaiter(this, void 0, void 0, function* () {
            webapp.get(url, (req, res) => __awaiter(this, void 0, void 0, function* () {
                yield this.handleRequestGet(req, res, url, requiredParams, work);
            }));
        });
    }
    // store the function to return a response for an admin request
    registerAdminHandler(action, work) {
        return __awaiter(this, void 0, void 0, function* () {
            this.adminHandlers[action] = work;
        });
    }
    getUUID() {
        return __awaiter(this, void 0, void 0, function* () {
            const loopSafety = 20;
            let loopIteration = 1;
            let uuid = yield UUID.newUUID();
            while (this.uuidRegister[uuid] && loopIteration <= loopSafety) {
                console.log('handling uuid clash');
                uuid = yield UUID.newUUID();
                loopIteration++;
            }
            if (this.uuidRegister[uuid]) {
                return 'ERROR: Could not generate unique uuid';
            }
            this.uuidRegister[uuid] = true; // record the uuid for this request is in use
            return uuid;
        });
    }
    releaseUUID(uuid) {
        // release the uuid from the register of those in use
        delete this.uuidRegister[uuid];
    }
    // common handling of webrequests
    // assigns uuid to each request
    // records the request and the time to serve it
    // ensures database connection is released
    // provides simple error handling
    handleRequest(req, res, requestUrl, requiredParams, work) {
        return __awaiter(this, void 0, void 0, function* () {
            let timeStart = new Date().getTime();
            var response = new WebResponse(false, '', 'Only Initialised', '');
            // get a unqiue identifier for the request being served
            let uuid = yield this.getUUID();
            // return an error if we could not get an uuid
            if (uuid.startsWith('ERROR:')) {
                console.error(uuid);
                response = new WebResponse(false, 'Could not generate unique uuid', '', '');
                res.send(response.toString());
                return;
            }
            //  get sanitised request variables
            let logParams = [];
            try {
                // support parsing known params and providing sanitized values to the work to be done
                let requiredParamChecks = [];
                for (var i = 0; i < requiredParams.length; i++) {
                    switch (requiredParams[i]) {
                        case 'txHash':
                            let txHashCheck = this.requireTransactionHash(req, res);
                            if (!txHashCheck.isValid) {
                                return;
                            }
                            requiredParamChecks.push(txHashCheck);
                            logParams.push('txHash=' + txHashCheck.value);
                            break;
                        case 'network':
                            let networkCheck = this.requireNetwork(req, res);
                            if (!networkCheck.isValid) {
                                return;
                            }
                            requiredParamChecks.push(networkCheck);
                            logParams.push('network=' + networkCheck.value);
                            break;
                        case 'address':
                            let addressCheck = this.requireBech32Address(req, res);
                            if (!addressCheck.isValid) {
                                return;
                            }
                            requiredParamChecks.push(addressCheck);
                            logParams.push('address=' + addressCheck.value);
                            break;
                        case 'hex':
                            let hexCheck = this.requireHex(req, res);
                            if (!hexCheck.isValid) {
                                return;
                            }
                            requiredParamChecks.push(hexCheck);
                            logParams.push('hex=' + hexCheck.value);
                            break;
                        case 'hexlist':
                            let hexlistCheck = this.requireHexList(req, res);
                            if (!hexlistCheck.isValid) {
                                return;
                            }
                            requiredParamChecks.push(hexlistCheck);
                            logParams.push('hexlist=' + hexlistCheck.value);
                            break;
                        case 'id':
                            let idCheck = this.requireId(req, res);
                            if (!idCheck.isValid) {
                                return;
                            }
                            requiredParamChecks.push(idCheck);
                            logParams.push('id=' + idCheck.value);
                            break;
                        default:
                            if (requiredParams[i].startsWith('custom:')) {
                                let nameEnd = requiredParams[i].indexOf(' ');
                                let name = requiredParams[i].substring(7, nameEnd);
                                let regex = requiredParams[i].substring(nameEnd + 1);
                                let customCheck = this.requireCustom(req, res, name, regex);
                                if (!customCheck.isValid) {
                                    return;
                                }
                                requiredParamChecks.push(customCheck);
                                logParams.push(`${name}=${customCheck.value}`);
                                break;
                            }
                            console.error(`unknown required param ${requiredParams[i]}`);
                            break;
                    }
                }
                // get the response for the request and send it
                response = yield work(uuid, ...requiredParamChecks);
                res.send(response.toString());
            }
            catch (err) {
                // show and record any error encounted
                console.error(`UUID:${uuid} Error handling ${requestUrl}`);
                console.error(err);
                response = new WebResponse(false, err.toString(), `Caught Error handling ${requestUrl}`, '');
                res.send(response.toString());
            }
            finally {
                // log the request that was served
                let timeEnd = new Date().getTime();
                let storeLog = yield DB.addWeblog(uuid, requestUrl, logParams.join('\r\n'), response.success, (timeEnd - timeStart) / 1000, response.logMessage, response.errorMessage);
                if (storeLog.error) {
                    console.error('unable to store log of web request');
                    console.error(storeLog.message);
                }
                // free db resources for the request
                yield DBCore.releaseConnection(uuid);
                // release the uuid from the register of those in use
                this.releaseUUID(uuid);
            }
        });
    }
    handleRequestGet(req, res, requestUrl, requiredParams, work) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.handleRequestUnchecked(req, res, requestUrl, requiredParams, work, false);
        });
    }
    handleRequestPost(req, res, requestUrl, requiredParams, work) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.handleRequestUnchecked(req, res, requestUrl, requiredParams, work, true);
        });
    }
    handleRequestUnchecked(req, res, requestUrl, requiredParams, work, isPost) {
        return __awaiter(this, void 0, void 0, function* () {
            let timeStart = new Date().getTime();
            var response = new WebResponse(false, '', 'Only Initialised', '');
            // get a unqiue identifier for the request being served
            let uuid = yield this.getUUID();
            // return an error if we could not get an uuid
            if (uuid.startsWith('ERROR:')) {
                console.error(uuid);
                response = new WebResponse(false, 'Could not generate unique uuid', '', '');
                res.send(response.toString());
                return;
            }
            let logParams = [];
            try {
                // get the param values if they are present
                let paramVals = [];
                for (var i = 0; i < requiredParams.length; i++) {
                    let name = requiredParams[i];
                    let val = '';
                    if (isPost) {
                        if (req.body[name] === undefined) {
                            res.send(new WebResponse(false, `Missing ${name} post data`, '', '').toString());
                            return;
                        }
                        val = req.body[name].toString();
                    }
                    else {
                        if (req.query[name] === undefined) {
                            res.send(new WebResponse(false, `Missing ${name} param`, '', '').toString());
                            return;
                        }
                        val = req.query[name].toString();
                    }
                    paramVals.push(val);
                    logParams.push(`${name}=${val}`);
                }
                // get the response for the request
                let timedOut = false;
                [response, timedOut] = yield gts_concurrency_1.Concurrency.doFuncOrTimeout(90000, function () {
                    return __awaiter(this, void 0, void 0, function* () { return yield work(uuid, req.originalUrl, req.ip, req.cookies, ...paramVals); });
                });
                if (timedOut) {
                    response = new WebResponse(false, 'ERROR: Processing request timed out', `Error, Processing request timed out while handling ${requestUrl}`, '');
                    res.send(response.toString());
                    return;
                }
                if (!response) {
                    response = new WebResponse(false, 'ERROR: No response returned for request.', `Error, no response returned for handling ${requestUrl}`, '');
                    res.send(response.toString());
                    return;
                }
                // set any cookies specified for the response
                if (response.cookies != undefined && response.cookies.length > 0) {
                    for (var i = 0; i < response.cookies.length; i++) {
                        let c = response.cookies[i];
                        res.cookie(c.name, c.value, c.getOptions());
                    }
                }
                //send the response
                res.send(response.toString());
            }
            catch (err) {
                // show and record any error encounted
                console.error(`UUID:${uuid} Error handling ${requestUrl}`);
                console.error(err);
                response = new WebResponse(false, err.toString(), `Caught Error handling ${requestUrl}`, '');
                res.send(response.toString());
            }
            finally {
                // log the request that was served
                let timeEnd = new Date().getTime();
                let storeLog = yield DB.addWeblog(uuid, requestUrl, logParams.join('\r\n'), response.success, (timeEnd - timeStart) / 1000, response.logMessage, response.errorMessage);
                if (storeLog.error) {
                    console.error('unable to store log of web request');
                    console.error(storeLog.message);
                }
                // free db resources for the request
                yield DBCore.releaseConnection(uuid);
                // release the uuid from the register of those in use
                this.releaseUUID(uuid);
            }
        });
    }
    // attach code to serve admin files
    attachAdminFiles(web, webapp) {
        // serve files from the admin directory if are logged in
        webapp.get('/admin*', (req, res) => __awaiter(this, void 0, void 0, function* () {
            console.log('admin file handler');
            let timeStart = new Date().getTime();
            let resp = new WebResponse(false, 'Just Init', '', '');
            let uuid = yield web.getUUID();
            try {
                // return an error if we could not get an uuid
                if (uuid.startsWith('ERROR:')) {
                    console.error(uuid);
                    resp = new WebResponse(false, 'Could not generate unique uuid', '', '');
                }
                else {
                    let url = req.originalUrl.replace('\\', '/');
                    if (!(url == '/admin' || url.startsWith('/admin/'))) {
                        resp = new WebResponse(false, 'ERROR: Invalid admin request received', `UUID:${uuid} Trying to access invalid admin file`, '');
                    }
                    else {
                        let requestIp = req.ip;
                        let cookies = req.cookies;
                        let isLoggedIn = yield Secure.Session.isLoggedIn(uuid, requestIp, cookies);
                        if (!isLoggedIn) {
                            res.status(401);
                            this.handleServeFile(web, res, '/admin/401', uuid, new RenderEnvSettings(this, uuid, requestIp, cookies, url, '', isLoggedIn, {}));
                            resp = new WebResponse(true, '401 Unauthorised', `UUID:${uuid} Trying to access admin without login`, '');
                        }
                        else {
                            console.log('process admin file request ' + url);
                            resp = yield this.handleServeFile(web, res, url, uuid, new RenderEnvSettings(this, uuid, requestIp, cookies, url, '', isLoggedIn, {}));
                        }
                    }
                }
                if (!resp.success) {
                    console.log('sending admin error message');
                    res.send(resp.toString());
                }
            }
            finally {
                // log the request that was served
                let timeEnd = new Date().getTime();
                let storeLog = yield DB.addWeblog(uuid, req.originalUrl, '', resp.success, (timeEnd - timeStart) / 1000, resp.logMessage, resp.errorMessage);
                if (storeLog.error) {
                    console.error('unable to store log of admin request');
                    console.error(storeLog.message);
                }
                // free db resources for the request
                yield DBCore.releaseConnection(uuid);
                // release the uuid from the register of those in use
                web.releaseUUID(uuid);
            }
        }));
    }
    // attach code to serve normal website files
    attachRootFiles(web, webapp) {
        // serve files from the public directory
        webapp.get('/*', (req, res) => __awaiter(this, void 0, void 0, function* () {
            console.log('public file handler');
            let timeStart = new Date().getTime();
            let resp = new WebResponse(false, 'Just Init', '', '');
            let uuid = yield web.getUUID();
            try {
                // return an error if we could not get an uuid
                if (uuid.startsWith('ERROR:')) {
                    console.error(uuid);
                    resp = new WebResponse(false, 'Could not generate unique uuid', '', '');
                }
                else {
                    let requestIp = req.ip;
                    let cookies = req.cookies;
                    let isLoggedIn = yield Secure.Session.isLoggedIn(uuid, requestIp, cookies);
                    let url = req.originalUrl.replace('\\', '/');
                    if (url == '/admin' || url.startsWith('/admin/')) {
                        resp = new WebResponse(false, 'ERROR: Invalid request received', `UUID:${uuid} Trying to access admin from rootFiles handler`, '');
                    }
                    else if (url == '/api' || url.startsWith('/api/')) {
                        resp = new WebResponse(false, 'ERROR: Invalid request received', `UUID:${uuid} Trying to access api from rootFiles handler`, '');
                    }
                    else {
                        console.log('process root file request');
                        resp = yield this.handleServeFile(web, res, '/public' + url, uuid, new RenderEnvSettings(this, uuid, requestIp, cookies, url, '', isLoggedIn, {}));
                    }
                }
                if (!resp.success) {
                    console.log('sending root message');
                    res.send(resp.toString());
                }
            }
            finally {
                // log the request that was served
                let timeEnd = new Date().getTime();
                let storeLog = yield DB.addWeblog(uuid, req.originalUrl, '', resp.success, (timeEnd - timeStart) / 1000, resp.logMessage, resp.errorMessage);
                if (storeLog.error) {
                    console.error('unable to store log of site request');
                    console.error(storeLog.message);
                }
                // free db resources for the request
                yield DBCore.releaseConnection(uuid);
                // release the uuid from the register of those in use
                web.releaseUUID(uuid);
            }
        }));
    }
    readSettingsFile(fileName, web, uuid, requestIp, cookies) {
        return __awaiter(this, void 0, void 0, function* () {
            let loadedData = {};
            let p = new Promise(function (resolve, reject) {
                fs.readFile(fileName, 'utf8', (error, data) => __awaiter(this, void 0, void 0, function* () {
                    if (error) {
                        console.log('readSettingsFile: file read error');
                        console.log(error);
                        resolve(false);
                    }
                    else {
                        let ejsSettings = JSON.parse(data);
                        for (var i = 0; i < ejsSettings.ad.length; i++) {
                            let action = ejsSettings.ad[i];
                            let wrd = yield web.adminHandlers[action](uuid, requestIp, cookies, null);
                            loadedData[action] = wrd.data;
                        }
                        resolve(true);
                    }
                }));
            });
            let b = yield p;
            return loadedData;
        });
    }
    handleServeFile(web, res, url, uuid, renderEnvSettings) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('handleServeFile ' + url);
            // stop use of .. to traverse up the diretory tree
            if (url.indexOf('/../') >= 0) {
                console.log('request invalid');
                return new WebResponse(false, 'ERROR: Invalid request received', `UUID:${uuid} Trying to access invalid file`, '');
            }
            // strip params off url to find filename
            if (url.indexOf('?') >= 0) {
                url = url.substring(0, url.indexOf('?'));
            }
            let ejsFile = web.getFile(url + '.ejs');
            let ejsRootFile = web.getFile(url + '/.ejs');
            if (fs.existsSync(ejsRootFile)) { // allow default .ejs file in a folder to be served without the trailing / on the folder name
                if (fs.existsSync(ejsRootFile + '.json')) {
                    let data = yield this.readSettingsFile(ejsRootFile + '.json', web, uuid, renderEnvSettings.requestIp, renderEnvSettings.cookies);
                    renderEnvSettings.data = data;
                }
                let wr = yield this.serveEjsFile(uuid, res, ejsRootFile, renderEnvSettings);
                return wr;
            }
            if (fs.existsSync(ejsFile)) {
                if (fs.existsSync(ejsFile + '.json')) {
                    let data = yield this.readSettingsFile(ejsFile + '.json', web, uuid, renderEnvSettings.requestIp, renderEnvSettings.cookies);
                    renderEnvSettings.data = data;
                }
                let wr = yield this.serveEjsFile(uuid, res, ejsFile, renderEnvSettings);
                return wr;
            }
            if (url.endsWith('.ejs')) {
                console.log('blocking serve (not render) of ejs');
                return new WebResponse(false, 'ERROR: Problem serving ejs file', `UUID:${uuid} Will not serve un-rendered ejs files`, url);
            }
            else if (fs.existsSync(web.getFile(url))) {
                console.log('sending static file');
                yield res.sendFile(web.getFile(url));
                console.log('static file sent');
                return new WebResponse(true, '', `UUID:${uuid} Served static file`, '');
            }
            else {
                console.log('file not exist');
                res.status(404).end(); // send 404 not found
                return new WebResponse(true, 'ERROR: 404', `UUID:${uuid} Requested file doesn't exist`, url); // return true so WebResponse is only logged, not sent as we already sent 404
            }
        });
    }
    serveEjsFile(uuid, res, ejsFile, renderEnvSettings) {
        return __awaiter(this, void 0, void 0, function* () {
            // make sessionId available. start new sesion if need be
            renderEnvSettings.sessionId = yield Secure.getSessionId(renderEnvSettings.uuid, renderEnvSettings.requestIp, renderEnvSettings.cookies);
            let returnCookies = [];
            // save session cookie in response if session has just been created
            if (renderEnvSettings.cookies['session'] == undefined || renderEnvSettings.cookies['session'] != renderEnvSettings.sessionId) {
                returnCookies.push(new Cookie('session', renderEnvSettings.sessionId));
            }
            // synchronously render the file to the response. Return a WebResponse for logging and error reporting
            let p = new Promise(function (resolve, reject) {
                // ejs.renderFile( filename, data, options, callback
                ejs.renderFile(ejsFile, renderEnvSettings, {}, function (err, result) {
                    return __awaiter(this, void 0, void 0, function* () {
                        if (err) {
                            console.log('error rendering root ejs');
                            console.log(err);
                            resolve(new WebResponse(false, 'ERROR: Problem rendering ejs file', `UUID:${uuid} Problem rendering ejs file`, err, returnCookies));
                        }
                        else {
                            // send the cookies to the response
                            if (returnCookies.length > 0) {
                                for (var i = 0; i < returnCookies.length; i++) {
                                    let c = returnCookies[i];
                                    res.cookie(c.name, c.value, c.getOptions());
                                }
                            }
                            // send the file to the response
                            yield res.send(result);
                            // return webresponse for logging
                            resolve(new WebResponse(true, '', `UUID:${uuid} Rendered root ejs`, '', returnCookies));
                        }
                    });
                });
            });
            let wr = yield p;
            return wr;
        });
    }
    // attach code to view and prune weblogs
    attachWeblogsInterface(web, webapp) {
        // serve a page to view weblogs
        webapp.get('/weblogs', (req, res) => res.sendFile(web.getFile('weblogs.html')));
        // fetch weblogs from the db
        web.registerHandler(webapp, '/req/weblogs', [], function (uuid) {
            return __awaiter(this, void 0, void 0, function* () {
                let result = yield DB.getWeblogs(uuid);
                if (result.error) {
                    return new WebResponse(false, result.message, 'Failed to fetch Weblogs', '');
                }
                else {
                    let logs = result.data == null ? [] : result.data;
                    let jsonLogs = JSON.stringify(logs);
                    return new WebResponse(true, '', 'Fetched Weblogs', jsonLogs);
                }
            });
        });
        // delete weblogs from a given id and older
        web.registerHandler(webapp, '/req/prune-weblogs', ['id'], function (uuid, idCheck) {
            return __awaiter(this, void 0, void 0, function* () {
                let result = yield DB.pruneWeblogs(uuid, idCheck.value);
                if (result.error) {
                    return new WebResponse(false, result.message, 'Failed to prune Weblogs', '');
                }
                else {
                    return new WebResponse(true, '', 'Pruned Weblogs', '');
                }
            });
        });
    }
    // ---------------------------------------------
    // Functions to validate incomming data
    // ---------------------------------------------
    // check that a transaction hash is sent for the request
    requireTransactionHash(req, res) {
        if (req.query.txHash === undefined) {
            res.send(new WebResponse(false, 'Missing txHash param', '', '').toString());
            return new GTS.DM.CheckedValue(false, '');
        }
        let txHash = req.query.txHash.toString();
        if (txHash && txHash.length == 64 && GTS.HexUtils.checkStringIsHexEncoded(txHash)) {
            return new GTS.DM.CheckedValue(true, txHash);
        }
        else {
            res.send(new WebResponse(false, 'Invalid transaction hash param received', '', '').toString());
            return new GTS.DM.CheckedValue(false, '');
        }
    }
    // check that a network is sent for the request
    requireNetwork(req, res) {
        if (req.query.network === undefined) {
            res.send(new WebResponse(false, 'Missing network param', '', '').toString());
            return new GTS.DM.CheckedValue(false, '');
        }
        let network = req.query.network.toString();
        if (network && (network == '1' || network == 'T' || network == 'D')) {
            return new GTS.DM.CheckedValue(true, network);
        }
        else {
            res.send(new WebResponse(false, 'Invalid network param received', '', '').toString());
            return new GTS.DM.CheckedValue(false, '');
        }
    }
    // check that a bech32 address is sent for the request
    requireBech32Address(req, res) {
        if (req.query.address === undefined) {
            res.send(new WebResponse(false, 'Missing address param', '', '').toString());
            return new GTS.DM.CheckedValue(false, '');
        }
        let address = req.query.address.toString();
        if (address && GTS.AddressUtils.checkAddressStringIsBech32(address)) {
            return new GTS.DM.CheckedValue(true, address);
        }
        else {
            res.send(new WebResponse(false, 'Invalid address param received', '', '').toString());
            return new GTS.DM.CheckedValue(false, '');
        }
    }
    // check that hex is sent for the request
    requireHex(req, res) {
        if (req.query.hex === undefined) {
            res.send(new WebResponse(false, 'Missing hex param', '', '').toString());
            return new GTS.DM.CheckedValue(false, '');
        }
        let hex = req.query.hex.toString();
        if (hex && GTS.HexUtils.checkStringIsHexEncodedList(hex)) {
            return new GTS.DM.CheckedValue(true, hex);
        }
        else {
            res.send(new WebResponse(false, 'Invalid hex param received', '', '').toString());
            return new GTS.DM.CheckedValue(false, '');
        }
    }
    // check that hexlist is sent for the request
    requireHexList(req, res) {
        if (req.query.hexlist === undefined) {
            res.send(new WebResponse(false, 'Missing hexlist param', '', '').toString());
            return new GTS.DM.CheckedValue(false, '');
        }
        let hexlist = req.query.hexlist.toString();
        if (GTS.HexUtils.checkStringIsHexEncodedList(hexlist)) {
            return new GTS.DM.CheckedValue(true, hexlist);
        }
        else {
            res.send(new WebResponse(false, 'Invalid hexlist param received. Please ensure the hexlist consists of 0 or more hex pairs. List items are seperated by the @ symbol', '', '').toString());
            return new GTS.DM.CheckedValue(false, '');
        }
    }
    // check that an integer id is sent for the request
    requireId(req, res) {
        if (req.query.id === undefined) {
            res.send(new WebResponse(false, 'Missing id param', '', '').toString());
            return new GTS.DM.CheckedValue(false, '');
        }
        let id = req.query.id.toString();
        if (GTS.StringUtils.checkStringIsInteger(id)) {
            return new GTS.DM.CheckedValue(true, id);
        }
        else {
            res.send(new WebResponse(false, 'Invalid id param received', '', '').toString());
            return new GTS.DM.CheckedValue(false, '');
        }
    }
    // allow cusom validation (regex)
    requireCustom(req, res, name, regex) {
        if (req.query[name] === undefined) {
            res.send(new WebResponse(false, `Missing ${name} param`, '', '').toString());
            return new GTS.DM.CheckedValue(false, '');
        }
        let custom = req.query[name].toString();
        if (new RegExp(regex, "g").test(custom)) {
            return new GTS.DM.CheckedValue(true, custom);
        }
        else {
            res.send(new WebResponse(false, `Invalid ${name} param received`, '', '').toString());
            return new GTS.DM.CheckedValue(false, '');
        }
    }
}
exports.WebServerHelper = WebServerHelper;
// allow web responses to set cookies
class Cookie {
    constructor(pName, pValue, pExpires, pDomain, pPath, pHttpOnly, pSecure) {
        this.expires = new Date(0); // expiry date of cookie, if not specified creates a session cookie
        this.domain = ''; // domain of cookie
        this.name = pName;
        this.value = pValue;
        this.expires = pExpires !== null && pExpires !== void 0 ? pExpires : new Date(0);
        this.domain = pDomain !== null && pDomain !== void 0 ? pDomain : '';
        this.path = pPath !== null && pPath !== void 0 ? pPath : '/';
        this.httpOnly = pHttpOnly !== null && pHttpOnly !== void 0 ? pHttpOnly : false;
        this.secure = pSecure !== null && pSecure !== void 0 ? pSecure : false;
    }
    getOptions() {
        if (this.domain.length > 0) {
            return { expires: this.expires.getTime() == 0 ? 0 : this.expires, domain: this.domain, path: this.path, httpOnly: this.httpOnly, secure: this.secure };
        }
        return { expires: this.expires.getTime() == 0 ? 0 : this.expires, path: this.path, httpOnly: this.httpOnly, secure: this.secure };
    }
}
exports.Cookie = Cookie;
// When using await Webserver.handleRequest to process web requests, WebResponse is the format that worker functions provide the data to return
// It also defines the JSON wrapper of the returned data
class WebResponse {
    constructor(pSuccess, pErrorMessage, pLogMessage, pData, pSetCookies) {
        this.success = pSuccess;
        this.errorMessage = pErrorMessage;
        this.logMessage = pLogMessage;
        this.data = pData;
        this.cookies = pSetCookies !== null && pSetCookies !== void 0 ? pSetCookies : [];
    }
}
exports.WebResponse = WebResponse;
// JSON to send a response to the client
WebResponse.prototype.toString = function () {
    // don't return logMessage to the client, this is logged in the DB
    // if there is no data, return "" so the JSON is valid
    let safeData = '""';
    if (this.data != null && this.data.length > 0) {
        safeData = this.data;
    }
    // only send errorMessage if their is one
    let escapedMessage = GTS.StringUtils.escapeDoubleQuotes(GTS.StringUtils.escapeNewLines(this.errorMessage));
    let errorMessageJSON = '';
    if (this.errorMessage.length > 0) {
        errorMessageJSON = `, "errorMessage":"${escapedMessage}"`;
    }
    // send success as 1 for true, or 0 for false
    return `{"success":${this.success ? '1' : '0'}${errorMessageJSON}, "data":${safeData}}`;
};
// Access to the Webserver is logged
class Weblog {
    constructor() {
        this.id = 0;
        this.uuid = '';
        this.requestedAt = '';
        this.requestUrl = '';
        this.requestParams = '';
        this.responseSuccess = false;
        this.responseDuration = 0;
        this.logMessage = '';
        this.errorMessage = '';
    }
}
exports.Weblog = Weblog;
var DB;
(function (DB) {
    // log a request has been served by webserver
    function addWeblog(uuid, requestUrl, requestParams, responseSuccess, responseDuration, logMessage, errorMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            let fetchConn = yield DBCore.getConnection('addWebLog', uuid);
            if (fetchConn.error || fetchConn.data == null) {
                return new GTS.DM.WrappedResult().setError('DB Connection error\r\n' + fetchConn.message);
            }
            let client = fetchConn.data;
            yield client.query('CALL addWebLog($1,$2,$3,$4,$5,$6,$7);', [uuid, requestUrl, requestParams, responseSuccess, responseDuration, logMessage, errorMessage]);
            return new GTS.DM.WrappedResult().setNoData();
        });
    }
    DB.addWeblog = addWeblog;
    // view all weblogs recorded
    function getWeblogs(uuid) {
        return __awaiter(this, void 0, void 0, function* () {
            let retvalData = [];
            let fetchConn = yield DBCore.getConnection('getWeblogs', uuid);
            if (fetchConn.error || fetchConn.data == null) {
                return new GTS.DM.WrappedResult().setError('DB Connection error\r\n' + fetchConn.message);
            }
            let client = fetchConn.data;
            const res = yield client.query('SELECT id, uuid, requestedat, requesturl, requestparams, responsesuccess, responseduration, logmessage, errormessage FROM WebLogs ORDER BY id ASC;');
            for (var i = 0; i < res.rowCount; i++) {
                let l = new Weblog();
                l.id = res.rows[i].id;
                l.uuid = res.rows[i].uuid;
                l.requestedAt = res.rows[i].requestedat;
                l.requestUrl = res.rows[i].requesturl;
                l.requestParams = res.rows[i].requestparams;
                l.responseSuccess = res.rows[i].responsesuccess;
                l.responseDuration = res.rows[i].responseduration;
                l.logMessage = res.rows[i].logmessage;
                l.errorMessage = res.rows[i].errormessage;
                retvalData.push(l);
            }
            return new GTS.DM.WrappedResult().setData(retvalData);
        });
    }
    DB.getWeblogs = getWeblogs;
    // delete web logs by id and older
    function pruneWeblogs(uuid, id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let fetchConn = yield DBCore.getConnection('pruneWeblogs', uuid);
                if (fetchConn.error || fetchConn.data == null) {
                    return new GTS.DM.WrappedResult().setError('DB Connection error\r\n' + fetchConn.message);
                }
                let client = fetchConn.data;
                yield client.query('DELETE FROM WebLogs WHERE id <= $1;', [id]);
                return new GTS.DM.WrappedResult().setNoData();
            }
            catch (err) {
                return new GTS.DM.WrappedResult().setError(err.toString());
            }
        });
    }
    DB.pruneWeblogs = pruneWeblogs;
})(DB = exports.DB || (exports.DB = {}));
