import * as GTS from "./gts";
import * as DBCore from "./gts.db";
import * as UUID from "./gts.uuid";
import * as WS from "./gts.webserver";
import * as Express from 'express';
import *  as WebApp from './gts.webapp';
import {Concurrency} from './gts.concurrency';
var crypto = require('crypto');
import * as Encodec from './gts.encodec';

const ejs = require('ejs');
const GIFEncoder = require('gifencoder');
const { createCanvas } = require('canvas');
const fs = require('fs');

export function attachWebInterface(web:WS.WebServerHelper, webapp:Express.Application):void{
		
	// login.ejs will serve from public files as /login
	
	// a captcha is shown as part of starting a session
	web.registerHandlerGet(webapp, '/api/startSession', [], async function(uuid:string, url:string, requestIp:string, cookies:GTS.DM.HashTable<string>){
		return await handleStartSessionRequest(uuid, requestIp, cookies);
	});
	
	// login by ident, password, and captcha
	web.registerHandlerPost(webapp, '/api/login', ['ident','challenge'], async function(uuid:string, url:string, requestIp:string, cookies:GTS.DM.HashTable<string>, ident:string, challenge:string){
		return await handleLoginRequest(uuid, requestIp, cookies, ident, challenge);
	});
	
	// log out of account
	web.registerHandlerPost(webapp, '/api/logout', ['challenge'], async function(uuid:string, url:string, requestIp:string, cookies:GTS.DM.HashTable<string>, challenge:string){
		return await handleLogoutRequest(uuid, requestIp, cookies, challenge);
	});
	
	// get current talk sequence for account
	web.registerHandlerPost(webapp, '/api/curSeq', ['challenge'], async function(uuid:string, url:string, requestIp:string, cookies:GTS.DM.HashTable<string>, challenge:string){
		return await handleSequenceRequest(uuid, requestIp, cookies, challenge);
	});
	
	//NOTE: requests to the server must be received in sequence. Message is encrypted
	web.registerHandlerPost(webapp, '/api/talk', ['sequence','message'], async function(uuid:string, url:string, requestIp:string, cookies:GTS.DM.HashTable<string>, sequence:string, message:string){
		return await handleSecureTalk(web, uuid, requestIp, cookies, sequence, message);
	});
}

// establish a session to allow logging in
async function handleStartSessionRequest(uuid:string, requestIp:string, cookies:GTS.DM.HashTable<string>):Promise<WS.WebResponse>{
	console.log('in handleStartSessionRequest');
	const [hs, s] = await Session.hasSession(uuid, requestIp, cookies);
	//console.log('done hasSession check');
	if(hs && s){
		if(s!.status == SessionStatus.LoggedIn){
			console.log('already logged in');
			return new WS.WebResponse(true, "", `UUID:${uuid} Already logged in`,`Already logged in`, []);
		}
		console.log('early exit, session already intialised');
		return new WS.WebResponse(true, "", `UUID:${uuid} Request to start already initialised session ${cookies['session']}`,`<img src="/captchas/${cookies['session']}.gif">`, []);
	}
	
	let sessionId:string = await getSessionId(uuid,requestIp,cookies);
	if(sessionId.length==0){
		return new WS.WebResponse(false, "", `UUID:${uuid} Unable to initialse session`,`Unable to initialise session. Try again later.`, []);
	}
	
	//console.log('established session object');
	console.log('handleStartSessionRequest yields session '+sessionId);
	
	//console.log('new session being returned');
	return new WS.WebResponse(true, "", `UUID:${uuid} Captcha Drawn`,`<img src="/captchas/${sessionId}.gif">`, [new WS.Cookie('session',sessionId)]);
}

// get the id of a session. start a session if need be
export async function getSessionId(uuid:string, requestIp:string, cookies:GTS.DM.HashTable<string>):Promise<string>{
	const [hs, s] = await Session.hasSession(uuid, requestIp, cookies);
	if(hs && s){
		return s.sessionId;
	}
	// start a session
	let now:Date = new Date();
	const loopSafety:number = 20;
	let loopIteration:number = 1;
	let sessionId:string = uuid;
	while(!Session.isProposedSessionIdUnique(uuid, sessionId) && loopIteration<=loopSafety){
		console.log('handling sessionId clash');
		sessionId = await UUID.newUUID();
		loopIteration++;
	}
	if(loopIteration == loopSafety){
		console.log('loop safety break on session id generation');
		return '';
	}
	// new Session(pId:number, pSessionId:string, pCreated:Date, pLastSeen:Date, pIp:string, pStatus:number, pCaptcha:number, pNonceBase:number, pLogoutSeed:number, pSeqReqSeed:number, pPassword:string, pSeq:string, pChkSum:string
	let ns:Session = new Session(0, sessionId, now, now, requestIp, SessionStatus.Initialised, 0, 1, 1, 1, 'NONEnoneNONEnone', 1, 'NEWnewNEWnewNEWnewNEWnewNEW=');
	ns.addToDB(uuid);
	// create captcha and image to show it
	ns.initialiseCaptcha(uuid, sessionId);
	return sessionId;
}

