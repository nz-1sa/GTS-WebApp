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
exports.DB = exports.Session = exports.SessionStatus = exports.attachCaptcha = exports.isLoggedIn = exports.hasSession = void 0;
const GTS = __importStar(require("./gts"));
const DBCore = __importStar(require("./gts.db"));
const UUID = __importStar(require("./gts.uuid"));
const WS = __importStar(require("./gts.webserver"));
var crypto = require('crypto');
const GIFEncoder = require('gifencoder');
const { createCanvas } = require('canvas');
const fs = require('fs');
function getRandom(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}
const questionBase = [
    "What number does ? represent\nin this animated seq:",
    "What number is coloured red\nin this animated seq:",
    "What number is coloured blue\nin this animated seq:"
];
function hasSession(uuid, requestIp, cookies) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!cookies['session']) {
            console.log('no session cookie at hasSession check');
            return [false, undefined];
        }
        if (cookies['session'].length != 36) {
            console.log('incorrect session length at hasSession check');
            return [false, undefined];
        }
        let ws = yield DB.getSession(uuid, cookies['session']);
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
exports.hasSession = hasSession;
function isLoggedIn(uuid, requestIp, cookies) {
    return __awaiter(this, void 0, void 0, function* () {
        const [hs, s] = yield hasSession(uuid, requestIp, cookies);
        if (!hs) {
            return false;
        }
        if (!s) {
            return false;
        }
        return (s.status == SessionStatus.LoggedIn);
    });
}
exports.isLoggedIn = isLoggedIn;
function attachCaptcha(web, webapp) {
    web.registerHandlerUnchecked(webapp, '/captcha', [], function (uuid, requestIp, cookies) {
        return __awaiter(this, void 0, void 0, function* () {
            const [hs, s] = yield hasSession(uuid, requestIp, cookies);
            if (hs && s) {
                if (s.status == SessionStatus.LoggedIn) {
                    return new WS.WebResponse(true, "", `UUID:${uuid} Already logged in`, `Already logged in`, []);
                }
                return new WS.WebResponse(true, "", `UUID:${uuid} Captcha Previously Drawn ${cookies['session']}`, `<img src="/captchas/${cookies['session']}.gif">`, []);
            }
            let now = new Date();
            const loopSafety = 20;
            let loopIteration = 1;
            let sessionId = uuid;
            while (!DB.isSessionIdUnique(uuid, sessionId) && loopIteration <= loopSafety) {
                console.log('handling sessionId clash');
                sessionId = yield UUID.newUUID();
                loopIteration++;
            }
            if (loopIteration == loopSafety) {
                return new WS.WebResponse(false, "", `UUID:${uuid} Unable to initialse session`, `Unable to initialise session. Try again later.`, []);
            }
            DB.addSession(uuid, sessionId, now, now, requestIp, SessionStatus.Initialised);
            let answer = drawCaptcha(sessionId);
            return new WS.WebResponse(true, "", `UUID:${uuid} Captcha Drawn`, `<img src="/captchas/${sessionId}.gif">`, [new WS.Cookie('session', sessionId)]);
        });
    });
}
exports.attachCaptcha = attachCaptcha;
function drawCaptcha(sessionId) {
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
        return 0;
    }
    //TODO: store the answer in the db with a cookie to get the value
    console.log('answer is ' + answer);
    // start rendering the animated gif
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
    return answer;
}
var SessionStatus;
(function (SessionStatus) {
    SessionStatus[SessionStatus["Initialised"] = 1] = "Initialised";
    SessionStatus[SessionStatus["LoggedIn"] = 2] = "LoggedIn";
    SessionStatus[SessionStatus["LoggedOut"] = 3] = "LoggedOut";
    SessionStatus[SessionStatus["Expired"] = 4] = "Expired";
})(SessionStatus = exports.SessionStatus || (exports.SessionStatus = {}));
class Session {
    constructor(pId, pSessionId, pCreated, pLastSeen, pIp, pStatus, pChkSum) {
        this.id = pId;
        this.sessionId = pSessionId;
        this.created = pCreated;
        this.lastSeen = pLastSeen;
        this.ip = pIp;
        this.status = pStatus;
        this.chkSum = pChkSum;
    }
    genHash() {
        var j = JSON.stringify({ sessionId: this.sessionId, created: this.created, lastSeen: this.lastSeen, ip: this.ip, status: this.status });
        var hsh = crypto.createHash('sha1').update(j).digest('base64');
        return hsh;
    }
    toString() {
        return JSON.stringify({ id: this.id.toString(), sessionId: this.sessionId, created: this.created.toString(), lastSeen: this.lastSeen.toString(), ip: this.ip, status: this.status.toString(), chkSum: this.chkSum });
    }
    toJSON() {
        return { id: this.id.toString(), sessionId: this.sessionId, created: this.created.toString(), lastSeen: this.lastSeen.toString(), ip: this.ip, status: this.status.toString(), chkSum: this.chkSum };
    }
    testId() {
        return this.id >= 0 && this.id <= 2147483600;
    }
    testSessionId() {
        return this.sessionId.length >= 36 && this.sessionId.length <= 36;
    }
    testCreated() {
        return true;
    }
    testLastSeen() {
        return true;
    }
    testIp() {
        return this.ip.length >= 3 && this.ip.length <= 39;
    }
    testStatus() {
        return [1, 2, 3, 4].indexOf(this.status) >= 0;
    }
    testChkSum() {
        return true;
    }
    static fromStrings(id, sessionId, created, lastSeen, ip, status, chkSum) {
        let regexTests = [new RegExp("^[0-9]+$", "g").test(id), new RegExp("^[A-Za-z\. \-,0-9=+/]+$", "g").test(sessionId), new RegExp("^[0-9]{4}-[0-9]{2}-[0-9][0-9]? [0-9]{2}:[0-9]{2}(?::[0-9]{2})$", "g").test(created), new RegExp("^[0-9]{4}-[0-9]{2}-[0-9][0-9]? [0-9]{2}:[0-9]{2}(?::[0-9]{2})$", "g").test(lastSeen), new RegExp("^[A-Za-z\. \-,0-9=+/]+$", "g").test(ip), new RegExp("^[0-9]+$", "g").test(status), new RegExp("^[a-zA-Z0-9/+]{26}[a-zA-Z0-9/+=]{2}$", "g").test(chkSum)];
        if (!regexTests.every(Boolean)) {
            // detail invalid value
            let paramNames = ["id", "sessionId", "created", "lastSeen", "ip", "status", "chkSum"];
            for (var i = 0; i < regexTests.length; i++) {
                if (!regexTests[i]) {
                    console.log('posted value for ' + paramNames[i] + ' fails regex check');
                }
            }
            return undefined;
        }
        let session = new Session(parseInt(id), (sessionId), new Date(created), new Date(lastSeen), (ip), parseInt(status), (chkSum));
        if (session.testId() && session.testSessionId() && session.testCreated() && session.testLastSeen() && session.testIp() && session.testStatus() && session.testChkSum()) {
            return session;
        }
        //TODO: detail invalid value
        return undefined;
    }
}
exports.Session = Session;
var DB;
(function (DB) {
    function fetchAllSession(uuid) {
        return __awaiter(this, void 0, void 0, function* () {
            let retval = new GTS.DM.WrappedResult();
            let retvalData = [];
            let fetchConn = yield DBCore.getConnection('fetchAllSession', uuid);
            if (fetchConn.error) {
                return retval.setError('DB Connection error\n' + fetchConn.message);
            }
            if (fetchConn.data == null) {
                return retval.setError('DB Connection NULL error');
            }
            let client = fetchConn.data;
            const res = yield client.query('SELECT id, sessionId, created, lastSeen, ip, status, chkSum FROM sessions;');
            if (res.rowCount == 0) {
                return retval.setData(retvalData);
            } // handle empty table
            for (let i = 0; i < res.rowCount; i++) {
                retvalData.push(new Session(res.rows[i].id, res.rows[i].sessionid, res.rows[i].created, res.rows[i].lastseen, res.rows[i].ip, res.rows[i].status, res.rows[i].chksum));
            }
            return retval.setData(retvalData);
        });
    }
    DB.fetchAllSession = fetchAllSession;
    function getSession(uuid, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            let retval = new GTS.DM.WrappedResult();
            let fetchConn = yield DBCore.getConnection('getSession', uuid);
            if (fetchConn.error) {
                return retval.setError('DB Connection error\n' + fetchConn.message);
            }
            if (fetchConn.data == null) {
                return retval.setError('DB Connection NULL error');
            }
            let client = fetchConn.data;
            const res = yield client.query('SELECT id, created, lastSeen, ip, status, chkSum FROM sessions WHERE sessionId = $1;', [sessionId]);
            if (res.rowCount == 0) {
                return retval.setError('Session not found.');
            }
            let s = new Session(res.rows[0].id, sessionId, res.rows[0].created, res.rows[0].lastseen, res.rows[0].ip, res.rows[0].status, res.rows[0].chksum);
            return retval.setData(s);
        });
    }
    DB.getSession = getSession;
    function isSessionIdUnique(uuid, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            let retval = new GTS.DM.WrappedResult();
            let fetchConn = yield DBCore.getConnection('getSession', uuid);
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
    DB.isSessionIdUnique = isSessionIdUnique;
    function addSession(uuid, sessionId, created, lastSeen, ip, status) {
        return __awaiter(this, void 0, void 0, function* () {
            let retval = new GTS.DM.WrappedResult();
            let fetchConn = yield DBCore.getConnection('addSession', uuid);
            if (fetchConn.error) {
                return retval.setError('DB Connection error\n' + fetchConn.message);
            }
            if (fetchConn.data == null) {
                return retval.setError('DB Connection NULL error');
            }
            let client = fetchConn.data;
            let obj = new Session(0, sessionId, created, lastSeen, ip, status, '');
            let chksum = obj.genHash();
            const res = yield client.query('CALL addSession($1,$2,$3,$4,$5,$6,$7);', [sessionId, created, lastSeen, ip, status, chksum, 0]);
            if (res.rowCount == 0) {
                return retval.setError('Session not added.');
            }
            obj.id = res.rows[0].insertedid;
            obj.chkSum = chksum;
            return retval.setData(obj);
        });
    }
    DB.addSession = addSession;
    function updateSession(uuid, id, sessionId, created, lastSeen, ip, status, chkSum) {
        return __awaiter(this, void 0, void 0, function* () {
            let retval = new GTS.DM.WrappedResult();
            let fetchConn = yield DBCore.getConnection('updateSession', uuid);
            if (fetchConn.error) {
                return retval.setError('DB Connection error\n' + fetchConn.message);
            }
            if (fetchConn.data == null) {
                return retval.setError('DB Connection NULL error');
            }
            let client = fetchConn.data;
            let obj = new Session(id, sessionId, created, lastSeen, ip, status, chkSum);
            let newChksum = obj.genHash();
            const res = yield client.query('CALL updateSession($1,$2,$3,$4,$5,$6,$7,$8,$9);', [id, sessionId, created, lastSeen, ip, status, newChksum, chkSum, 0]);
            if (res.rowCount == 0) {
                return retval.setError('Session not updated. 0 row count.');
            }
            if (res.rows[0].updatestatus == 0) {
                return retval.setError('Session not updated. ChkSum failed.');
            }
            obj.chkSum = newChksum;
            return retval.setData(obj);
        });
    }
    DB.updateSession = updateSession;
    function deleteSession(uuid, id) {
        return __awaiter(this, void 0, void 0, function* () {
            let retval = new GTS.DM.WrappedResult();
            let fetchConn = yield DBCore.getConnection('deleteSession', uuid);
            if (fetchConn.error) {
                return retval.setError('DB Connection error\n' + fetchConn.message);
            }
            if (fetchConn.data == null) {
                return retval.setError('DB Connection NULL error');
            }
            let client = fetchConn.data;
            yield client.query('DELETE FROM sessions WHERE id=$1;', [id]);
            return retval.setData();
        });
    }
    DB.deleteSession = deleteSession;
})(DB = exports.DB || (exports.DB = {}));
