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
exports.StringUtils = exports.AddressUtils = exports.HexUtils = exports.Base64Utils = exports.DateTime = exports.sendTelegramMessage = exports.fetchJSON = exports.HexDecoded = exports.CheckedValue = exports.WrappedResult = exports.TypedStringVal = exports.getServerMAC = exports.delayCancellable = exports.CancellableDelay = exports.delay = exports.Threading = exports.WS = exports.DBCore = exports.UUID = void 0;
const axios_1 = __importDefault(require("axios"));
const getmac_1 = __importDefault(require("getmac"));
const BECH32 = require('bech32');
// reference to other files
exports.UUID = __importStar(require("./gts.uuid"));
exports.DBCore = __importStar(require("./gts.db"));
exports.WS = __importStar(require("./gts.webserver"));
exports.Threading = __importStar(require("./gts.threading"));
// use setTimeout to introduce a delay in code
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
exports.delay = delay;
// holds a promise to wait for, and the ability to cancel the delay the promise is waiting for
class CancellableDelay {
    constructor(pDelayTimeout, pPromise) {
        this.delayTimeout = pDelayTimeout;
        this.p = pPromise;
    }
}
exports.CancellableDelay = CancellableDelay;
// use setTimeout to introduce a delay in code that can be cancelled
function delayCancellable(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        // ability to cancel the timeout, init to a dummy value to allow code to compile
        var delayTimeout = setTimeout(() => null, 1);
        // the promise that resolves when the timeout is done, init to a dummy value to allow code to compile
        var delayPromise = Promise.resolve();
        // set the real values for delayTimeout and delayPromise
        var promiseTimeoutSet = new Promise(function (resolveTimeoutSet, rejectTimeoutSet) {
            delayPromise = new Promise(function (resolve, reject) { delayTimeout = setTimeout(resolve, ms); resolveTimeoutSet(); });
        });
        // wait for the real values to be set to return
        yield promiseTimeoutSet;
        // return the results
        return new CancellableDelay(delayTimeout, delayPromise);
    });
}
exports.delayCancellable = delayCancellable;
function getServerMAC() {
    return (0, getmac_1.default)();
}
exports.getServerMAC = getServerMAC;
// Allow extra info to be stored about a string value
class TypedStringVal {
    constructor() {
        this.type = '';
        this.value = '';
    }
}
exports.TypedStringVal = TypedStringVal;
// Allow a result to be wrapped with error information (if there was an error, and a message)
class WrappedResult {
    constructor() {
        this.error = true;
        this.message = 'WrappedResult default constructor values';
        this.data = null;
    }
    setVals(pError, pMessage, pData) {
        this.error = pError;
        this.message = pMessage;
        this.data = pData;
        return this;
    }
    setError(pMessage) {
        this.error = true;
        this.message = pMessage;
        return this;
    }
    setData(pData) {
        this.error = false;
        this.message = 'Data Set';
        this.data = pData;
        return this;
    }
    setNoData() {
        this.error = false;
        this.message = 'No Data Set';
        this.data = null;
        return this;
    }
}
exports.WrappedResult = WrappedResult;
// Allow the population of data to say if its valid
class CheckedValue {
    constructor(pIsValid, pValue) {
        this.isValid = pIsValid;
        this.value = pValue;
    }
}
exports.CheckedValue = CheckedValue;
class HexDecoded {
    constructor() {
        this.hex = '';
        this.number = -1;
        this.address = '';
        this.string = '';
        this.escaped = '';
    }
}
exports.HexDecoded = HexDecoded;
HexDecoded.prototype.toString = function () {
    let properties = [];
    if (this.hex.length > 0) {
        properties.push(`"hex":"${this.hex}"`);
    }
    if (this.number >= 0) {
        properties.push(`"number":${this.number.toString()}`);
    }
    if (this.address.length > 0) {
        properties.push(`"address":"${this.address}"`);
    }
    if (this.string.length > 0) {
        properties.push(`"string":"${this.string}"`);
    }
    if (this.escaped.length > 0) {
        properties.push(`"escaped":"${this.escaped}"`);
    }
    return `{${properties.join(',')}}`;
};
// Get JSON from a web resource
function fetchJSON(url) {
    return __awaiter(this, void 0, void 0, function* () {
        let retval = new WrappedResult(); // prepare data structure for response. Use setError and setData to send result
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
function sendTelegramMessage(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        let response = yield fetchJSON('https://api.telegram.org/bot***REMOVED***/sendMessage?chat_id=***REMOVED***&text=' + encodeURIComponent(msg));
        if (response.error) {
            return response;
        }
        return response;
    });
}
exports.sendTelegramMessage = sendTelegramMessage;
var DateTime;
(function (DateTime) {
    // show the timestamp  as yyyy/MM/dd HH:mm:ss		timestamp is in seconds since epoch, eg elrond timestamp
    function timestampToDateString(timestamp) {
        var d = new Date(0); // The 0 there is the key, which sets the date to the epoch
        d.setUTCSeconds(timestamp);
        return dateToString(d);
    }
    DateTime.timestampToDateString = timestampToDateString;
    // show the date  as yyyy/MM/dd HH:mm:s
    function dateToString(d) {
        return ''.concat(d.getFullYear().toString(), '/', ('0' + (1 + d.getMonth()).toString()).slice(-2), '/', ('0' + d.getDate().toString()).slice(-2), ' ', ('0' + d.getHours().toString()).slice(-2), ':', ('0' + d.getMinutes().toString()).slice(-2), ':', ('0' + d.getSeconds().toString()).slice(-2));
    }
    DateTime.dateToString = dateToString;
})(DateTime = exports.DateTime || (exports.DateTime = {}));
var Base64Utils;
(function (Base64Utils) {
    // check that a base64 string looks legit
    function checkStringIsBase64Encoded(base64test) {
        let base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
        return base64Pattern.test(base64test);
    }
    Base64Utils.checkStringIsBase64Encoded = checkStringIsBase64Encoded;
    // base64 decode a string
    function decodeString(str) {
        const buff = Buffer.from(str, 'base64');
        return buff.toString();
    }
    Base64Utils.decodeString = decodeString;
    // base64 encode a string
    function encodeString(str) {
        const buff = Buffer.from(str, 'utf-8');
        return buff.toString('base64'); // decode buffer as Base64
    }
    Base64Utils.encodeString = encodeString;
    // base 64 encode a number
    function encodeNumber(num) {
        let hex = num.toString(16);
        if (hex.length % 2 == 1) {
            hex = '0' + hex;
        } // keep hex strings even length
        const buff = Buffer.from(hex, "hex");
        return buff.toString('base64'); // decode buffer as Base64
    }
    Base64Utils.encodeNumber = encodeNumber;
    // base 64 decode a number
    function decodeNumber(str) {
        const buff = Buffer.from(str, 'base64');
        const hex = buff.toString('hex'); // decode buffer as hex
        return parseInt("0x" + hex, 16); // return base 10 int of hex
    }
    Base64Utils.decodeNumber = decodeNumber;
})(Base64Utils = exports.Base64Utils || (exports.Base64Utils = {}));
var HexUtils;
(function (HexUtils) {
    // test that string is hex encoded
    function checkStringIsHexEncoded(hex) {
        let regexHex = /^[0-9a-fA-F]+$/;
        return hex.length % 2 == 0 && regexHex.test(hex);
    }
    HexUtils.checkStringIsHexEncoded = checkStringIsHexEncoded;
    // test that string is an @ seperated list of hex encoded strings
    function checkStringIsHexEncodedList(hexlist) {
        let regexDataPattern = /^(([0-9a-fA-F]{2})*|@)*$/;
        return regexDataPattern.test(hexlist);
    }
    HexUtils.checkStringIsHexEncodedList = checkStringIsHexEncodedList;
    // decode a string from hex encoding
    function decodeString(hex) {
        if (!hex || hex.length % 2 != 0) {
            return new WrappedResult().setError('invalid hex provided to decodeString');
        }
        var str = '';
        try {
            for (var n = 0; n < hex.length; n += 2) {
                str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
            }
        }
        catch (err) {
            return new WrappedResult().setError('error decoding hex encoded string\r\n' + err);
        }
        return new WrappedResult().setData(str);
    }
    HexUtils.decodeString = decodeString;
    function encodeString(str) {
        const buff = Buffer.from(str, 'utf-8');
        let hex = buff.toString('hex'); // decode buffer as hex
        if (hex.length % 2 == 1) {
            hex = '0' + hex;
        } // keep hex strings even length
        return hex;
    }
    HexUtils.encodeString = encodeString;
    // decode a number from hex encoding
    function decodeNumber(hex) {
        if (!hex || hex.length % 2 != 0) {
            return new WrappedResult().setError('invalid hex provided to decodeNumber');
        }
        let num = NaN;
        try {
            num = parseInt("0x" + hex, 16);
        }
        catch (err) {
            return new WrappedResult().setError('error decoding hex encoded number\r\n' + err);
        }
        return new WrappedResult().setData(num);
    }
    HexUtils.decodeNumber = decodeNumber;
    function encodeNumber(num) {
        let hex = num.toString(16);
        if (hex.length % 2 == 1) {
            hex = '0' + hex;
        } // keep hex strings even length
        return hex;
    }
    HexUtils.encodeNumber = encodeNumber;
    // Try to auto guess what type to decode hex as
    function autoDecodeValueFromHex(hex) {
        // test for empty string
        if (hex.length == 0) {
            return { type: 'empty', value: '' };
        }
        // test is valid hex
        if (!checkStringIsHexEncoded(hex)) {
            return { type: 'error', value: 'input not hex' };
        }
        // test if value is hex encoded address
        if (hex.length == 64) {
            let decodedAddress = AddressUtils.convertAddressHexToBech32(hex);
            if (!decodedAddress.error && decodedAddress.data != null && AddressUtils.checkAddressStringIsBech32(decodedAddress.data)) {
                return { type: 'address', value: decodedAddress.data };
            }
        }
        // test if hex decoded value looks like printable ascii string
        let str = HexUtils.decodeString(hex);
        if (!str.error && str.data != null && StringUtils.checkStringIsAsciiPrintable(str.data)) {
            return { type: 'string', value: str.data };
        }
        // test if hex decoded value looks like a number
        let decodeNum = HexUtils.decodeNumber(hex);
        if (!decodeNum.error && decodeNum.data != null) {
            return { type: 'decimal', value: decodeNum.data.toString(10) };
        }
        // return the hex if we can't decode it
        return { type: 'hex', value: hex };
    }
    HexUtils.autoDecodeValueFromHex = autoDecodeValueFromHex;
    function multiDecodeHex(hex) {
        let retval = new HexDecoded();
        let isValidHex = checkStringIsHexEncoded(hex);
        if (!isValidHex) {
            retval.string = hex;
            return retval;
        }
        retval.hex = hex;
        let decodedNumber = decodeNumber(hex);
        if (decodedNumber.error) {
            retval.number = -1;
        }
        else {
            retval.number = decodedNumber.data == null ? -1 : decodedNumber.data;
        }
        let decodedAddress = AddressUtils.convertAddressHexToBech32(hex);
        if (decodedAddress.error) {
            retval.address = '';
        }
        else {
            retval.address = decodedAddress.data == null ? '' : decodedAddress.data;
        }
        let decodedString = decodeString(hex);
        if (decodedString.error) {
            retval.string = '';
        }
        else {
            retval.string = decodedString.data == null ? '' : decodedString.data;
        }
        // include an escaped copy of the string if it includes non ascii printable characters
        if (!StringUtils.checkStringIsAsciiPrintable(retval.string)) {
            retval.escaped = escape(retval.string);
        }
        return retval;
    }
    HexUtils.multiDecodeHex = multiDecodeHex;
})(HexUtils = exports.HexUtils || (exports.HexUtils = {}));
var AddressUtils;
(function (AddressUtils) {
    // check if an address looks to be valid bech32
    function checkAddressStringIsBech32(bech32) {
        let addressPattern = /^erd1[a-z0-9]{58}$/;
        return addressPattern.test(bech32);
    }
    AddressUtils.checkAddressStringIsBech32 = checkAddressStringIsBech32;
    // convert hex into a bech32 address
    function convertAddressHexToBech32(hex) {
        if (hex.length != 64) {
            return new WrappedResult().setError('inavlid hex length');
        }
        try {
            let buf = Buffer.from(hex, "hex");
            let words = BECH32.bech32.toWords(buf);
            let address = BECH32.bech32.encode('erd', words);
            return new WrappedResult().setData(address);
        }
        catch (err) {
            return new WrappedResult().setError('error coverting hex to bech32\r\n' + err);
        }
    }
    AddressUtils.convertAddressHexToBech32 = convertAddressHexToBech32;
    // convert a bech32 address into hex
    function convertAddressBech32ToHex(address) {
        let obj = BECH32.bech32.decode(address);
        let buff = Buffer.from(BECH32.bech32.fromWords(obj.words));
        return buff.toString('hex');
    }
    AddressUtils.convertAddressBech32ToHex = convertAddressBech32ToHex;
    // convert a base64 encoded address into bech32
    function convertAddressBase64ToBech32(base64) {
        let buff = Buffer.from(base64, 'base64');
        let words = BECH32.bech32.toWords(buff);
        let address = BECH32.bech32.encode('erd', words);
        return address;
    }
    AddressUtils.convertAddressBase64ToBech32 = convertAddressBase64ToBech32;
    function checkAddressHexIsSC(hex) {
        return hex.startsWith("0".repeat(16));
    }
    AddressUtils.checkAddressHexIsSC = checkAddressHexIsSC;
})(AddressUtils = exports.AddressUtils || (exports.AddressUtils = {}));
var StringUtils;
(function (StringUtils) {
    function checkStringIsAsciiPrintable(str) {
        for (let i = 0; i < str.length; i++) {
            let code = str.charCodeAt(i);
            if (code < 32 || code > 126) {
                return false;
            }
        }
        return true;
    }
    StringUtils.checkStringIsAsciiPrintable = checkStringIsAsciiPrintable;
    function checkStringIsInteger(num) {
        let regex = /^[0-9]+$/;
        return regex.test(num);
    }
    StringUtils.checkStringIsInteger = checkStringIsInteger;
    function escapeDoubleQuotes(obj) {
        let str = typeof (obj === 'string') ? obj : obj.toString();
        return str.split('"').join('\\"');
    }
    StringUtils.escapeDoubleQuotes = escapeDoubleQuotes;
    function escapeNewLines(obj) {
        let str = typeof (obj === 'string') ? obj : obj.toString();
        return str.split('\r\n').join('\\r\\n');
    }
    StringUtils.escapeNewLines = escapeNewLines;
})(StringUtils = exports.StringUtils || (exports.StringUtils = {}));
