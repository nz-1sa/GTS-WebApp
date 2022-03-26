import * as GTS from "./gts";
import * as DBCore from "./gts.db";
import * as WS from "./gts.webserver";
import Express from 'express';
const PATH = require('path');

const doLogging:boolean = false;												// if thread debug logging is being recorded
let threadingLogId:number = 0;													// incrementing ids for sequencing of log entries
const threadingLogGroup:number = new Date().getTime();		// single server, the id is in groups of when the file loaded



// introduce a delay in code by allowing await for a setTimeout
export function pause(ms:number):Promise<void>{
	return new Promise(resolve => setTimeout(resolve, ms));
}

// holds a promise to wait for, and the ability to cancel the delay the promise is waiting for
export class CancellableDelay{
	timeout:NodeJS.Timeout;	// the timeout from a setTimeout (clear to cancel)
	promise:Promise<void>;	// the promise that is resolved the the setTimout finishes
	constructor(pTimeout:NodeJS.Timeout, pPromise:Promise<void>){
		this.timeout = pTimeout;
		this.promise = pPromise;
	}
}

// use setTimeout to introduce a delay in code that can be cancelled by using clearTimeout
export async function delayCancellable(ms:number):Promise<CancellableDelay>{
	// ability to cancel the timeout, init to a dummy value to allow code to compile
	var delayTimeout:NodeJS.Timeout = setTimeout(()=>null,1);
	// the promise that resolves when the timeout is done, init to a dummy value to allow code to compile
	var delayPromise:Promise<void> = Promise.resolve();
	// set the real values for delayTimeout and delayPromise
	var promiseTimeoutSet:Promise<void> = new Promise(function(resolveTimeoutSet:Function, rejectTimeoutSet:Function){
		delayPromise = new Promise(function(resolve, reject){delayTimeout = setTimeout(resolve, ms); resolveTimeoutSet();});
	});
	// wait for the real values to be set to return, avoids race condition by ensuring the function in the promise constructor finishes before exiting function delayCancellable
	await promiseTimeoutSet;
	// return the results
	return new CancellableDelay(delayTimeout, delayPromise);	
}

let doOnceStatus:GTS.DM.HashTable<number> = {};
let doOnceWaiting:GTS.DM.HashTable<DoOnceWaitingJob[]> = {};
export async function multiThreadDoOnce<T>(purpose:string, uuid:string, action:Function):Promise<T>{
	if(doLogging){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'multiThreadDoOnce',purpose,'entered function'),uuid);}
	let jobStatus:number = doOnceStatus[purpose]?doOnceStatus[purpose]:0;
	doOnceStatus[purpose] = ++jobStatus;
	if(!doOnceWaiting[purpose]){doOnceWaiting[purpose]=[];}
	var jobValue:T;
	if(jobStatus == 1){		// first in, do the job
		if(doLogging){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'multiThreadDoOnce',purpose,'starting job'),uuid);}
		jobValue = await action(uuid);
		if(doLogging){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'multiThreadDoOnce',purpose,'finished job'),uuid);}
		doOnceStatus[purpose] = jobStatus = 100;	// flag the job has been done, no more threads will be added now to waiting to resolve
		// release any threads waiting on the completion of the job
		let waitingToResolve = doOnceWaiting[purpose];
		for(var i=0; i<waitingToResolve.length; i++){
			waitingToResolve[i].resolve(jobValue);												// let any and all waiting in the que proceed now the job is done
			if(doLogging){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,waitingToResolve[i].uuid,'multiThreadDoOnce',purpose,'resumed thread waiting for job'),uuid);}
		}
		waitingToResolve = doOnceWaiting[purpose] = [];		// clear list now they are all resolved
		return new Promise(function(resolve, reject){resolve(jobValue)});
	}
	if(jobStatus < 100){// que additional requests that arrive while the job is being done
		doOnceStatus[purpose] = --jobStatus;		// keep tracing value low, while waiting for the job to be done
		return new Promise(async function(resolve, reject){
			if(doLogging){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'multiThreadDoOnce',purpose,'Pausing thread while waiting for job'),uuid);}
			doOnceWaiting[purpose].push({uuid:uuid,resolve:resolve});
		});
	}
	if(jobStatus == 200){	// reset tracking to prevent too large a number being used
		doOnceStatus[purpose] = jobStatus = 100;	// numbers 100 and above show the job has been done
	}
	// nothing to do as it was already done once
	if(doLogging){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'multiThreadDoOnce',purpose,'job was already completed'),uuid);}
	return new Promise(function(resolve, reject){resolve(jobValue)});
}

