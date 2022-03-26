const BECH32 = require('bech32');

export namespace DateTimeUtils{
	// show the timestamp  as yyyy/MM/dd HH:mm:ss		timestamp is in seconds since epoch, eg elrond timestamp
	export function timestampToDateString(timestamp: number): string{
		var d = new Date(0); // The 0 there is the key, which sets the date to the epoch
		d.setUTCSeconds(timestamp);
		return dateToString(d);
	}

	// show the date  as yyyy/MM/dd HH:mm:s
	export function dateToString(d: Date): string{
		return ''.concat(
			d.getFullYear().toString(),'/',('0'+(1 + d.getMonth()).toString()).slice(-2),'/',('0'+d.getDate().toString()).slice(-2),' ',
			('0'+d.getHours().toString()).slice(-2),':',('0'+d.getMinutes().toString()).slice(-2),':',('0'+d.getSeconds().toString()).slice(-2));
	}
}

export namespace Base64Utils{
	// check that a base64 string looks legit
	export function checkStringIsBase64Encoded( base64test: string): boolean{
		let base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
		return base64Pattern.test(base64test);
	}

	// base64 decode a string
	export function decodeString(str:string):string{
		const buff = Buffer.from(str, 'base64');
		return buff.toString();
	}
	
	// base64 encode a string
	export function encodeString(str:string):string{
		const buff = Buffer.from(str, 'utf-8');
		return buff.toString('base64');		// decode buffer as Base64
	}
	
	// base 64 encode a number
	export function encodeNumber(num:number):string{
		let hex:string = num.toString(16);
		if(hex.length%2==1){hex='0'+hex;}	// keep hex strings even length
		const buff = Buffer.from(hex, "hex");
		return buff.toString('base64');		// decode buffer as Base64
	}
	
	// base 64 decode a number
	export function decodeNumber(str:string):number{
		const buff = Buffer.from(str, 'base64');
		const hex = buff.toString('hex');		// decode buffer as hex
		return parseInt("0x"+hex, 16)			// return base 10 int of hex
	}
}

export namespace HexUtils{
	// test that string is hex encoded
	export function checkStringIsHexEncoded(hex: string): boolean{
		let regexHex = /^[0-9a-fA-F]+$/;
		return hex.length%2 == 0 && regexHex.test(hex);
	}

	// test that string is an @ seperated list of hex encoded strings
	export function checkStringIsHexEncodedList(hexlist:string):boolean{
		let regexDataPattern = /^(([0-9a-fA-F]{2})*|@)*$/;
		return regexDataPattern.test(hexlist);
	}

	// decode a string from hex encoding
	export function decodeString(hex:string): DM.WrappedResult<string>{
		if(!hex || hex.length%2 !=0){
			return new DM.WrappedResult<string>().setError('invalid hex provided to decodeString');
		}
		var str = '';
		try{
			for (var n = 0; n < hex.length; n += 2) {
				str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
			}
		} catch(err) {
			return new DM.WrappedResult<string>().setError('error decoding hex encoded string\r\n'+err);
		}
		return new DM.WrappedResult<string>().setData(str);
	 }
	 
	 export function encodeString(str:string):string{
		const buff = Buffer.from(str, 'utf-8');
		let hex:string = buff.toString('hex');		// decode buffer as hex
		if(hex.length%2==1){hex='0'+hex;}	// keep hex strings even length
		return hex;
	 }

	 // decode a number from hex encoding
	 export function decodeNumber(hex:string): DM.WrappedResult<number>{
		 if(!hex || hex.length%2 !=0){
			return new DM.WrappedResult<number>().setError('invalid hex provided to decodeNumber');
		}
		let num:number = NaN;
		try{
			num = parseInt("0x"+hex, 16);
		} catch(err) {
			return new DM.WrappedResult<number>().setError('error decoding hex encoded number\r\n'+err);
		}
		 return new DM.WrappedResult<number>().setData(num);
	 }
	 
	 export function encodeNumber(num:number):string{
		let hex:string = num.toString(16);
		if(hex.length%2==1){hex='0'+hex;}	// keep hex strings even length
		return hex;
	 }
	 
	 // Try to auto guess what type to decode hex as
	export function autoDecodeValueFromHex(hex: string): DM.TypedStringVal{
		// test for empty string
		if(hex.length==0){ return {type:'empty', value:''}; }
		// test is valid hex
		if(!checkStringIsHexEncoded(hex)){ return {type:'error', value:'input not hex'}; }
		// test if value is hex encoded address
		if(hex.length==64){
			let decodedAddress:DM.WrappedResult<string> = AddressUtils.convertAddressHexToBech32(hex);
			if(!decodedAddress.error && decodedAddress.data != null && AddressUtils.checkAddressStringIsBech32(decodedAddress.data!)){ return {type:'address', value:decodedAddress.data!}; }
		}
		// test if hex decoded value looks like printable ascii string
		let str:DM.WrappedResult<string> =  HexUtils.decodeString(hex);
		if(!str.error && str.data != null && StringUtils.checkStringIsAsciiPrintable(str.data!)){ return {type:'string', value:str.data!}; }
		// test if hex decoded value looks like a number
		let decodeNum:DM.WrappedResult<number> = HexUtils.decodeNumber(hex);
		if(!decodeNum.error && decodeNum.data != null){
			return {type:'decimal', value:decodeNum.data!.toString(10)};
		}
		// return the hex if we can't decode it
		return {type:'hex', value:hex};
	}
	
