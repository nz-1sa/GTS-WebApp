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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Telegram = exports.fetchJSON = exports.getServerMAC = exports.WrappedResult = exports.WebResponse = exports.Threading = exports.WS = exports.DBCore = exports.UUID = exports.GTS = void 0;
const axios_1 = __importDefault(require("axios"));
const getmac_1 = __importDefault(require("getmac"));
const GTS = __importStar(require("./gts"));
// provide code from GTS core files
exports.GTS = __importStar(require("./gts"));
exports.UUID = __importStar(require("./gts.uuid"));
exports.DBCore = __importStar(require("./gts.db"));
exports.WS = __importStar(require("./gts.webserver"));
exports.Threading = __importStar(require("./gts.threading"));
// quicker reference to commly used types
var gts_webserver_1 = require("./gts.webserver");
Object.defineProperty(exports, "WebResponse", { enumerable: true, get: function () { return gts_webserver_1.WebResponse; } });
class WrappedResult extends GTS.DM.WrappedResult {
}
exports.WrappedResult = WrappedResult;
;
// Provide access to the MAC address of the server (used to give guids cross server uniqueness)
function getServerMAC() {
    return (0, getmac_1.default)();
}
exports.getServerMAC = getServerMAC;
// Get JSON from a web resource
function fetchJSON(url) {
    return __awaiter(this, void 0, void 0, function* () {
        let retval = new GTS.DM.WrappedResult(); // prepare data structure for response. Use setError and setData to send result
        // fetch the json
        try {
            let res = yield (0, axios_1.default)({
                url: url,
                method: 'get',
                timeout: 8000,
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            if (res.status == 200 && res.data) {
                retval.setData(res.data);
                return retval;
            }
            else {
                console.error(`Could not get url ${url}, response code was ${res.status}`);
                return retval.setError(`Could not get url ${url}, response code was ${res.status}`);
            }
        }
        catch (err) {
            console.error(`Could not get url ${url}, error was ${err}`);
            return retval.setError(`Could not get url ${url}, error was ${err}`);
        }
    });
}
exports.fetchJSON = fetchJSON;
var Telegram;
(function (Telegram) {
    // send a telegram message
    function sendMessage(msg, token, chatid) {
        return __awaiter(this, void 0, void 0, function* () {
            let response = yield fetchJSON(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatid}&text=${encodeURIComponent(msg)}`);
            if (response.error) {
                return response;
            }
            return response;
        });
    }
    Telegram.sendMessage = sendMessage;
})(Telegram = exports.Telegram || (exports.Telegram = {}));