// start a bunch of async functions and continue once they are all done
export async function doAllAsync( jobs:Function[] , uuid:string, purpose:string):Promise<void>{
	if(doLogging){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'doAllAsync',purpose,'start with '+jobs.length+' jobs'),uuid);}
	// create an array to track when each job provided is completed
	let results:boolean[] = new Array(jobs.length).fill(false);
	// return a promise we will notify when all jobs have been done
	var promiseAllResolve:Function;			// how we will resolve this promise
	let p:Promise<void> = new Promise(function(resolve:Function, reject:Function){
		promiseAllResolve = resolve;
	});
	
	// asynchronously start all the jobs
	for(var i:number=0; i<jobs.length; i++){
		if(doLogging){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'doAllAsync',purpose,`started job ${i}`),uuid);}
		doJob(i, uuid, purpose);		// continue without waiting for job to complete
	}
	return p;

	// when each job completes, record that the job is done
	async function doJob(i:number, uuid:string, purpose:string){
		await jobs[i]();
		results[i] = true;
		
		// if all jobs are done resolve our promise to notify when all are done
		if(results.every(Boolean)){
			if(doLogging){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'doAllAsync',purpose,`finished job ${i}, all jobs done`),uuid);}
			promiseAllResolve();
		} else if(doLogging){
			await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'doAllAsync',purpose,`finished job ${i}`),uuid)
		}
	}
}

let singleLockStatus:GTS.DM.HashTable<boolean> = {};
let singleLockWaiting:GTS.DM.HashTable<SingleLockWaitingJob[]> = {};
// Que jobs doing each on in turn in the order they arrive
export async function singleLock<T>(purpose:string, uuid:string, action:Function, doLog?:boolean):Promise<T>{
	if(doLog===undefined){ doLog = doLogging; }	// if no param is given to do logging, use the default
	if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'SingleLock',purpose,'new job/thread arrives'),uuid);}
	//console.log(`${uuid} ${purpose} singleLock`);
	// find out if there is currently a job being processed as this one arrives to be done
	if(!singleLockWaiting[purpose]){singleLockWaiting[purpose]=[];}
	let jobProcessing:boolean = singleLockStatus[purpose]?singleLockStatus[purpose]:false;
	singleLockStatus[purpose] = jobProcessing;
	// if there is a job being processed
	if(jobProcessing){
		let existingJobCount:number = singleLockWaiting[purpose].length;
		if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'SingleLock',purpose,'job already being processed, '+existingJobCount+' jobs in the que'),uuid);}
		//console.log(`${uuid} ${purpose} job already being processed, ${existingJobCount} jobs in the que`);
		// return a promise that the job will be done when it can be
		return new Promise(async function(resolve, reject){
			// que this job to be done when possible
			singleLockWaiting[purpose].push({uuid:uuid, action:action, resolve:resolve, process:async function(uuid:string,action:Function,resolve:Function){
				if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'SingleLock',purpose,'qued job being processed'),uuid);}
				//console.log(`${uuid} ${purpose} qued job being processed`);
				// do this job when the time comes
				let jobValue:T = await action(uuid);
				if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'SingleLock',purpose,'qued job done'),uuid);}
				//console.log(`${uuid} ${purpose} qued job done`);
				let r = singleLockWaiting[purpose].shift();
				if(r){
					// and when it is done process the next job in the que if any
					let existingJobCount:number = singleLockWaiting[purpose].length;
					if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'SingleLock',purpose,'got another qued job, '+existingJobCount+' more in que'),uuid);}
					//console.log(`${uuid} ${purpose} found another job qued`);
					r.process(r.uuid,r.action,r.resolve);
				}else{
					// flag that processing is finished if we have just done the last job in the que
					jobProcessing = singleLockStatus[purpose] = false;
					if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'SingleLock',purpose,'que finished'),uuid);}
					//console.log(`${uuid} ${purpose} que finished`);
				}
				// let the thread continue that was waiting for the job to be done
				resolve(jobValue);
				if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'SingleLock',purpose,'job/thread released'),uuid);}
				//console.log(`${uuid} ${purpose} qued job released`);
			}});
			if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'SingleLock',purpose,'job qued'),uuid);}
		});
	}
	// start the job if there are no others to wait for
	singleLockStatus[purpose] = jobProcessing = true;
	if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'SingleLock',purpose,'start processing job'),uuid);}
	//console.log(`${uuid} ${purpose} start processing job`);
	let jobValueFirst:T = await action(uuid);
	if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'SingleLock',purpose,'job done'),uuid);}
	//console.log(`${uuid} ${purpose} job done`);
	let r = singleLockWaiting[purpose].shift();
	if(r){
		// and when it is done process a job in the que if any
		let existingJobCount:number = singleLockWaiting[purpose].length;
		if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'SingleLock',purpose,'got a qued job, '+existingJobCount+' more in que'),uuid);}
		//console.log(`${uuid} ${purpose} found a qued job`);
		r.process(r.uuid,r.action,r.resolve);
	}else{
		// flag that processing is finished if there is no que
		jobProcessing = singleLockStatus[purpose] = false;
		if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'SingleLock',purpose,'que not used'),uuid);}
	}
	// let the thread continue that called to have the job done
	if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'SingleLock',purpose,'job released'),uuid);}
	//console.log(`${uuid} ${purpose} job released`);
	return jobValueFirst;
}

