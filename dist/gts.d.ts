export * as Base64Utils from "./gts.utils.base64";
export * as HexUtils from "./gts.utils.hex";
export * as AddressUtils from "./gts.utils.address";
export * as StringUtils from "./gts.utils.string";
export * as DateTimeUtils from "./gts.utils.datetime";
export declare namespace DM {
    interface HashTable<T> {
        [key: string]: T;
    }
    type JSONValue = string | number | boolean | null | JSONValue[] | {
        [key: string]: JSONValue;
    };
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
