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