let throttleStatus:GTS.DM.HashTable<boolean> = {};
let throttleWaiting:GTS.DM.HashTable<SingleLockWaitingJob[]> = {};
let throttleLastDone:GTS.DM.HashTable<number> = {};
// Que jobs doing each on in turn in the order they arrive, with a delay between jobs
export async function throttle<T>(uuid:string, purpose:string, delay:number, action:Function, doLog?:boolean):Promise<T>{
	if(doLog===undefined){ doLog = doLogging; }	// if no param is given to do logging, use the default
	if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'Throttle',purpose,'new job/thread arrives'),uuid);}
	// find out if there is currently a job being processed as this one arrives to be done
	if(!throttleWaiting[purpose]){throttleWaiting[purpose]=[];}
	let jobProcessing:boolean = throttleStatus[purpose]?throttleStatus[purpose]:false;
	throttleStatus[purpose] = jobProcessing;
	if(!throttleLastDone[purpose]){throttleLastDone[purpose]=0;}
	// if there is a job being processed
	if(jobProcessing){
		let existingJobCount:number = throttleWaiting[purpose].length;
		if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'Throttle',purpose,'job already being processed, '+existingJobCount+' jobs in the que'),uuid);}
		// return a promise that the job will be done when it can be
		return new Promise(async function(resolve, reject){
			// que this job to be done when possible
			throttleWaiting[purpose].push({uuid:uuid, action:action, resolve:resolve, process:async function(uuid:string, action:Function, resolve:Function){
				// Delay que if needed to enforece throttle
				let ticks:number = new Date().getTime();
				//console.log(`For throttle now is ${ticks}, last done at ${throttleLastDone[purpose]}`);
				let delayDone:number = ticks-throttleLastDone[purpose];
				if(delayDone < delay){
					if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'Throttle',purpose,`enforced delay of ${delay-delayDone}`),uuid);}
					//console.log(`Throttle delaying ${delay-delayDone}`);
					await pause(delay-delayDone);
					//console.log('Throttle delay done');
				}
				//console.log('qued job being processed');
				if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'Throttle',purpose,'qued job being processed'),uuid);}
				// do this job when the time comes
				let jobValue:T = await action(uuid);
				// record when job is done
				throttleLastDone[purpose] = new Date().getTime();
				if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'Throttle',purpose,'qued job done'),uuid);}
				//console.log('job done');
				// try and process next job in the que
				let r = throttleWaiting[purpose].shift();
				if(r){
					// and when it is done process the next job in the que if any
					let existingJobCount:number = throttleWaiting[purpose].length;
					if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'Throttle',purpose,'got another qued job, '+existingJobCount+' more in que'),uuid);}
					r.process(r.uuid,r.action,r.resolve);
				}else{
					// flag that processing is finished if we have just done the last job in the que
					jobProcessing = throttleStatus[purpose] = false;
					if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'Throttle',purpose,'que finished'),uuid);}
				}
				// let the thread continue that was waiting for the job to be done
				resolve(jobValue);
				if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'Throttle',purpose,'job/thread released'),uuid);}
			}});
			if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'Throttle',purpose,'job qued'),uuid);}
		});
	}
	// start the job if there are no others to wait for
	throttleStatus[purpose] = jobProcessing = true;
	// Delay que if needed to enforece throttle
	let ticksFirst:number = new Date().getTime();
	//console.log(`For throttle first now is ${ticksFirst}, last done at ${throttleLastDone[purpose]}`);
	let delayDoneFirst:number = ticksFirst-throttleLastDone[purpose];
	if(delayDoneFirst < delay){
		if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'Throttle',purpose,`enforced delay of ${delay-delayDoneFirst}`),uuid);}
		//console.log(`Throttle delaying ${delay-delayDoneFirst}`);
		await pause(delay-delayDoneFirst);
		//console.log('Throttle delay done');
	}
	//console.log('start processing job');
	if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'Throttle',purpose,'start processing job'),uuid);}
	// do the job
	let jobValueFirst:T = await action(uuid);
	// record when job is done
	throttleLastDone[purpose] = new Date().getTime();
	if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'Throttle',purpose,'job done'),uuid);}
	//console.log('job done');
	// try and process any job in the que
	let r = throttleWaiting[purpose].shift();
	if(r){
		// and when it is done process a job in the que if any
		let existingJobCount:number = throttleWaiting[purpose].length;
		if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'Throttle',purpose,'got a qued job, '+existingJobCount+' more in que'),uuid);}
		r.process(r.uuid,r.action,r.resolve);
	}else{
		// flag that processing is finished if there is no que
		jobProcessing = throttleStatus[purpose] = false;
		if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'Throttle',purpose,'que not used'),uuid);}
	}
	// let the thread continue that called to have the job done
	if(doLog){await DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId,threadingLogGroup,uuid,'Throttle',purpose,'job released'),uuid);}
	//console.log(`${uuid} ${purpose} job released`);
	return jobValueFirst;
}