// process login for a session
async function handleLoginRequest(uuid:string, requestIp:string, cookies:GTS.DM.HashTable<string>, ident:string, challenge:string):Promise<WS.WebResponse>{
	console.log('in handleLoginRequest');
	// check that there is an open session to log in to
	const [hs, s] = await Session.hasSession(uuid, requestIp, cookies);
	//console.log('done hasSession check');
	if(!hs || !s){
		console.log('returning no session error');
		return new WS.WebResponse(false, "ERROR: A session needs to be started before loggin in.", `UUID:${uuid} Login called before startSession`,'', []);
	}
	let sess:Session = s!;
	if(sess.ip != requestIp){
		console.log('wrong session ip');
		return new WS.WebResponse(false, "ERROR: Can not change IP during session.", `UUID:${uuid} Login called from wrong IP.`,'', []);
	}
	if(sess.status != SessionStatus.Initialised){
		console.log('wrong session state, only can login from Initialised');
		return new WS.WebResponse(false, "ERROR: Can only login to a session once", `UUID:${uuid} Can only login to a session once`,'', []);
	}
	
	// get login account from db
	let la:GTS.DM.WrappedResult<[string,string]> = await LoginAccount.getPassHash(uuid, ident);
	// la.error
	if(la.error){
		console.log('wrong email ident');
		return new WS.WebResponse(false, "ERROR: Login failed", `UUID:${uuid} Login failed, incorrect email ident`,'', []);
	}
	console.log(la);
	let accountSessionId:string = la.data![1];
	
	if(accountSessionId.length > 0){
		let doReject:boolean = false;
		if(accountSessionId == sess.sessionId){
			console.log('error, how can account be assigned to us when we are not logged in yet (trying to do so)');
			doReject = true;
		} else {
			console.log('login already attached to a different session');
			await Session.expireOldSessionsInDB(uuid);
			let rs:GTS.DM.WrappedResult<Session> = await Session.getSessionFromDB(uuid, accountSessionId);
			if(rs.error){
				console.log('error getting attached session');
				console.log(rs.message);
				doReject = true;
			} else {
				let s:Session = rs.data!;
				if(s.status == SessionStatus.LoggedOut || s.status == SessionStatus.Expired){
					console.log('clearing logged out or expired session');
					LoginAccount.setActiveSessionId(uuid,ident,'');	// clear active session if is for a logged out or expired session
				} else {
					console.log('attached session is ');
					console.log(s);
					doReject = true;
				}
			}
		}
		if(doReject){
			return new WS.WebResponse(false, "ERROR: Login failed", `UUID:${uuid} Login failed, is already active`,'', []);
		}
	}
	let knownSaltPassHash: string = la.data![0];
	console.log('using hash from db');
	console.log({knownSaltPassHash:knownSaltPassHash, captcha:sess.captcha, challenge:challenge});
	
	// decrypt challenge using knownSaltPassHash and captcha
	let decoded:string = Encodec.decrypt(challenge, knownSaltPassHash, sess.captcha);
	
	console.log({decoded:decoded});
	
	if(!new RegExp("^[0-9]+$", "g").test(decoded)){
		console.log('failed regex check');
		return new WS.WebResponse(false, "ERROR: Login failed.", `UUID:${uuid} Login failed, decoded content failed regex check.`,'', []);
	}
	// verify decrypted challenge content
	if( parseInt(decoded) == NaN ){
		console.log('failed NaN check');
		return new WS.WebResponse(false, "ERROR: Login failed.", `UUID:${uuid} Login failed, invalid decoded content.`,'', []);
	}
	let now:number = new Date().getTime();
	let timeDiff= now-parseInt(decoded);
	//console.log({now:now, timeDiff:timeDiff});
	if(timeDiff < 0 || timeDiff > 20000 ){	// request must arrive within 20 seconds
		console.log('failed Date check');
		return new WS.WebResponse(false, "ERROR: Login failed.", `UUID:${uuid} Login failed, request to old.`,'', []);
	}
	
	// generate password and nonce base (offset) for the session
	//console.log('setting session credentials');
	sess.status = SessionStatus.LoggedIn;
	sess.password = await Session.genSessionPassword();
	sess.nonceBase = Math.floor(1+Math.random()*483600);
	sess.logoutSeed = Math.floor(1+Math.random()*483600);
	sess.seqReqSeed = Math.floor(1+Math.random()*483600);
	sess.seq = 1;
	sess.updateDB(uuid);
	//console.log({sess:sess});
	
	// show that the login is in use (prevent dual login)
	LoginAccount.setActiveSessionId(uuid,ident,sess.sessionId);
	
	// encrypt and return to client the password to use for the session, and the nonce base to start sequence from
	let plainTextResponse = new Date().getTime().toString()+JSON.stringify({p:sess.password, n:sess.nonceBase, l:sess.logoutSeed, r:sess.seqReqSeed});
	//console.log({plainTextResponse:plainTextResponse});
	let encResponse = Encodec.encrypt(plainTextResponse, knownSaltPassHash, sess.captcha);
	//console.log({encResponse:encResponse});
	return new WS.WebResponse(true, "", `UUID:${uuid} Login success`, `"${encResponse}"`);
}

// process logout for a session
async function handleLogoutRequest(uuid:string, requestIp:string, cookies:GTS.DM.HashTable<string>, challenge:string):Promise<WS.WebResponse>{
	console.log('in handleLogoutRequest');
	// check that there is an open session to log out from
	const [hs, s] = await Session.hasSession(uuid, requestIp, cookies);
	if(!hs || !s){
		return new WS.WebResponse(false, "ERROR: A session needs to be started before logging out.", `UUID:${uuid} Logout called before startSession`,'', []);
	}
	let sess:Session = s!;
	if(sess.ip != requestIp){
		return new WS.WebResponse(false, "ERROR: Can only logout from logged in IP", `UUID:${uuid} Logout called from wrong IP.`,'', []);
	}
	if(sess.status != SessionStatus.LoggedIn){
		return new WS.WebResponse(false, "ERROR: Can only logout after loggin in", `UUID:${uuid} Logout called before login.`,'', []);
	}
	
	// decrypt challenge using session password and logoutSeed instead of sequence (allows always to logout, even if lose track of sequence at client)
	let decoded:string = Encodec.decrypt(challenge, sess.password, sess.logoutSeed);
	
	if(!new RegExp("^[0-9]+$", "g").test(decoded)){
		console.log('failed regex check');
		return new WS.WebResponse(false, "ERROR: Logout failed.", `UUID:${uuid} Logout failed, decoded content failed regex check.`,'', []);
	}
	// verify decrypted challenge content
	if( parseInt(decoded) == NaN ){
		console.log('failed NaN check');
		return new WS.WebResponse(false, "ERROR: Logout failed.", `UUID:${uuid} Logout failed, invalid decoded content.`,'', []);
	}
	let now:number = new Date().getTime();
	let timeDiff= now-parseInt(decoded);
	//console.log({now:now, timeDiff:timeDiff});
	if(timeDiff < 0 || timeDiff > 20000 ){	// request must arrive within 20 seconds
		console.log('failed Date check');
		return new WS.WebResponse(false, "ERROR: Logout failed.", `UUID:${uuid} Logout failed, request to old.`,'', []);
	}
	
	sess.status = SessionStatus.LoggedOut;
	sess.updateDB(uuid);
	
	// encrypt and return to client the current time to allow checking for valid response
	let plainTextResponse = new Date().getTime().toString();
	//console.log({plainTextResponse:plainTextResponse});
	let encResponse = Encodec.encrypt(plainTextResponse, sess.password, sess.logoutSeed);
	//console.log({encResponse:encResponse});
	return new WS.WebResponse(true, "", `UUID:${uuid} Logout success`, `"${encResponse}"`);
}

