import * as GTS from "./gts";
import * as DBCore from "./gts.db";
import * as UUID from "./gts.uuid";
import { Concurrency } from "./gts.concurrency";
import * as Express from 'express';
import * as Secure from "./gts.secure";

const PATH = require('path');
const ejs = require('ejs');
const fs = require('fs');

export interface IAdminHandlerFunction {
	(uuid:string, requestIp:string, cookies:GTS.DM.HashTable<string>, params:GTS.DM.JSONValue):Promise<WebResponse>;
}

export class WebServerHelper{
	// store which uuids are in use
	// each request gets an uuid
	// if there is a clash of duplicate ids, make sure they are not for concurrently processed requests
	private uuidRegister:GTS.DM.HashTable<boolean>;
	
	private siteRoot = '';

	// initialise a new uuid register when the WebServerHelper is instantiated
	constructor( pSiteRoot:string ){
		this.uuidRegister = {};
		this.siteRoot = pSiteRoot;			// set where files are served from
	}
	
	// get a file in reference to the website root
	public getFile( fileName:string ):string{
		return PATH.join(this.siteRoot, fileName);
	}
	
	// register how to hanle a web request; the url to listen on, required parameters to be sent, and the function to do
	public async registerHandler(webapp:Express.Application, url:string, requiredParams:string[], work:Function):Promise<void>{
		webapp.get(url, async (req:Express.Request, res:Express.Response) =>{
			await this.handleRequest(req, res, url, requiredParams, work);
		});
	}
	
	// register how to hanle a web request; the url to listen on, required parameters to be sent, and the function to do. Params are not checked
	public async registerHandlerPost(webapp:Express.Application, url:string, requiredParams:string[], work:Function):Promise<void>{
		webapp.post(url, async (req:Express.Request, res:Express.Response) =>{
			await this.handleRequestPost(req, res, url, requiredParams, work);
		});
	}
	
	public async registerHandlerGet(webapp:Express.Application, url:string, requiredParams:string[], work:Function):Promise<void>{
		webapp.get(url, async (req:Express.Request, res:Express.Response) =>{
			await this.handleRequestGet(req, res, url, requiredParams, work);
		});
	}
	
	public adminHandlers:GTS.DM.HashTable<IAdminHandlerFunction> = {};
	
	// store the function to return a response for an admin request
	public async registerAdminHandler(action:string, work:IAdminHandlerFunction):Promise<void>{
		this.adminHandlers[action] = work;
	}
	
	public async getUUID(): Promise<string>{
		const loopSafety:number = 20;
		let loopIteration:number = 1;
		let uuid:string = await UUID.newUUID();
		while(this.uuidRegister[uuid] && loopIteration<=loopSafety){
			console.log('handling uuid clash');
			uuid = await UUID.newUUID();
			loopIteration++;
		}
		if(this.uuidRegister[uuid]){
			return 'ERROR: Could not generate unique uuid';
		}
		this.uuidRegister[uuid]=true;	// record the uuid for this request is in use
		return uuid;
	}
	
	public releaseUUID(uuid:string):void{
		// release the uuid from the register of those in use
			delete this.uuidRegister[uuid];
	}
	
