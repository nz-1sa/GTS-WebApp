import * as GTS from "./gts";


// Holds a promise that is resolved when a delay is completed, and a timeout that can clear/cancel the delay
class CancellableDelay{
	timeout:number;	// the timeout from a global.setTimeout (clear to cancel)
	promise:Promise<void>;	// the promise that is resolved the the setTimout finishes
	constructor(pTimeout:number, pPromise:Promise<void>){
		this.timeout = pTimeout;
		this.promise = pPromise;
	}
}

// The action sent to do for a delayed result
export interface IAsyncAction {
	(resolve:Function):Promise<void>;
}

// for an action (paramaterless function) create a promise  to wait on a delayed result, and a function to call later that runs the action and resolves the promise
export class DelayedResult<T>{
    private p2:Promise<T>;
    constructor(pPromise:Promise<T>){
        this.p2 = pPromise;
    }
    public async getResult():Promise<T>{
        return this.p2;
    }
    public static async createDelayedResult<T>(pAction:IAsyncAction):Promise<[Function,DelayedResult<T>]>{
        var dr:DelayedResult<T>;
        var resolvePromiseDelayedResult:Function;
        await new Promise(function(varsSetResolve:Function){
            dr = new DelayedResult<T>( new Promise(function(resolve){
                resolvePromiseDelayedResult = function(){
                    pAction(resolve);
                }
            }) );
            varsSetResolve();
        });
        return [resolvePromiseDelayedResult!,dr!];
        // when resolvePromiseDelayedResult() is called dr.p2 will resolve with the value returned from resolvePromiseDelayedResult()
    }
}

// class to help make code that can be run concurrently
export class Concurrency{

	// -----
	// PAUSE
	// -----
	
