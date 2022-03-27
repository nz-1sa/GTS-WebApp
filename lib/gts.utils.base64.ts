// check that a base64 string looks legit
export function checkStringIsBase64Encoded( base64test: string): boolean{
	let base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
	return base64Pattern.test(base64test);
}

// base64 encode a string
export function encodeString(str:string):string{
	const buff = Buffer.from(str, 'utf-8');
	return buff.toString('base64');		// decode buffer as Base64
}

// base64 decode a string
export function decodeString(str:string):string{
	const buff = Buffer.from(str, 'base64');
	return buff.toString();
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