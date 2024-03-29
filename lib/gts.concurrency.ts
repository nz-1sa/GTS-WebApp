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
	public reject(message:string){
		console.log('reject not yet set for promise');
	}
    constructor(pPromise:Promise<T>){
        this.p2 = pPromise;
    }
    public async getResult():Promise<T>{
        return this.p2;
    }
    public static async createDelayedResult<T>(pAction:IAsyncAction):Promise<[Function,DelayedResult<T>]>{
        var dr:DelayedResult<T>;
        var resolvePromiseDelayedResult:Function;
		var rejectPromiseDelayedResult:(message: string) => void;
        await new Promise(function(varsSetResolve:Function){
            dr = new DelayedResult<T>( new Promise(function(resolve, reject){
                resolvePromiseDelayedResult = function(){
                    pAction(resolve);
                }
				rejectPromiseDelayedResult = function(message:string){
					reject(message);
				}
            }) );
            varsSetResolve();
        });
		dr!.reject = rejectPromiseDelayedResult!;
        return [resolvePromiseDelayedResult!,dr!];
        // when resolvePromiseDelayedResult() is called dr.p2 will resolve with the value returned from resolvePromiseDelayedResult()
    }
}

class SequencedJobWaiting{
	public jobStarted:boolean = false;
	public startJob:Function;
	public timeoutJob:Function;
	constructor(jStart:Function, jTimeout:Function){
		this.jobStarted = false;
		this.startJob = async function(){this.jobStarted = true; await jStart(); };
		this.timeoutJob = async function(){if(!this.jobStarted){await jTimeout(); }};
	}
}

export class QuedJob<T>{
	started:boolean;
	subFunc:Function;
	dRes:DelayedResult<T>;
	constructor(f:Function, dr:DelayedResult<T>){
		this.started = false;
		this.subFunc = f;
		this.dRes = dr;
	}
	public async run():Promise<void>{
		this.started = true;
		await this.subFunc();
	}
	public isStarted():boolean{
		return this.started;
	}
	public async getResult():Promise<T>{
        return this.dRes.getResult();
    }
	public reject(message:string):void{
		this.dRes.reject(message);
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
		//console.log('in limitToOneAtATime');
		//console.log({purpose:purpose, fn:fn, args:args});
		// ensure there is a promise defined for the specified purpose (used to limit execution to one at a time within purpose)
		if(!Concurrency.limitOneAtATimePromises[purpose]){Concurrency.limitOneAtATimePromises[purpose]=Promise.resolve();};
		//console.log('storeage defined');

		var f:Function; var dr:DelayedResult<any>; var errMsg:string = '';
		await new Promise<void>(async function(resolveVarsSet:Function){
			//console.log('creating delayedResult');
			[f,dr] = await DelayedResult.createDelayedResult<any>(async function(resolve:Function):Promise<any>{
				// wait for other jobs that are scheduled to be done first
				//console.log('waiting for earlier jobs to be completed');
				await Concurrency.limitOneAtATimePromises[purpose];
				// set that this job is the job to be done
				//console.log('setting our job to be done');
				Concurrency.limitOneAtATimePromises[purpose] = Concurrency.limitOneAtATimePromises[purpose].then(
					// do the job resolving the value being awaited on
					async function(){
						//console.log('START ONE AT A TIME '+purpose);
						let val:any = await fn(...args)
							.catch((err:any)=>{console.log(err);errMsg='ERROR:'+err;})
							.then((val:any)=>{resolve(val);});
						//console.log('END ONE AT A TIME '+purpose);
					}
				);
			});
			resolveVarsSet();
		});
		//console.log('delayed result made');
		if(errMsg.length > 0){
			console.log('error is '+errMsg);
			return Promise.reject(errMsg);
		}
		//console.log('calling job');
		f!();				// call the function to the job
		if(errMsg.length > 0){
			console.log('error is '+errMsg);
			return Promise.reject(errMsg);
		}
		//console.log('returning promise for job');
		return dr!;		// return object wrapper of promise to wait for the job to be done
	}

	// -------------
	// X AT A TIME
	// -------------
	
