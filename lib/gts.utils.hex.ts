import * as GTS from "./gts";

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

// encode a string in hex encoding
 export function encodeString(str:string):string{
	const buff = Buffer.from(str, 'utf-8');
	let hex:string = buff.toString('hex');		// decode buffer as hex
	if(hex.length%2==1){hex='0'+hex;}	// keep hex strings even length
	return hex;
 }

// decode a string from hex encoding
export function decodeString(hex:string): GTS.DM.WrappedResult<string>{
	if(!hex || hex.length%2 !=0){
		return new GTS.DM.WrappedResult<string>().setError('invalid hex provided to decodeString');
	}
	var str = '';
	try{
		for (var n = 0; n < hex.length; n += 2) {
			str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
		}
	} catch(err) {
		return new GTS.DM.WrappedResult<string>().setError('error decoding hex encoded string\r\n'+err);
	}
	return new GTS.DM.WrappedResult<string>().setData(str);
 }
 
 // represent a number as hex
  export function encodeNumber(num:number):string{
	let hex:string = num.toString(16);
	if(hex.length%2==1){hex='0'+hex;}	// keep hex strings even length
	return hex;
 }

 // decode a number from hex encoding
 export function decodeNumber(hex:string): GTS.DM.WrappedResult<number>{
	 if(!hex || hex.length%2 !=0){
		return new GTS.DM.WrappedResult<number>().setError('invalid hex provided to decodeNumber');
	}
	let num:number = NaN;
	try{
		num = parseInt("0x"+hex, 16);
	} catch(err) {
		return new GTS.DM.WrappedResult<number>().setError('error decoding hex encoded number\r\n'+err);
	}
	 return new GTS.DM.WrappedResult<number>().setData(num);
 }
 
 
 // Try to auto guess what type to decode hex as
export function autoDecodeValueFromHex(hex: string):GTS.DM.TypedStringVal{
	// test for empty string
	if(hex.length==0){ return {type:'empty', value:''}; }
	// test is valid hex
	if(!checkStringIsHexEncoded(hex)){ return {type:'error', value:'input not hex'}; }
	// test if value is hex encoded address
	if(hex.length==64){
		let decodedAddress:GTS.DM.WrappedResult<string> = GTS.AddressUtils.convertAddressHexToBech32(hex);
		if(!decodedAddress.error && decodedAddress.data != null && GTS.AddressUtils.checkAddressStringIsBech32(decodedAddress.data!)){ return {type:'address', value:decodedAddress.data!}; }
	}
	// test if hex decoded value looks like printable ascii string
	let str:GTS.DM.WrappedResult<string> =  decodeString(hex);
	if(!str.error && str.data != null && GTS.StringUtils.checkStringIsAsciiPrintable(str.data!)){ return {type:'string', value:str.data!}; }
	// test if hex decoded value looks like a number
	let decodeNum:GTS.DM.WrappedResult<number> = decodeNumber(hex);
	if(!decodeNum.error && decodeNum.data != null){
		return {type:'decimal', value:decodeNum.data!.toString(10)};
	}
	// return the hex if we can't decode it
	return {type:'hex', value:hex};
}

// try decoding hex as string, a number, and as an address
export function multiDecodeHex(hex: string):DM.HexDecoded{
	let retval:DM.HexDecoded = new DM.HexDecoded();
	let isValidHex:boolean = checkStringIsHexEncoded(hex);
	if(!isValidHex){
		retval.string = hex;
		return retval;
	}
	retval.hex = hex;
	let decodedNumber:GTS.DM.WrappedResult<number> = decodeNumber(hex);
	if(decodedNumber.error){
		retval.number = -1;
	} else {
		retval.number = decodedNumber.data==null?-1:decodedNumber.data;
	}
	let decodedAddress:GTS.DM.WrappedResult<string> = GTS.AddressUtils.convertAddressHexToBech32(hex);
	if(decodedAddress.error){
		retval.address = '';
	} else {
		retval.address = decodedAddress.data==null?'':decodedAddress.data;
	}
	let decodedString:GTS.DM.WrappedResult<string> = decodeString(hex);
	if(decodedString.error){
		retval.string = '';
	} else {
		retval.string = decodedString.data==null?'':decodedString.data!;
	}
	// include an escaped copy of the string if it includes non ascii printable characters
	if(!GTS.StringUtils.checkStringIsAsciiPrintable(retval.string)){
		retval.escaped = escape(retval.string);
	}
	return retval;
}

// Data Model
export namespace DM{
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