	// common handling of webrequests
	// assigns uuid to each request
	// records the request and the time to serve it
	// ensures database connection is released
	// provides simple error handling
	private async handleRequest(req:Express.Request, res:Express.Response, requestUrl:string, requiredParams:string[], work:Function):Promise<void>{
		let timeStart:number = new Date().getTime();
		var response:WebResponse = new WebResponse(false,'', 'Only Initialised','');

		// get a unqiue identifier for the request being served
		let uuid:string = await this.getUUID();
		
		// return an error if we could not get an uuid
		if(uuid.startsWith('ERROR:')){
			console.error(uuid);
			response = new WebResponse(false, 'Could not generate unique uuid', '','');
			res.send(response.toString());
			return;
		}

		//  get sanitised request variables
		let logParams:string[] = [];
		try{
			// support parsing known params and providing sanitized values to the work to be done
			let requiredParamChecks:GTS.DM.CheckedValue<string>[] = [];
			for(var i:number=0;i<requiredParams.length;i++){
				switch(requiredParams[i]){
					case 'txHash':
						let txHashCheck:GTS.DM.CheckedValue<string> = this.requireTransactionHash(req, res);
						if(!txHashCheck.isValid){ return; }
						requiredParamChecks.push(txHashCheck);
						logParams.push('txHash='+txHashCheck.value);
						break;
					case 'network':
						let networkCheck:GTS.DM.CheckedValue<string> = this.requireNetwork(req, res);
						if(!networkCheck.isValid){ return; }
						requiredParamChecks.push(networkCheck);
						logParams.push('network='+networkCheck.value);
						break;
					case 'address':
						let addressCheck:GTS.DM.CheckedValue<string> = this.requireBech32Address(req, res);
						if(!addressCheck.isValid){ return; }
						requiredParamChecks.push(addressCheck);
						logParams.push('address='+addressCheck.value);
						break;
					case 'hex':
						let hexCheck:GTS.DM.CheckedValue<string> = this.requireHex(req, res);
						if(!hexCheck.isValid){ return; }
						requiredParamChecks.push(hexCheck);
						logParams.push('hex='+hexCheck.value);
						break;
					case 'hexlist':
						let hexlistCheck:GTS.DM.CheckedValue<string> = this.requireHexList(req, res);
						if(!hexlistCheck.isValid){ return; }
						requiredParamChecks.push(hexlistCheck);
						logParams.push('hexlist='+hexlistCheck.value);
						break;
					case 'id':
						let idCheck:GTS.DM.CheckedValue<string> = this.requireId(req, res);
						if(!idCheck.isValid){ return; }
						requiredParamChecks.push(idCheck);
						logParams.push('id='+idCheck.value);
						break;
					default:
						if(requiredParams[i].startsWith('custom:')){
							let nameEnd = requiredParams[i].indexOf(' ');
							let name = requiredParams[i].substring(7, nameEnd);
							let regex = requiredParams[i].substring(nameEnd+1);
							let customCheck:GTS.DM.CheckedValue<string> = this.requireCustom(req, res, name, regex);
							if(!customCheck.isValid){ return; }
							requiredParamChecks.push(customCheck);
							logParams.push(`${name}=${customCheck.value}`);
							break;
						}
						console.error(`unknown required param ${requiredParams[i]}`);
						break;
				}
			}

			// get the response for the request and send it
			response = await work(uuid, ...requiredParamChecks);
			res.send(response.toString());
		} catch (err:any){
			// show and record any error encounted
			console.error(`UUID:${uuid} Error handling ${requestUrl}`);
			console.error(err);
			response = new WebResponse(false, err.toString(), `Caught Error handling ${requestUrl}`,'');
			res.send(response.toString());
		} finally {
			// log the request that was served
			let timeEnd:number = new Date().getTime();
			let storeLog:GTS.DM.WrappedResult<void> = await DB.addWeblog(uuid, requestUrl, logParams.join('\r\n'), response.success, (timeEnd-timeStart)/1000, response.logMessage, response.errorMessage);
			if(storeLog.error){
				console.error('unable to store log of web request');
				console.error(storeLog.message);
			}
			// free db resources for the request
			await DBCore.releaseConnection(uuid);
			// release the uuid from the register of those in use
			this.releaseUUID(uuid);
		}
	}
	
	private async handleRequestGet(req:Express.Request, res:Express.Response, requestUrl:string, requiredParams:string[], work:Function):Promise<void>{
		return this.handleRequestUnchecked(req, res, requestUrl, requiredParams, work, false);
	}
	
	private async handleRequestPost(req:Express.Request, res:Express.Response, requestUrl:string, requiredParams:string[], work:Function):Promise<void>{
		return this.handleRequestUnchecked(req, res, requestUrl, requiredParams, work, true);
	}
	
