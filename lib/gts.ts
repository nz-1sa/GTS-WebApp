// provide utility functions
export * as Base64Utils from "./gts.utils.base64";
export * as HexUtils from "./gts.utils.hex"
export * as AddressUtils from "./gts.utils.address";
export * as StringUtils from "./gts.utils.string";
export * as DateTimeUtils from "./gts.utils.datetime";

// Data Model of generic types
export namespace DM{
	// Define HashTables by using index signature. Each entry of the hashtable will have a string key and a value of type T
	export interface HashTable<T> {
		[key: string]: T;
	}

	// Allow extra info to be stored about a string value,		loosely typed subclassing of string
	export class TypedStringVal{
		type:string = '';
		value:string = '';
	}

	// Allow a result to be typed data wrapped with error information (data, if there was an error, and a message)
	export class WrappedResult<T>{
		error: boolean;		// if there was an error
		message: string;	// description of the error, free use if result is not an error
		data: T|null;			// the data being returned if there is any
		
		// initially the result is an error that it still has default values, call one of its set functions after initialising
		constructor(){
			this.error=true;
			this.message = 'WrappedResult default constructor values';
			this.data = null;
		}
		
		// set that the result is an error and include an error message
		setError(pMessage:string):WrappedResult<T>{
			this.error = true;
			this.message = pMessage;
			return this;
		}
		
		// set that the result is success and return the data
		setData(pData:T):WrappedResult<T>{
			this.error = false;
			this.message = 'Data Set';
			this.data = pData;
			return this;
		}
		
		// set that the result is success and return no data
		setNoData():WrappedResult<T>{
			this.error = false;
			this.message = 'No Data Set';
			this.data = null;
			return this;
		}
		
		// set all four values, use to include a message with data, or data with an error
		setVals(pError:boolean, pMessage:string, pData:T):WrappedResult<T>{
			this.error = pError;
			this.message = pMessage;
			this.data = pData;
			return this;
		}
	}
	
	// Allow a result to be a typed value wrapped with if the value is valid (eg is provided in the request stream)
	export class CheckedValue<T>{
		isValid: boolean;
		value: T;
		constructor(pIsValid:boolean, pValue:T){
			this.isValid = pIsValid;
			this.value = pValue;
		}
	}
}