export async function doWithTimeout<T>(uuid:string, timeout:number, action:Function):Promise<T>{
	let funcOver:boolean = false;
	var ourTimeout:NodeJS.Timeout;						// ability to cancel time limit if work is done first
	var promiseDoneOrTimedout:Function;				// how we will resolve this promise
	let p:Promise<T> = new Promise(function(resolve, reject){
		promiseDoneOrTimedout = resolve;
	});
	//console.log('done init');
	limitTime(uuid, timeout);
	//console.log('called limitTime');
	doJob(uuid, action);
	//console.log('called doJob');
	return p;
	
	async function limitTime(uuid:string, timeout:number){
		let delay:CancellableDelay = await delayCancellable(timeout);
		ourTimeout = delay.timeout;
		await delay.promise;
		if(!funcOver){
			funcOver = true;
			console.log('timeout finished first');
			promiseDoneOrTimedout(null);
			return;
		}
		console.log('timeout finished after doJob');
	}
	
	async function doJob(uuid:string, action:Function){
		let res:T = await action(uuid);
		if(!funcOver){
			funcOver = true;
			//console.log('doJob finished first');
			clearTimeout(ourTimeout);
			//console.log('time limit timeout cleared');
			promiseDoneOrTimedout(res);
			//console.log('promise resolved');
			return;
		}
		console.log('doJob finished after timeout');
	}
}