	// allow limit on x at a time to be within a defined purpose
	private static limitXAtATimeQues: GTS.DM.HashTable<QuedJob<any>[]> = {};
	
	static async limitXAtATime<T>(purpose:string, fn:Function, ...args:any[]):Promise<DelayedResult<T>>{
		if(!Concurrency.limitXAtATimeQues[purpose]){Concurrency.limitXAtATimeQues[purpose]=[];};
		// create a delayed result that gives a promise for when the job is run
		var f:Function; var dr:DelayedResult<T>;
		[f,dr] = await DelayedResult.createDelayedResult<T>(async function(resolve:Function):Promise<void>{
			let r:T = await fn(...args);
			resolve(r);
		});
		let job:QuedJob<any> = new QuedJob(f,dr);
		await Concurrency.limitToOneAtATime<void>('limitXAtATime_'+purpose, async function(){
			console.log('OAAT_LIMX starting limitXAtATime '+purpose);
			Concurrency.limitXAtATimeQues[purpose].push(job);
			if(Concurrency.limitXAtATimeQues[purpose].length < 10){
				console.log('OAAT_LIMX job qued at '+Concurrency.limitXAtATimeQues[purpose].length+', starting now');
				job.run().then(()=>{
					//console.log('job finished, removing from que');
					// remove from que after job is done and start any waiting jobs
					Concurrency.finishedLimitedJob(purpose, job);
				});
			} else {
				console.log('OAAT_LIMX job delayed, qued at '+Concurrency.limitXAtATimeQues[purpose].length);
			}
			console.log('OAAT_LIMX end limitXAtATime '+purpose);
		});
		return dr;
	}
	