	private async handleRequestUnchecked(req:Express.Request, res:Express.Response, requestUrl:string, requiredParams:string[], work:Function, isPost:boolean):Promise<void>{
		let timeStart:number = new Date().getTime();
		var response:WebResponse = new WebResponse(false,'', 'Only Initialised','');
		
		// get a unqiue identifier for the request being served
		let uuid:string = await this.getUUID();
		
		// return an error if we could not get an uuid
		if(uuid.startsWith('ERROR:')){
			console.error(uuid);
			response = new WebResponse(false, 'Could not generate unique uuid', '','');
			res.send(response.toString());
			return;
		}
		
		let logParams:string[] = [];
		try{
			// get the param values if they are present
			let paramVals:string[] = [];
			for(var i:number=0;i<requiredParams.length;i++){
				let name:string = requiredParams[i];
				let val:string = '';
				if(isPost){
					if(req.body[name] === undefined){
						res.send( new WebResponse(false, `Missing ${name} post data`,'','').toString() );
						return;
					}
					val = req.body[name]!.toString();
				} else {
					if(req.query[name] === undefined){
						res.send( new WebResponse(false, `Missing ${name} param`,'','').toString() );
						return;
					}
					val = req.query[name]!.toString();
				}
				paramVals.push(val);
				logParams.push(`${name}=${val}`);
			}
			// get the response for the request
			let timedOut = false;
			[response,timedOut] = await Concurrency.doFuncOrTimeout<WebResponse>( 90000, async function(){return await work(uuid, req.originalUrl, req.ip, req.cookies, ...paramVals);});
			
			if(timedOut){
				response = new WebResponse(false, 'ERROR: Processing request timed out', `Error, Processing request timed out while handling ${requestUrl}`,'');
				res.send(response.toString());
				return;
			}
			if(!response){
				response = new WebResponse(false, 'ERROR: No response returned for request.', `Error, no response returned for handling ${requestUrl}`,'');
				res.send(response.toString());
				return;
			}
			// set any cookies specified for the response
			if(response.cookies != undefined && response.cookies.length > 0){
				for(var i:number=0; i<response.cookies.length; i++){
					let c: Cookie = response.cookies[i];
					res.cookie(c.name, c.value, c.getOptions());
				}
			}
			//send the response
			res.send(response.toString());
		} catch (err:any){
			// show and record any error encounted
			console.error(`UUID:${uuid} Error handling ${requestUrl}`);
			console.error(err);
			response = new WebResponse(false, err.toString(), `Caught Error handling ${requestUrl}`,'');
			res.send(response.toString());
		} finally {
			// log the request that was served
			let timeEnd:number = new Date().getTime();
			let storeLog:GTS.DM.WrappedResult<void> = await DB.addWeblog(uuid, requestUrl, logParams.join('\r\n'), response.success, (timeEnd-timeStart)/1000, response.logMessage, response.errorMessage);
			if(storeLog.error){
				console.error('unable to store log of web request');
				console.error(storeLog.message);
			}
			// free db resources for the request
			await DBCore.releaseConnection(uuid);
			// release the uuid from the register of those in use
			this.releaseUUID(uuid);
		}
	}
	
