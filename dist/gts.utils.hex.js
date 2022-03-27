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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DM = exports.multiDecodeHex = exports.autoDecodeValueFromHex = exports.decodeNumber = exports.encodeNumber = exports.decodeString = exports.encodeString = exports.checkStringIsHexEncodedList = exports.checkStringIsHexEncoded = void 0;
const GTS = __importStar(require("./gts"));
// test that string is hex encoded
function checkStringIsHexEncoded(hex) {
    let regexHex = /^[0-9a-fA-F]+$/;
    return hex.length % 2 == 0 && regexHex.test(hex);
}
exports.checkStringIsHexEncoded = checkStringIsHexEncoded;
// test that string is an @ seperated list of hex encoded strings
function checkStringIsHexEncodedList(hexlist) {
    let regexDataPattern = /^(([0-9a-fA-F]{2})*|@)*$/;
    return regexDataPattern.test(hexlist);
}
exports.checkStringIsHexEncodedList = checkStringIsHexEncodedList;
// encode a string in hex encoding
function encodeString(str) {
    const buff = Buffer.from(str, 'utf-8');
    let hex = buff.toString('hex'); // decode buffer as hex
    if (hex.length % 2 == 1) {
        hex = '0' + hex;
    } // keep hex strings even length
    return hex;
}
exports.encodeString = encodeString;
// decode a string from hex encoding
function decodeString(hex) {
    if (!hex || hex.length % 2 != 0) {
        return new GTS.DM.WrappedResult().setError('invalid hex provided to decodeString');
    }
    var str = '';
    try {
        for (var n = 0; n < hex.length; n += 2) {
            str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
        }
    }
    catch (err) {
        return new GTS.DM.WrappedResult().setError('error decoding hex encoded string\r\n' + err);
    }
    return new GTS.DM.WrappedResult().setData(str);
}
exports.decodeString = decodeString;
// represent a number as hex
function encodeNumber(num) {
    let hex = num.toString(16);
    if (hex.length % 2 == 1) {
        hex = '0' + hex;
    } // keep hex strings even length
    return hex;
}
exports.encodeNumber = encodeNumber;
// decode a number from hex encoding
function decodeNumber(hex) {
    if (!hex || hex.length % 2 != 0) {
        return new GTS.DM.WrappedResult().setError('invalid hex provided to decodeNumber');
    }
    let num = NaN;
    try {
        num = parseInt("0x" + hex, 16);
    }
    catch (err) {
        return new GTS.DM.WrappedResult().setError('error decoding hex encoded number\r\n' + err);
    }
    return new GTS.DM.WrappedResult().setData(num);
}
exports.decodeNumber = decodeNumber;
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
        let decodedAddress = GTS.AddressUtils.convertAddressHexToBech32(hex);
        if (!decodedAddress.error && decodedAddress.data != null && GTS.AddressUtils.checkAddressStringIsBech32(decodedAddress.data)) {
            return { type: 'address', value: decodedAddress.data };
        }
    }
    // test if hex decoded value looks like printable ascii string
    let str = decodeString(hex);
    if (!str.error && str.data != null && GTS.StringUtils.checkStringIsAsciiPrintable(str.data)) {
        return { type: 'string', value: str.data };
    }
    // test if hex decoded value looks like a number
    let decodeNum = decodeNumber(hex);
    if (!decodeNum.error && decodeNum.data != null) {
        return { type: 'decimal', value: decodeNum.data.toString(10) };
    }
    // return the hex if we can't decode it
    return { type: 'hex', value: hex };
}
exports.autoDecodeValueFromHex = autoDecodeValueFromHex;
// try decoding hex as string, a number, and as an address
function multiDecodeHex(hex) {
    let retval = new DM.HexDecoded();
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
    let decodedAddress = GTS.AddressUtils.convertAddressHexToBech32(hex);
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
    if (!GTS.StringUtils.checkStringIsAsciiPrintable(retval.string)) {
        retval.escaped = escape(retval.string);
    }
    return retval;
}
exports.multiDecodeHex = multiDecodeHex;
// Data Model
var DM;
(function (DM) {
    class HexDecoded {
        constructor() {
            this.hex = '';
            this.number = -1;
            this.address = '';
            this.string = '';
            this.escaped = '';
        }
    }
    DM.HexDecoded = HexDecoded;
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
})(DM = exports.DM || (exports.DM = {}));
