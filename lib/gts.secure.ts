import * as GTS from "./gts";
import * as DBCore from "./gts.db";
import * as UUID from "./gts.uuid";
import * as WS from "./gts.webserver";
import * as Express from 'express';
import *  as WebApp from './gts.webapp';
import * as Threading from "./gts.threading";
var crypto = require('crypto');
import * as Encodec from './gts.encodec';

const GIFEncoder = require('gifencoder');
const { createCanvas } = require('canvas');
const fs = require('fs');

export function attachWebInterface(web:WS.WebServerHelper, webapp:Express.Application):void{
		
	// serve login page from project root
	webapp.get( '/login', ( req, res ) => res.sendFile( web.getFile( 'login.html' ) ) );
	
	// a captcha is shown as part of starting a session
	web.registerHandlerUnchecked(webapp, '/api/startSession', [], async function(uuid:string, requestIp:string, cookies:GTS.DM.HashTable<string>){
		return await handleStartSessionRequest(uuid, requestIp, cookies);
	});
	
	// login by email, password, and captcha
	//TODO: email should be SHA1 hash
	web.registerHandlerUnchecked(webapp, '/api/login', ['email','challenge'], async function(uuid:string, requestIp:string, cookies:GTS.DM.HashTable<string>, email:string, challenge:string){
		return await handleLoginRequest(uuid, requestIp, cookies, email, challenge);
	});
	
	//TODO: support log out
	
	//NOTE: requests to the server must be received in sequence. Message is encrypted
	web.registerHandlerUnchecked(webapp, '/api/talk', ['sequence','message'], async function(uuid:string, requestIp:string, cookies:GTS.DM.HashTable<string>, sequence:string, message:string){
		return await handleSecureTalk(web, uuid, requestIp, cookies, sequence, message);
	});
}

// establish a session to allow logging in
async function handleStartSessionRequest(uuid:string, requestIp:string, cookies:GTS.DM.HashTable<string>):Promise<WS.WebResponse>{
	const [hs, s] = await Session.hasSession(uuid, requestIp, cookies);
	if(hs && s){
		if(s!.status == SessionStatus.LoggedIn){
			return new WS.WebResponse(true, "", `UUID:${uuid} Already logged in`,`Already logged in`, []);
		}
		return new WS.WebResponse(true, "", `UUID:${uuid} Request to start already initialised session ${cookies['session']}`,`<img src="/captchas/${cookies['session']}.gif">`, []);
	}
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
		return new WS.WebResponse(false, "", `UUID:${uuid} Unable to initialse session`,`Unable to initialise session. Try again later.`, []);
	}
	// pId:number, pSessionId:string, pCreated:Date, pLastSeen:Date, pIp:string, pStatus:number, pCaptcha:number, pNonce:number, pPassword:string, pSeq:string, pChkSum:string
	let ns:Session = new Session(0, sessionId, now, now, requestIp, SessionStatus.Initialised, 0, 1, 'NONEnoneNONEnone', 1, 'NEWnewNEWnewNEWnewNEWnewNEW=');
	ns.addToDB(uuid);
	ns.initialiseCaptcha(uuid, sessionId);
	return new WS.WebResponse(true, "", `UUID:${uuid} Captcha Drawn`,`<img src="/captchas/${sessionId}.gif">`, [new WS.Cookie('session',sessionId)]);
}

