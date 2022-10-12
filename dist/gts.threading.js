"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DB = exports.ThreadingLog = exports.attachThreadingDebugInterface = exports.throttle = exports.SequencedJob = exports.singleLock = exports.doAllAsync = exports.doFuncOrTimeout = exports.Concurrency = exports.CancellableDelay = exports.pause = void 0;
const GTS = __importStar(require("./gts"));
const DBCore = __importStar(require("./gts.db"));
const WS = __importStar(require("./gts.webserver"));
const doLogging = false; // if thread debug logging is being recorded
let threadingLogId = 0; // incrementing ids for sequencing of log entries
const threadingLogGroup = new Date().getTime(); // single server, the id is in groups of when the file loaded
// shorthand to add log to DB if logging is enabled
function addThreadingLog(pUuid, pType, pPurpose, pAction, doLog) {
    return __awaiter(this, void 0, void 0, function* () {
        if (doLog === undefined) {
            doLog = doLogging;
        }
        if (doLog) {
            yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, pUuid, pType, pPurpose, pAction), pUuid);
        }
    });
}
// introduce a delay in code by allowing await for a setTimeout
function pause(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
exports.pause = pause;
// use setTimeout to introduce a delay in code that can be cancelled by using clearTimeout
class CancellableDelay {
    constructor(pTimeout, pPromise) {
        this.timeout = pTimeout;
        this.promise = pPromise;
    }
    // start waiting for a pause that can be cancelled
    static startCancellableDelay(ms) {
        return __awaiter(this, void 0, void 0, function* () {
            // ability to cancel the timeout, init to a dummy value to allow code to compile
            var delayTimeout = setTimeout(() => null, 1);
            // the promise that resolves when the timeout is done, init to a dummy value to allow code to compile
            var delayPromise = Promise.resolve();
            // set the real values for delayTimeout and delayPromise
            var promiseTimeoutSet = new Promise(function (resolveTimeoutSet, rejectTimeoutSet) {
                delayPromise = new Promise(function (resolve, reject) { delayTimeout = setTimeout(resolve, ms); resolveTimeoutSet(); });
            });
            // wait for the real values to be set to return, avoids race condition by ensuring the function in the promise constructor finishes before exiting function delayCancellable
            yield promiseTimeoutSet;
            // return the results
            return new CancellableDelay(delayTimeout, delayPromise);
        });
    }
}
exports.CancellableDelay = CancellableDelay;
class Concurrency {
    // provide setTimeout such that it can be awaited on
    static pause(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // for a given purpose, limit concurrency to one at a time
    static limitToOneAtATime(purpose, fn, ...args) {
        return __awaiter(this, void 0, void 0, function* () {
            // ensure there is a promise defined to limit execution to one at a time for the specified purpose
            if (!Concurrency.limitOneAtATimePromises[purpose]) {
                Concurrency.limitOneAtATimePromises[purpose] = Promise.resolve();
            }
            ;
            // get the value from when the job is done
            var retval = yield new Promise(function (resolve) {
                return __awaiter(this, void 0, void 0, function* () {
                    // wait for other jobs that are scheduled to be done first
                    yield Concurrency.limitOneAtATimePromises[purpose];
                    // set that this job is the job to be done
                    Concurrency.limitOneAtATimePromises[purpose] = Concurrency.limitOneAtATimePromises[purpose].then(
                    // do the job resolving the value being awaited on
                    function () {
                        return __awaiter(this, void 0, void 0, function* () { resolve(yield fn(...args)); });
                    });
                });
            });
            // return the value
            return retval;
        });
    }
}
exports.Concurrency = Concurrency;
// allow limit on concurrency to be within a defined purpose
Concurrency.limitOneAtATimePromises = {};
{
    timeout: NodeJS.Timeout; // the timeout from a setTimeout (clear to cancel)
    promise: Promise(); // the promise that is resolved the the setTimout finishes
    constructor(pTimeout, NodeJS.Timeout, pPromise, Promise(), {
        this: .timeout = pTimeout,
        this: .promise = pPromise
    });
}
async;
startCancellableDelay(ms, number);
Promise < CancellableDelay > {
    // ability to cancel the timeout, init to a dummy value to allow code to compile
    var: delayTimeout, NodeJS, : .Timeout = setTimeout(() => null, 1),
    // the promise that resolves when the timeout is done, init to a dummy value to allow code to compile
    var: delayPromise, void:  > , Promise, : .resolve(),
    // set the real values for delayTimeout and delayPromise
    await: new Promise(function (resolveTimeoutSet, rejectTimeoutSet) {
        delayPromise = new Promise(function (resolve, reject) { delayTimeout = setTimeout(resolve, ms); resolveTimeoutSet(); });
    }),
    // return the results
    return: new CancellableDelay(delayTimeout, delayPromise)
};
;
// start doing a job, but return if the allowed time is up. NOTE: job continues to run when timeout occurs, just the result is no longer waited on
function doFuncOrTimeout(uuid, timeout, action) {
    return __awaiter(this, void 0, void 0, function* () {
        let funcOver = false;
        var ourTimeout; // ability to cancel time limit if work is done first
        var promiseDoneOrTimedout; // how we will resolve this promise
        let p = new Promise(function (resolve, reject) {
            promiseDoneOrTimedout = resolve;
        });
        yield addThreadingLog(uuid, 'doFuncOrTimeout', '', 'starting job with timeout');
        limitTime(uuid, timeout);
        doJob(uuid, action);
        return p;
        function limitTime(uuid, timeout) {
            return __awaiter(this, void 0, void 0, function* () {
                let delay = yield CancellableDelay.startCancellableDelay(timeout);
                ourTimeout = delay.timeout;
                yield delay.promise;
                if (!funcOver) {
                    funcOver = true;
                    yield addThreadingLog(uuid, 'doFuncOrTimeout', '', 'the job timed out');
                    promiseDoneOrTimedout([null, true]); // resolves the promise returned by doFuncOrTimeout. Null result, true for timeout
                    return;
                }
                yield addThreadingLog(uuid, 'doFuncOrTimeout', '', 'timeout finished after doJob');
            });
        }
        function doJob(uuid, action) {
            return __awaiter(this, void 0, void 0, function* () {
                let res = yield action(uuid);
                if (!funcOver) {
                    funcOver = true;
                    yield addThreadingLog(uuid, 'doFuncOrTimeout', '', 'doJob finished before timeout');
                    clearTimeout(ourTimeout);
                    promiseDoneOrTimedout([res, false]); // resolves promise with the result of the action, false for not timeout
                    return;
                }
                yield addThreadingLog(uuid, 'doFuncOrTimeout', '', 'doJob finished after timeout');
            });
        }
    });
}
exports.doFuncOrTimeout = doFuncOrTimeout;
class DoOnceJob {
    constructor(pUuid, pResolve) {
        this.uuid = pUuid;
        this.resolve = pResolve;
    }
    // synchronously do async jobs
    static doSyncCheckJobCountIsInProgress() {
        return __awaiter(this, void 0, void 0, function* () {
            yield checkJobCountIsInProgressPromise; // wait for any previous check that is pending
            checkJobCountIsInProgressPromise = checkJobCountIsInProgressPromise.then(() => fn(...args)); // get others to wait while we check
        });
    }
    // get the result for purpose from cache, or by doing action and then cache the result for cacheDuration ms, -1 is cache forever, 0 is only cache concurrent requests
    static executeOnce(pUuid, purpose, action, cacheDuration) {
        return __awaiter(this, void 0, void 0, function* () {
            yield addThreadingLog(pUuid, 'DoOnceJob.executeOnce', purpose, 'entered function'); // if logging is on then add a log that this method has been called
            if (!DoOnceJob.currentReqeusts[purpose]) {
                DoOnceJob.currentReqeusts[purpose] = [];
            }
            ; // ensure storage is initiated for requests wating for the specified purpose
            // reply from cache if have previous answer
            if (DoOnceJob.cachedValues[purpose]) {
                yield addThreadingLog(pUuid, 'DoOnceJob.executeOnce', purpose, 'returned cached value'); // if logging is on then add a log that the valiue has been returned from cache
                return DoOnceJob.cachedValues[purpose]; // return the value for the purpose
            }
            //TODO: this should be in a que to prevent similtaneous calls missing starting the job
            // add to a list of requests waiting on response
            let p = new Promise(function (resolve, reject) {
                return __awaiter(this, void 0, void 0, function* () {
                    yield addThreadingLog(pUuid, 'DoOnceJob.executeOnce', purpose, 'Pausing thread while waiting for job');
                    DoOnceJob.currentReqeusts[purpose].push(new DoOnceJob(pUuid, resolve));
                });
            });
            // if this is the first request wanting the response, go get it async
            if (DoOnceJob.currentReqeusts[purpose].length == 1) {
                DoOnceJob.executeJobNotifyAndCacheResult(pUuid, purpose, action, cacheDuration);
            }
            //END OF TODO
            // return a promise to be waited on that is fulfilled when the response is known
            return p;
        });
    }
    // remove the cached value for a specified purpose, uuid is an identifier for logging
    static removeCachedItem(pUuid, purpose) {
        return __awaiter(this, void 0, void 0, function* () {
            if (DoOnceJob.cachedValues[purpose]) {
                yield addThreadingLog(pUuid, 'multiThreadDoOnce', purpose, 'item removed from cache'); // if logging is on add a log that the cached value for purpose has been removed
                delete DoOnceJob.cachedValues[purpose]; // remove the cached value
            }
        });
    }
    // remove all cached values, uuid is an identifier for logging
    static clearCache(pUuid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield addThreadingLog(pUuid, 'multiThreadDoOnce', '', 'cache cleared'); // if logging is on add a log that the cached values have been cleared
            DoOnceJob.cachedValues = {}; // clear the cached values
        });
    }
    // share same result with all concurrent reuests for a given purpose. Option to cache result for futher requests (-1 for ever, 0 no cache, 1+ cache duration in ms)
    static executeJobNotifyAndCacheResult(pUuid, purpose, action, cacheDuration) {
        return __awaiter(this, void 0, void 0, function* () {
            let jobValue = yield action(pUuid);
            while (DoOnceJob.currentReqeusts[purpose].length > 0) {
                let j = DoOnceJob.currentReqeusts[purpose].shift();
                if (j != undefined) {
                    j.resolve(jobValue);
                    yield addThreadingLog(j.uuid, 'multiThreadDoOnce', purpose, 'resumed thread waiting for job');
                }
            }
            switch (cacheDuration) {
                case -1: // keep results in cache (until ram is cleared)
                    DoOnceJob.cachedValues[purpose] = jobValue;
                    yield addThreadingLog(pUuid, 'multiThreadDoOnce', purpose, 'job perma cached');
                    return;
                case 0: // results not cache, just concurrent requests share same answer
                    return;
                default: // cache for a specified number of ms
                    DoOnceJob.cachedValues[purpose] = jobValue;
                    yield pause(cacheDuration);
                    delete DoOnceJob.cachedValues[purpose];
                    return;
            }
        });
    }
}
// cached values from executeOnce calls (values cached for purpose)
DoOnceJob.cachedValues = {};
// lists of pending requests (grouped by purpose)
DoOnceJob.currentReqeusts = {};
// a promise is used to ensure there will not be concurrent checks of if to do the request. Resolved at first as is not in use
DoOnceJob.checkJobCountIsInProgressPromise = Promise.resolve();
/*let doOnceStatus:GTS.DM.HashTable<number> = {};
let doOnceWaiting:GTS.DM.HashTable<DoOnceWaitingJob[]> = {};
export async function multiThreadDoOnce<T>(purpose:string, uuid:string, action:Function, timeout:number):Promise<T>{
    await addThreadingLog(uuid,'multiThreadDoOnce',purpose,'entered function');
    let jobStatus:number = doOnceStatus[purpose]?doOnceStatus[purpose]:0;
    doOnceStatus[purpose] = ++jobStatus;
    if(!doOnceWaiting[purpose]){doOnceWaiting[purpose]=[];}
    var jobValue:T;
    if(jobStatus == 1){		// first in, do the job
        await addThreadingLog(uuid,'multiThreadDoOnce',purpose,'starting job');
        
        //TODO: timeout > 0 then doFuncOrTimeout else await action
        jobValue = await action(uuid);
        await addThreadingLog(uuid,'multiThreadDoOnce',purpose,'finished job');
        doOnceStatus[purpose] = jobStatus = 100;	// flag the job has been done, no more threads will be added now to waiting to resolve
        // release any threads waiting on the completion of the job
        let waitingToResolve = doOnceWaiting[purpose];
        for(var i=0; i<waitingToResolve.length; i++){
            waitingToResolve[i].resolve(jobValue);												// let any and all waiting in the que proceed now the job is done
            await addThreadingLog(waitingToResolve[i].uuid,'multiThreadDoOnce',purpose,'resumed thread waiting for job');
        }
        waitingToResolve = doOnceWaiting[purpose] = [];		// clear list now they are all resolved
        return new Promise(function(resolve, reject){resolve(jobValue)});
    }
    if(jobStatus < 100){// que additional requests that arrive while the job is being done
        doOnceStatus[purpose] = --jobStatus;		// keep tracking value low, while waiting for the job to be done
        return new Promise(async function(resolve, reject){
            await addThreadingLog(uuid,'multiThreadDoOnce',purpose,'Pausing thread while waiting for job');
            doOnceWaiting[purpose].push({uuid:uuid,resolve:resolve});
        });
    }
    if(jobStatus == 200){	// reset tracking to prevent too large a number being used
        doOnceStatus[purpose] = jobStatus = 100;	// numbers 100 and above show the job has been done
    }
    // nothing to do as it was already done once
    await addThreadingLog(uuid,'multiThreadDoOnce',purpose,'job was already completed');
    return new Promise(function(resolve, reject){resolve(jobValue)});		//TODO: jobValue does not have its value (just is default value)
} */
// start a bunch of async functions and continue once they are all done
function doAllAsync(jobs, uuid, purpose) {
    return __awaiter(this, void 0, void 0, function* () {
        yield addThreadingLog(uuid, 'doAllAsync', purpose, 'start with ' + jobs.length + ' jobs');
        // create an array to track when each job provided is completed
        let results = new Array(jobs.length).fill(false);
        // return a promise we will notify when all jobs have been done
        var promiseAllResolve; // how we will resolve this promise
        let p = new Promise(function (resolve, reject) {
            promiseAllResolve = resolve;
        });
        // asynchronously start all the jobs
        for (var i = 0; i < jobs.length; i++) {
            yield addThreadingLog(uuid, 'doAllAsync', purpose, `started job ${i}`);
            doJob(i, uuid, purpose); // continue without waiting for job to complete
        }
        return p;
        // when each job completes, record that the job is done
        function doJob(i, uuid, purpose) {
            return __awaiter(this, void 0, void 0, function* () {
                yield jobs[i]();
                results[i] = true;
                // if all jobs are done resolve our promise to notify when all are done
                if (results.every(Boolean)) {
                    yield addThreadingLog(uuid, 'doAllAsync', purpose, `finished job ${i}, all jobs done`);
                    promiseAllResolve();
                }
                yield addThreadingLog(uuid, 'doAllAsync', purpose, `finished job ${i}`);
            });
        }
    });
}
exports.doAllAsync = doAllAsync;
class SingleLockWaitingJob {
    constructor(pUuid, pAction, pResolve, pProcess) {
        this.uuid = pUuid;
        this.action = pAction;
        this.resolve = pResolve;
        this.process = pProcess;
    }
}
let singleLockStatus = {};
let singleLockWaiting = {};
// Que jobs doing each on in turn in the order they arrive
function singleLock(purpose, uuid, action, doLog) {
    return __awaiter(this, void 0, void 0, function* () {
        if (doLog === undefined) {
            doLog = doLogging;
        } // if no param is given to do logging, use the default
        yield addThreadingLog(uuid, 'SingleLock', purpose, 'new job/thread arrives', doLog);
        //console.log(`${uuid} ${purpose} singleLock`);
        // find out if there is currently a job being processed as this one arrives to be done
        if (!singleLockWaiting[purpose]) {
            singleLockWaiting[purpose] = [];
        }
        let jobProcessing = singleLockStatus[purpose] ? singleLockStatus[purpose] : false;
        singleLockStatus[purpose] = jobProcessing;
        // if there is a job being processed
        if (jobProcessing) {
            let existingJobCount = singleLockWaiting[purpose].length;
            yield addThreadingLog(uuid, 'SingleLock', purpose, 'job already being processed, ' + existingJobCount + ' jobs in the que', doLog);
            //console.log(`${uuid} ${purpose} job already being processed, ${existingJobCount} jobs in the que`);
            // return a promise that the job will be done when it can be
            return new Promise(function (resolve, reject) {
                return __awaiter(this, void 0, void 0, function* () {
                    // que this job to be done when possible
                    singleLockWaiting[purpose].push({ uuid: uuid, action: action, resolve: resolve, process: function (uuid, action, resolve) {
                            return __awaiter(this, void 0, void 0, function* () {
                                yield addThreadingLog(uuid, 'SingleLock', purpose, 'qued job being processed', doLog);
                                //console.log(`${uuid} ${purpose} qued job being processed`);
                                // do this job when the time comes
                                let jobValue = yield action(uuid);
                                yield addThreadingLog(uuid, 'SingleLock', purpose, 'qued job done', doLog);
                                //console.log(`${uuid} ${purpose} qued job done`);
                                let r = singleLockWaiting[purpose].shift();
                                if (r) {
                                    // and when it is done process the next job in the que if any
                                    let existingJobCount = singleLockWaiting[purpose].length;
                                    yield addThreadingLog(uuid, 'SingleLock', purpose, 'got another qued job, ' + existingJobCount + ' more in que', doLog);
                                    //console.log(`${uuid} ${purpose} found another job qued`);
                                    r.process(r.uuid, r.action, r.resolve);
                                }
                                else {
                                    // flag that processing is finished if we have just done the last job in the que
                                    jobProcessing = singleLockStatus[purpose] = false;
                                    yield addThreadingLog(uuid, 'SingleLock', purpose, 'que finished', doLog);
                                    //console.log(`${uuid} ${purpose} que finished`);
                                }
                                // let the thread continue that was waiting for the job to be done
                                resolve(jobValue);
                                yield addThreadingLog(uuid, 'SingleLock', purpose, 'job/thread released');
                                //console.log(`${uuid} ${purpose} qued job released`);
                            });
                        } });
                    yield addThreadingLog(uuid, 'SingleLock', purpose, 'job qued', doLog);
                });
            });
        }
        // start the job if there are no others to wait for
        singleLockStatus[purpose] = jobProcessing = true;
        yield addThreadingLog(uuid, 'SingleLock', purpose, 'start processing job', doLog);
        //console.log(`${uuid} ${purpose} start processing job`);
        let jobValueFirst = yield action(uuid);
        yield addThreadingLog(uuid, 'SingleLock', purpose, 'job done', doLog);
        //console.log(`${uuid} ${purpose} job done`);
        let r = singleLockWaiting[purpose].shift();
        if (r) {
            // and when it is done process a job in the que if any
            let existingJobCount = singleLockWaiting[purpose].length;
            yield addThreadingLog(uuid, 'SingleLock', purpose, 'got a qued job, ' + existingJobCount + ' more in que', doLog);
            //console.log(`${uuid} ${purpose} found a qued job`);
            r.process(r.uuid, r.action, r.resolve);
        }
        else {
            // flag that processing is finished if there is no que
            jobProcessing = singleLockStatus[purpose] = false;
            yield addThreadingLog(uuid, 'SingleLock', purpose, 'que not used', doLog);
        }
        // let the thread continue that called to have the job done
        yield addThreadingLog(uuid, 'SingleLock', purpose, 'job released', doLog);
        //console.log(`${uuid} ${purpose} job released`);
        return jobValueFirst;
    });
}
exports.singleLock = singleLock;
// jobs that start in sequence
class SequencedJob {
    constructor(pUuid, pPurpose, pReqSequence, pSeqCheck, pAction, pResolve, pReject) {
        this.uuid = pUuid;
        this.purpose = pPurpose;
        this.reqSequence = pReqSequence;
        this.seqCheck = pSeqCheck;
        this.action = pAction;
        this.resolve = pResolve;
        this.reject = pReject;
    }
    static attemptSequencedJob(uuid, purpose, reqSequence, expectedSequence, seqCheck, action, doLog) {
        return __awaiter(this, void 0, void 0, function* () {
            if (doLog === undefined) {
                doLog = doLogging;
            } // if no param is given to do logging, use the default
            if (!SequencedJob.jobsWaiting[purpose]) {
                SequencedJob.jobsWaiting[purpose] = {};
            } // ensure storage defined for purpose
            // just do the request if it is in the correct order
            if (reqSequence == expectedSequence) {
                yield addThreadingLog(uuid, 'SequencedStartLock', purpose, 'job arrived for expected sequence #' + reqSequence, doLog);
                // remove store if previous request was qued for the sequence we are processing now
                let cur = reqSequence.toString();
                if (SequencedJob.jobsWaiting[purpose].hasOwnProperty(cur)) {
                    delete SequencedJob.jobsWaiting[purpose][cur];
                    yield addThreadingLog(uuid, 'SequencedStartLock', purpose, 'deleted prequed job for #' + reqSequence + ' as a new request arrived at the expected sequence');
                }
                return new Promise(function (resolve, reject) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let curJob = new SequencedJob(uuid, purpose, reqSequence, seqCheck, action, resolve, reject);
                        curJob.processSequencedJob(doLog);
                    });
                });
            }
            if (reqSequence < expectedSequence) {
                yield addThreadingLog(uuid, 'SequencedStartLock', purpose, 'job arrived for already started, expected ' + expectedSequence + ' and got sequence #' + reqSequence);
                return Promise.reject('incorrect sequence');
            }
            if (reqSequence < (expectedSequence + 11)) {
                let key = reqSequence.toString();
                yield addThreadingLog(uuid, 'SequencedStartLock', purpose, 'will que future job #' + reqSequence + ' as are almost there from ' + expectedSequence, doLog);
                // return a promise that the job will be done on its turn
                return new Promise(function (resolve, reject) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let quedJob = new SequencedJob(uuid, purpose, reqSequence, seqCheck, action, resolve, reject);
                        SequencedJob.jobsWaiting[purpose][key] = quedJob;
                        yield addThreadingLog(uuid, 'SequencedStartLock', purpose, 'job qued #' + reqSequence, doLog);
                    });
                });
                //TODO: should the above return be a timeout
                // Threading.doFuncOrTimeout
            }
            else {
                yield addThreadingLog(uuid, 'SequencedStartLock', purpose, 'job arrived for too far in the future, wanted ' + expectedSequence + ' and got sequence #' + reqSequence, doLog);
                return Promise.reject('incorrect sequence');
            }
        });
    }
    //TODO: unque sequene job (as has timed out)
    processSequencedJob(doLog) {
        return __awaiter(this, void 0, void 0, function* () {
            //TODO: test decryption is legit  before sequence test/increment
            let res = yield this.seqCheck(this.uuid, this.purpose, this.reqSequence);
            console.log('double check is');
            console.log(res);
            if (res.error) {
                yield addThreadingLog(this.uuid, 'SequencedStartLock', this.purpose, 'DB error checking sequence #' + this.reqSequence, doLog);
                this.reject('Sequene Check Error'); //TODO: Is this correct logic? Cancel the  job, how can we process them when there is an error checking sequence
            }
            let doubleCheck = res.data;
            if (!doubleCheck) {
                yield addThreadingLog(this.uuid, 'SequencedStartLock', this.purpose, 'Sequene check failed for #' + this.reqSequence, doLog);
                this.reject('Sequene Check Failed'); //TODO: Is this correct logic? Cancel the job if is the wrong sequence
                return;
            }
            // Log and do the job
            yield addThreadingLog(this.uuid, 'SequencedStartLock', this.purpose, 'started job #' + this.reqSequence, doLog);
            let jobValue = yield this.action(this.uuid, this.purpose, this.reqSequence);
            yield addThreadingLog(this.uuid, 'SequencedStartLock', this.purpose, 'finished job #' + this.reqSequence, doLog);
            // Check if there is a next job waiting
            let next = (this.reqSequence + 1).toString();
            if (SequencedJob.jobsWaiting[this.purpose].hasOwnProperty(next)) {
                yield addThreadingLog(this.uuid, 'SequencedStartLock', this.purpose, 'continuing to next job, #' + next + ' afer doing #' + this.reqSequence, doLog);
                // async start qued job
                let doNext = function (pPurpose, pNext) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let nextJob = SequencedJob.jobsWaiting[pPurpose][pNext];
                        nextJob.processSequencedJob(doLog);
                    });
                };
                doNext(this.purpose, next);
            }
            // let the thread continue that was waiting for the job to be done
            this.resolve(jobValue);
            yield addThreadingLog(this.uuid, 'SequencedStartLock', this.purpose, 'job/thread released #' + this.reqSequence, doLog);
        });
    }
}
exports.SequencedJob = SequencedJob;
SequencedJob.jobsWaiting = {};
let throttleStatus = {};
let throttleWaiting = {};
let throttleLastDone = {};
// Que jobs doing each on in turn in the order they arrive, with a delay between jobs
function throttle(uuid, purpose, delay, action, doLog) {
    return __awaiter(this, void 0, void 0, function* () {
        yield addThreadingLog(uuid, 'Throttle', purpose, 'new job/thread arrives', doLog);
        // find out if there is currently a job being processed as this one arrives to be done
        if (!throttleWaiting[purpose]) {
            throttleWaiting[purpose] = [];
        }
        let jobProcessing = throttleStatus[purpose] ? throttleStatus[purpose] : false;
        throttleStatus[purpose] = jobProcessing;
        if (!throttleLastDone[purpose]) {
            throttleLastDone[purpose] = 0;
        }
        // if there is a job being processed
        if (jobProcessing) {
            let existingJobCount = throttleWaiting[purpose].length;
            yield addThreadingLog(uuid, 'Throttle', purpose, 'job already being processed, ' + existingJobCount + ' jobs in the que', doLog);
            // return a promise that the job will be done when it can be
            return new Promise(function (resolve, reject) {
                return __awaiter(this, void 0, void 0, function* () {
                    // que this job to be done when possible
                    throttleWaiting[purpose].push({ uuid: uuid, action: action, resolve: resolve, process: function (uuid, action, resolve) {
                            return __awaiter(this, void 0, void 0, function* () {
                                // Delay que if needed to enforece throttle
                                let ticks = new Date().getTime();
                                //console.log(`For throttle now is ${ticks}, last done at ${throttleLastDone[purpose]}`);
                                let delayDone = ticks - throttleLastDone[purpose];
                                if (delayDone < delay) {
                                    yield addThreadingLog(uuid, 'Throttle', purpose, `enforced delay of ${delay - delayDone}`, doLog);
                                    //console.log(`Throttle delaying ${delay-delayDone}`);
                                    yield pause(delay - delayDone);
                                    //console.log('Throttle delay done');
                                }
                                //console.log('qued job being processed');
                                yield addThreadingLog(uuid, 'Throttle', purpose, 'qued job being processed', doLog);
                                // do this job when the time comes
                                let jobValue = yield action(uuid);
                                // record when job is done
                                throttleLastDone[purpose] = new Date().getTime();
                                yield addThreadingLog(uuid, 'Throttle', purpose, 'qued job done', doLog);
                                //console.log('job done');
                                // try and process next job in the que
                                let r = throttleWaiting[purpose].shift();
                                if (r) {
                                    // and when it is done process the next job in the que if any
                                    let existingJobCount = throttleWaiting[purpose].length;
                                    yield addThreadingLog(uuid, 'Throttle', purpose, 'got another qued job, ' + existingJobCount + ' more in que', doLog);
                                    r.process(r.uuid, r.action, r.resolve);
                                }
                                else {
                                    // flag that processing is finished if we have just done the last job in the que
                                    jobProcessing = throttleStatus[purpose] = false;
                                    yield addThreadingLog(uuid, 'Throttle', purpose, 'que finished', doLog);
                                }
                                // let the thread continue that was waiting for the job to be done
                                resolve(jobValue);
                                yield addThreadingLog(uuid, 'Throttle', purpose, 'job/thread released', doLog);
                            });
                        } });
                    yield addThreadingLog(uuid, 'Throttle', purpose, 'job qued', doLog);
                });
            });
        }
        // start the job if there are no others to wait for
        throttleStatus[purpose] = jobProcessing = true;
        // Delay que if needed to enforece throttle
        let ticksFirst = new Date().getTime();
        //console.log(`For throttle first now is ${ticksFirst}, last done at ${throttleLastDone[purpose]}`);
        let delayDoneFirst = ticksFirst - throttleLastDone[purpose];
        if (delayDoneFirst < delay) {
            yield addThreadingLog(uuid, 'Throttle', purpose, `enforced delay of ${delay - delayDoneFirst}`, doLog);
            //console.log(`Throttle delaying ${delay-delayDoneFirst}`);
            yield pause(delay - delayDoneFirst);
            //console.log('Throttle delay done');
        }
        //console.log('start processing job');
        yield addThreadingLog(uuid, 'Throttle', purpose, 'start processing job', doLog);
        // do the job
        let jobValueFirst = yield action(uuid);
        // record when job is done
        throttleLastDone[purpose] = new Date().getTime();
        yield addThreadingLog(uuid, 'Throttle', purpose, 'job done', doLog);
        //console.log('job done');
        // try and process any job in the que
        let r = throttleWaiting[purpose].shift();
        if (r) {
            // and when it is done process a job in the que if any
            let existingJobCount = throttleWaiting[purpose].length;
            yield addThreadingLog(uuid, 'Throttle', purpose, 'got a qued job, ' + existingJobCount + ' more in que', doLog);
            r.process(r.uuid, r.action, r.resolve);
        }
        else {
            // flag that processing is finished if there is no que
            jobProcessing = throttleStatus[purpose] = false;
            yield addThreadingLog(uuid, 'Throttle', purpose, 'que not used', doLog);
        }
        // let the thread continue that called to have the job done
        yield addThreadingLog(uuid, 'Throttle', purpose, 'job released', doLog);
        //console.log(`${uuid} ${purpose} job released`);
        return jobValueFirst;
    });
}
exports.throttle = throttle;
function attachThreadingDebugInterface(web, webapp) {
    webapp.get('/threadinglogs', (req, res) => res.sendFile(web.getFile('threadinglogs.html')));
    web.registerHandler(webapp, '/req/threadinglogs', [], function (uuid) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let getLogs = yield DB.getThreadingLogs(uuid);
                if (getLogs.error) {
                    return new WS.WebResponse(false, 'Error fetching threading logs\r\n' + getLogs.message, 'Error fetching threading logs', '');
                }
                let jsonLogs = JSON.stringify(getLogs.data);
                return new WS.WebResponse(true, '', `Fetched Threadinglogs`, jsonLogs);
            }
            catch (err) {
                return new WS.WebResponse(false, 'Error fetching threading logs\r\n' + err, 'Error fetching threading logs', '');
            }
        });
    });
    web.registerHandler(webapp, '/req/prune-threadinglogs', ['id'], function (uuid, idCheck) {
        return __awaiter(this, void 0, void 0, function* () {
            let result = yield DB.pruneThreadinglogs(uuid, idCheck.value);
            if (result.error) {
                return new WS.WebResponse(false, result.message, 'Failed to prune Threadinglogs', '');
            }
            else {
                return new WS.WebResponse(true, '', 'Pruned Threadinglogs', '');
            }
        });
    });
    web.registerHandler(webapp, '/OneAtATime', [], function (uuid) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let jobs = [function () {
                        return __awaiter(this, void 0, void 0, function* () { yield doTest(uuid); });
                    }, function () {
                        return __awaiter(this, void 0, void 0, function* () { yield doTest(uuid); });
                    }, function () {
                        return __awaiter(this, void 0, void 0, function* () { yield doTest(uuid); });
                    },
                    function () {
                        return __awaiter(this, void 0, void 0, function* () { yield doTest(uuid); });
                    }, function () {
                        return __awaiter(this, void 0, void 0, function* () { yield doTest(uuid); });
                    }, function () {
                        return __awaiter(this, void 0, void 0, function* () { yield doTest(uuid); });
                    }];
                yield doAllAsync(jobs, uuid, 'Testing All Async');
                return new WS.WebResponse(true, '', 'Done OneAtATime Test', '<a href="./threadinglogs">View Logs</a>');
            }
            catch (err) {
                return new WS.WebResponse(false, 'Error running OneAtATime test\r\n' + err, 'Error running OneAtATime test', '');
            }
            function doTest(uuid) {
                return __awaiter(this, void 0, void 0, function* () {
                    yield singleLock('testing', uuid, function (uuidCallback) {
                        return __awaiter(this, void 0, void 0, function* () {
                            yield pause(1000);
                            return true;
                        });
                    });
                });
            }
        });
    });
    web.registerHandler(webapp, '/DoAllAsync', [], function (uuid) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let jobs = [function () {
                        return __awaiter(this, void 0, void 0, function* () { yield pause(2000); });
                    }, function () {
                        return __awaiter(this, void 0, void 0, function* () { yield pause(1900); });
                    }, function () {
                        return __awaiter(this, void 0, void 0, function* () { yield pause(1800); });
                    },
                    function () {
                        return __awaiter(this, void 0, void 0, function* () { yield pause(2000); });
                    }, function () {
                        return __awaiter(this, void 0, void 0, function* () { yield pause(1900); });
                    }, function () {
                        return __awaiter(this, void 0, void 0, function* () { yield pause(1800); });
                    }];
                yield doAllAsync(jobs, uuid, 'Testing /DoAllAsync');
                return new WS.WebResponse(true, '', 'Done DoAllAsync Test', '<a href="./threadinglogs">View Logs</a>');
            }
            catch (err) {
                return new WS.WebResponse(false, 'Error running DoAllAsync test\r\n' + err, 'Error running DoAllAsync test', '');
            }
        });
    });
}
exports.attachThreadingDebugInterface = attachThreadingDebugInterface;
// Multi-threading logic is logged. This may help future debugging
class ThreadingLog {
    constructor() {
        this.dbId = 0;
        this.threadingId = 0;
        this.threadingGroup = 0;
        this.uuid = '';
        this.type = '';
        this.purpose = '';
        this.action = '';
        this.loggedAt = 0;
    }
    setVals(pDbId, pThreadingId, pThreadingGroup, pUuid, pType, pPurpose, pAction, pLoggedAt) {
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
    setNew(pThreadingId, pThreadingGroup, pUuid, pType, pPurpose, pAction) {
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
exports.ThreadingLog = ThreadingLog;
var DB;
(function (DB) {
    function addThreadingLog(log, uuid) {
        return __awaiter(this, void 0, void 0, function* () {
            let fetchConn = yield DBCore.getConnection('addThreadingLog', uuid);
            if (fetchConn.error || fetchConn.data == null) {
                return new GTS.DM.WrappedResult().setError('DB Connection error\r\n' + fetchConn.message);
            }
            let client = fetchConn.data;
            yield client.query('CALL addThreadingLog($1,$2,$3,$4,$5,$6,$7);', [log.threadingId, log.threadingGroup, log.uuid, log.type, log.purpose, log.action, log.loggedAt]);
            return new GTS.DM.WrappedResult().setNoData();
        });
    }
    DB.addThreadingLog = addThreadingLog;
    // view all threading logs recorded
    function getThreadingLogs(uuid) {
        return __awaiter(this, void 0, void 0, function* () {
            let retvalData = [];
            let fetchConn = yield DBCore.getConnection('getWeblogs', uuid);
            if (fetchConn.error || fetchConn.data == null) {
                return new GTS.DM.WrappedResult().setError('DB Connection error\r\n' + fetchConn.message);
            }
            let client = fetchConn.data;
            const res = yield client.query('SELECT id, threadingid, threadinggroup, uuid, type, purpose, action, loggedat FROM ThreadingLogs ORDER BY loggedat ASC, threadingid ASC;');
            for (var i = 0; i < res.rowCount; i++) {
                let l = new ThreadingLog().setVals(res.rows[i].id, res.rows[i].threadingid, res.rows[i].threadinggroup, res.rows[i].uuid, res.rows[i].type, res.rows[i].purpose, res.rows[i].action, res.rows[i].loggedat);
                retvalData.push(l);
            }
            return new GTS.DM.WrappedResult().setData(retvalData);
        });
    }
    DB.getThreadingLogs = getThreadingLogs;
    function pruneThreadinglogs(uuid, id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let fetchConn = yield DBCore.getConnection('pruneThreadinglogs', uuid);
                if (fetchConn.error || fetchConn.data == null) {
                    return new GTS.DM.WrappedResult().setError('DB Connection error\r\n' + fetchConn.message);
                }
                let client = fetchConn.data;
                yield client.query('DELETE FROM ThreadingLogs WHERE id <= $1;', [id]);
                return new GTS.DM.WrappedResult().setNoData();
            }
            catch (err) {
                return new GTS.DM.WrappedResult().setError(err.toString());
            }
        });
    }
    DB.pruneThreadinglogs = pruneThreadinglogs;
    function actionSequence(uuid, purpose, reqSequence) {
        return __awaiter(this, void 0, void 0, function* () {
            let retval = new GTS.DM.WrappedResult();
            let fetchConn = yield DBCore.getConnection('actionSequence', uuid);
            if (fetchConn.error || fetchConn.data == null) {
                return retval.setError('DB Connection error\r\n' + fetchConn.message);
            }
            let client = fetchConn.data;
            const res = yield client.query('CALL actionSequence($1,$2,$3);', [purpose, reqSequence, 0]);
            if (res.rows[0].expectedSequence == reqSequence) {
                return retval.setData(true);
            }
            return retval.setData(false);
        });
    }
    DB.actionSequence = actionSequence;
})(DB = exports.DB || (exports.DB = {}));
