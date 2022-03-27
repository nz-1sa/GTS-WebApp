import * as GTS from "./gts";
export declare function checkStringIsHexEncoded(hex: string): boolean;
export declare function checkStringIsHexEncodedList(hexlist: string): boolean;
export declare function encodeString(str: string): string;
export declare function decodeString(hex: string): GTS.DM.WrappedResult<string>;
export declare function encodeNumber(num: number): string;
export declare function decodeNumber(hex: string): GTS.DM.WrappedResult<number>;
export declare function autoDecodeValueFromHex(hex: string): GTS.DM.TypedStringVal;
export declare function multiDecodeHex(hex: string): DM.HexDecoded;
export declare namespace DM {
    class HexDecoded {
        hex: string;
        number: number;
        address: string;
        string: string;
        escaped: string;
    }
}