// process login for a session
async function handleLoginRequest(uuid:string, requestIp:string, cookies:GTS.DM.HashTable<string>, email:string, challenge:string):Promise<WS.WebResponse>{
	// check that there is an open session to log in to
	const [hs, s] = await Session.hasSession(uuid, requestIp, cookies);
	if(!hs || !s){
		return new WS.WebResponse(false, "ERROR: A session needs to be started before loggin in.", `UUID:${uuid} Login called before startSession`,'', []);
	}
	let sess:Session = s!;
	if(sess.status != SessionStatus.Initialised){
		return new WS.WebResponse(false, "ERROR: Can only login to a session once", `UUID:${uuid} Can only login to a session once`,'', []);
	}
	
	//TODO: get knownSaltPassHash for email address from database
	let knownSaltPassHash:string = 'GtgV3vHNK1TvAbsWNV7ioUo1QeI=';
	
	console.log('using debug key to decode');
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
	console.log({now:now, timeDiff:timeDiff});
	if(timeDiff < 0 || timeDiff > 20000 ){	// request must arrive within 20 seconds
		console.log('failed Date check');
		return new WS.WebResponse(false, "ERROR: Login failed.", `UUID:${uuid} Login failed, request to old.`,'', []);
	}
	
	// generate password and nonce for the session
	console.log('setting session credentials');
	sess.status = SessionStatus.LoggedIn;
	sess.password = await Session.genSessionPassword();
	sess.nonce = Math.floor(1+Math.random()*483600);
	sess.seq = 1;
	sess.updateDB(uuid);
	console.log({sess:sess});
	
	// encrypt and return to client the password to use for the session, and the nonce to start with
	let plainTextResponse = JSON.stringify({pass:sess.password, nonce:sess.nonce});
	console.log({plainTextResponse:plainTextResponse});
	let encResponse = Encodec.encrypt(plainTextResponse, knownSaltPassHash, sess.captcha);
	console.log({encResponse:encResponse});
	return new WS.WebResponse(true, "", `UUID:${uuid} Login success`, `"${encResponse}"`);
}

