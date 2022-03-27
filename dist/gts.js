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
exports.DM = exports.DateTimeUtils = exports.StringUtils = exports.AddressUtils = exports.HexUtils = exports.Base64Utils = void 0;
// provide utility functions
exports.Base64Utils = __importStar(require("./gts.utils.base64"));
exports.HexUtils = __importStar(require("./gts.utils.hex"));
exports.AddressUtils = __importStar(require("./gts.utils.address"));
exports.StringUtils = __importStar(require("./gts.utils.string"));
exports.DateTimeUtils = __importStar(require("./gts.utils.datetime"));
// Data Model of generic types
var DM;
(function (DM) {
    // Allow extra info to be stored about a string value,		loosely typed subclassing of string
    class TypedStringVal {
        constructor() {
            this.type = '';
            this.value = '';
        }
    }
    DM.TypedStringVal = TypedStringVal;
    // Allow a result to be typed data wrapped with error information (data, if there was an error, and a message)
    class WrappedResult {
        // initially the result is an error that it still has default values, call one of its set functions after initialising
        constructor() {
            this.error = true;
            this.message = 'WrappedResult default constructor values';
            this.data = null;
        }
        // set that the result is an error and include an error message
        setError(pMessage) {
            this.error = true;
            this.message = pMessage;
            return this;
        }
        // set that the result is success and return the data
        setData(pData) {
            this.error = false;
            this.message = 'Data Set';
            this.data = pData;
            return this;
        }
        // set that the result is success and return no data
        setNoData() {
            this.error = false;
            this.message = 'No Data Set';
            this.data = null;
            return this;
        }
        // set all four values, use to include a message with data, or data with an error
        setVals(pError, pMessage, pData) {
            this.error = pError;
            this.message = pMessage;
            this.data = pData;
            return this;
        }
    }
    DM.WrappedResult = WrappedResult;
    // Allow a result to be a typed value wrapped with if the value is valid (eg is provided in the request stream)
    class CheckedValue {
        constructor(pIsValid, pValue) {
            this.isValid = pIsValid;
            this.value = pValue;
        }
    }
    DM.CheckedValue = CheckedValue;
})(DM = exports.DM || (exports.DM = {}));