async function handleSequenceRequest(uuid:string, requestIp:string, cookies:GTS.DM.HashTable<string>, challenge:string):Promise<WS.WebResponse>{
	console.log('handleSequenceRequest');
	// check that there is an open session to request sequence for
	const [hs, s] = await Session.hasSession(uuid, requestIp, cookies);
	if(!hs || !s){
		return new WS.WebResponse(false, "ERROR: A session needs to be started to have a seqeunce.", `UUID:${uuid} curSeq called before startSession`,'', []);
	}
	let sess:Session = s!;
	if(sess.ip != requestIp){
		return new WS.WebResponse(false, "ERROR: Can only get session from logged in IP", `UUID:${uuid} curSeq called from wrong IP.`,'', []);
	}
	if(sess.status != SessionStatus.LoggedIn){
		return new WS.WebResponse(false, "ERROR: Can only get session after loggin in", `UUID:${uuid} curSeq called before login.`,'', []);
	}
	
	//console.log('decoding seq request with');
	//console.log({p:sess.password, s:sess.seqReqSeed});
	
	// decrypt challenge using session password and seqReqSeed instead of sequence (cant expect them to know the sequence if calling curSeq)
	let decoded:string = Encodec.decrypt(challenge, sess.password, sess.seqReqSeed);
	
	if(!new RegExp("^[0-9]+$", "g").test(decoded)){
		console.log('failed regex check');
		return new WS.WebResponse(false, "ERROR: Request Sequence failed.", `UUID:${uuid} curSeq failed, decoded content failed regex check.`,'', []);
	}
	// verify decrypted challenge content
	if( parseInt(decoded) == NaN ){
		console.log('failed NaN check');
		return new WS.WebResponse(false, "ERROR: Request Sequence failed.", `UUID:${uuid} curSeq failed, invalid decoded content.`,'', []);
	}
	let now:number = new Date().getTime();
	let timeDiff= now-parseInt(decoded);
	//console.log({now:now, timeDiff:timeDiff});
	if(timeDiff < 0 || timeDiff > 20000 ){	// request must arrive within 20 seconds
		console.log('failed Date check');
		return new WS.WebResponse(false, "ERROR: Request Sequence failed.", `UUID:${uuid} curSeq failed, request to old.`,'', []);
	}
	
	console.log('handleSequenceRequest yields '+sess.seq);

	// encrypt and return to client the current sequence to use for talking, and a date check of the response
	let plainTextResponse =  new Date().getTime().toString()+JSON.stringify({seq:sess.seq.toString()});
	//console.log({plainTextResponse:plainTextResponse});
	let encResponse = Encodec.encrypt(plainTextResponse, sess.password, sess.seqReqSeed);
	//console.log({encResponse:encResponse});
	return new WS.WebResponse(true, "", `UUID:${uuid} curSeq success`, `"${encResponse}"`);
}

// secure talk within a session
async function handleSecureTalk(web:WS.WebServerHelper, uuid:string, requestIp:string, cookies:GTS.DM.HashTable<string>, sequence:string, message:string):Promise<WS.WebResponse>{
	console.log('handleSecureTalk');
	const [hs, s] = await Session.hasSession(uuid, requestIp, cookies);
	if(!hs){
		console.log('reject, no session');
		return new WS.WebResponse(false, "ERROR: Need to have session first.", `UUID:${uuid} Attempted session talk before session start`,'', []);
	}
	if(!s){
		console.log('reject, error getting session');
		return new WS.WebResponse(false, "ERROR: Failed to connect to session.", `UUID:${uuid} Error getting session from DB`,'', []);
	}
	let sess:Session = s!;
	if(sess.ip != requestIp){
		console.log('reject, ip changed');
		return new WS.WebResponse(false, "ERROR: Can not change IP during session.", `UUID:${uuid} Talk called from wrong IP.`,'', []);
	}
	if(sess.status != SessionStatus.LoggedIn){
		console.log('reject, not logged in');
		return new WS.WebResponse(false, "ERROR: Need to login first.", `UUID:${uuid} Attempted session talk before login`,'', []);
	};
	if(!new RegExp("^[0-9]+$", "g").test(sequence)){
		console.log('reject, failed sequence regex');
		return new WS.WebResponse(false, "ERROR: Invalid sequence.", `UUID:${uuid} Secure Talk sequence fails regex check`,'', []);
	}
	let iSequence:number = parseInt(sequence);
	if(iSequence < s.seq){
		console.log('reject, seqeunce too low');
		return new WS.WebResponse(false, "ERROR: Invalid sequence.", `UUID:${uuid} Secure Talk sequence is less than expected session sequence`,'', []);
	}
	if(iSequence > s.seq+10){
		console.log('reject, sequence too high');
		return new WS.WebResponse(false, "ERROR: Invalid sequence.", `UUID:${uuid} Secure Talk sequence is too large (10+ expected)`,'', []);
	}
	
	// by getting to here there is a logged in session
	let doLogSequenceCheck = true;
	let retval:WS.WebResponse = new WS.WebResponse(false,'ERROR Unset return value',`UUID:${uuid} Unknown error`, '', []);
	await Concurrency.doSequencedJob<WS.WebResponse>(sess.sessionId, iSequence, async function(purpose:string, seqNum:number, dbId:string):Promise<WS.WebResponse>{ // dbId:string is uuid as param to async func,  'talkSession'+ id for purpose
		console.log('OAAT_SEQJOB talking at number #'+seqNum);
		//console.log({pass:sess.password, nonce:sess.nonceBase+seqNum});
		
		// decrypt challenge using knownSaltPassHash and captcha
		let decoded:string = Encodec.decrypt(message, sess.password, (sess.nonceBase+seqNum));
		const [action,params] = JSON.parse(decoded);
		console.log('OAAT_SEQJOB request received for '+action);
		
		if(!web.adminHandlers[action]){
			console.log('OAAT_SEQJOB reject, invalid admin action specified');
			return new WS.WebResponse(false,'ERROR: Undefined admin action',`UUID:${dbId} Missing admin action {action}`,`""`,[]);
		}
		
		let adminResp:WS.WebResponse = await web.adminHandlers[action](dbId, requestIp, cookies, params);
		//console.log('admin response is');
		//console.log(adminResp);
		
		return adminResp;
		
		
	}, [uuid], Session.checkAndIncrementSequenceInDB, [uuid])
		// WS.WebResponse(pSuccess:boolean, pErrorMessage:string, pLogMessage:string, pData:string, pSetCookies?: Cookie[])
		.then((adminResponse:WS.WebResponse) => {
			let plainTextResponse =  new Date().getTime().toString()+adminResponse.toString();
			retval = new WS.WebResponse(true, '', `UUID:${uuid} Secure Talk done`, `"${Encodec.encrypt(plainTextResponse,sess.password, (sess.nonceBase+iSequence))}"`, []);
		} )
		.catch((err:any) => {
			console.log('sequence talk error');
			console.log(err);
			let errMsg:string = '';
			if((err as string).startsWith && (err as string).startsWith('Seq Check Error')){
				errMsg = 'ERROR: Seq Check Error'; 
			} else if(err =='timedout'){
				errMsg = 'ERROR: Timedout Before Start';
			} else {
				errMsg = 'ERROR: Secure Talk Error';
			}
			retval = new WS.WebResponse(false, errMsg, `UUID:${uuid} ERROR: Secure Talk. ${err}`,'', []);
		} );
		
	//console.log('retval for secureTalk is '+retval.toString());
	return retval;
}

