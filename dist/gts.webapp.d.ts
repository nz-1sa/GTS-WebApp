/// <reference types="node" />
export * as UUID from "./gts.uuid";
export * as DBCore from "./gts.db";
export * as WS from "./gts.webserver";
export * as Threading from "./gts.threading";
export interface HashTable<T> {
    [key: string]: T;
}
export declare function delay(ms: number): Promise<void>;
export declare class CancellableDelay {
    delayTimeout: NodeJS.Timeout;
    p: Promise<void>;
    constructor(pDelayTimeout: NodeJS.Timeout, pPromise: Promise<void>);
}
export declare function delayCancellable(ms: number): Promise<CancellableDelay>;
export declare function getServerMAC(): string;
export declare class TypedStringVal {
    type: string;
    value: string;
}
export declare class WrappedResult<T> {
    error: boolean;
    message: string;
    data: T | null;
    constructor();
    setVals(pError: boolean, pMessage: string, pData: T): WrappedResult<T>;
    setError(pMessage: string): WrappedResult<T>;
    setData(pData: T): WrappedResult<T>;
    setNoData(): WrappedResult<T>;
}
export declare class CheckedValue<T> {
    isValid: boolean;
    value: T;
    constructor(pIsValid: boolean, pValue: T);
}
export declare class HexDecoded {
    hex: string;
    number: number;
    address: string;
    string: string;
    escaped: string;
}
export declare function fetchJSON<T>(url: string): Promise<WrappedResult<T>>;
export declare function sendTelegramMessage(msg: string): Promise<WrappedResult<Telegram.SendMessageResult>>;
export declare namespace Telegram {
    interface SendMessageResult {
        ok: boolean;
        result: Result;
    }
    interface Result {
        message_id: number;
        sender_chat: SenderChat;
        chat: Chat;
        date: number;
        text: string;
    }
    interface SenderChat {
        id: number;
        title: string;
        username: string;
        type: string;
    }
    interface Chat {
        id: number;
        title: string;
        username: string;
        type: string;
    }
}
export declare namespace DateTime {
    function timestampToDateString(timestamp: number): string;
    function dateToString(d: Date): string;
}
export declare namespace Base64Utils {
    function checkStringIsBase64Encoded(base64test: string): boolean;
    function decodeString(str: string): string;
    function encodeString(str: string): string;
    function encodeNumber(num: number): string;
    function decodeNumber(str: string): number;
}
export declare namespace HexUtils {
    function checkStringIsHexEncoded(hex: string): boolean;
    function checkStringIsHexEncodedList(hexlist: string): boolean;
    function decodeString(hex: string): WrappedResult<string>;
    function encodeString(str: string): string;
    function decodeNumber(hex: string): WrappedResult<number>;
    function encodeNumber(num: number): string;
    function autoDecodeValueFromHex(hex: string): TypedStringVal;
    function multiDecodeHex(hex: string): HexDecoded;
}
export declare namespace AddressUtils {
    function checkAddressStringIsBech32(bech32: string): boolean;
    function convertAddressHexToBech32(hex: string): WrappedResult<string>;
    function convertAddressBech32ToHex(address: string): string;
    function convertAddressBase64ToBech32(base64: string): any;
    function checkAddressHexIsSC(hex: string): boolean;
}
export declare namespace StringUtils {
    function checkStringIsAsciiPrintable(str: string): boolean;
    function checkStringIsInteger(num: string): boolean;
    function escapeDoubleQuotes(obj: any): string;
    function escapeNewLines(obj: any): string;
}
