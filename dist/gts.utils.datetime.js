"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dateToString = exports.timestampToDateString = void 0;
// show the timestamp  as yyyy/MM/dd HH:mm:ss		timestamp is in seconds since epoch, eg elrond timestamp
function timestampToDateString(timestamp) {
    var d = new Date(0); // The 0 there is the key, which sets the date to the epoch
    d.setUTCSeconds(timestamp);
    return dateToString(d);
}
exports.timestampToDateString = timestampToDateString;
// show the date  as yyyy/MM/dd HH:mm:s
function dateToString(d) {
    return ''.concat(d.getFullYear().toString(), '/', ('0' + (1 + d.getMonth()).toString()).slice(-2), '/', ('0' + d.getDate().toString()).slice(-2), ' ', ('0' + d.getHours().toString()).slice(-2), ':', ('0' + d.getMinutes().toString()).slice(-2), ':', ('0' + d.getSeconds().toString()).slice(-2));
}
exports.dateToString = dateToString;