export enum SessionStatus{
	Initialised = 1,
	LoggedIn = 2,
	LoggedOut = 3,
	Expired = 4
}

export class Session{
	id: number;
	sessionId: string;
	created: Date;
	lastSeen: Date;
	ip: string;
	status: SessionStatus;
	captcha: number;
	nonceBase: number;
	logoutSeed: number;
	seqReqSeed: number;
	password: string;
	seq: number;
	chkSum: string;
	constructor(pId:number, pSessionId:string, pCreated:Date, pLastSeen:Date, pIp:string, pStatus:SessionStatus, pCaptcha:number, pNonceBase:number, pLogoutSeed:number, pSeqReqSeed:number, pPassword:string, pSeq:number, pChkSum:string){
		this.id = pId;
		this.sessionId = pSessionId;
		this.created = pCreated;
		this.lastSeen = pLastSeen;
		this.ip = pIp;
		this.status = pStatus;
		this.captcha = pCaptcha;
		this.nonceBase = pNonceBase;
		this.logoutSeed = pLogoutSeed;
		this.seqReqSeed = pSeqReqSeed;
		this.password = pPassword;
		this.seq = pSeq;
		this.chkSum = pChkSum;
	}
	
	// base64 sha1 hash of the session's values (excludes id and chkSum).  Can compare .genHash() with .chkSum to test for if changed
	genHash(): string{
		var j = JSON.stringify({sessionId:this.sessionId,created:this.created,lastSeen:this.lastSeen,ip:this.ip,status:this.status,captcha:this.captcha,nonceBase:this.nonceBase,logoutSeed:this.logoutSeed,seqReqSeed:this.seqReqSeed,password:this.password,seq:this.seq});
		var hsh = crypto.createHash('sha1').update(j).digest('base64');
		return hsh;
	}
	
	// cast session as a JSON string
	toString(): string{
		return JSON.stringify(this.toJSON());
	}
	
	// cast session as a JSON object
	toJSON(): object{
		return {id:this.id.toString(),sessionId:this.sessionId,created:this.created.toString(),lastSeen:this.lastSeen.toString(),ip:this.ip,status:this.status.toString(),captcha:this.captcha.toString(),nonceBase:this.nonceBase.toString(),logoutSeed:this.logoutSeed.toString(),seqReqSeed:this.seqReqSeed.toString(),password:this.password,seq:this.seq.toString(),chkSum:this.chkSum};
	}
	
