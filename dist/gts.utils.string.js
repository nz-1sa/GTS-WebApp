"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeNewLines = exports.escapeDoubleQuotes = exports.checkStringIsInteger = exports.checkStringIsAsciiPrintable = void 0;
// true if all characters in a string as ascii prinatble (codes 32 - 126)
function checkStringIsAsciiPrintable(str) {
    for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        if (code < 32 || code > 126) {
            return false;
        }
    }
    return true;
}
exports.checkStringIsAsciiPrintable = checkStringIsAsciiPrintable;
// true if is a string representation of an integer 
function checkStringIsInteger(num) {
    let regex = /^[0-9]+$/;
    return regex.test(num);
}
exports.checkStringIsInteger = checkStringIsInteger;
// return a new string where all double quotes are backslash encoded
function escapeDoubleQuotes(obj) {
    let str = typeof (obj === 'string') ? obj : obj.toString();
    return str.split('"').join('\\"');
}
exports.escapeDoubleQuotes = escapeDoubleQuotes;
// return a new string where all newlines are backslash encoded
function escapeNewLines(obj) {
    let str = typeof (obj === 'string') ? obj : obj.toString();
    return str.split('\r\n').join('\\r\\n');
}
exports.escapeNewLines = escapeNewLines;