	export function multiDecodeHex(hex: string):HexDecoded{
		let retval:HexDecoded = new HexDecoded();
		let isValidHex:boolean = checkStringIsHexEncoded(hex);
		if(!isValidHex){
			retval.string = hex;
			return retval;
		}
		retval.hex = hex;
		let decodedNumber:DM.WrappedResult<number> = decodeNumber(hex);
		if(decodedNumber.error){
			retval.number = -1;
		} else {
			retval.number = decodedNumber.data==null?-1:decodedNumber.data;
		}
		let decodedAddress:DM.WrappedResult<string> = AddressUtils.convertAddressHexToBech32(hex);
		if(decodedAddress.error){
			retval.address = '';
		} else {
			retval.address = decodedAddress.data==null?'':decodedAddress.data;
		}
		let decodedString:DM.WrappedResult<string> = decodeString(hex);
		if(decodedString.error){
			retval.string = '';
		} else {
			retval.string = decodedString.data==null?'':decodedString.data!;
		}
		// include an escaped copy of the string if it includes non ascii printable characters
		if(!StringUtils.checkStringIsAsciiPrintable(retval.string)){
			retval.escaped = escape(retval.string);
		}
		return retval;
	}
	
	export class HexDecoded{
		hex: string = '';
		number: number = -1;
		address: string = '';
		string: string = '';
		escaped: string = '';
	}
	HexDecoded.prototype.toString = function(){
		let properties:string[] = [];
		if(this.hex.length>0){properties.push(`"hex":"${this.hex}"`);}
		if(this.number>=0){properties.push(`"number":${this.number.toString()}`);}
		if(this.address.length>0){properties.push(`"address":"${this.address}"`);}
		if(this.string.length>0){properties.push(`"string":"${this.string}"`);}
		if(this.escaped.length>0){properties.push(`"escaped":"${this.escaped}"`);}
		return `{${properties.join(',')}}`;
	}
}

export namespace AddressUtils{
	// check if an address looks to be valid bech32
	export function checkAddressStringIsBech32( bech32: string ): boolean{
		let addressPattern = /^erd1[a-z0-9]{58}$/;
		return addressPattern.test(bech32);
	}
	
	// convert hex into a bech32 address
	export function convertAddressHexToBech32( hex:string ):DM.WrappedResult<string>{
		if(hex.length!=64){return new DM.WrappedResult<string>().setError('inavlid hex length');}
		try{
			let buf = Buffer.from(hex, "hex");
			let words = BECH32.bech32.toWords(buf);
			let address = BECH32.bech32.encode('erd', words);
			return new DM.WrappedResult<string>().setData(address);
		} catch( err ){
			return new DM.WrappedResult<string>().setError('error coverting hex to bech32\r\n'+err);
		}
	}

	// convert a bech32 address into hex
	export function convertAddressBech32ToHex( address:string ){
		let obj = BECH32.bech32.decode( address );
		let buff = Buffer.from(BECH32.bech32.fromWords(obj.words));
		return buff.toString('hex');
	}

	// convert a base64 encoded address into bech32
	export function convertAddressBase64ToBech32( base64:string ){
		let buff = Buffer.from(base64, 'base64');
		let words = BECH32.bech32.toWords(buff);
		let address = BECH32.bech32.encode('erd', words);
		return address;
	}

	export function checkAddressHexIsSC( hex: string ): boolean{
		return hex.startsWith("0".repeat(16));
	}
}

export namespace StringUtils{
	export function checkStringIsAsciiPrintable(str: string): boolean{
		for(let i=0;i<str.length;i++){
			let code = str.charCodeAt(i);
			if(code < 32 || code > 126){ return false; }
		}
		return true;
	}
	
	export function checkStringIsInteger(num:string): boolean{
		let regex = /^[0-9]+$/;
		return regex.test(num);
	}

	export function escapeDoubleQuotes(obj:any){
		let str:string = typeof(obj==='string')?obj:obj.toString();
		return str.split('"').join('\\"');
	}

	export function escapeNewLines(obj:any){
		let str:string = typeof(obj==='string')?obj:obj.toString();
		return str.split('\r\n').join('\\r\\n');
	}
}

// Data Model
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