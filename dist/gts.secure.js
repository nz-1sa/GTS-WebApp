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
exports.Session = exports.SessionStatus = exports.attachWebInterface = void 0;
const GTS = __importStar(require("./gts"));
const DBCore = __importStar(require("./gts.db"));
const UUID = __importStar(require("./gts.uuid"));
const WS = __importStar(require("./gts.webserver"));
const gts_concurrency_1 = require("./gts.concurrency");
var crypto = require('crypto');
const Encodec = __importStar(require("./gts.encodec"));
const GIFEncoder = require('gifencoder');
const { createCanvas } = require('canvas');
const fs = require('fs');
function attachWebInterface(web, webapp) {
    // serve login page from project root
    webapp.get('/login', (req, res) => res.sendFile(web.getFile('login.html')));
    // a captcha is shown as part of starting a session
    web.registerHandlerUnchecked(webapp, '/api/startSession', [], function (uuid, requestIp, cookies) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield handleStartSessionRequest(uuid, requestIp, cookies);
        });
    });
    // login by email, password, and captcha
    //TODO: email should be SHA1 hash
    web.registerHandlerUnchecked(webapp, '/api/login', ['email', 'challenge'], function (uuid, requestIp, cookies, email, challenge) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield handleLoginRequest(uuid, requestIp, cookies, email, challenge);
        });
    });
    // log out of account
    web.registerHandlerUnchecked(webapp, '/api/logout', ['challenge'], function (uuid, requestIp, cookies, challenge) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield handleLogoutRequest(uuid, requestIp, cookies, challenge);
        });
    });
    //NOTE: requests to the server must be received in sequence. Message is encrypted
    web.registerHandlerUnchecked(webapp, '/api/talk', ['sequence', 'message'], function (uuid, requestIp, cookies, sequence, message) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield handleSecureTalk(web, uuid, requestIp, cookies, sequence, message);
        });
    });
}
exports.attachWebInterface = attachWebInterface;
// establish a session to allow logging in
function handleStartSessionRequest(uuid, requestIp, cookies) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('in handleStartSessionRequest');
        const [hs, s] = yield Session.hasSession(uuid, requestIp, cookies);
        console.log('done hasSession check');
        if (hs && s) {
            if (s.status == SessionStatus.LoggedIn) {
                console.log('already logged in');
                return new WS.WebResponse(true, "", `UUID:${uuid} Already logged in`, `Already logged in`, []);
            }
            console.log('initialise already done');
            return new WS.WebResponse(true, "", `UUID:${uuid} Request to start already initialised session ${cookies['session']}`, `<img src="/captchas/${cookies['session']}.gif">`, []);
        }
        let now = new Date();
        const loopSafety = 20;
        let loopIteration = 1;
        let sessionId = uuid;
        while (!Session.isProposedSessionIdUnique(uuid, sessionId) && loopIteration <= loopSafety) {
            console.log('handling sessionId clash');
            sessionId = yield UUID.newUUID();
            loopIteration++;
        }
        if (loopIteration == loopSafety) {
            console.log('loop safety break on session id generation');
            return new WS.WebResponse(false, "", `UUID:${uuid} Unable to initialse session`, `Unable to initialise session. Try again later.`, []);
        }
        console.log('got session id');
        // pId:number, pSessionId:string, pCreated:Date, pLastSeen:Date, pIp:string, pStatus:number, pCaptcha:number, pNonce:number, pPassword:string, pSeq:string, pChkSum:string
        let ns = new Session(0, sessionId, now, now, requestIp, SessionStatus.Initialised, 0, 1, 'NONEnoneNONEnone', 1, 'NEWnewNEWnewNEWnewNEWnewNEW=');
        console.log('established session object');
        console.log({ uuid: uuid });
        ns.addToDB(uuid);
        console.log('session added to db');
        ns.initialiseCaptcha(uuid, sessionId);
        console.log('new session being returned');
        return new WS.WebResponse(true, "", `UUID:${uuid} Captcha Drawn`, `<img src="/captchas/${sessionId}.gif">`, [new WS.Cookie('session', sessionId)]);
    });
}
// process login for a session
function handleLoginRequest(uuid, requestIp, cookies, email, challenge) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('in handleLoginRequest');
        // check that there is an open session to log in to
        const [hs, s] = yield Session.hasSession(uuid, requestIp, cookies);
        console.log('done hasSession check');
        if (!hs || !s) {
            console.log('returning no session error');
            return new WS.WebResponse(false, "ERROR: A session needs to be started before loggin in.", `UUID:${uuid} Login called before startSession`, '', []);
        }
        let sess = s;
        if (sess.ip != requestIp) {
            console.log('wrong session ip');
            return new WS.WebResponse(false, "ERROR: Can not change IP during session.", `UUID:${uuid} Login called from wrong IP.`, '', []);
        }
        if (sess.status != SessionStatus.Initialised) {
            console.log('wrong session state, only can login from Initialised');
            return new WS.WebResponse(false, "ERROR: Can only login to a session once", `UUID:${uuid} Can only login to a session once`, '', []);
        }
        //TODO: get knownSaltPassHash for email address from database
        let knownSaltPassHash = 'GtgV3vHNK1TvAbsWNV7ioUo1QeI='; //knownSaltPassHash is the SHA1 hash of email+password, stops rainbow tables matching sha1 of just pass.
        console.log('using debug key to decode');
        console.log({ knownSaltPassHash: knownSaltPassHash, captcha: sess.captcha, challenge: challenge });
        // decrypt challenge using knownSaltPassHash and captcha
        let decoded = Encodec.decrypt(challenge, knownSaltPassHash, sess.captcha);
        console.log({ decoded: decoded });
        if (!new RegExp("^[0-9]+$", "g").test(decoded)) {
            console.log('failed regex check');
            return new WS.WebResponse(false, "ERROR: Login failed.", `UUID:${uuid} Login failed, decoded content failed regex check.`, '', []);
        }
        // verify decrypted challenge content
        if (parseInt(decoded) == NaN) {
            console.log('failed NaN check');
            return new WS.WebResponse(false, "ERROR: Login failed.", `UUID:${uuid} Login failed, invalid decoded content.`, '', []);
        }
        let now = new Date().getTime();
        let timeDiff = now - parseInt(decoded);
        console.log({ now: now, timeDiff: timeDiff });
        if (timeDiff < 0 || timeDiff > 20000) { // request must arrive within 20 seconds
            console.log('failed Date check');
            return new WS.WebResponse(false, "ERROR: Login failed.", `UUID:${uuid} Login failed, request to old.`, '', []);
        }
        // generate password and nonce for the session
        console.log('setting session credentials');
        sess.status = SessionStatus.LoggedIn;
        sess.password = yield Session.genSessionPassword();
        sess.nonce = Math.floor(1 + Math.random() * 483600);
        sess.seq = 1;
        sess.updateDB(uuid);
        console.log({ sess: sess });
        // encrypt and return to client the password to use for the session, and the nonce to start with
        let plainTextResponse = JSON.stringify({ pass: sess.password, nonce: sess.nonce });
        console.log({ plainTextResponse: plainTextResponse });
        let encResponse = Encodec.encrypt(plainTextResponse, knownSaltPassHash, sess.captcha);
        console.log({ encResponse: encResponse });
        return new WS.WebResponse(true, "", `UUID:${uuid} Login success`, `"${encResponse}"`);
    });
}
// process logout for a session
function handleLogoutRequest(uuid, requestIp, cookies, challenge) {
    return __awaiter(this, void 0, void 0, function* () {
        // check that there is an open session to log out from
        const [hs, s] = yield Session.hasSession(uuid, requestIp, cookies);
        if (!hs || !s) {
            return new WS.WebResponse(false, "ERROR: A session needs to be started before logging out.", `UUID:${uuid} Logout called before startSession`, '', []);
        }
        let sess = s;
        if (sess.ip != requestIp) {
            return new WS.WebResponse(false, "ERROR: Can only logout from logged in IP", `UUID:${uuid} Logout called from wrong IP.`, '', []);
        }
        if (sess.status != SessionStatus.LoggedIn) {
            return new WS.WebResponse(false, "ERROR: Can only logout after loggin in", `UUID:${uuid} Logout called before login.`, '', []);
        }
        // decrypt challenge using session password and 0 for sequence (allows always to logout, even if lose track of sequence at client)
        let decoded = Encodec.decrypt(challenge, sess.password, 0);
        if (!new RegExp("^[0-9]+$", "g").test(decoded)) {
            console.log('failed regex check');
            return new WS.WebResponse(false, "ERROR: Logout failed.", `UUID:${uuid} Logout failed, decoded content failed regex check.`, '', []);
        }
        // verify decrypted challenge content
        if (parseInt(decoded) == NaN) {
            console.log('failed NaN check');
            return new WS.WebResponse(false, "ERROR: Logout failed.", `UUID:${uuid} Logout failed, invalid decoded content.`, '', []);
        }
        let now = new Date().getTime();
        let timeDiff = now - parseInt(decoded);
        console.log({ now: now, timeDiff: timeDiff });
        if (timeDiff < 0 || timeDiff > 20000) { // request must arrive within 20 seconds
            console.log('failed Date check');
            return new WS.WebResponse(false, "ERROR: Logout failed.", `UUID:${uuid} Logout failed, request to old.`, '', []);
        }
        sess.status = SessionStatus.LoggedOut;
        sess.updateDB(uuid);
        // encrypt and return to client the password to use for the session, and the nonce to start with
        let plainTextResponse = new Date().getTime().toString();
        console.log({ plainTextResponse: plainTextResponse });
        let encResponse = Encodec.encrypt(plainTextResponse, sess.password, 0);
        console.log({ encResponse: encResponse });
        return new WS.WebResponse(true, "", `UUID:${uuid} Logout success`, `"${encResponse}"`);
    });
}
// secure talk within a session
function handleSecureTalk(web, uuid, requestIp, cookies, sequence, message) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('handleSecureTalk');
        console.log({ uuid: uuid, requestIp: requestIp, cookies: cookies, sequence: sequence });
        const [hs, s] = yield Session.hasSession(uuid, requestIp, cookies);
        if (!hs) {
            return new WS.WebResponse(false, "ERROR: Need to have session first.", `UUID:${uuid} Attempted session talk before session start`, '', []);
        }
        if (!s) {
            return new WS.WebResponse(false, "ERROR: Failed to connect to session.", `UUID:${uuid} Error getting session from DB`, '', []);
        }
        let sess = s;
        if (sess.ip != requestIp) {
            return new WS.WebResponse(false, "ERROR: Can not change IP during session.", `UUID:${uuid} Talk called from wrong IP.`, '', []);
        }
        if (sess.status != SessionStatus.LoggedIn) {
            return new WS.WebResponse(false, "ERROR: Need to login first.", `UUID:${uuid} Attempted session talk before login`, '', []);
        }
        ;
        if (!new RegExp("^[0-9]+$", "g").test(sequence)) {
            return new WS.WebResponse(false, "ERROR: Invalid sequence.", `UUID:${uuid} Secure Talk sequence fails regex check`, '', []);
        }
        // by getting to here there is a logged in session
        let doLogSequenceCheck = true;
        let retval = new WS.WebResponse(false, 'ERROR', `UUID:${uuid} Unknown error`, '', []);
        yield gts_concurrency_1.Concurrency.doSequencedJob(sess.sessionId, parseInt(sequence), function (purpose, seqNum) {
            return __awaiter(this, void 0, void 0, function* () {
                console.log('talking at number #' + seqNum);
                console.log({ pass: sess.password, nonce: sess.nonce + seqNum });
                // decrypt challenge using knownSaltPassHash and captcha
                let decoded = Encodec.decrypt(message, sess.password, (sess.nonce + seqNum));
                const [action, params] = JSON.parse(decoded);
                console.log({ action: action, params: params });
                if (!web.adminHandlers[action]) {
                    return new WS.WebResponse(false, 'ERROR: Undefined admin action', `UUID:${uuid} Missing admin action {action}`, `""`, []);
                }
                let adminResp = yield web.adminHandlers[action](uuid, requestIp, cookies, params);
                console.log('admin response is');
                console.log(adminResp);
                return adminResp;
            });
        }, Session.checkAndIncrementSequenceInDB)
            .then((adminResponse) => { retval = new WS.WebResponse(true, '', `UUID:${uuid} Secure Talk done`, `"${Encodec.encrypt(adminResponse.toString(), sess.password, (sess.nonce + parseInt(sequence)))}"`, []); })
            .catch((err) => { retval = new WS.WebResponse(false, "ERROR: Sequence Start Failed.", `UUID:${uuid} ERROR: Sequence Start Failed. {err}`, '', []); });
        console.log('retval is');
        console.log(retval.toString());
        return retval;
    });
}
var SessionStatus;
(function (SessionStatus) {
    SessionStatus[SessionStatus["Initialised"] = 1] = "Initialised";
    SessionStatus[SessionStatus["LoggedIn"] = 2] = "LoggedIn";
    SessionStatus[SessionStatus["LoggedOut"] = 3] = "LoggedOut";
    SessionStatus[SessionStatus["Expired"] = 4] = "Expired";
})(SessionStatus = exports.SessionStatus || (exports.SessionStatus = {}));
class Session {
    constructor(pId, pSessionId, pCreated, pLastSeen, pIp, pStatus, pCaptcha, pNonce, pPassword, pSeq, pChkSum) {
        this.id = pId;
        this.sessionId = pSessionId;
        this.created = pCreated;
        this.lastSeen = pLastSeen;
        this.ip = pIp;
        this.status = pStatus;
        this.captcha = pCaptcha;
        this.nonce = pNonce;
        this.password = pPassword;
        this.seq = pSeq;
        this.chkSum = pChkSum;
    }
    // base64 sha1 hash of the session's values (excludes id and chkSum).  Can compare .genHash() with .chkSum to test for if changed
    genHash() {
        var j = JSON.stringify({ sessionId: this.sessionId, created: this.created, lastSeen: this.lastSeen, ip: this.ip, status: this.status, captcha: this.captcha, nonce: this.nonce, password: this.password, seq: this.seq });
        var hsh = crypto.createHash('sha1').update(j).digest('base64');
        return hsh;
    }
    // cast session as a JSON string
    toString() {
        return JSON.stringify(this.toJSON());
    }
    // cast session as a JSON object
    toJSON() {
        return { id: this.id.toString(), sessionId: this.sessionId, created: this.created.toString(), lastSeen: this.lastSeen.toString(), ip: this.ip, status: this.status.toString(), captcha: this.captcha.toString(), nonce: this.nonce.toString(), password: this.password, seq: this.seq.toString(), chkSum: this.chkSum };
    }
    // casted value checks for allowed values in a session
    verifyValuesAreValid() {
        let errDesc = '';
        var idIsValid = (this.id >= 0 && this.id <= 2147483600);
        if (!idIsValid) {
            if (errDesc.length > 0) {
                errDesc = errDesc + ' ';
            }
            errDesc = errDesc + 'Invalid value for id.';
        }
        var sessionIdIsValid = (this.sessionId.length >= 36 && this.sessionId.length <= 36);
        if (!sessionIdIsValid) {
            if (errDesc.length > 0) {
                errDesc = errDesc + ' ';
            }
            errDesc = errDesc + 'Invalid value for sessionId.';
        }
        var createdIsValid = (true);
        if (!createdIsValid) {
            if (errDesc.length > 0) {
                errDesc = errDesc + ' ';
            }
            errDesc = errDesc + 'Invalid value for created.';
        }
        var lastSeenIsValid = (true);
        if (!lastSeenIsValid) {
            if (errDesc.length > 0) {
                errDesc = errDesc + ' ';
            }
            errDesc = errDesc + 'Invalid value for lastSeen.';
        }
        var ipIsValid = (this.ip.length >= 3 && this.ip.length <= 39);
        if (!ipIsValid) {
            if (errDesc.length > 0) {
                errDesc = errDesc + ' ';
            }
            errDesc = errDesc + 'Invalid value for ip.';
        }
        var statusIsValid = ([1, 2, 3, 4].indexOf(this.status) >= 0);
        if (!statusIsValid) {
            if (errDesc.length > 0) {
                errDesc = errDesc + ' ';
            }
            errDesc = errDesc + 'Invalid value for status.';
        }
        var captchaIsValid = (this.captcha >= 1 && this.captcha <= 999);
        if (!captchaIsValid) {
            if (errDesc.length > 0) {
                errDesc = errDesc + ' ';
            }
            errDesc = errDesc + 'Invalid value for captcha.';
        }
        var nonceIsValid = (this.nonce >= 1 && this.nonce <= 2147483600);
        if (!nonceIsValid) {
            if (errDesc.length > 0) {
                errDesc = errDesc + ' ';
            }
            errDesc = errDesc + 'Invalid value for nonce.';
        }
        var passwordIsValid = (this.password.length >= 16 && this.password.length <= 16);
        if (!passwordIsValid) {
            if (errDesc.length > 0) {
                errDesc = errDesc + ' ';
            }
            errDesc = errDesc + 'Invalid value for password.';
        }
        var seqIsValid = (this.seq >= 0);
        if (!seqIsValid) {
            if (errDesc.length > 0) {
                errDesc = errDesc + ' ';
            }
            errDesc = errDesc + 'Invalid value for seq.';
        }
        var chkSumIsValid = (true);
        if (!chkSumIsValid) {
            if (errDesc.length > 0) {
                errDesc = errDesc + ' ';
            }
            errDesc = errDesc + 'Invalid value for chkSum.';
        }
        return [idIsValid && sessionIdIsValid && createdIsValid && lastSeenIsValid && ipIsValid && statusIsValid && captchaIsValid && nonceIsValid && passwordIsValid && seqIsValid && chkSumIsValid, errDesc];
    }
    // instantiate a session from string values. Null returned if sting values fail regex checks or casted value checks
    static fromStrings(id, sessionId, created, lastSeen, ip, status, captcha, nonce, password, seq, chkSum) {
        let regexTests = [new RegExp("^[0-9]+$", "g").test(id), new RegExp("^[A-Za-z\. \-,0-9=+/]+$", "g").test(sessionId), new RegExp("^[0-9]{4}-[0-9]{2}-[0-9][0-9]? [0-9]{2}:[0-9]{2}(?::[0-9]{2})$", "g").test(created), new RegExp("^[0-9]{4}-[0-9]{2}-[0-9][0-9]? [0-9]{2}:[0-9]{2}(?::[0-9]{2})$", "g").test(lastSeen), new RegExp("^[A-Za-z\. \-,0-9=+/]+$", "g").test(ip), new RegExp("^[0-9]+$", "g").test(status), new RegExp("^[0-9]+$", "g").test(captcha), new RegExp("^[0-9]+$", "g").test(nonce), new RegExp("^[A-Za-z\. \-,0-9=+/]+$", "g").test(password), new RegExp("^[0-9]+$", "g").test(seq), new RegExp("^[a-zA-Z0-9/+]{26}[a-zA-Z0-9/+=]{2}$", "g").test(chkSum)];
        if (!regexTests.every(Boolean)) {
            // detail invalid value
            let paramNames = ["id", "sessionId", "created", "lastSeen", "ip", "status", "captcha", "nonce", "password", "seq", "chkSum"];
            for (var i = 0; i < regexTests.length; i++) {
                if (!regexTests[i]) {
                    console.log('posted value for ' + paramNames[i] + ' fails regex check');
                }
            }
            return null;
        }
        let session = new Session(parseInt(id), (sessionId), new Date(created), new Date(lastSeen), (ip), parseInt(status), parseInt(captcha), parseInt(nonce), (password), parseInt(seq), (chkSum));
        let valueCheck = session.verifyValuesAreValid();
        let success = valueCheck[0];
        if (success) {
            return session;
        }
        let errMsg = valueCheck[1];
        console.log(errMsg);
        return null;
    }
    static isProposedSessionIdUnique(uuid, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            let retval = new GTS.DM.WrappedResult();
            let fetchConn = yield DBCore.getConnection('Session.isProposedSessionIdUnique', uuid);
            if (fetchConn.error) {
                return retval.setError('DB Connection error\n' + fetchConn.message);
            }
            if (fetchConn.data == null) {
                return retval.setError('DB Connection NULL error');
            }
            let client = fetchConn.data;
            const res = yield client.query('SELECT id FROM sessions WHERE sessionId = $1;', [sessionId]);
            return retval.setData(res.rowCount == 0);
        });
    }
    // get a session from the database for the specified sessionId
    static getSessionFromDB(uuid, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            let retval = new GTS.DM.WrappedResult();
            let fetchConn = yield DBCore.getConnection('Session.getSessionFromDB', uuid);
            if (fetchConn.error) {
                return retval.setError('DB Connection error\n' + fetchConn.message);
            }
            if (fetchConn.data == null) {
                return retval.setError('DB Connection NULL error');
            }
            let client = fetchConn.data;
            const res = yield client.query('SELECT id, created, lastSeen, ip, status, captcha, nonce, password, seq, chkSum FROM sessions WHERE sessionId = $1;', [sessionId]);
            if (res.rowCount == 0) {
                return retval.setError('Session not found.');
            }
            let s = new Session(res.rows[0].id, sessionId, res.rows[0].created, res.rows[0].lastseen, res.rows[0].ip, res.rows[0].status, res.rows[0].captcha, res.rows[0].nonce, res.rows[0].password, res.rows[0].seq, res.rows[0].chksum);
            //TODO: update last seen
            return retval.setData(s);
        });
    }
    //TODO: needs to be like Concurrency.inMemorySequenceTracking
    static checkAndIncrementSequenceInDB(uuid, sessionId, reqSequence) {
        return __awaiter(this, void 0, void 0, function* () {
            let retval = new GTS.DM.WrappedResult();
            let fetchConn = yield DBCore.getConnection('Session.checkAndIncrementSequence', uuid);
            if (fetchConn.error) {
                return retval.setError('DB Connection error\n' + fetchConn.message);
            }
            if (fetchConn.data == null) {
                return retval.setError('DB Connection NULL error');
            }
            let client = fetchConn.data;
            console.log('checking sequence in db');
            console.log({ sessionId: sessionId, reqSequence: reqSequence });
            const res = yield client.query('CALL checkAndIncrementSessionSequence($1,$2,$3)', [sessionId, reqSequence, 0]);
            if (res.rowCount == 0) {
                return retval.setError('checkAndIncrementSessionSequence failed.');
            }
            if (res.rows[0].doseq == 0) {
                return retval.setData("RunNow");
            }
            if (res.rows[0].doseq > 0 && res.rows[0].doseq < 10) {
                return retval.setData("RunSoon");
            }
            return retval.setData("Invalid");
        });
    }
    // list all the sessions from the database in full detail
    static fetchAllFromDB(uuid) {
        return __awaiter(this, void 0, void 0, function* () {
            let retval = new GTS.DM.WrappedResult();
            let retvalData = [];
            let fetchConn = yield DBCore.getConnection('Session.fetchAllFromDB', uuid);
            if (fetchConn.error) {
                return retval.setError('DB Connection error\n' + fetchConn.message);
            }
            if (fetchConn.data == null) {
                return retval.setError('DB Connection NULL error');
            }
            let client = fetchConn.data;
            const res = yield client.query('SELECT id, sessionId, created, lastSeen, ip, status, captcha, nonce, password, seq, chkSum FROM sessions;');
            if (res.rowCount == 0) {
                return retval.setData(retvalData);
            } // handle empty table
            for (let i = 0; i < res.rowCount; i++) {
                retvalData.push(new Session(res.rows[i].id, res.rows[i].sessionid, res.rows[i].created, res.rows[i].lastseen, res.rows[i].ip, res.rows[i].status, res.rows[i].captcha, res.rows[i].nonce, res.rows[i].password, res.rows[i].seq, res.rows[i].chksum));
            }
            return retval.setData(retvalData);
        });
    }
    // add a session to the database, id is assigned as it is added
    addToDB(uuid) {
        return __awaiter(this, void 0, void 0, function* () {
            let retval = new GTS.DM.WrappedResult();
            let fetchConn = yield DBCore.getConnection('Session.addToDB', uuid);
            if (fetchConn.error) {
                return retval.setError('DB Connection error\n' + fetchConn.message);
            }
            if (fetchConn.data == null) {
                return retval.setError('DB Connection NULL error');
            }
            let client = fetchConn.data;
            this.chkSum = this.genHash();
            const res = yield client.query('CALL addSession($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11);', [this.sessionId, this.created, this.lastSeen, this.ip, this.status, this.captcha, this.nonce, this.password, this.seq, this.chkSum, 0]);
            if (res.rowCount == 0) {
                return retval.setError('Session not added.');
            }
            this.id = res.rows[0].insertedid;
            return retval.setData(null);
        });
    }
    // update a session in the database
    updateDB(uuid) {
        return __awaiter(this, void 0, void 0, function* () {
            let retval = new GTS.DM.WrappedResult();
            let fetchConn = yield DBCore.getConnection('Session.updateDB', uuid);
            if (fetchConn.error) {
                return retval.setError('DB Connection error\n' + fetchConn.message);
            }
            if (fetchConn.data == null) {
                return retval.setError('DB Connection NULL error');
            }
            let client = fetchConn.data;
            let newChksum = this.genHash();
            const res = yield client.query('CALL updateSession($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13);', [this.id, this.sessionId, this.created, this.lastSeen, this.ip, this.status, this.captcha, this.nonce, this.password, this.seq, newChksum, this.chkSum, 0]);
            if (res.rowCount == 0) {
                return retval.setError('Session not updated. 0 row count.');
            }
            if (res.rows[0].updatestatus == 0) {
                return retval.setError('Session not updated. ChkSum failed.');
            }
            this.chkSum = newChksum;
            return retval.setData(null);
        });
    }
    // delete a session from the database
    deleteFromDB(uuid) {
        return __awaiter(this, void 0, void 0, function* () {
            let retval = new GTS.DM.WrappedResult();
            let fetchConn = yield DBCore.getConnection('Session.deleteFromDB', uuid);
            if (fetchConn.error) {
                return retval.setError('DB Connection error\n' + fetchConn.message);
            }
            if (fetchConn.data == null) {
                return retval.setError('DB Connection NULL error');
            }
            let client = fetchConn.data;
            yield client.query('DELETE FROM sessions WHERE id=$1;', [this.id]);
            return retval.setData();
        });
    }
    initialiseCaptcha(uuid, sessionId) {
        // The questions that are asked
        const questionBase = [
            "What number does ? represent\nin this animated seq:",
            "What number is coloured red\nin this animated seq:",
            "What number is coloured blue\nin this animated seq:"
        ];
        // the captcha is initialised randomly
        function getRandom(min, max) {
            return Math.floor(Math.random() * (max - min)) + min;
        }
        // decide which question we are asking
        let questionId = getRandom(0, questionBase.length - 1);
        const numberCount = 5; // how many numbers are in the sequence
        const numWidth = 60; // the amount of padding for each number
        const imgWidth = 380; // width of the image to render
        const imgHeight = 100; // height of the image to render
        const answerHorizOffset = 40; // left indentation of the first answer number
        const answerVertOffset = 80; // how far down the image the answer numbers are rendered
        // the animation will be of a number sequence with ? placed in it and will have two coloured numbers
        const sequenceIsAscending = (getRandom(0, 1) == 0); // the sequence can go in two directions up (ascending) or down (descending)
        let minSeq = 1; // the lowest value allowed to display
        let maxSeq = 999; // the bigest value allowed to display
        // adjust min/max boundaries to ensure a sequence can't go past the above values
        if (sequenceIsAscending) {
            maxSeq -= numberCount;
        }
        else {
            minSeq += numberCount;
        }
        const start = getRandom(minSeq, maxSeq); // produce a random number to start the sequence
        const unknownFrame = getRandom(1, numberCount - 2); // choose where our unkown number goes making sure it is not the first or last number of the sequence
        let redFrame = getRandom(0, numberCount - 1); // choose a number position to be red (eg 2nd number)
        while (redFrame == unknownFrame) { // ensure it is a different number to the one ? represents
            redFrame = getRandom(0, numberCount - 1);
        }
        let blueFrame = getRandom(0, numberCount - 1); // choose a number position to be blue (eg 3rd number)
        while (blueFrame == unknownFrame || blueFrame == redFrame) { // ensure it is a different number to the one ? represents, and the one that is red
            blueFrame = getRandom(0, numberCount - 1);
        }
        // get the answer to the question
        let answer = 0;
        switch (questionId) {
            case 0: // ?
                answer = start + (sequenceIsAscending ? unknownFrame : unknownFrame * -1);
                break;
            case 1: // red
                answer = start + (sequenceIsAscending ? redFrame : redFrame * -1);
                break;
            case 2: // blue
                answer = start + (sequenceIsAscending ? blueFrame : blueFrame * -1);
                break;
        }
        // provide range checking on the answer
        let minCheckAllow = 1;
        let maxCheckAllow = 999;
        if (questionId == 0) {
            minCheckAllow = 1;
            maxCheckAllow = 998;
        } // reduce check range to ensure ? is not first or last character
        if (answer < minCheckAllow || answer > maxCheckAllow) {
            console.log("invalid " + answer + "," +
                "questionId is " + questionId + "," +
                (sequenceIsAscending ? "sequence is ascending, " : "sequence is descending, ") +
                "start is " + start + "," +
                "unknownFrame is " + unknownFrame + "," +
                "maxSeq is " + maxSeq + "," +
                "minSeq is " + minSeq);
            return;
        }
        // store the answer in the db for the session
        this.captcha = answer;
        this.updateDB(uuid);
        // start rendering the captcha animated gif
        const encoder = new GIFEncoder(imgWidth, imgHeight);
        encoder.start();
        encoder.setRepeat(0); // 0 for repeat, -1 for no-repeat
        encoder.setDelay(2000); // frame delay in ms
        encoder.setQuality(10); // image quality. 10 is default.
        // use node-canvas to draw each frame
        const canvas = createCanvas(imgWidth, imgHeight);
        const ctx = canvas.getContext('2d');
        // render a frame for each number
        for (var frameNum = 0; frameNum < numberCount; frameNum++) {
            ctx.fillStyle = '#FFDEA6';
            ctx.fillRect(0, 0, imgWidth, imgHeight);
            ctx.font = "16px Courier New";
            ctx.fillStyle = '#000000';
            ctx.fillText(questionBase[questionId], 10, 30);
            ctx.font = "28px Courier New";
            ctx.fillStyle = '#000000';
            if (frameNum == redFrame) {
                ctx.fillStyle = '#FF0000';
            }
            if (frameNum == blueFrame) {
                ctx.fillStyle = '#0000FF';
            }
            let frameValue = (start + (sequenceIsAscending ? frameNum : frameNum * -1)).toString();
            if (frameNum == unknownFrame) {
                frameValue = '?';
            }
            ctx.fillText(frameValue, answerHorizOffset + (frameNum * numWidth), answerVertOffset);
            encoder.addFrame(ctx);
        }
        encoder.finish();
        const buf = encoder.out.getData();
        fs.writeFile(`public/captchas/${sessionId}.gif`, buf, function (err) {
            // animated GIF written
            if (err != null) {
                console.log('error');
                console.log(err);
            }
        });
    }
    static hasSession(uuid, requestIp, cookies) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log({ uuid: uuid, requestIp: requestIp, cookies: cookies });
            if (!cookies['session']) {
                console.log('no session cookie at hasSession check');
                return [false, undefined];
            }
            if (cookies['session'].length != 36) {
                console.log('incorrect session length at hasSession check');
                return [false, undefined];
            }
            let ws = yield Session.getSessionFromDB(uuid, cookies['session']);
            if (ws.error) {
                console.log('failed to get session from db ' + ws.message);
                return [false, undefined];
            }
            if (ws.data == null) {
                console.log('null session from db');
                return [false, undefined];
            }
            let s = ws.data;
            if (s.ip != requestIp) {
                console.log('ip mismatch at hasSession check');
                return [false, undefined];
            }
            if (s.status == SessionStatus.Expired) {
                console.log('expired session at hasSession check');
                return [false, undefined];
            }
            return [true, s];
        });
    }
    static isLoggedIn(uuid, requestIp, cookies) {
        return __awaiter(this, void 0, void 0, function* () {
            const [hs, s] = yield Session.hasSession(uuid, requestIp, cookies);
            if (!hs) {
                return false;
            }
            if (!s) {
                return false;
            }
            return (s.status == SessionStatus.LoggedIn);
        });
    }
    // generate a random characters of the 189 that can be seen, 67 of the possible 256 8bit characters are excluded.
    static randomPassChar() {
        return __awaiter(this, void 0, void 0, function* () {
            let x = Math.floor(Math.random() * 222) + 33;
            let prohibit = [127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 173];
            if (prohibit.indexOf(x) >= 0) {
                return Session.randomPassChar();
            } // recurse to get different char if our random is prohibited
            return String.fromCharCode(x);
        });
    }
    // generate a password to use for the session ot reduce the usage and hence attack surface of the users password
    static genSessionPassword() {
        return __awaiter(this, void 0, void 0, function* () {
            let passwordChars = new Array(16);
            function assignRandomChar(index) {
                return __awaiter(this, void 0, void 0, function* () {
                    passwordChars[index] = yield Session.randomPassChar();
                });
            }
            let promises = [];
            for (var i = 0; i < passwordChars.length; i++) {
                promises.push(assignRandomChar(i));
            }
            yield Promise.all(promises);
            return passwordChars.join('');
        });
    }
}
exports.Session = Session;