	static async finishedLimitedJob(purpose:string, job:any){
		await Concurrency.limitToOneAtATime<void>('limitXAtATime_'+purpose, async function(){
			console.log('OAAT_LIMX starting limitXAtATime '+purpose);
			Concurrency.limitXAtATimeQues[purpose].splice(Concurrency.limitXAtATimeQues[purpose].indexOf(job),1);
			console.log('OAAT_LIMX job removed from que');
			for(let i:number = 0; i < Concurrency.limitXAtATimeQues[purpose].length; i++){
				if(!Concurrency.limitXAtATimeQues[purpose][i].started){
					console.log('OAAT_LIMX delayd job being started');
					Concurrency.limitXAtATimeQues[purpose][i].run().then(()=>{
						// remove from que after job is done and start any waiting jobs
						//console.log('delayed job finished, removing from que');
						Concurrency.finishedLimitedJob(purpose, Concurrency.limitXAtATimeQues[purpose][i]);
					});
					break;
				}
			}
			console.log('OAAT_LIMX end limitXAtATime '+purpose);
		});
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

	private static sequencedJobsWaiting: GTS.DM.HashTable<GTS.DM.HashTable<SequencedJobWaiting>> = {};

	static async doSequencedJob<T>(purpose:string, sequence:number, action:Function, actionArgs?:any[], seqCheckAndIncr?:Function, seqCheckArgs?:any[]):Promise<T>{
		// default to in memory sequence checking if no function provided
		if(seqCheckAndIncr==undefined){
			seqCheckAndIncr = Concurrency.inMemorySequenceTracking;
		}
		
		// inspect to start the scheduled jobs one at a time, only scheduling is synchronous, running of the jobs is asynchronous
		var drSyncSchedule:DelayedResult<DelayedResult<T>>;
		await new Promise<void>(async function(resolveOneAtATimeAccessScheduled){
			drSyncSchedule = await Concurrency.limitToOneAtATime<DelayedResult<T>>(
				'synchronousTalk_'+purpose,		// que identifier (can have multiple ques run in parallel)
				async function(purp:string, seq:number, act:Function, actArgs:any[], sqChkIncr:Function, sqChkIncrArgs:any[]):Promise<DelayedResult<string>>{	// function to run when its turn comes in the que
					console.log('OAAT_SEQJOB starting synchronousTalk_'+purpose);
					if(!Concurrency.sequencedJobsWaiting[purp]){Concurrency.sequencedJobsWaiting[purp]={};}
					let seqCheck:GTS.DM.WrappedResult<string> = await sqChkIncr!(purp,seq,...sqChkIncrArgs);
					// Check if got and incremented sequence from db successfully
					if(seqCheck.error){
						console.log('OAAT_SEQJOB error checking and incrementing talk sequence in the db');
						console.log(seqCheck.message);
						console.log('OAAT_SEQJOB end synchronousTalk_'+purpose);
						return Promise.reject('Error double checking sequence to talk in the db');
					}
					
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
							console.log('OAAT_SEQJOB Running job now '+purp+'_'+seq)
							fDoResolveNow!();	// asynchronously start the job
							// resolve any scheduled jobs that are ready to do
							while(Concurrency.sequencedJobsWaiting[purp].hasOwnProperty(++seq)){
								let r:GTS.DM.WrappedResult<string> = await sqChkIncr!(purp,seq,...sqChkIncrArgs);
								if(r.error){
									console.log('OAAT_SEQJOB error checking and incrementing talk sequence in the db for qued job');
									console.log(r.message);
									console.log('OAAT_SEQJOB end synchronousTalk_'+purpose);
									return Promise.reject('Error double checking sequence to talk in the db for qued job');
								}
								
								//console.log({runNextResult:r});
								if(r.data=="RunNow"){
									console.log('OAAT_SEQJOB Running waiting job');
									let s:SequencedJobWaiting = Concurrency.sequencedJobsWaiting[purp][seq];
									s.startJob();
									delete Concurrency.sequencedJobsWaiting[purp][seq];
								}
							}
							console.log('OAAT_SEQJOB end synchronousTalk_'+purpose);
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
							});
							let s:SequencedJobWaiting = new SequencedJobWaiting(fDoResolveSoon!, function(){
								// clear job from que
								delete Concurrency.sequencedJobsWaiting[purp][seq];
								// somehow reject the promise
								drSoon.reject('timedout');
							});
							Concurrency.sequencedJobsWaiting[purp][seq]=s;
							console.log('OAAT_SEQJOB Qued to run soon '+purp+'_'+seq);
							// Put a timer on this, advance jobs have to arrive not just close in sequence, but close in time
							global.setTimeout(s.timeoutJob, 5000);
							console.log('OAAT_SEQJOB end synchronousTalk_'+purpose);
							return drSoon!;
						case "Invalid":
								console.log('OAAT_SEQJOB In Invalid '+purp+'_'+seq);
							console.log('OAAT_SEQJOB end synchronousTalk_'+purpose);
								return Promise.reject("Invalid Sequence.");
						default:
							console.log('OAAT_SEQJOB In default '+purp+'_'+seq+' '+seqCheck.data);
							console.log('OAAT_SEQJOB end synchronousTalk_'+purpose);
							return Promise.reject("Unknown Result of Sequence Check.");
					}
					
				},
				purpose, sequence, action, actionArgs??[], seqCheckAndIncr, seqCheckArgs??[]		// parameters to the function that is run
			);
			resolveOneAtATimeAccessScheduled();
		});
		
		// One At a Time access now scheduled (and could be already running)
		let haveError:boolean = false;
		let error:string = '';
		var dr2:DelayedResult<T>;
		await new Promise<void>(function(resolveVarsSet:Function){
			drSyncSchedule!.getResult()
				.then((dr:DelayedResult<T>|void)=>{
					if(!dr){
						haveError = true;
						error = error + 'Seq Check Error: void delayed result returned';
					} else {
						dr2 = dr;
					}
					resolveVarsSet();
					return;
				})
				.catch((err:any)=>{
					console.log(err);
					haveError = true;
					error = error + 'Seq Check Error: '+err;
					resolveVarsSet();
					return;
				});
		});
		if(haveError){
			return Promise.reject(error);
		} else {
			// Sequence Job now scheduled (and could be already running)
			let sjr:T = await dr2!.getResult();
			// Sequence job has been executed, return the value from the executed job
			return sjr;
		}
		
	}
}