// secure talk within a session
async function handleSecureTalk(web:WS.WebServerHelper, uuid:string, requestIp:string, cookies:GTS.DM.HashTable<string>, sequence:string, message:string):Promise<WS.WebResponse>{
	console.log('handleSecureTalk');
	console.log({uuid:uuid, requestIp:requestIp, cookies:cookies, sequence:sequence});
	const [hs, s] = await Session.hasSession(uuid, requestIp, cookies);
	if(!hs){
		return new WS.WebResponse(false, "ERROR: Need to have session first.", `UUID:${uuid} Attempted session talk before session start`,'', []);
	}
	if(!s){
		return new WS.WebResponse(false, "ERROR: Failed to connect to session.", `UUID:${uuid} Error getting session from DB`,'', []);
	}
	if(s!.status != SessionStatus.LoggedIn){
		return new WS.WebResponse(false, "ERROR: Need to login first.", `UUID:${uuid} Attempted session talk before login`,'', []);
	};
	if(!new RegExp("^[0-9]+$", "g").test(sequence)){
		return new WS.WebResponse(false, "ERROR: Invalid sequence.", `UUID:${uuid} Secure Talk sequence fails regex check`,'', []);
	}
	
	// by getting to here there is a logged in session
	let doLogSequenceCheck = true;
	let retval:WS.WebResponse = new WS.WebResponse(false,'ERROR',`UUID:${uuid} Unknown error`, '', []);
	await Threading.sequencedStartLock<WS.WebResponse>(uuid, s.sessionId, parseInt(sequence), s.seq, Session.checkAndIncrementSequenceInDB, function(uuid:string, purpose:string, seqNum:number){
		console.log('talking at number #'+seqNum);
		console.log({pass:s.password, nonce:s.nonce+seqNum});
		
		// decrypt challenge using knownSaltPassHash and captcha
		let decoded:string = Encodec.decrypt(message, s.password, (s.nonce+seqNum));
		const [action,params] = JSON.parse(decoded);
		console.log({action:action, params:params});
		
		if(!web.adminHandlers[action]){
			return new WS.WebResponse(false,'ERROR: Undefined admin action',`UUID:${uuid} Missing admin action {action}`,`""`,[]);
		}
		
		return web.adminHandlers[action](uuid, requestIp, cookies, params);
		
		
	}, doLogSequenceCheck)
		.then(adminResponse => {retval = new WS.WebResponse(true, '', `UUID:${uuid} Secure Talk done`, `"${Encodec.encrypt(adminResponse.toString(),s.password, (s.nonce+parseInt(sequence)))}"`, []);} )
		.catch(err => {retval = new WS.WebResponse(false, "ERROR: Sequence Start Failed.", `UUID:${uuid} ERROR: Sequence Start Failed. {err}`,'', []);} );
	console.log('retval is');
	console.log(retval.toString());
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
	nonce: number;
	password: string;
	seq: number;
	chkSum: string;
	constructor(pId:number, pSessionId:string, pCreated:Date, pLastSeen:Date, pIp:string, pStatus:SessionStatus, pCaptcha:number, pNonce:number, pPassword:string, pSeq:number, pChkSum:string){
		this.id = pId;
		this.sessionId = pSessionId;
		this.created = pCreated;
		this.lastSeen = pLastSeen;
		this.ip = pIp;
		this.status = pStatus;
		this.captcha = pCaptcha;
		this.nonce = pNonce;
		this.password = pPassword;
		this.seq = pSeq;
		this.chkSum = pChkSum;
	}
	
	// base64 sha1 hash of the session's values (excludes id and chkSum).  Can compare .genHash() with .chkSum to test for if changed
	genHash(): string{
		var j = JSON.stringify({sessionId:this.sessionId,created:this.created,lastSeen:this.lastSeen,ip:this.ip,status:this.status,captcha:this.captcha,nonce:this.nonce,password:this.password,seq:this.seq});
		var hsh = crypto.createHash('sha1').update(j).digest('base64');
		return hsh;
	}
	
	// cast session as a JSON string
	toString(): string{
		return JSON.stringify(this.toJSON());
	}
	
	// cast session as a JSON object
	toJSON(): object{
		return {id:this.id.toString(),sessionId:this.sessionId,created:this.created.toString(),lastSeen:this.lastSeen.toString(),ip:this.ip,status:this.status.toString(),captcha:this.captcha.toString(),nonce:this.nonce.toString(),password:this.password,seq:this.seq.toString(),chkSum:this.chkSum};
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
		var nonceIsValid = (this.nonce >= 1 && this.nonce <= 2147483600); if( !nonceIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for nonce.'; }
		var passwordIsValid = (this.password.length >= 16 && this.password.length <= 16); if( !passwordIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for password.'; }
		var seqIsValid = (this.seq >= 0); if( !seqIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for seq.'; }
		var chkSumIsValid = (true); if( !chkSumIsValid ){ if(errDesc.length > 0){errDesc=errDesc+' ';} errDesc = errDesc + 'Invalid value for chkSum.'; }
		return [idIsValid && sessionIdIsValid && createdIsValid && lastSeenIsValid && ipIsValid && statusIsValid && captchaIsValid && nonceIsValid && passwordIsValid && seqIsValid && chkSumIsValid, errDesc];
	}
	
	// instantiate a session from string values. Null returned if sting values fail regex checks or casted value checks
	static fromStrings( id: string, sessionId: string, created: string, lastSeen: string, ip: string, status: string, captcha: string, nonce: string, password: string, seq: string, chkSum: string ): Session|null{
		let regexTests: boolean[] = [new RegExp("^[0-9]+$", "g").test(id), new RegExp("^[A-Za-z\. \-,0-9=+/]+$", "g").test(sessionId), new RegExp("^[0-9]{4}-[0-9]{2}-[0-9][0-9]? [0-9]{2}:[0-9]{2}(?::[0-9]{2})$", "g").test(created), new RegExp("^[0-9]{4}-[0-9]{2}-[0-9][0-9]? [0-9]{2}:[0-9]{2}(?::[0-9]{2})$", "g").test(lastSeen), new RegExp("^[A-Za-z\. \-,0-9=+/]+$", "g").test(ip), new RegExp("^[0-9]+$", "g").test(status), new RegExp("^[0-9]+$", "g").test(captcha), new RegExp("^[0-9]+$", "g").test(nonce), new RegExp("^[A-Za-z\. \-,0-9=+/]+$", "g").test(password), new RegExp("^[0-9]+$", "g").test(seq), new RegExp("^[a-zA-Z0-9/+]{26}[a-zA-Z0-9/+=]{2}$", "g").test(chkSum)];
		if(!regexTests.every(Boolean)){
			// detail invalid value
			let paramNames: string[] = ["id", "sessionId", "created", "lastSeen", "ip", "status", "captcha", "nonce", "password", "seq", "chkSum"];
			for(var i=0; i<regexTests.length; i++){
				if(!regexTests[i]){
					console.log('posted value for '+paramNames[i]+' fails regex check');
				}
			}
			return null;
		}
		let session:Session = new Session(parseInt(id), (sessionId), new Date(created), new Date(lastSeen), (ip), parseInt(status), parseInt(captcha), parseInt(nonce), (password), parseInt(seq), (chkSum));
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
	
	// get a session from the database for the specified sessionId
	static async getSessionFromDB(uuid:string, sessionId:string): Promise<GTS.DM.WrappedResult<Session>>{
		let retval: GTS.DM.WrappedResult<Session> = new GTS.DM.WrappedResult();
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection( 'Session.getSessionFromDB', uuid );
		if( fetchConn.error ) { return retval.setError( 'DB Connection error\n' + fetchConn.message ); }
		if( fetchConn.data == null ){ return retval.setError( 'DB Connection NULL error' ); }
		let client:DBCore.Client = fetchConn.data;
		const res = await client.query( 'SELECT id, created, lastSeen, ip, status, captcha, nonce, password, seq, chkSum FROM sessions WHERE sessionId = $1;',[sessionId] );
		if( res.rowCount == 0 ) { return retval.setError( 'Session not found.' ); }
		let s:Session = new Session( res.rows[0].id, sessionId, res.rows[0].created, res.rows[0].lastseen, res.rows[0].ip, res.rows[0].status, res.rows[0].captcha, res.rows[0].nonce, res.rows[0].password, res.rows[0].seq, res.rows[0].chksum);
		//TODO: update last seen
		return retval.setData( s );
	}
	
	static async checkAndIncrementSequenceInDB(uuid:string, sessionId:string, reqSequence:number): Promise<GTS.DM.WrappedResult<boolean>>{
		let retval: GTS.DM.WrappedResult<boolean> = new GTS.DM.WrappedResult();
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> =  await DBCore.getConnection('Session.checkAndIncrementSequence', uuid);
		if(fetchConn.error){ return retval.setError('DB Connection error\n'+fetchConn.message); }
		if(fetchConn.data == null){ return retval.setError('DB Connection NULL error'); }
		let client:DBCore.Client = fetchConn.data;
		console.log('checking sequence in db');
		console.log({sessionId:sessionId, reqSequence:reqSequence});
		const res = await client.query('CALL checkAndIncrementSessionSequence($1,$2,$3)',[sessionId,reqSequence,0]);
		if( res.rowCount == 0 ) { return retval.setError( 'checkAndIncrementSessionSequence failed.' ); }
		console.log({doseq:res.rows[0].doseq, reqSequence:reqSequence});
		return retval.setData(res.rows[0].doseq == reqSequence);
	}
	
	// list all the sessions from the database in full detail
	static async fetchAllFromDB(uuid:string): Promise<GTS.DM.WrappedResult<Session[]>> {
		let retval: GTS.DM.WrappedResult<Session[]> = new GTS.DM.WrappedResult();
		let retvalData: Session[] = [];
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection( 'Session.fetchAllFromDB', uuid );
		if( fetchConn.error ){ return retval.setError( 'DB Connection error\n' + fetchConn.message ); }
		if( fetchConn.data == null ){ return retval.setError( 'DB Connection NULL error' ); }
		let client:DBCore.Client = fetchConn.data;
		const res = await client.query( 'SELECT id, sessionId, created, lastSeen, ip, status, captcha, nonce, password, seq, chkSum FROM sessions;' );
		if( res.rowCount == 0 ) { return retval.setData( retvalData ); }        // handle empty table
		for( let i = 0; i < res.rowCount; i++ ) {
			retvalData.push( new Session( res.rows[i].id, res.rows[i].sessionid, res.rows[i].created, res.rows[i].lastseen, res.rows[i].ip, res.rows[i].status, res.rows[i].captcha, res.rows[i].nonce, res.rows[i].password, res.rows[i].seq, res.rows[i].chksum) );
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
		const res = await client.query( 'CALL addSession($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11);',[this.sessionId,this.created,this.lastSeen,this.ip,this.status,this.captcha,this.nonce,this.password,this.seq,this.chkSum,0]);
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
		const res = await client.query('CALL updateSession($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13);',[this.id,this.sessionId,this.created,this.lastSeen,this.ip,this.status,this.captcha,this.nonce,this.password,this.seq,newChksum,this.chkSum,0]);
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
		encoder.setDelay(2000);  // frame delay in ms
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
		let ws:GTS.DM.WrappedResult<Session> = await Session.getSessionFromDB(uuid, cookies['session']);
		if( ws.error ) { console.log('failed to get session from db '+ws.message ); return [false,undefined];}
		if( ws.data == null ) { console.log('null session from db'); return [false,undefined]; }
		let s: Session = ws.data;
		if(s.ip != requestIp){ console.log('ip mismatch at hasSession check'); return [false,undefined]; }
		if(s.status == SessionStatus.Expired){ console.log('expired session at hasSession check'); return [false,undefined]; }
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