	// attach code to serve admin files
	public attachAdminFiles(web:WebServerHelper, webapp:Express.Application):void{
		// serve files from the admin directory if are logged in
		webapp.get('/admin*', async (req, res) => {
			console.log('admin file handler');
			let timeStart:number = new Date().getTime();
			let resp:WebResponse = new WebResponse(false, 'Just Init', '','');
			let uuid:string = await web.getUUID();
			try{
				// return an error if we could not get an uuid
				if(uuid.startsWith('ERROR:')){
					console.error(uuid);
					resp = new WebResponse(false, 'Could not generate unique uuid', '','');
				} else {
					let requestIp:string = req.ip;
					let cookies:GTS.DM.HashTable<string> = req.cookies;
					let isLoggedIn:boolean = await Secure.Session.isLoggedIn(uuid, requestIp, cookies);
					if(!isLoggedIn){
						resp = new WebResponse(false, 'ERROR: You need to be logged in to access the admin',`UUID:${uuid} Trying to access admin without login`,'');
					} else {
						let url = req.originalUrl.replace('\\','/');
						if(!(url=='/admin' || url.startsWith('/admin/'))){
							resp = new WebResponse(false, 'ERROR: Invalid admin request received',`UUID:${uuid} Trying to access invalid admin file`,'');
						}else{
							console.log('process admin file request');
							resp = await this.handleServeFile(web, res, url, uuid);
						}
					}
				}
				if(!resp.success){ console.log('sending admin error message'); res.send(resp.toString()); }
			} finally {
				// log the request that was served
				let timeEnd:number = new Date().getTime();
				let storeLog:GTS.DM.WrappedResult<void> = await DB.addWeblog(uuid, req.originalUrl, '', resp.success, (timeEnd-timeStart)/1000, resp.logMessage, resp.errorMessage);
				if(storeLog.error){
					console.error('unable to store log of admin request');
					console.error(storeLog.message);
				}
				// free db resources for the request
				await DBCore.releaseConnection(uuid);
				// release the uuid from the register of those in use
				web.releaseUUID(uuid);
			}
		});
	}
	
	// attach code to serve normal website files
	public attachRootFiles(web:WebServerHelper, webapp:Express.Application):void{
		// serve files from the public directory
		webapp.get('/*', async (req:Express.Request, res:Express.Response) => {
			console.log('public file handler');
			let timeStart:number = new Date().getTime();
			let resp:WebResponse = new WebResponse(false, 'Just Init', '','');
			let uuid:string = await web.getUUID();
			try{
				// return an error if we could not get an uuid
				if(uuid.startsWith('ERROR:')){
					console.error(uuid);
					resp = new WebResponse(false, 'Could not generate unique uuid', '','');
				} else {
					let requestIp:string = req.ip;
					let cookies:GTS.DM.HashTable<string> = req.cookies;
					let isLoggedIn:boolean = await Secure.Session.isLoggedIn(uuid, requestIp, cookies);
					let url = req.originalUrl.replace('\\','/');
					if(url=='/admin' || url.startsWith('/admin/')){
						resp = new WebResponse(false, 'ERROR: Invalid request received',`UUID:${uuid} Trying to access admin from rootFiles handler`,'');
					}else if(url=='/api' || url.startsWith('/api/')){
						resp = new WebResponse(false, 'ERROR: Invalid request received',`UUID:${uuid} Trying to access api from rootFiles handler`,'');
					}else{
						console.log('process root file request');
						resp = await this.handleServeFile(web, res, '/public'+url, uuid);
					}
				}
				if(!resp.success){ console.log('sending root message'); res.send(resp.toString()); }
			} finally {
				// log the request that was served
				let timeEnd:number = new Date().getTime();
				let storeLog:GTS.DM.WrappedResult<void> = await DB.addWeblog(uuid, req.originalUrl, '', resp.success, (timeEnd-timeStart)/1000, resp.logMessage, resp.errorMessage);
				if(storeLog.error){
					console.error('unable to store log of site request');
					console.error(storeLog.message);
				}
				// free db resources for the request
				await DBCore.releaseConnection(uuid);
				// release the uuid from the register of those in use
				web.releaseUUID(uuid);
			}
		});
	}
	