	// casted value checks for allowed values in a session
	verifyValuesAreValid(): [boolean, string]{
		let errDesc:string = '';
		var idIsValid = (this.id >= 0 && this.id <= 2147483600); if( !idIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for id.'; }
		var sessionIdIsValid = (this.sessionId.length >= 36 && this.sessionId.length <= 36); if( !sessionIdIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for sessionId.'; }
		var createdIsValid = (true); if( !createdIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for created.'; }
		var lastSeenIsValid = (true); if( !lastSeenIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for lastSeen.'; }
		var ipIsValid = (this.ip.length >= 3 && this.ip.length <= 39); if( !ipIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for ip.'; }
		var statusIsValid = ([1,2,3,4].indexOf(this.status) >= 0); if( !statusIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for status.'; }
		var captchaIsValid = (this.captcha >= 1 && this.captcha <= 999); if( !captchaIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for captcha.'; }
		var nonceBaseIsValid = (this.nonceBase >= 1 && this.nonceBase <= 2147483600); if( !nonceBaseIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for nonceBase.'; }
		var logoutSeedIsValid = (this.logoutSeed >= 1 && this.logoutSeed <= 2147483600); if( !logoutSeedIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for logoutSeed.'; }
		var seqReqSeedIsValid = (this.seqReqSeed >= 1 && this.seqReqSeed <= 2147483600); if( !seqReqSeedIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for seqReqSeed.'; }
		var passwordIsValid = (this.password.length >= 16 && this.password.length <= 16); if( !passwordIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for password.'; }
		var seqIsValid = (this.seq >= 0); if( !seqIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for seq.'; }
		var chkSumIsValid = (true); if( !chkSumIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for chkSum.'; }
		return [idIsValid && sessionIdIsValid && createdIsValid && lastSeenIsValid && ipIsValid && statusIsValid && captchaIsValid && nonceBaseIsValid && passwordIsValid && seqIsValid && chkSumIsValid, errDesc];
	}
	
	// instantiate a session from string values. Null returned if sting values fail regex checks or casted value checks
	static fromStrings( id: string, sessionId: string, created: string, lastSeen: string, ip: string, status: string, captcha: string, nonceBase: string, logoutSeed: string, seqReqSeed: string, password: string, seq: string, chkSum: string ): Session|null{
		let regexTests: boolean[] = [new RegExp("^[0-9]+$", "g").test(id), new RegExp("^[A-Za-z\. \-,0-9=+/]+$", "g").test(sessionId), new RegExp("^[0-9]{4}-[0-9]{2}-[0-9][0-9]? [0-9]{2}:[0-9]{2}(?::[0-9]{2})$", "g").test(created), new RegExp("^[0-9]{4}-[0-9]{2}-[0-9][0-9]? [0-9]{2}:[0-9]{2}(?::[0-9]{2})$", "g").test(lastSeen), new RegExp("^[A-Za-z\. \-,0-9=+/]+$", "g").test(ip), new RegExp("^[0-9]+$", "g").test(status), new RegExp("^[0-9]+$", "g").test(captcha), new RegExp("^[0-9]+$", "g").test(nonceBase), new RegExp("^[0-9]+$", "g").test(logoutSeed), new RegExp("^[0-9]+$", "g").test(seqReqSeed), new RegExp("^[A-Za-z\. \-,0-9=+/]+$", "g").test(password), new RegExp("^[0-9]+$", "g").test(seq), new RegExp("^[a-zA-Z0-9/+]{26}[a-zA-Z0-9/+=]{2}$", "g").test(chkSum)];
		if(!regexTests.every(Boolean)){
			// detail invalid value
			let paramNames: string[] = ["id", "sessionId", "created", "lastSeen", "ip", "status", "captcha", "nonceBase", "logoutSeed", "seqReqSeed", "password", "seq", "chkSum"];
			for(var i=0; i<regexTests.length; i++){
				if(!regexTests[i]){
					console.log('posted value for '+paramNames[i]+' fails regex check');
				}
			}
			return null;
		}
		let session:Session = new Session(parseInt(id), (sessionId), new Date(created), new Date(lastSeen), (ip), parseInt(status), parseInt(captcha), parseInt(nonceBase), parseInt(logoutSeed), parseInt(seqReqSeed), (password), parseInt(seq), (chkSum));
		let valueCheck = session.verifyValuesAreValid();
		let success = valueCheck[0];
		if(success){
			return session;
		}
		let errMsg = valueCheck[1]; console.log(errMsg);
		return null;
	}
	
	static async isProposedSessionIdUnique(uuid:string, sessionId:string): Promise<GTS.DM.WrappedResult<boolean>>{
		let retval: GTS.DM.WrappedResult<boolean> = new GTS.DM.WrappedResult();
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection( 'Session.isProposedSessionIdUnique', uuid );
		if( fetchConn.error ){ return retval.setError( 'DB Connection error\n' + fetchConn.message ); }
		if( fetchConn.data == null ){ return retval.setError( 'DB Connection NULL error' ); }
		let client:DBCore.Client = fetchConn.data;
		const res = await client.query( 'SELECT id FROM sessions WHERE sessionId = $1;',[sessionId] );
		return retval.setData( res.rowCount == 0 );
	}
	
	// expire old sessions
	static async expireOldSessionsInDB(uuid:string): Promise<GTS.DM.WrappedResult<boolean>>{
		//console.log('in expireOldSessionsInDB');
		let retval: GTS.DM.WrappedResult<boolean> = new GTS.DM.WrappedResult();
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection( 'Session.expireOldSessionsInDB', uuid );
		if( fetchConn.error ) { console.log('db error '+fetchConn.message); return retval.setError( 'DB Connection error\n' + fetchConn.message ); }
		if( fetchConn.data == null ){ console.log('db error, null connection returned'); return retval.setError( 'DB Connection NULL error' ); }
		let client:DBCore.Client = fetchConn.data;
		//console.log('got db client');
		const res = await client.query( 'UPDATE sessions SET status = 4 WHERE status < 3 AND EXTRACT(EPOCH FROM (now() - lastseen)) > 600;' );
		//console.log('awaited db query');
		return retval.setData( res.rowCount == 0 );
	}
	
	// update session seen
	static async updateSessionLastSeenInDB(uuid:string, sessionId:string): Promise<GTS.DM.WrappedResult<boolean>>{
		//console.log('in updateSessionLastSeenInDB');
		let retval: GTS.DM.WrappedResult<boolean> = new GTS.DM.WrappedResult();
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection( 'Session.updateSessionLastSeenInDB', uuid );
		if( fetchConn.error ) { console.log('db error '+fetchConn.message); return retval.setError( 'DB Connection error\n' + fetchConn.message ); }
		if( fetchConn.data == null ){ console.log('db error, null connection returned'); return retval.setError( 'DB Connection NULL error' ); }
		let client:DBCore.Client = fetchConn.data;
		//console.log('got db client');
		const res = await client.query( 'UPDATE sessions SET lastseen = now() WHERE sessionId = $1;',[sessionId] );
		//console.log('awaited db query');
		return retval.setData( res.rowCount == 0 );
	}
	
	// get a session from the database for the specified sessionId
	static async getSessionFromDB(uuid:string, sessionId:string): Promise<GTS.DM.WrappedResult<Session>>{
		//console.log('in getSessionFromDB');
		let retval: GTS.DM.WrappedResult<Session> = new GTS.DM.WrappedResult();
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection( 'Session.getSessionFromDB', uuid );
		if( fetchConn.error ) { console.log('db error '+fetchConn.message); return retval.setError( 'DB Connection error\n' + fetchConn.message ); }
		if( fetchConn.data == null ){ console.log('db error, null connection returned'); return retval.setError( 'DB Connection NULL error' ); }
		let client:DBCore.Client = fetchConn.data;
		//console.log('got db client');
		const res = await client.query( 'SELECT id, created, lastSeen, ip, status, captcha, nonceBase, logoutSeed, seqReqSeed, password, seq, chkSum FROM sessions WHERE sessionId = $1;',[sessionId] );
		//console.log('awaited db query');
		if( res.rowCount == 0 ) { console.log('session not found.'); return retval.setError( 'Session not found.' ); }
		let s:Session = new Session( res.rows[0].id, sessionId, res.rows[0].created, res.rows[0].lastseen, res.rows[0].ip, res.rows[0].status, res.rows[0].captcha, res.rows[0].noncebase, res.rows[0].logoutseed, res.rows[0].seqreqseed, res.rows[0].password, res.rows[0].seq, res.rows[0].chksum);
		// console.log('got session object from db');
		// console.log(s);
		//TODO: update last seen
		return retval.setData( s );
	}
	
	// function is like Concurrency.inMemorySequenceTracking, but tracks sequence in session table of db rather than in memory
	static async checkAndIncrementSequenceInDB(sessionId:string, reqSequence:number, uuid:string): Promise<GTS.DM.WrappedResult<string>>{
		let retval: GTS.DM.WrappedResult<string> = new GTS.DM.WrappedResult();
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> =  await DBCore.getConnection('Session.checkAndIncrementSequence', uuid);
		if(fetchConn.error){ return retval.setError('DB Connection error\n'+fetchConn.message); }
		if(fetchConn.data == null){ return retval.setError('DB Connection NULL error'); }
		let client:DBCore.Client = fetchConn.data;
		const res = await client.query('CALL checkAndIncrementSessionSequence($1,$2,$3)',[sessionId,reqSequence,0]);
		if( res.rowCount == 0 ) { return retval.setError( 'checkAndIncrementSessionSequence failed.' ); }
		//console.log({test:'compare talk sequence with db session store', sessionId:sessionId, reqSequence:reqSequence, seqDiff:res.rows[0].doseq});
		if(res.rows[0].doseq==0){ return retval.setData("RunNow"); }
		if(res.rows[0].doseq < 0 && res.rows[0].doseq >= -10){ return retval.setData("RunSoon"); }
		return retval.setData("Invalid");
	}
	
	// list all the sessions from the database in full detail
	static async fetchAllFromDB(uuid:string): Promise<GTS.DM.WrappedResult<Session[]>> {
		let retval: GTS.DM.WrappedResult<Session[]> = new GTS.DM.WrappedResult();
		let retvalData: Session[] = [];
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection( 'Session.fetchAllFromDB', uuid );
		if( fetchConn.error ){ return retval.setError( 'DB Connection error\n' + fetchConn.message ); }
		if( fetchConn.data == null ){ return retval.setError( 'DB Connection NULL error' ); }
		let client:DBCore.Client = fetchConn.data;
		const res = await client.query( 'SELECT id, sessionId, created, lastSeen, ip, status, captcha, nonceBase, logoutSeed, seqReqSeed, password, seq, chkSum FROM sessions;' );
		if( res.rowCount == 0 ) { return retval.setData( retvalData ); }        // handle empty table
		for( let i = 0; i < res.rowCount; i++ ) {
			retvalData.push( new Session( res.rows[i].id, res.rows[i].sessionid, res.rows[i].created, res.rows[i].lastseen, res.rows[i].ip, res.rows[i].status, res.rows[i].captcha, res.rows[0].nonceBase, res.rows[0].logoutSeed, res.rows[0].seqReqSeed, res.rows[i].password, res.rows[i].seq, res.rows[i].chksum) );
		}
		return retval.setData( retvalData );
	}
	
	// add a session to the database, id is assigned as it is added
	async addToDB(uuid:string): Promise<GTS.DM.WrappedResult<null>> {
		let retval: GTS.DM.WrappedResult<null> = new GTS.DM.WrappedResult();
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection( 'Session.addToDB', uuid );
		if( fetchConn.error ){ return retval.setError( 'DB Connection error\n' + fetchConn.message ); }
		if( fetchConn.data == null ){ return retval.setError( 'DB Connection NULL error' ); }
		let client:DBCore.Client = fetchConn.data;
		this.chkSum = this.genHash();
		const res = await client.query( 'CALL addSession($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13);',[this.sessionId,this.created,this.lastSeen,this.ip,this.status,this.captcha,this.nonceBase,this.logoutSeed,this.seqReqSeed,this.password,this.seq,this.chkSum,0]);
		if( res.rowCount == 0 ) { return retval.setError( 'Session not added.' ); }
		this.id = res.rows[0].insertedid;
		return retval.setData( null );
	}
	
	// update a session in the database
	async updateDB(uuid:string): Promise<GTS.DM.WrappedResult<null>> {
		let retval: GTS.DM.WrappedResult<null> = new GTS.DM.WrappedResult();
		let fetchConn: GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection( 'Session.updateDB', uuid );
		if( fetchConn.error ){ return retval.setError( 'DB Connection error\n' + fetchConn.message ); }
		if( fetchConn.data == null ){ return retval.setError( 'DB Connection NULL error' ); }
		let client:DBCore.Client = fetchConn.data;
		let newChksum:string = this.genHash();
		const res = await client.query('CALL updateSession($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15);',[this.id,this.sessionId,this.created,this.lastSeen,this.ip,this.status,this.captcha,this.nonceBase,this.logoutSeed,this.seqReqSeed,this.password,this.seq,newChksum,this.chkSum,0]);
		if( res.rowCount == 0 ) { return retval.setError( 'Session not updated. 0 row count.' ); }
		if(res.rows[0].updatestatus == 0){ return retval.setError( 'Session not updated. ChkSum failed.' ); }
		this.chkSum = newChksum;
		return retval.setData(null);
	}
	
	// delete a session from the database
	async deleteFromDB(uuid:string): Promise<GTS.DM.WrappedResult<void>> {
		let retval: GTS.DM.WrappedResult<void> = new GTS.DM.WrappedResult();
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> =  await DBCore.getConnection('Session.deleteFromDB', uuid);
		if(fetchConn.error){ return retval.setError('DB Connection error\n'+fetchConn.message); }
		if(fetchConn.data == null){ return retval.setError('DB Connection NULL error'); }
		let client:DBCore.Client = fetchConn.data;
		await client.query('DELETE FROM sessions WHERE id=$1;',[this.id]);
		return retval.setData();
	}
	
	initialiseCaptcha(uuid:string, sessionId:string): void{
		// The questions that are asked
		const questionBase: string[]  = [
			"What number does ? represent\nin this animated seq:",
			"What number is coloured red\nin this animated seq:",
			"What number is coloured blue\nin this animated seq:"
		];
		
		// the captcha is initialised randomly
		function getRandom(min:number, max:number): number{
			return Math.floor(Math.random()*(max-min))+min;
		}
		
		// decide which question we are asking
		let questionId:number = getRandom(0,questionBase.length-1);
		
		const numberCount:number = 5;		// how many numbers are in the sequence
		const numWidth: number = 60;			// the amount of padding for each number
		const imgWidth:number = 380;			// width of the image to render
		const imgHeight:number = 100;			// height of the image to render
		const answerHorizOffset = 40;			// left indentation of the first answer number
		const answerVertOffset = 80;				// how far down the image the answer numbers are rendered
		
		// the animation will be of a number sequence with ? placed in it and will have two coloured numbers
		const sequenceIsAscending:boolean = (getRandom(0,1)==0);		// the sequence can go in two directions up (ascending) or down (descending)
		let minSeq:number = 1;						// the lowest value allowed to display
		let maxSeq:number = 999;					// the bigest value allowed to display
		// adjust min/max boundaries to ensure a sequence can't go past the above values
		if(sequenceIsAscending){maxSeq-=numberCount;}else{minSeq+=numberCount;}
		
		const start:number = getRandom(minSeq,maxSeq);						// produce a random number to start the sequence
		const unknownFrame:number = getRandom(1,numberCount-2);		// choose where our unkown number goes making sure it is not the first or last number of the sequence
		
		let redFrame:number = getRandom(0,numberCount-1);					// choose a number position to be red (eg 2nd number)
		while(redFrame==unknownFrame){												// ensure it is a different number to the one ? represents
			redFrame = getRandom(0,numberCount-1);
		}
		let blueFrame = getRandom(0,numberCount-1);							// choose a number position to be blue (eg 3rd number)
		while(blueFrame==unknownFrame|| blueFrame==redFrame){		// ensure it is a different number to the one ? represents, and the one that is red
			blueFrame = getRandom(0,numberCount-1);
		}
		
		// get the answer to the question
		let answer:number = 0;
		switch(questionId){
			case 0: // ?
				answer = start+(sequenceIsAscending?unknownFrame:unknownFrame*-1);
				break;
			case 1: // red
				answer = start+(sequenceIsAscending?redFrame:redFrame*-1);
				break;
			case 2: // blue
				answer = start+(sequenceIsAscending?blueFrame:blueFrame*-1);
				break;
		}
		
		// provide range checking on the answer
		let minCheckAllow:number = 1;
		let maxCheckAllow:number = 999;
		if(questionId==0){minCheckAllow=1;maxCheckAllow=998;} // reduce check range to ensure ? is not first or last character
		if(answer<minCheckAllow||answer>maxCheckAllow){
			console.log("invalid " + answer + "," +
				"questionId is " + questionId + "," +
				( sequenceIsAscending ? "sequence is ascending, " : "sequence is descending, " ) +
				"start is " + start + "," +
				"unknownFrame is " + unknownFrame + "," +
				"maxSeq is " + maxSeq + "," +
				"minSeq is " + minSeq);
			return;
		}
		
		// store the answer in the db for the session
		this.captcha = answer;
		this.updateDB(uuid);
		
		// start rendering the captcha animated gif
		const encoder = new GIFEncoder(imgWidth, imgHeight);
		encoder.start();
		encoder.setRepeat(0);   // 0 for repeat, -1 for no-repeat
		encoder.setDelay(1000);  // frame delay in ms
		encoder.setQuality(10); // image quality. 10 is default.

		// use node-canvas to draw each frame
		const canvas = createCanvas(imgWidth, imgHeight);
		const ctx = canvas.getContext('2d');
		
		// render a frame for each number
		for(var frameNum:number = 0; frameNum < numberCount; frameNum++){
			ctx.fillStyle = '#FFDEA6';
			ctx.fillRect(0, 0, imgWidth, imgHeight);
			ctx.font = "16px Courier New";
			ctx.fillStyle = '#000000';
			ctx.fillText(questionBase[questionId], 10, 30);
			ctx.font = "28px Courier New";
			ctx.fillStyle = '#000000';
			if(frameNum == redFrame){ ctx.fillStyle = '#FF0000'; }
			if(frameNum == blueFrame){ ctx.fillStyle = '#0000FF'; }
			let frameValue:string = (start + (sequenceIsAscending?frameNum:frameNum*-1)).toString();
			if(frameNum == unknownFrame){ frameValue = '?'; }
			ctx.fillText(frameValue, answerHorizOffset+(frameNum*numWidth), answerVertOffset);
			encoder.addFrame(ctx);
		}
		encoder.finish();
		const buf = encoder.out.getData();
		fs.writeFile(`public/captchas/${sessionId}.gif`, buf, function (err:any) {
			// animated GIF written
			if(err != null){
				console.log('error');
				console.log(err);
			}
		});
	}
	
	static async hasSession(uuid:string, requestIp:string, cookies:GTS.DM.HashTable<string>): Promise<[boolean,Session?]>{
		if(!cookies['session']){ console.log('no session cookie at hasSession check'); return [false,undefined]; }
		if(cookies['session'].length != 36){ console.log('incorrect session length at hasSession check'); return [false,undefined]; }
		
		await Session.expireOldSessionsInDB(uuid);
		let ws:GTS.DM.WrappedResult<Session> = await Session.getSessionFromDB(uuid, cookies['session']);
		if( ws.error ) { console.log('failed to get session from db '+ws.message ); return [false,undefined];}
		if( ws.data == null ) { console.log('null session from db'); return [false,undefined]; }
		
		let s: Session = ws.data;
		if(s.ip != requestIp){ console.log('ip mismatch at hasSession check'); return [false,undefined]; }
		if(s.status == SessionStatus.Expired){ console.log('expired session at hasSession check'); return [false,undefined]; }
		await Session.updateSessionLastSeenInDB(uuid, cookies['session']);
		return [true,s];
	}

	static async isLoggedIn(uuid:string, requestIp:string, cookies:GTS.DM.HashTable<string>): Promise<boolean>{
		const [hs, s] = await Session.hasSession(uuid, requestIp, cookies);
		if(!hs){ return false; }
		if(!s){ return false; }
		return (s!.status == SessionStatus.LoggedIn);
	}

	// generate a random characters of the 189 that can be seen, 67 of the possible 256 8bit characters are excluded.
	private static async randomPassChar(): Promise<string>{
		let x:number = Math.floor(Math.random()*222)+33;
		let prohibit:number[] = [127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,173];
		if(prohibit.indexOf(x) >= 0){ return Session.randomPassChar(); } // recurse to get different char if our random is prohibited
		return String.fromCharCode(x);
	}

	// generate a password to use for the session ot reduce the usage and hence attack surface of the users password
	static async genSessionPassword(){
		let passwordChars = new Array(16);
		async function assignRandomChar(index:number){
			passwordChars[index] = await Session.randomPassChar();
		}
		let promises = [];
		for(var i:number=0; i < passwordChars.length; i++){
			promises.push( assignRandomChar(i) );
		}
		await Promise.all(promises);
		return passwordChars.join('');
	}
}

export class LoginAccount{
	id: number;
	ident: string;
	email: string;
	passHash: string;
	activeSessionId: string;
	chkSum: string;
	constructor(pId?:number, pIdent?:string, pEmail?:string, pPassHash?:string, pActiveSessionId?:string, pChkSum?:string){
		this.id = pId ?? 0;
		this.ident = pIdent ?? '';
		this.email = pEmail ?? '';
		this.passHash = pPassHash ?? '';
		this.activeSessionId = pActiveSessionId ?? '';
		this.chkSum = pChkSum ?? '';
	}
	
	// base64 sha1 hash of the loginAccount's values (excludes id and chkSum).  Can compare .genHash() with .chkSum to test for if changed
	genHash(): string{
		var j = JSON.stringify({ident:this.ident,email:this.email,passHash:this.passHash,activeSessionId:this.activeSessionId});
		var hsh = crypto.createHash('sha1').update(j).digest('base64');
		return hsh;
	}
	
	// cast loginAccount as a JSON string
	toString(): string{
		return JSON.stringify(this.toJSON());
	}
	
	// cast loginAccount as a JSON object
	toJSON(): object{
		return {id:this.id.toString(),ident:this.ident,email:this.email,passHash:this.passHash,activeSessionId:this.activeSessionId,chkSum:this.chkSum};
	}
	
	// casted value checks for allowed values in a loginAccount
	verifyValuesAreValid(): [boolean, string]{
		let errDesc:string = '';
		var idIsValid = (this.id >= 0 && this.id <= 2147483600); if( !idIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for id.'; }
		var identIsValid = (this.ident.length >= 3 && this.ident.length <= 48); if( !identIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for ident.'; }
		var emailIsValid = (this.email.length >= 6 && this.email.length <= 100); if( !emailIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for email.'; }
		var passHashIsValid = (this.passHash.length >= 28 && this.passHash.length <= 28); if( !passHashIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for passHash.'; }
		var activeSessionIdIsValid = (this.activeSessionId.length >= 36 && this.activeSessionId.length <= 36); if( !activeSessionIdIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for activeSessionId.'; }
		var chkSumIsValid = (true); if( !chkSumIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for chkSum.'; }
		return [idIsValid && identIsValid && emailIsValid && passHashIsValid && activeSessionIdIsValid && chkSumIsValid, errDesc];
	}
	
	// instantiate a loginAccount from string values. Null returned if sting values fail regex checks or casted value checks
	static fromStrings( id: string, ident: string, email: string, passHash: string, activeSessionId: string, chkSum: string ): LoginAccount|null{
		let regexTests: boolean[] = [new RegExp("^[0-9]+$", "g").test(id), new RegExp("^([A-Za-z0-9+/]{4})+(([A-Za-z0-9+/]{3}=)|([A-Za-z0-9+/]{2}==))?$", "g").test(ident), new RegExp("^[A-Za-z\. \-,0-9=+/]+$", "g").test(email), new RegExp("^([A-Za-z0-9+/]{4})+(([A-Za-z0-9+/]{3}=)|([A-Za-z0-9+/]{2}==))?$", "g").test(passHash), new RegExp("^[A-Za-z\. \-,0-9=+/]+$", "g").test(activeSessionId), new RegExp("^[a-zA-Z0-9/+]{26}[a-zA-Z0-9/+=]{2}$", "g").test(chkSum)];
		if(!regexTests.every(Boolean)){
			// detail invalid value
			let paramNames: string[] = ["id", "ident", "email", "passHash", "activeSessionId", "chkSum"];
			for(var i=0; i<regexTests.length; i++){
				if(!regexTests[i]){
					console.log('posted value for '+paramNames[i]+' fails regex check');
				}
			}
			return null;
		}
		let loginAccount:LoginAccount = new LoginAccount(parseInt(id), (ident), (email), (passHash), (activeSessionId), (chkSum));
		let valueCheck = loginAccount.verifyValuesAreValid();
		let success = valueCheck[0];
		if(success){
			return loginAccount;
		}
		let errMsg = valueCheck[1]; console.log(errMsg);
		return null;
	}
	
	// list all the loginAccounts from the database in full detail
	static async fetchAllFromDB(uuid:string): Promise<GTS.DM.WrappedResult<LoginAccount[]>> {
		let retval: GTS.DM.WrappedResult<LoginAccount[]> = new GTS.DM.WrappedResult();
		let retvalData: LoginAccount[] = [];
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection( 'LoginAccount.fetchAllFromDB', uuid );
		if( fetchConn.error ){ return retval.setError( 'DB Connection error\n' + fetchConn.message ); }
		if( fetchConn.data == null ){ return retval.setError( 'DB Connection NULL error' ); }
		let client:DBCore.Client = fetchConn.data;
		const res = await client.query( 'SELECT id, ident, email, passHash, activeSessionId, chkSum FROM loginAccounts;' );
		if( res.rowCount == 0 ) { return retval.setData( retvalData ); }        // handle empty table
		for( let i = 0; i < res.rowCount; i++ ) {
			retvalData.push( new LoginAccount( res.rows[i].id, res.rows[i].ident, res.rows[i].email, res.rows[i].passhash, res.rows[i].activesessionid, res.rows[i].chksum) );
		}
		return retval.setData( retvalData );
	}
	
	// add a loginAccount to the database, id is assigned as it is added
	async addToDB(uuid:string): Promise<GTS.DM.WrappedResult<null>> {
		let retval: GTS.DM.WrappedResult<null> = new GTS.DM.WrappedResult();
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection( 'LoginAccount.addToDB', uuid );
		if( fetchConn.error ){ return retval.setError( 'DB Connection error\n' + fetchConn.message ); }
		if( fetchConn.data == null ){ return retval.setError( 'DB Connection NULL error' ); }
		let client:DBCore.Client = fetchConn.data;
		this.chkSum = this.genHash();
		const res = await client.query( 'CALL addLoginAccount($1,$2,$3,$4,$5,$6);',[this.ident,this.email,this.passHash,this.activeSessionId,this.chkSum,0]);
		if( res.rowCount == 0 ) { return retval.setError( 'LoginAccount not added.' ); }
		this.id = res.rows[0].insertedid;
		return retval.setData( null );
	}
	
	// update a loginAccount in the database
	async updateDB(uuid:string): Promise<GTS.DM.WrappedResult<null>> {
		let retval: GTS.DM.WrappedResult<null> = new GTS.DM.WrappedResult();
		let fetchConn: GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection( 'LoginAccount.updateDB', uuid );
		if( fetchConn.error ){ return retval.setError( 'DB Connection error\n' + fetchConn.message ); }
		if( fetchConn.data == null ){ return retval.setError( 'DB Connection NULL error' ); }
		let client:DBCore.Client = fetchConn.data;
		let newChksum:string = this.genHash();
		const res = await client.query('CALL updateLoginAccount($1,$2,$3,$4,$5,$6,$7,$8);',[this.id,this.ident,this.email,this.passHash,this.activeSessionId,newChksum,this.chkSum,0]);
		if( res.rowCount == 0 ) { return retval.setError( 'LoginAccount not updated. 0 row count.' ); }
		if(res.rows[0].updatestatus == 0){ return retval.setError( 'LoginAccount not updated. ChkSum failed.' ); }
		this.chkSum = newChksum;
		return retval.setData(null);
	}
	
	// delete a loginAccount from the database
	async deleteFromDB(uuid:string): Promise<GTS.DM.WrappedResult<void>> {
		let retval: GTS.DM.WrappedResult<void> = new GTS.DM.WrappedResult();
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> =  await DBCore.getConnection('LoginAccount.deleteFromDB', uuid);
		if(fetchConn.error){ return retval.setError('DB Connection error\n'+fetchConn.message); }
		if(fetchConn.data == null){ return retval.setError('DB Connection NULL error'); }
		let client:DBCore.Client = fetchConn.data;
		await client.query('DELETE FROM loginAccounts WHERE id=$1;',[this.id]);
		return retval.setData();
	}
	
	static async getPassHash(uuid:string, ident:string): Promise<GTS.DM.WrappedResult<[string,string]>>{
		let retval: GTS.DM.WrappedResult<[string,string]> = new GTS.DM.WrappedResult();
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection( 'LoginAccount.getPassHash', uuid );
		if( fetchConn.error ){ return retval.setError( 'DB Connection error\n' + fetchConn.message ); }
		if( fetchConn.data == null ){ return retval.setError( 'DB Connection NULL error' ); }
		let client:DBCore.Client = fetchConn.data;
		const res = await client.query( 'SELECT passhash, activesessionid FROM loginAccounts WHERE ident = $1;',[ident] );
		if( res.rowCount == 0 ) { return retval.setError( 'Account not found.' ); }
		return retval.setData( [res.rows[0].passhash, res.rows[0].activesessionid] );
	}
	
	static async setActiveSessionId(uuid:string, ident:string, activesessionid:string): Promise<GTS.DM.WrappedResult<void>>{
		let retval: GTS.DM.WrappedResult<void> = new GTS.DM.WrappedResult();
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection( 'LoginAccount.getPassHash', uuid );
		if( fetchConn.error ){ return retval.setError( 'DB Connection error\n' + fetchConn.message ); }
		if( fetchConn.data == null ){ return retval.setError( 'DB Connection NULL error' ); }
		let client:DBCore.Client = fetchConn.data;
		const res = await client.query( 'UPDATE loginaccounts SET activesessionid=$1 WHERE ident=$2;',[activesessionid,ident]);
		if( res.rowCount == 0 ) { return retval.setError( 'LoginAccount not added.' ); }
		return retval.setData();
	}
}