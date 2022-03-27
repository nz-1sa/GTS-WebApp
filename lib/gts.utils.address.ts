const BECH32 = require('bech32');
import * as GTS from "./gts";

// check if an address looks to be valid bech32
export function checkAddressStringIsBech32( bech32: string ): boolean{
	let addressPattern = /^erd1[a-z0-9]{58}$/;
	return addressPattern.test(bech32);
}

// convert hex into a bech32 address
export function convertAddressHexToBech32( hex:string ):GTS.DM.WrappedResult<string>{
	if(hex.length!=64){return new GTS.DM.WrappedResult<string>().setError('inavlid hex length');}
	try{
		let buf = Buffer.from(hex, "hex");
		let words = BECH32.bech32.toWords(buf);
		let address = BECH32.bech32.encode('erd', words);
		return new GTS.DM.WrappedResult<string>().setData(address);
	} catch( err ){
		return new GTS.DM.WrappedResult<string>().setError('error coverting hex to bech32\r\n'+err);
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

// smart contracts can be identified by thier address
export function checkAddressHexIsSC( hex: string ): boolean{
	return hex.startsWith("0".repeat(16));
}