export function attachThreadingDebugInterface(web:WS.WebServerHelper, webapp:Express.Application):void{
	webapp.get('/threadinglogs', (req:Express.Request, res:Express.Response) => res.sendFile(PATH.join(__dirname, '../threadinglogs.html')));
	web.registerHandler(webapp, '/req/threadinglogs', [], async function(uuid:string){
		try{
			let getLogs:GTS.DM.WrappedResult<ThreadingLog[]> = await DB.getThreadingLogs(uuid);
			if(getLogs.error){
				return new WS.WebResponse(false,'Error fetching threading logs\r\n'+getLogs.message,'Error fetching threading logs','');
			}
			let jsonLogs:string = JSON.stringify(getLogs.data);
			return new WS.WebResponse(true, '', `Fetched Threadinglogs`,jsonLogs);
		} catch(err) {
			return new WS.WebResponse(false,'Error fetching threading logs\r\n'+err,'Error fetching threading logs','');
		}
	});
	web.registerHandler(webapp, '/req/prune-threadinglogs', ['id'], async function(uuid:string, idCheck:GTS.DM.CheckedValue<string>){
		let result:GTS.DM.WrappedResult<void> = await DB.pruneThreadinglogs(uuid, idCheck.value);
		if(result.error){
			return new WS.WebResponse(false, result.message, 'Failed to prune Threadinglogs','');
		} else {
			return new WS.WebResponse(true, '', 'Pruned Threadinglogs', '');
		}
	});
	
	web.registerHandler(webapp, '/OneAtATime', [], async function(uuid:string){
		try{
			let jobs:Function[] = [ async function(){await doTest(uuid);}, async function(){await doTest(uuid);}, async function(){await doTest(uuid);},
												async function(){await doTest(uuid);}, async function(){await doTest(uuid);}, async function(){await doTest(uuid);} ];
			await doAllAsync(jobs, uuid, 'Testing All Async');
			return new WS.WebResponse(true, '', 'Done OneAtATime Test','<a href="./threadinglogs">View Logs</a>');
		} catch(err) {
			return new WS.WebResponse(false,'Error running OneAtATime test\r\n'+err,'Error running OneAtATime test','');
		}
		
		async function doTest(uuid:string){
			await singleLock<boolean>('testing',uuid, async function(uuidCallback:string){
				await pause(1000);
				return true;
			});
		}
	});


	web.registerHandler(webapp, '/DoAllAsync', [], async function(uuid:string){
		try{
			let jobs:Function[] = [ async function(){await pause(2000);}, async function(){await pause(1900);}, async function(){await pause(1800);},
												async function(){await pause(2000);}, async function(){await pause(1900);}, async function(){await pause(1800);} ];
			await doAllAsync(jobs, uuid, 'Testing /DoAllAsync');			
			return new WS.WebResponse(true, '', 'Done DoAllAsync Test','<a href="./threadinglogs">View Logs</a>');													
		} catch(err) {
			return new WS.WebResponse(false,'Error running DoAllAsync test\r\n'+err,'Error running DoAllAsync test','');
		}
	});
}

class SingleLockWaitingJob{
	uuid: string;
	action: Function;
	resolve: Function;
	process: Function;
	
	constructor( pUuid:string, pAction:Function, pResolve:Function, pProcess:Function ){
		this.uuid = pUuid;
		this.action = pAction;
		this.resolve = pResolve;
		this.process = pProcess;
	}
}

class DoOnceWaitingJob{
	uuid: string;
	resolve: Function;
	constructor( pUuid:string, pAction:Function, pResolve:Function, pProcess:Function ){
		this.uuid = pUuid;
		this.resolve = pResolve;
	}
}

