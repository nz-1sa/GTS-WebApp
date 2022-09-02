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
exports.DB = exports.Weblog = exports.WebResponse = exports.WebServerHelper = void 0;
const GTS = __importStar(require("./gts"));
const DBCore = __importStar(require("./gts.db"));
const UUID = __importStar(require("./gts.uuid"));
const PATH = require('path');
class WebServerHelper {
    // initialise a new uuid register when the WebServerHelper is instantiated
    constructor(pSiteRoot) {
        this.siteRoot = '';
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
    registerHandlerUnchecked(webapp, url, requiredParams, work) {
        return __awaiter(this, void 0, void 0, function* () {
            webapp.get(url, (req, res) => __awaiter(this, void 0, void 0, function* () {
                yield this.handleRequestUnchecked(req, res, url, requiredParams, work);
            }));
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
    handleRequestUnchecked(req, res, requestUrl, requiredParams, work) {
        return __awaiter(this, void 0, void 0, function* () {
            let timeStart = new Date().getTime();
            var response = new WebResponse(false, '', 'Only Initialised', '');
            res.cookie('test2', 'test2');
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
                    if (req.query[name] === undefined) {
                        res.send(new WebResponse(false, `Missing ${name} param`, '', '').toString());
                        return;
                    }
                    let val = req.query[name].toString();
                    paramVals.push(val);
                    logParams.push(`${name}=${val}`);
                }
                // get the response for the request and send it
                response = yield work(uuid, res, ...paramVals);
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
// When using await Webserver.handleRequest to process web requests, WebResponse is the format that worker functions provide the data to return
// It also defines the JSON wrapper of the returned data
class WebResponse {
    constructor(pSuccess, pErrorMessage, pLogMessage, pData) {
        this.success = pSuccess;
        this.errorMessage = pErrorMessage;
        this.logMessage = pLogMessage;
        this.data = pData;
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