	private async handleServeFile(web:WebServerHelper, res:Express.Response, url:string, uuid:string):Promise<WebResponse> {
		console.log('handleServeFile '+url);
		// stop use of .. to traverse up the diretory tree
		if(url.indexOf('/../')>=0){
			console.log('request invalid');
			return new WebResponse(false, 'ERROR: Invalid request received',`UUID:${uuid} Trying to access invalid file`,'');
		}
		// strip params off url to find filename
		if(url.indexOf('?')>=0){url = url.substring(0,url.indexOf('?'));}
		let ejsFile:string = web.getFile(url+'.ejs');
		let ejsRootFile:string = web.getFile(url+'/.ejs');
		if(fs.existsSync(ejsRootFile)) {	// allow default .ejs file in a folder to be served without the trailing / on the folder name
			let resolveError:Function = {};
			let resolveRendered:Function = {};
			const pError:Promise<WebResponse> = new Promise((resolve) =>{resolveError=resolve;});
			const pRendered:Promise<WebResponse> = new Promise((resolve) =>{resolveRendered=resolve;});
			
			ejs.renderFile(ejsRootFile, {}, {}, async function(err:string, result:string){	// renderFile( filename, data, options
				if( err ){
					console.log('error rendering root ejs');
					resolveError(new WebResponse(false, 'ERROR: Problem rendering ejs file',`UUID:${uuid} Problem rendering ejs file`,err));
				} else {
					console.log('rendering root ejs');
					await res.send(result);
					console.log('rendered root ejs');
					resolveRendered(new WebResponse(true, '',`UUID:${uuid} Rendered root ejs`,''));
				}
			});
			
			let wr:WebResponse = await Promise<WebResponse>.any([pError,pRendered]);
			return wr;
		}
		if(fs.existsSync(ejsFile)) {
			ejs.renderFile(ejsFile, {}, {}, async function(err:string, result:string){	// renderFile( filename, data, options
				if( err ){
					console.log('error rendering ejs');
					return new WebResponse(false, 'ERROR: Problem rendering ejs file',`UUID:${uuid} Problem rendering ejs file`,err);
				} else {
					console.log('rendering ejs');
					await res.send(result);
					console.log('rendered ejs');
					return new WebResponse(true, '',`UUID:${uuid} Rendered ejs`,'');
				}
			});
		}
		if(url.endsWith('.ejs')){
			console.log('blocking server (not render) of ejs');
			return new WebResponse(false, 'ERROR: Problem serving ejs file',`UUID:${uuid} Will not serve un-rendered ejs files`,url);
		} else if(fs.existsSync(web.getFile(url))){
			console.log('sending static file');
			await res.sendFile( web.getFile(url) );
			console.log('static file sent');
			return new WebResponse(true, '',`UUID:${uuid} Served static file`,'');
		} else {
			console.log('file not exist');
			return new WebResponse(false, 'ERROR: Problem serving file',`UUID:${uuid} Requested file doesn't exist`,url);
		}
	}
	
	// attach code to view and prune weblogs
	public attachWeblogsInterface(web:WebServerHelper, webapp:Express.Application):void{
		// serve a page to view weblogs
		webapp.get('/weblogs', (req:Express.Request, res:Express.Response) => res.sendFile(web.getFile('weblogs.html')));

		// fetch weblogs from the db
		web.registerHandler(webapp, '/req/weblogs', [], async function(uuid:string){
			let result:GTS.DM.WrappedResult<Weblog[]> = await DB.getWeblogs(uuid);
			if(result.error){
				return new WebResponse(false, result.message, 'Failed to fetch Weblogs','');
			} else {
				let logs: Weblog[] = result.data==null?[]:result.data!;
				let jsonLogs:string = JSON.stringify(logs);
				return new WebResponse(true, '', 'Fetched Weblogs', jsonLogs);
			}
		});

		// delete weblogs from a given id and older
		web.registerHandler(webapp, '/req/prune-weblogs', ['id'], async function(uuid:string, idCheck:GTS.DM.CheckedValue<string>){
			let result:GTS.DM.WrappedResult<void> = await DB.pruneWeblogs(uuid, idCheck.value);
			if(result.error){
				return new WebResponse(false, result.message, 'Failed to prune Weblogs','');
			} else {
				return new WebResponse(true, '', 'Pruned Weblogs', '');
			}
		});
	}