	// provide setTimeout such that it can be awaited on
	public static pause(ms:number):Promise<void>{
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	// -------------
	// ONE AT A TIME
	// -------------

	// allow limit on concurrency to be within a defined purpose
	private static limitOneAtATimePromises: GTS.DM.HashTable<Promise<any>> = {};
	
	// for a given purpose, limit concurrency to one at a time
	/* public static async limitToOneAtATime<T>(purpose:string, fn:Function, ...args:any[]):Promise<T>{
		// ensure there is a promise defined to limit execution to one at a time for the specified purpose
		if(!Concurrency.limitOneAtATimePromises[purpose]){Concurrency.limitOneAtATimePromises[purpose]=Promise.resolve();};
		// get the value from when the job is done
		var retval:T = await new Promise(async function(resolve){
			// wait for other jobs that are scheduled to be done first
			await Concurrency.limitOneAtATimePromises[purpose];
			// set that this job is the job to be done
			Concurrency.limitOneAtATimePromises[purpose] = Concurrency.limitOneAtATimePromises[purpose].then(
				// do the job resolving the value being awaited on
				async function(){resolve(await fn(...args));}
			);
		});
		// return the value
		return retval;
	} */
	
	// for a given purpose, limit concurrency to one at a time
	public static async limitToOneAtATime<T>(purpose:string, fn:Function, ...args:any[]):Promise<DelayedResult<T>>{
		console.log('in limitToOneAtATime');
		console.log({purpose:purpose, fn:fn, args:args});
		// ensure there is a promise defined for the specified purpose (used to limit execution to one at a time within purpose)
		if(!Concurrency.limitOneAtATimePromises[purpose]){Concurrency.limitOneAtATimePromises[purpose]=Promise.resolve();};
		console.log('storeage defined');

		var f:Function; var dr:DelayedResult<any>; var errMsg:string = '';
		await new Promise<void>(async function(resolveVarsSet:Function){
			console.log('creating delayedResult');
			[f,dr] = await DelayedResult.createDelayedResult<any>(async function(resolve:Function):Promise<any>{
				// wait for other jobs that are scheduled to be done first
				console.log('waiting for earlier jobs to be completed');
				await Concurrency.limitOneAtATimePromises[purpose];
				// set that this job is the job to be done
				console.log('setting our job to be done');
				Concurrency.limitOneAtATimePromises[purpose] = Concurrency.limitOneAtATimePromises[purpose].then(
					// do the job resolving the value being awaited on
					async function(){let val:any = await fn(...args).catch((err:any)=>{console.log(err);errMsg='ERROR:'+err;}).then((val:any)=>{resolve(val);});}
				);
			});
			resolveVarsSet();
		});
		console.log('delayed result made');
		if(errMsg.length > 0){
			console.log('error is '+errMsg);
			return Promise.reject(errMsg);
		}
		console.log('calling job');
		f!();				// call the function to the job
		if(errMsg.length > 0){
			console.log('error is '+errMsg);
			return Promise.reject(errMsg);
		}
		console.log('returning promise for job');
		return dr!;		// return object wrapper of promise to wait for the job to be done
	}

	// -----------------
	// CANCELLABLE DELAY
	// -----------------

	// start waiting for a pause that can be cancelled
	public static async startCancellableDelay(ms:number):Promise<CancellableDelay>{
		// ability to cancel the timeout, init to a dummy value to allow code to compile
		let delayTimeout:number = 0; //global.setTimeout(()=>null,1);
		
		var f:Function; var dr:DelayedResult<any>;
		[f,dr] = await DelayedResult.createDelayedResult<void>(async function(resolve:Function):Promise<void>{
			delayTimeout = global.setTimeout(resolve, ms);
		});
		f();		// call the function to start the timeout
		return new CancellableDelay(delayTimeout, dr.getResult());	
		
		// the promise that resolves when the timeout is done, init to a dummy value to allow code to compile
		/* let delayPromise:Promise<void> = Promise.resolve();
		// set the real values for delayTimeout and delayPromise
		await new Promise(function(resolveTimeoutSet:Function){
			delayPromise = new Promise(
				function(resolve:Function){
					delayTimeout = setTimeout(resolve, ms);
					resolveTimeoutSet();
				});
		});
		// return the results
		return new CancellableDelay(delayTimeout, delayPromise);	*/
	}

	// ------------------
	// DO FUNC OR TIMEOUT
	// ------------------

	public static async doFuncOrTimeout<T>(timeout:number, action:Function):Promise<[T,boolean]>{
		let funcOver:boolean = false;						// flag if action is done or timeout has happened
		var ourTimeout:number;				// ability to cancel time limit if work is done first
		var promiseDoneOrTimedout:Function;				// how we will resolve this promise
		let p:Promise<[T,boolean]> = new Promise(function(resolve){
			promiseDoneOrTimedout = resolve;
		});
		limitTime(timeout);
		doJob(action);
		return p;
		
		async function limitTime(timeout:number){
			let delay:CancellableDelay = await Concurrency.startCancellableDelay(timeout);
			ourTimeout = delay.timeout;
			await delay.promise;
			if(!funcOver){
				funcOver = true;
				promiseDoneOrTimedout([null,true]);			// resolves the promise returned by doFuncOrTimeout. Null result, true for timeout
				return;
			}
		}
		
		async function doJob(action:Function){
			let res:T = await action();
			if(!funcOver){
				funcOver = true;
				global.clearTimeout(ourTimeout);					// stop the timeout if the job finishes first
				promiseDoneOrTimedout([res,false]);			// resolves promise with the result of the action, false for not timeout
				return;
			}
		}
	}

	// ------------
	// THROTTLE JOB
	// ------------

	// ensure a job takes at least a min duration to complete
	public static async throttleJob<T>(minDuration:number, action:Function):Promise<T>{
		let pWork:Promise<T> = action();
		await Concurrency.pause(minDuration);
		return await pWork;			// if the job finished during the pause return the result, otherwise return the result when the job finishes
	}

	// -------
	// DO ONCE
	// -------

	// cached values from doOnce calls (values cached for purpose)
	private static cachedDoOnceValues: GTS.DM.HashTable<any> = {};
	
	// lists of pending doOnce calls (grouped by purpose). This is the resolve function to finish the promise being awaited on
	private static currentDoOnceReqeusts: GTS.DM.HashTable<Function[]> = {};

	// get the result for purpose from cache, or by doing action and then cache the result for cacheDuration ms, -1 is cache forever, 0 is only cache concurrent requests
	public static async doOnce<T>(purpose:string, action:Function, cacheDuration:number): Promise<T|void>{
		if(!Concurrency.currentDoOnceReqeusts[purpose]){Concurrency.currentDoOnceReqeusts[purpose]=[];};		// ensure storage is initiated for requests wating for the specified purpose
		
		// reply from cache if have previous answer
		if(Concurrency.cachedDoOnceValues[purpose]){
			return Concurrency.cachedDoOnceValues[purpose] as T;		// return the value for the purpose
		}

		// find out if this is the first request to arrive (do test syncrhonously)
		let dr:DelayedResult<[boolean,Promise<T>]> = await Concurrency.limitToOneAtATime<[boolean,Promise<T>]>('doOnce_'+purpose, async function(){
			return [Concurrency.currentDoOnceReqeusts[purpose].length == 0, new Promise(async function(resolve){
				Concurrency.currentDoOnceReqeusts[purpose].push( resolve );
			})];
		});
		let a = await dr.getResult()!;
		if(a != null){
			let [isFirst, p] = a!;
			
			// if it is the first get the value for the purpose
			if(isFirst){ Concurrency.executeJobNotifyAndCacheResult(purpose, action, cacheDuration); }
			
			return p;   // return the promise waiting on the value for the purpose
		}

		return Promise.resolve();
	}

	// share same result with all concurrent reuests for a given purpose. Option to cache result for futher requests (-1 for ever, 0 no cache, 1+ cache duration in ms)
	static async executeJobNotifyAndCacheResult<T>(purpose:string, action:Function, cacheDuration:number):Promise<void>{
		// execute the job to get the value
		let jobValue:T = await action();
		// notify the value to all requests waiting on it
		while(Concurrency.currentDoOnceReqeusts[purpose].length > 0){
			let resolveRequest:Function|undefined = Concurrency.currentDoOnceReqeusts[purpose].shift();
			if(resolveRequest != undefined){
				resolveRequest(jobValue);
			}
		}
		// and cache the value if requried
		switch(cacheDuration){
			case -1: // keep results in cache (until ram is cleared)
				Concurrency.cachedDoOnceValues[purpose] = jobValue;
				return;
			case 0: // results not cache, just concurrent requests share same answer
				return;
			default:	// cache for a specified number of ms
				Concurrency.cachedDoOnceValues[purpose] = jobValue;
				await Concurrency.pause(cacheDuration);
				delete Concurrency.cachedDoOnceValues[purpose];
				return;
		}
	}

	// ------------
	// DO ALL ASYNC
	// ------------

	// start a bunch of async functions and continue once they are all done
	static async doAllAsync<T>( jobs:Function[]):Promise<T[]>{
		// create an array to track when each job provided is completed
		let completed:boolean[] = new Array(jobs.length).fill(false);
		let results:T[] = new Array(jobs.length);
		// return a promise we will notify when all jobs have been done
		var promiseAllCompleted:Function;			// how we will resolve the doAll promise
		let p:Promise<T[]> = new Promise(function(resolve:Function){
			promiseAllCompleted = resolve;
		});
		
		// asynchronously start all the jobs
		for(var i:number=0; i<jobs.length; i++){
			doJob(i);		// continue without waiting for job to complete
		}
		return p;

		// when each job completes, record that the job is done
		async function doJob(i:number){
			results[i] = await jobs[i]();
			completed[i] = true;
			
			// if all jobs are done resolve our promise to notify when all are done
			if(completed.every(Boolean)){
				promiseAllCompleted(results);
			}
		}
	}

	// --------------------
	// SEQUENCED START JOBS
	// --------------------
	private static expectedSequenceLookup: GTS.DM.HashTable<number> = {};
	public static inMemorySequenceTracking(purpose:string, sequence:number):GTS.DM.WrappedResult<string>{
		let retval:GTS.DM.WrappedResult<string> = new GTS.DM.WrappedResult();
		// ensure storage for sequence for purpose
		if(!Concurrency.expectedSequenceLookup[purpose]){ Concurrency.expectedSequenceLookup[purpose]=1;}
		// get the number of the expected sequence (starts at 1)
		let expectedSequence:number = Concurrency.expectedSequenceLookup[purpose];
		//console.log({log:'sequence test', purpose:purpose, sequence:sequence,expectedSequence:expectedSequence});
		// return "RunNow" when the sequence is that expected
		if(sequence == expectedSequence){Concurrency.expectedSequenceLookup[purpose]=++sequence; return retval.setData("RunNow");}
		// return "RunSoon" if the sequence is due to run soon
		if(sequence < (expectedSequence+10)){ return retval.setData("RunSoon"); }
		// return "Invalid" if the sequence is already run or is too far in the future
		return retval.setData("Invalid");
	}

	private static sequencedJobsWaiting: GTS.DM.HashTable<GTS.DM.HashTable<Function>> = {};

	static async doSequencedJob<T>(purpose:string, sequence:number, action:Function, actionArgs?:any[], seqCheckAndIncr?:Function, seqCheckArgs?:any[]):Promise<T>{
		// default to in memory sequence checking if no function provided
		if(seqCheckAndIncr==undefined){
			seqCheckAndIncr = Concurrency.inMemorySequenceTracking;
		}
		
		// inspect to start the scheduled jobs one at a time, only scheduling is synchronous, running of the jobs is asynchronous
		var drSyncSchedule:DelayedResult<DelayedResult<T>>;
		await new Promise<void>(async function(resolveOneAtATimeAccessScheduled){
			drSyncSchedule = await Concurrency.limitToOneAtATime<DelayedResult<T>>(
				purpose,		// que identifier (can have multiple ques run in parallel)
				async function(purp:string, seq:number, act:Function, actArgs:any[], sqChkIncr:Function, sqChkIncrArgs:any[]):Promise<DelayedResult<string>>{	// function to run when its turn comes in the que
					if(!Concurrency.sequencedJobsWaiting[purp]){Concurrency.sequencedJobsWaiting[purp]={};}
					let seqCheck:GTS.DM.WrappedResult<string> = await sqChkIncr!(purp,seq,...sqChkIncrArgs);
					// wrapped result
					console.log({seqCheck:seqCheck.data});
					switch(seqCheck.data){
						case "RunNow":
							// The sequence of the job at hand is the expected sequence
							// Prepare a delayed result that does the job
							var fDoResolveNow:Function;
							var drNow:DelayedResult<string>;
							await new Promise<void>(async function(varsSet:Function){
								[fDoResolveNow,drNow] = await DelayedResult.createDelayedResult<string>(async function(resolve:Function):Promise<void>{
									resolve(act(purp,seq, ...actArgs));
								});
								varsSet();
							})
							console.log('Running job now '+purp+seq)
							fDoResolveNow!();	// asynchronously start the job
							// resolve any scheduled jobs that are ready to do
							while(Concurrency.sequencedJobsWaiting[purp].hasOwnProperty(++seq)){
								let r:string = await sqChkIncr!(purp,seq,...sqChkIncrArgs);
								if(r=="RunNow"){
									let f:Function = Concurrency.sequencedJobsWaiting[purp][seq];
									f();
									delete Concurrency.sequencedJobsWaiting[purp][seq];
								}
							} 
							return drNow!;
						case "RunSoon":
							// the job at hand is due to run soon, schedule it to be done when the jobs required before it are started
							var fDoResolveSoon:Function;
							var drSoon:DelayedResult<string>;
							await new Promise<void>(async function(varsSet:Function){
								[fDoResolveSoon,drSoon] = await DelayedResult.createDelayedResult<string>(async function(resolve:Function):Promise<void>{
									resolve(act(purp,seq,...actArgs));
								});
								varsSet();
							})
							Concurrency.sequencedJobsWaiting[purp][seq]=fDoResolveSoon!;
							console.log('Qued to run soon '+purp+seq);
							return drSoon!;
						case "Invalid":
								console.log('In Invalid '+purp+seq);
								return Promise.reject("Invalid Sequence.");
						default:
							console.log('In default '+purp+seq);
							return Promise.reject("Unknown Result of Sequence Check.");
					}
					
				},
				purpose, sequence, action, actionArgs??[], seqCheckAndIncr, seqCheckArgs??[]		// parameters to the function that is run
			);
			resolveOneAtATimeAccessScheduled();
		});
		
		// One At a Time access now scheduled (and could be already running)
		var dr2:DelayedResult<T>;
		try{
			dr2 = await drSyncSchedule!.getResult();
			// Sequence Job now scheduled (and could be already running)
			let sjr:T = await dr2.getResult();
			// Sequence job has been executed, return the value from the executed job
			return sjr;
		} catch(err:any){
			console.log(err);
			return Promise.reject(err);
		}
		
		
	}
}
