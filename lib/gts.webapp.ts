import axios from 'axios';
import getMAC, { isMAC } from 'getmac'
const BECH32 = require('bech32');

// reference to other files
export * as UUID from "./gts.uuid";
export * as DBCore from "./gts.db";
export * as WS from "./gts.webserver";
export * as Threading from "./gts.threading";

// Define HashTables by using index signature. Each entry of the hashtable will have a string key and a value of type T
export interface HashTable<T> {
	[key: string]: T;
}

// use setTimeout to introduce a delay in code
export function delay(ms:number):Promise<void>{
	return new Promise(resolve => setTimeout(resolve, ms));
}

// holds a promise to wait for, and the ability to cancel the delay the promise is waiting for
export class CancellableDelay{
	delayTimeout:NodeJS.Timeout;
	p:Promise<void>;
	constructor(pDelayTimeout:NodeJS.Timeout, pPromise:Promise<void>){
		this.delayTimeout = pDelayTimeout;
		this.p = pPromise;
	}
}

// use setTimeout to introduce a delay in code that can be cancelled
export async function delayCancellable(ms:number):Promise<CancellableDelay>{
	// ability to cancel the timeout, init to a dummy value to allow code to compile
	var delayTimeout:NodeJS.Timeout = setTimeout(()=>null,1);
	// the promise that resolves when the timeout is done, init to a dummy value to allow code to compile
	var delayPromise:Promise<void> = Promise.resolve();
	// set the real values for delayTimeout and delayPromise
	var promiseTimeoutSet:Promise<void> = new Promise(function(resolveTimeoutSet:Function, rejectTimeoutSet:Function){
		delayPromise = new Promise(function(resolve, reject){delayTimeout = setTimeout(resolve, ms); resolveTimeoutSet();});
	});
	// wait for the real values to be set to return
	await promiseTimeoutSet;
	// return the results
	return new CancellableDelay(delayTimeout, delayPromise);	
}

export function getServerMAC(){
	return getMAC();
}

// Allow extra info to be stored about a string value
export class TypedStringVal{
	type:string = '';
	value:string = '';
}

// Allow a result to be wrapped with error information (if there was an error, and a message)
export class WrappedResult<T>{
	error: boolean;
	message: string;
	data: T|null;
	constructor(){
		this.error=true;
		this.message = 'WrappedResult default constructor values';
		this.data = null;
	}
	setVals(pError:boolean, pMessage:string, pData:T):WrappedResult<T>{
		this.error = pError;
		this.message = pMessage;
		this.data = pData;
		return this;
	}
	setError(pMessage:string):WrappedResult<T>{
		this.error = true;
		this.message = pMessage;
		return this;
	}
	setData(pData:T):WrappedResult<T>{
		this.error = false;
		this.message = 'Data Set';
		this.data = pData;
		return this;
	}
	setNoData():WrappedResult<T>{
		this.error = false;
		this.message = 'No Data Set';
		this.data = null;
		return this;
	}
}

// Allow the population of data to say if its valid
export class CheckedValue<T>{
	isValid: boolean;
	value: T;
	constructor(pIsValid:boolean, pValue:T){
		this.isValid = pIsValid;
		this.value = pValue;
	}
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

// Get JSON from a web resource
export async function fetchJSON<T>(url: string): Promise<WrappedResult<T>>{
	let retval: WrappedResult<T> = new WrappedResult();			// prepare data structure for response. Use setError and setData to send result
	
	// fetch the json
	try {
		let res = await axios({
			url: url,
			method: 'get',
			timeout: 8000,
			headers: {
				'Content-Type': 'application/json',
			}
		});
		if(res.status == 200 && res.data){
			retval.setData(res.data);
			return retval;
		} else {
			console.error(`Could not get url ${url}, response code was ${res.status}`);
			return retval.setError(`Could not get url ${url}, response code was ${res.status}`);
		}
	} catch (err) {
		console.error(`Could not get url ${url}, error was ${err}`);
		return retval.setError(`Could not get url ${url}, error was ${err}`);
	}
}

export async function sendTelegramMessage(msg: string): Promise<WrappedResult<Telegram.SendMessageResult>>{
	let response:WrappedResult<Telegram.SendMessageResult> = await fetchJSON<Telegram.SendMessageResult>('https://api.telegram.org/bot***REMOVED***/sendMessage?chat_id=***REMOVED***&text='+encodeURIComponent(msg));
	if(response.error){
		return response;
	}
	return response;
}

export namespace Telegram {
	export interface SendMessageResult {
		ok: boolean;
		result: Result;
	}
	 export interface Result {
		message_id: number;
		sender_chat: SenderChat;
		chat: Chat;
		date: number;
		text: string;
	}
	 export interface SenderChat {
		id: number;
		title: string;
		username: string;
		type: string;
	}
	export interface Chat {
		id: number;
		title: string;
		username: string;
		type: string;
	}
}

export namespace DateTime{
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
	export function decodeString(hex:string): WrappedResult<string>{
		if(!hex || hex.length%2 !=0){
			return new WrappedResult<string>().setError('invalid hex provided to decodeString');
		}
		var str = '';
		try{
			for (var n = 0; n < hex.length; n += 2) {
				str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
			}
		} catch(err) {
			return new WrappedResult<string>().setError('error decoding hex encoded string\r\n'+err);
		}
		return new WrappedResult<string>().setData(str);
	 }
	 
