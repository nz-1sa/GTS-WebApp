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
exports.addTestUUIDs = exports.newUUID = void 0;
const GTS = __importStar(require("./gts"));
const DBCore = __importStar(require("./gts.db"));
const gts_concurrency_1 = require("./gts.concurrency");
const WebApp = __importStar(require("./gts.webapp"));
// make a unique identifier, it is a timestamp first uuid and includes the mac of the machine made on
function newUUID() {
    return __awaiter(this, void 0, void 0, function* () {
        // start the uniqueness from the time it is generated, as the number of milliseconds since January 1, 1970)
        const ticks = new Date().getTime();
        const ticksHex = GTS.HexUtils.encodeNumber(ticks);
        if (ticksHex.length != 12) { //TODO: improve this quick error handling
            return '';
        }
        const uuidA = ticksHex.substring(0, 8); // length 8
        const uuidB = ticksHex.substring(8); // length 4
        // add to the uniqueness by using a random number from measuring code execurtion
        // local testing only gave 20 values so combine with a random number
        let delayRand = (yield randomDelay()).toString(10) + Math.random().toString().substring(1);
        const seedC = xmur3(delayRand);
        const randC = mulberry32(seedC());
        const uuidC = '6' + rand2string(randC(), 4).substring(1); // length 4
        // keep our randomness at least as random as the random function by including it in our random
        let normalRand = Math.floor(Math.random() * 65535);
        const uuidD = GTS.HexUtils.encodeNumber(normalRand); // length 4
        // use the mac address to reduce conflicts between machines
        const mac = WebApp.getServerMAC();
        const uuidE = mac.split(':').join(''); // length 12
        // return a uuid as a string joined from the above parts,	lengths: 8-4-4-4-12
        return `${uuidA}-${uuidB}-${uuidC}-${uuidD}-${uuidE}`;
        // get a hex string from a random number between 0 and 1
        // number of chars must be even
        function rand2string(r, chars) {
            let rnd = Number(r.toFixed(chars));
            rnd = Math.floor(rnd * Math.pow(10, (chars + 1)));
            const str = '0' + rnd.toString(16);
            return str.substring(0, chars);
        }
    });
}
exports.newUUID = newUUID;
function addTestUUIDs(sessionUUID) {
    return __awaiter(this, void 0, void 0, function* () {
        let fetchBatch = yield DB.getNewBatchNum(sessionUUID);
        if (fetchBatch.error || fetchBatch.data == null) {
            return new GTS.DM.WrappedResult().setError('Unable to get batch number\r\n' + fetchBatch.message);
        }
        for (var i = 0; i < 100; i++) {
            yield DB.addTestUUID(yield newUUID(), fetchBatch.data, sessionUUID);
        }
        return new GTS.DM.WrappedResult().setData(true);
    });
}
exports.addTestUUIDs = addTestUUIDs;
// get a randomness from slight extra delay introduced in calls to setTimeout
function randomDelay() {
    return __awaiter(this, void 0, void 0, function* () {
        var startTime = new Date().getTime();
        yield gts_concurrency_1.Concurrency.pause(10);
        var endTime = new Date().getTime();
        return (endTime - startTime);
    });
}
// Mulberry32 is a simple generator with a 32-bit state
// Param a is a random seed
// https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
function mulberry32(a) {
    return function () {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
// hash functions are very good at generating seeds from short strings
// seed generator based on MurmurHash3's mixing function
// https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
function xmur3(str) {
    for (var i = 0, h = 1779033703 ^ str.length; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = h << 13 | h >>> 19;
    }
    return function () {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^= h >>> 16) >>> 0;
    };
}
var DB;
(function (DB) {
    function getNewBatchNum(uuid) {
        return __awaiter(this, void 0, void 0, function* () {
            let fetchConn = yield DBCore.getConnection('getDecimals', uuid);
            if (fetchConn.error || fetchConn.data == null) {
                return new GTS.DM.WrappedResult().setError('DB Connection error\r\n' + fetchConn.message);
            }
            let client = fetchConn.data;
            const res = yield client.query('CALL getTestUUIDBatchNum(0);');
            if (res.rowCount == 0) {
                return new GTS.DM.WrappedResult().setData(-1);
            }
            return new GTS.DM.WrappedResult().setData(res.rows[0].num);
        });
    }
    DB.getNewBatchNum = getNewBatchNum;
    function addTestUUID(testUUID, batchNum, uuid) {
        return __awaiter(this, void 0, void 0, function* () {
            let fetchConn = yield DBCore.getConnection('addTestUUID', uuid);
            if (fetchConn.error || fetchConn.data == null) {
                return new GTS.DM.WrappedResult().setError('DB Connection error\r\n' + fetchConn.message);
            }
            let parts = testUUID.split('-');
            let client = fetchConn.data;
            yield client.query('CALL addTestUUID($1,$2,$3,$4,$5,$6);', [batchNum, parts[0], parts[1], parts[2], parts[3], parts[4]]);
            return new GTS.DM.WrappedResult().setNoData();
        });
    }
    DB.addTestUUID = addTestUUID;
})(DB || (DB = {}));