	// ---------------------------------------------
	// Functions to validate incomming data
	// ---------------------------------------------

	// check that a transaction hash is sent for the request
	private requireTransactionHash(req:Express.Request, res:Express.Response): GTS.DM.CheckedValue<string>{
		if(req.query.txHash === undefined){
			res.send( new WebResponse(false, 'Missing txHash param','','').toString() );
			return new GTS.DM.CheckedValue<string>(false,'');
		}
		let txHash:string = req.query.txHash!.toString();
		if(txHash && txHash.length==64 && GTS.HexUtils.checkStringIsHexEncoded(txHash)){
			return new GTS.DM.CheckedValue<string>(true,txHash);
		} else {
			res.send( new WebResponse(false, 'Invalid transaction hash param received','','').toString() );
			return new GTS.DM.CheckedValue<string>(false,'');
		}
	}

	// check that a network is sent for the request
	private requireNetwork(req:Express.Request, res:Express.Response): GTS.DM.CheckedValue<string>{
		if(req.query.network === undefined){
			res.send( new WebResponse(false, 'Missing network param','','').toString() );
			return new GTS.DM.CheckedValue<string>(false,'');
		}
		let network:string = req.query.network!.toString();
		if(network && (network == '1' || network == 'T' || network == 'D')){
			return new GTS.DM.CheckedValue<string>(true,network);
		} else {
			res.send( new WebResponse(false, 'Invalid network param received','','').toString() );
			return new GTS.DM.CheckedValue<string>(false,'');
		}
	}

	// check that a bech32 address is sent for the request
	private requireBech32Address(req:Express.Request, res:Express.Response): GTS.DM.CheckedValue<string>{
		if(req.query.address === undefined){
			res.send( new WebResponse(false, 'Missing address param','','').toString() );
			return new GTS.DM.CheckedValue<string>(false,'');
		}
		let address:string = req.query.address!.toString();
		if(address && GTS.AddressUtils.checkAddressStringIsBech32(address)){
			return new GTS.DM.CheckedValue<string>(true,address);
		} else {
			res.send( new WebResponse(false, 'Invalid address param received','','').toString() );
			return new GTS.DM.CheckedValue<string>(false,'');
		}
	}

	// check that hex is sent for the request
	private requireHex(req:Express.Request, res:Express.Response): GTS.DM.CheckedValue<string>{
		if(req.query.hex === undefined){
			res.send( new WebResponse(false, 'Missing hex param','','').toString() );
			return new GTS.DM.CheckedValue<string>(false,'');
		}
		let hex:string = req.query.hex!.toString();
		if(hex && GTS.HexUtils.checkStringIsHexEncodedList(hex)){
			return new GTS.DM.CheckedValue<string>(true,hex);
		} else {
			res.send( new WebResponse(false, 'Invalid hex param received','','').toString() );
			return new GTS.DM.CheckedValue<string>(false,'');
		}
	}

	// check that hexlist is sent for the request
	private requireHexList(req:Express.Request, res:Express.Response): GTS.DM.CheckedValue<string>{
		if(req.query.hexlist === undefined){
			res.send( new WebResponse(false, 'Missing hexlist param','','').toString() );
			return new GTS.DM.CheckedValue<string>(false,'');
		}
		let hexlist:string = req.query.hexlist!.toString();
		if(GTS.HexUtils.checkStringIsHexEncodedList(hexlist)){
			return new GTS.DM.CheckedValue<string>(true,hexlist);
		} else {
			res.send( new WebResponse(false, 'Invalid hexlist param received. Please ensure the hexlist consists of 0 or more hex pairs. List items are seperated by the @ symbol','','').toString() );
			return new GTS.DM.CheckedValue<string>(false,'');
		}
	}
	
