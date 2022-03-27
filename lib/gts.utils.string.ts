// true if all characters in a string as ascii prinatble (codes 32 - 126)
export function checkStringIsAsciiPrintable(str: string): boolean{
	for(let i=0;i<str.length;i++){
		let code = str.charCodeAt(i);
		if(code < 32 || code > 126){ return false; }
	}
	return true;
}

// true if is a string representation of an integer 
export function checkStringIsInteger(num:string): boolean{
	let regex = /^[0-9]+$/;
	return regex.test(num);
}

// return a new string where all double quotes are backslash encoded
export function escapeDoubleQuotes(obj:any){
	let str:string = typeof(obj==='string')?obj:obj.toString();
	return str.split('"').join('\\"');
}

// return a new string where all newlines are backslash encoded
export function escapeNewLines(obj:any){
	let str:string = typeof(obj==='string')?obj:obj.toString();
	return str.split('\r\n').join('\\r\\n');
}