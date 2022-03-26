export declare namespace DateTimeUtils {
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
    function decodeString(hex: string): DM.WrappedResult<string>;
    function encodeString(str: string): string;
    function decodeNumber(hex: string): DM.WrappedResult<number>;
    function encodeNumber(num: number): string;
    function autoDecodeValueFromHex(hex: string): DM.TypedStringVal;
    function multiDecodeHex(hex: string): HexDecoded;
    class HexDecoded {
        hex: string;
        number: number;
        address: string;
        string: string;
        escaped: string;
    }
}
export declare namespace AddressUtils {
    function checkAddressStringIsBech32(bech32: string): boolean;
    function convertAddressHexToBech32(hex: string): DM.WrappedResult<string>;
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
export declare namespace DM {
    interface HashTable<T> {
        [key: string]: T;
    }
    class TypedStringVal {
        type: string;
        value: string;
    }
    class WrappedResult<T> {
        error: boolean;
        message: string;
        data: T | null;
        constructor();
        setError(pMessage: string): WrappedResult<T>;
        setData(pData: T): WrappedResult<T>;
        setNoData(): WrappedResult<T>;
        setVals(pError: boolean, pMessage: string, pData: T): WrappedResult<T>;
    }
    class CheckedValue<T> {
        isValid: boolean;
        value: T;
        constructor(pIsValid: boolean, pValue: T);
    }
}