	// check that an integer id is sent for the request
	private requireId(req:Express.Request, res:Express.Response): GTS.DM.CheckedValue<string>{
		if(req.query.id === undefined){
			res.send( new WebResponse(false, 'Missing id param','','').toString() );
			return new GTS.DM.CheckedValue<string>(false,'');
		}
		let id:string = req.query.id!.toString();
		if(GTS.StringUtils.checkStringIsInteger(id)){
			return new GTS.DM.CheckedValue<string>(true,id);
		} else {
			res.send( new WebResponse(false, 'Invalid id param received','','').toString() );
			return new GTS.DM.CheckedValue<string>(false,'');
		}
	}
	
	// allow cusom validation (regex)
	private requireCustom(req:Express.Request, res:Express.Response, name:string, regex:string): GTS.DM.CheckedValue<string>{
		if(req.query[name] === undefined){
			res.send( new WebResponse(false, `Missing ${name} param`,'','').toString() );
			return new GTS.DM.CheckedValue<string>(false,'');
		}
		let custom:string = req.query[name]!.toString();
		if(new RegExp(regex, "g").test(custom)){
			return new GTS.DM.CheckedValue<string>(true,custom);
		} else {
			res.send( new WebResponse(false, `Invalid ${name} param received`,'','').toString() );
			return new GTS.DM.CheckedValue<string>(false,'');
		}
	}
}

// allow web responses to set cookies
export class Cookie{
	public name: string;		// name of cookie
	public value: string;		// value of cookie
	public expires: Date = new Date(0);		// expiry date of cookie, if not specified creates a session cookie
	public domain: string = '';	// domain of cookie
	public path: string;		// path for cookie, defaults to /
	public httpOnly: boolean;	// client script can not read httpOnly cookies
	public secure: boolean;		// cookie is only used with https
	
	constructor(pName:string, pValue:string);
	constructor(pName:string, pValue:string, pExpires:Date);
	constructor(pName:string, pValue:string, pExpires:Date, pDomain:string);
	constructor(pName:string, pValue:string, pExpires:Date, pDomain:string, pPath:string);
	constructor(pName:string, pValue:string, pExpires:Date, pDomain:string, pPath:string, pHttpOnly:boolean);
	constructor(pName:string, pValue:string, pExpires?:Date, pDomain?:string, pPath?:string, pHttpOnly?:boolean, pSecure?:boolean){
		this.name = pName;
		this.value = pValue;
		this.expires = pExpires ?? new Date(0);
		this.domain = pDomain ?? '';
		this.path = pPath ?? '/';
		this.httpOnly = pHttpOnly ?? false;
		this.secure = pSecure ?? false;
	}
	
	public getOptions(): object{
		if(this.domain.length > 0){
			return {expires:this.expires.getTime()==0?0:this.expires, domain:this.domain, path:this.path, httpOnly:this.httpOnly, secure:this.secure};
		}
		return {expires:this.expires.getTime()==0?0:this.expires, path:this.path, httpOnly:this.httpOnly, secure:this.secure};
	}
}

// When using await Webserver.handleRequest to process web requests, WebResponse is the format that worker functions provide the data to return
// It also defines the JSON wrapper of the returned data
export class WebResponse{
	success: boolean;
	errorMessage: string;
	logMessage: string;
	data: string;
	cookies: Cookie[];

	constructor(pSuccess:boolean, pErrorMessage:string, pLogMessage:string, pData:string, pSetCookies?: Cookie[]){
		this.success = pSuccess;
		this.errorMessage = pErrorMessage;
		this.logMessage = pLogMessage;
		this.data = pData;
		this.cookies = pSetCookies ?? [];
	}
}
// JSON to send a response to the client
WebResponse.prototype.toString = function(){
	// don't return logMessage to the client, this is logged in the DB
	// if there is no data, return "" so the JSON is valid
	let safeData:string='""'; if(this.data != null && this.data.length > 0){ safeData = this.data; }
	// only send errorMessage if their is one
	let escapedMessage = GTS.StringUtils.escapeDoubleQuotes(GTS.StringUtils.escapeNewLines(this.errorMessage));
	let errorMessageJSON:string = ''; if(this.errorMessage.length>0){ errorMessageJSON =`, "errorMessage":"${escapedMessage}"`; }
	// send success as 1 for true, or 0 for false
	return `{"success":${this.success?'1':'0'}${errorMessageJSON}, "data":${safeData}}`;
}

