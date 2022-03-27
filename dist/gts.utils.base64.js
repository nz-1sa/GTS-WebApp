"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeNumber = exports.encodeNumber = exports.decodeString = exports.encodeString = exports.checkStringIsBase64Encoded = void 0;
// check that a base64 string looks legit
function checkStringIsBase64Encoded(base64test) {
    let base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
    return base64Pattern.test(base64test);
}
exports.checkStringIsBase64Encoded = checkStringIsBase64Encoded;
// base64 encode a string
function encodeString(str) {
    const buff = Buffer.from(str, 'utf-8');
    return buff.toString('base64'); // decode buffer as Base64
}
exports.encodeString = encodeString;
// base64 decode a string
function decodeString(str) {
    const buff = Buffer.from(str, 'base64');
    return buff.toString();
}
exports.decodeString = decodeString;
// base 64 encode a number
function encodeNumber(num) {
    let hex = num.toString(16);
    if (hex.length % 2 == 1) {
        hex = '0' + hex;
    } // keep hex strings even length
    const buff = Buffer.from(hex, "hex");
    return buff.toString('base64'); // decode buffer as Base64
}
exports.encodeNumber = encodeNumber;
// base 64 decode a number
function decodeNumber(str) {
    const buff = Buffer.from(str, 'base64');
    const hex = buff.toString('hex'); // decode buffer as hex
    return parseInt("0x" + hex, 16); // return base 10 int of hex
}
exports.decodeNumber = decodeNumber;
