import * as GTS from "./gts";
export declare function checkAddressStringIsBech32(bech32: string): boolean;
export declare function convertAddressHexToBech32(hex: string): GTS.DM.WrappedResult<string>;
export declare function convertAddressBech32ToHex(address: string): string;
export declare function convertAddressBase64ToBech32(base64: string): any;
export declare function checkAddressHexIsSC(hex: string): boolean;