// Access to the Webserver is logged
export class Weblog{
	id: number;
	uuid: string;
	requestedAt: string;
	requestUrl: string;
	requestParams: string;
	responseSuccess: boolean;
	responseDuration: number;
	logMessage: string;
	errorMessage: string;
	
	constructor(){
		this.id = 0;
		this.uuid = '';
		this.requestedAt = '';
		this.requestUrl = '';
		this.requestParams = '';
		this.responseSuccess = false;
		this.responseDuration = 0;
		this.logMessage = '';
		this.errorMessage = '';
	}
}

export namespace DB{
	// log a request has been served by webserver
	export async function addWeblog(uuid:string, requestUrl:string, requestParams:string, responseSuccess:boolean, responseDuration:number, logMessage:string, errorMessage:string): Promise<GTS.DM.WrappedResult<void>>{
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> =  await DBCore.getConnection('addWebLog', uuid);
		if(fetchConn.error || fetchConn.data == null){
			return new GTS.DM.WrappedResult<void>().setError('DB Connection error\r\n'+fetchConn.message);
		}
		let client:DBCore.Client = fetchConn.data!;
		await client.query('CALL addWebLog($1,$2,$3,$4,$5,$6,$7);',[uuid,requestUrl,requestParams,responseSuccess,responseDuration,logMessage,errorMessage]);
		return new GTS.DM.WrappedResult<void>().setNoData();
	}

	// view all weblogs recorded
	export async function getWeblogs(uuid: string): Promise<GTS.DM.WrappedResult<Weblog[]>>{
		let retvalData: Weblog[] = [];
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection('getWeblogs', uuid);
		if(fetchConn.error || fetchConn.data == null){
			return new GTS.DM.WrappedResult<Weblog[]>().setError('DB Connection error\r\n'+fetchConn.message);
		}
		let client:DBCore.Client = fetchConn.data!;
		const res = await client.query('SELECT id, uuid, requestedat, requesturl, requestparams, responsesuccess, responseduration, logmessage, errormessage FROM WebLogs ORDER BY id ASC;');
		for(var i=0; i<res.rowCount; i++){
			let l = new Weblog();
			l.id = res.rows[i].id;
			l.uuid = res.rows[i].uuid;
			l.requestedAt = res.rows[i].requestedat;
			l.requestUrl = res.rows[i].requesturl;
			l.requestParams = res.rows[i].requestparams;
			l.responseSuccess = res.rows[i].responsesuccess;
			l.responseDuration = res.rows[i].responseduration;
			l.logMessage = res.rows[i].logmessage;
			l.errorMessage = res.rows[i].errormessage;
			retvalData.push(l);
		}
		return new GTS.DM.WrappedResult<Weblog[]>().setData(retvalData);
	}
	
	// delete web logs by id and older
	export async function pruneWeblogs(uuid:string, id:string): Promise<GTS.DM.WrappedResult<void>>{
		try{
			let fetchConn:GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection('pruneWeblogs', uuid);
			if(fetchConn.error || fetchConn.data == null){
				return new GTS.DM.WrappedResult<void>().setError('DB Connection error\r\n'+fetchConn.message);
			}
			let client:DBCore.Client = fetchConn.data!;
			await client.query('DELETE FROM WebLogs WHERE id <= $1;', [id]);
			return new GTS.DM.WrappedResult<void>().setNoData();
		}catch( err:any ){
			return new GTS.DM.WrappedResult<void>().setError(err.toString());
		}
	}
}