	 export function encodeString(str:string):string{
		const buff = Buffer.from(str, 'utf-8');
		let hex:string = buff.toString('hex');		// decode buffer as hex
		if(hex.length%2==1){hex='0'+hex;}	// keep hex strings even length
		return hex;
	 }

	 // decode a number from hex encoding
	 export function decodeNumber(hex:string): WrappedResult<number>{
		 if(!hex || hex.length%2 !=0){
			return new WrappedResult<number>().setError('invalid hex provided to decodeNumber');
		}
		let num:number = NaN;
		try{
			num = parseInt("0x"+hex, 16);
		} catch(err) {
			return new WrappedResult<number>().setError('error decoding hex encoded number\r\n'+err);
		}
		 return new WrappedResult<number>().setData(num);
	 }
	 
	 export function encodeNumber(num:number):string{
		let hex:string = num.toString(16);
		if(hex.length%2==1){hex='0'+hex;}	// keep hex strings even length
		return hex;
	 }
	 
	 // Try to auto guess what type to decode hex as
	export function autoDecodeValueFromHex(hex: string): TypedStringVal{
		// test for empty string
		if(hex.length==0){ return {type:'empty', value:''}; }
		// test is valid hex
		if(!checkStringIsHexEncoded(hex)){ return {type:'error', value:'input not hex'}; }
		// test if value is hex encoded address
		if(hex.length==64){
			let decodedAddress:WrappedResult<string> = AddressUtils.convertAddressHexToBech32(hex);
			if(!decodedAddress.error && decodedAddress.data != null && AddressUtils.checkAddressStringIsBech32(decodedAddress.data!)){ return {type:'address', value:decodedAddress.data!}; }
		}
		// test if hex decoded value looks like printable ascii string
		let str:WrappedResult<string> =  HexUtils.decodeString(hex);
		if(!str.error && str.data != null && StringUtils.checkStringIsAsciiPrintable(str.data!)){ return {type:'string', value:str.data!}; }
		// test if hex decoded value looks like a number
		let decodeNum:WrappedResult<number> = HexUtils.decodeNumber(hex);
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
		let decodedNumber:WrappedResult<number> = decodeNumber(hex);
		if(decodedNumber.error){
			retval.number = -1;
		} else {
			retval.number = decodedNumber.data==null?-1:decodedNumber.data;
		}
		let decodedAddress:WrappedResult<string> = AddressUtils.convertAddressHexToBech32(hex);
		if(decodedAddress.error){
			retval.address = '';
		} else {
			retval.address = decodedAddress.data==null?'':decodedAddress.data;
		}
		let decodedString:WrappedResult<string> = decodeString(hex);
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
}

export namespace AddressUtils{
	// check if an address looks to be valid bech32
	export function checkAddressStringIsBech32( bech32: string ): boolean{
		let addressPattern = /^erd1[a-z0-9]{58}$/;
		return addressPattern.test(bech32);
	}
	
	// convert hex into a bech32 address
	export function convertAddressHexToBech32( hex:string ):WrappedResult<string>{
		if(hex.length!=64){return new WrappedResult<string>().setError('inavlid hex length');}
		try{
			let buf = Buffer.from(hex, "hex");
			let words = BECH32.bech32.toWords(buf);
			let address = BECH32.bech32.encode('erd', words);
			return new WrappedResult<string>().setData(address);
		} catch( err ){
			return new WrappedResult<string>().setError('error coverting hex to bech32\r\n'+err);
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
