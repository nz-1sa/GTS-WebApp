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
exports.checkAddressHexIsSC = exports.convertAddressBase64ToBech32 = exports.convertAddressBech32ToHex = exports.convertAddressHexToBech32 = exports.checkAddressStringIsBech32 = void 0;
const BECH32 = require('bech32');
const GTS = __importStar(require("./gts"));
// check if an address looks to be valid bech32
function checkAddressStringIsBech32(bech32) {
    let addressPattern = /^erd1[a-z0-9]{58}$/;
    return addressPattern.test(bech32);
}
exports.checkAddressStringIsBech32 = checkAddressStringIsBech32;
// convert hex into a bech32 address
function convertAddressHexToBech32(hex) {
    if (hex.length != 64) {
        return new GTS.DM.WrappedResult().setError('inavlid hex length');
    }
    try {
        let buf = Buffer.from(hex, "hex");
        let words = BECH32.bech32.toWords(buf);
        let address = BECH32.bech32.encode('erd', words);
        return new GTS.DM.WrappedResult().setData(address);
    }
    catch (err) {
        return new GTS.DM.WrappedResult().setError('error coverting hex to bech32\r\n' + err);
    }
}
exports.convertAddressHexToBech32 = convertAddressHexToBech32;
// convert a bech32 address into hex
function convertAddressBech32ToHex(address) {
    let obj = BECH32.bech32.decode(address);
    let buff = Buffer.from(BECH32.bech32.fromWords(obj.words));
    return buff.toString('hex');
}
exports.convertAddressBech32ToHex = convertAddressBech32ToHex;
// convert a base64 encoded address into bech32
function convertAddressBase64ToBech32(base64) {
    let buff = Buffer.from(base64, 'base64');
    let words = BECH32.bech32.toWords(buff);
    let address = BECH32.bech32.encode('erd', words);
    return address;
}
exports.convertAddressBase64ToBech32 = convertAddressBase64ToBech32;
// smart contracts can be identified by thier address
function checkAddressHexIsSC(hex) {
    return hex.startsWith("0".repeat(16));
}
exports.checkAddressHexIsSC = checkAddressHexIsSC;
