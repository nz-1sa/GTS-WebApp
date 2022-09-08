import axios from 'axios';
import getMAC, { isMAC } from 'getmac'
import * as GTS from "./gts";

// provide code from GTS core files
export * as GTS from "./gts";
export * as UUID from "./gts.uuid";
export * as DBCore from "./gts.db";
export * as WS from "./gts.webserver";
export * as Threading from "./gts.threading";
export * as Captcha from "./gts.captcha";
export * as Encodec from "./gts.encodec";

// quicker reference to commly used types
export {WebResponse} from "./gts.webserver";
export class WrappedResult<T> extends GTS.DM.WrappedResult<T> {};

// Provide access to the MAC address of the server (used to give guids cross server uniqueness)
export function getServerMAC(){
	return getMAC();
}

// Get JSON from a web resource
export async function fetchJSON<T>(url: string): Promise<GTS.DM.WrappedResult<T>>{
	let retval: GTS.DM.WrappedResult<T> = new GTS.DM.WrappedResult();			// prepare data structure for response. Use setError and setData to send result
	
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

export namespace Telegram {
	// send a telegram message
	export async function sendMessage(msg:string, token:string, chatid:string): Promise<GTS.DM.WrappedResult<DM.SendMessageResult>>{
		let response:GTS.DM.WrappedResult<DM.SendMessageResult> = await fetchJSON<DM.SendMessageResult>(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatid}&text=${encodeURIComponent(msg)}`);
		if(response.error){
			return response;
		}
		return response;
	}

	// Data Model
	export namespace DM{
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
}