// Multi-threading logic is logged. This may help future debugging
export class ThreadingLog{
	dbId:number;
	threadingId:number;
	threadingGroup:number;
	uuid:string;
	type:string;
	purpose:string;
	action:string;
	loggedAt:number;
	constructor(){
		this.dbId = 0;
		this.threadingId = 0;
		this.threadingGroup = 0;
		this.uuid = '';
		this.type = '';
		this.purpose = '';
		this.action = '';
		this.loggedAt =0;
	}
	setVals(pDbId:number, pThreadingId:number, pThreadingGroup:number, pUuid:string, pType:string, pPurpose:string, pAction:string, pLoggedAt:number): ThreadingLog{
		this.dbId = pDbId;
		this.threadingId = pThreadingId;
		this.threadingGroup = pThreadingGroup;
		this.uuid = pUuid;
		this.type = pType;
		this.purpose = pPurpose;
		this.action = pAction;
		this.loggedAt = pLoggedAt;
		return this;
	}
	
	setNew(pThreadingId:number,pThreadingGroup:number,pUuid:string, pType:string, pPurpose:string, pAction:string): ThreadingLog{
		this.threadingId = pThreadingId;
		this.threadingGroup = pThreadingGroup;
		this.uuid = pUuid;
		this.type = pType;
		this.purpose = pPurpose;
		this.action = pAction;
		this.loggedAt = Date.now();
		return this;
	}
}

export namespace DB{
	export async function addThreadingLog(log:ThreadingLog, uuid:string): Promise<GTS.DM.WrappedResult<void>>{
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection('addThreadingLog', uuid);
		if(fetchConn.error || fetchConn.data == null){
			return new GTS.DM.WrappedResult<void>().setError('DB Connection error\r\n'+fetchConn.message);
		}
		let client:DBCore.Client = fetchConn.data!;
		await client.query('CALL addThreadingLog($1,$2,$3,$4,$5,$6,$7);',[log.threadingId, log.threadingGroup, log.uuid, log.type, log.purpose, log.action, log.loggedAt]);
		return new GTS.DM.WrappedResult<void>().setNoData();
	}

	// view all threading logs recorded
	export async function getThreadingLogs(uuid:string): Promise<GTS.DM.WrappedResult<ThreadingLog[]>>{
		let retvalData: ThreadingLog[] = [];
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection('getWeblogs', uuid);
		if(fetchConn.error || fetchConn.data == null){
			return new GTS.DM.WrappedResult<ThreadingLog[]>().setError('DB Connection error\r\n'+fetchConn.message);
		}
		let client:DBCore.Client = fetchConn.data!;
		const res = await client.query('SELECT id, threadingid, threadinggroup, uuid, type, purpose, action, loggedat FROM ThreadingLogs ORDER BY loggedat ASC, threadingid ASC;');
		for(var i=0; i<res.rowCount; i++){
			let l:ThreadingLog = new ThreadingLog().setVals(res.rows[i].id, res.rows[i].threadingid, res.rows[i].threadinggroup, res.rows[i].uuid, res.rows[i].type, res.rows[i].purpose, res.rows[i].action, res.rows[i].loggedat);
			retvalData.push(l);
		}
		return new GTS.DM.WrappedResult<ThreadingLog[]>().setData(retvalData);
	}
	
	export async function pruneThreadinglogs(uuid:string, id:string): Promise<GTS.DM.WrappedResult<void>>{
		try{
			let fetchConn:GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection('pruneThreadinglogs', uuid);
			if(fetchConn.error || fetchConn.data == null){
				return new GTS.DM.WrappedResult<void>().setError('DB Connection error\r\n'+fetchConn.message);
			}
			let client:DBCore.Client = fetchConn.data!;
			await client.query('DELETE FROM ThreadingLogs WHERE id <= $1;', [id]);
			return new GTS.DM.WrappedResult<void>().setNoData();
		}catch( err:any ){
			return new GTS.DM.WrappedResult<void>().setError(err.toString());
		}
	}
}