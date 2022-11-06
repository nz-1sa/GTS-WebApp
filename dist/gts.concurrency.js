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
exports.Concurrency = exports.QuedJob = exports.DelayedResult = void 0;
const GTS = __importStar(require("./gts"));
// Holds a promise that is resolved when a delay is completed, and a timeout that can clear/cancel the delay
class CancellableDelay {
    constructor(pTimeout, pPromise) {
        this.timeout = pTimeout;
        this.promise = pPromise;
    }
}
// for an action (paramaterless function) create a promise  to wait on a delayed result, and a function to call later that runs the action and resolves the promise
class DelayedResult {
    constructor(pPromise) {
        this.p2 = pPromise;
    }
    reject(message) {
        console.log('reject not yet set for promise');
    }
    getResult() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.p2;
        });
    }
    static createDelayedResult(pAction) {
        return __awaiter(this, void 0, void 0, function* () {
            var dr;
            var resolvePromiseDelayedResult;
            var rejectPromiseDelayedResult;
            yield new Promise(function (varsSetResolve) {
                dr = new DelayedResult(new Promise(function (resolve, reject) {
                    resolvePromiseDelayedResult = function () {
                        pAction(resolve);
                    };
                    rejectPromiseDelayedResult = function (message) {
                        reject(message);
                    };
                }));
                varsSetResolve();
            });
            dr.reject = rejectPromiseDelayedResult;
            return [resolvePromiseDelayedResult, dr];
            // when resolvePromiseDelayedResult() is called dr.p2 will resolve with the value returned from resolvePromiseDelayedResult()
        });
    }
}
exports.DelayedResult = DelayedResult;
class SequencedJobWaiting {
    constructor(jStart, jTimeout) {
        this.jobStarted = false;
        this.jobStarted = false;
        this.startJob = function () {
            return __awaiter(this, void 0, void 0, function* () { this.jobStarted = true; yield jStart(); });
        };
        this.timeoutJob = function () {
            return __awaiter(this, void 0, void 0, function* () { if (!this.jobStarted) {
                yield jTimeout();
            } });
        };
    }
}
class QuedJob {
    constructor(f, dr) {
        this.started = false;
        this.subFunc = f;
        this.dRes = dr;
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            this.started = true;
            yield this.subFunc();
        });
    }
    isStarted() {
        return this.started;
    }
    getResult() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.dRes.getResult();
        });
    }
    reject(message) {
        this.dRes.reject(message);
    }
}
exports.QuedJob = QuedJob;
// class to help make code that can be run concurrently
class Concurrency {
    // -----
    // PAUSE
    // -----
    // provide setTimeout such that it can be awaited on
    static pause(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
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
    static limitToOneAtATime(purpose, fn, ...args) {
        return __awaiter(this, void 0, void 0, function* () {
            //console.log('in limitToOneAtATime');
            //console.log({purpose:purpose, fn:fn, args:args});
            // ensure there is a promise defined for the specified purpose (used to limit execution to one at a time within purpose)
            if (!Concurrency.limitOneAtATimePromises[purpose]) {
                Concurrency.limitOneAtATimePromises[purpose] = Promise.resolve();
            }
            ;
            //console.log('storeage defined');
            var f;
            var dr;
            var errMsg = '';
            yield new Promise(function (resolveVarsSet) {
                return __awaiter(this, void 0, void 0, function* () {
                    //console.log('creating delayedResult');
                    [f, dr] = yield DelayedResult.createDelayedResult(function (resolve) {
                        return __awaiter(this, void 0, void 0, function* () {
                            // wait for other jobs that are scheduled to be done first
                            //console.log('waiting for earlier jobs to be completed');
                            yield Concurrency.limitOneAtATimePromises[purpose];
                            // set that this job is the job to be done
                            //console.log('setting our job to be done');
                            Concurrency.limitOneAtATimePromises[purpose] = Concurrency.limitOneAtATimePromises[purpose].then(
                            // do the job resolving the value being awaited on
                            function () {
                                return __awaiter(this, void 0, void 0, function* () {
                                    //console.log('START ONE AT A TIME '+purpose);
                                    let val = yield fn(...args)
                                        .catch((err) => { console.log(err); errMsg = 'ERROR:' + err; })
                                        .then((val) => { resolve(val); });
                                    //console.log('END ONE AT A TIME '+purpose);
                                });
                            });
                        });
                    });
                    resolveVarsSet();
                });
            });
            //console.log('delayed result made');
            if (errMsg.length > 0) {
                console.log('error is ' + errMsg);
                return Promise.reject(errMsg);
            }
            //console.log('calling job');
            f(); // call the function to the job
            if (errMsg.length > 0) {
                console.log('error is ' + errMsg);
                return Promise.reject(errMsg);
            }
            //console.log('returning promise for job');
            return dr; // return object wrapper of promise to wait for the job to be done
        });
    }
    static limitXAtATime(purpose, fn, ...args) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Concurrency.limitXAtATimeQues[purpose]) {
                Concurrency.limitXAtATimeQues[purpose] = [];
            }
            ;
            // create a delayed result that gives a promise for when the job is run
            var f;
            var dr;
            [f, dr] = yield DelayedResult.createDelayedResult(function (resolve) {
                return __awaiter(this, void 0, void 0, function* () {
                    let r = yield fn(...args);
                    resolve(r);
                });
            });
            let job = new QuedJob(f, dr);
            yield Concurrency.limitToOneAtATime('limitXAtATime_' + purpose, function () {
                return __awaiter(this, void 0, void 0, function* () {
                    console.log('OAAT_LIMX starting limitXAtATime ' + purpose);
                    Concurrency.limitXAtATimeQues[purpose].push(job);
                    if (Concurrency.limitXAtATimeQues[purpose].length < 10) {
                        console.log('OAAT_LIMX job qued at ' + Concurrency.limitXAtATimeQues[purpose].length + ', starting now');
                        job.run().then(() => {
                            //console.log('job finished, removing from que');
                            // remove from que after job is done and start any waiting jobs
                            Concurrency.finishedLimitedJob(purpose, job);
                        });
                    }
                    else {
                        console.log('OAAT_LIMX job delayed, qued at ' + Concurrency.limitXAtATimeQues[purpose].length);
                    }
                    console.log('OAAT_LIMX end limitXAtATime ' + purpose);
                });
            });
            return dr;
        });
    }
    static finishedLimitedJob(purpose, job) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Concurrency.limitToOneAtATime('limitXAtATime_' + purpose, function () {
                return __awaiter(this, void 0, void 0, function* () {
                    console.log('OAAT_LIMX starting limitXAtATime ' + purpose);
                    Concurrency.limitXAtATimeQues[purpose].splice(Concurrency.limitXAtATimeQues[purpose].indexOf(job), 1);
                    console.log('OAAT_LIMX job removed from que');
                    for (let i = 0; i < Concurrency.limitXAtATimeQues[purpose].length; i++) {
                        if (!Concurrency.limitXAtATimeQues[purpose][i].started) {
                            console.log('OAAT_LIMX delayd job being started');
                            Concurrency.limitXAtATimeQues[purpose][i].run().then(() => {
                                // remove from que after job is done and start any waiting jobs
                                //console.log('delayed job finished, removing from que');
                                Concurrency.finishedLimitedJob(purpose, Concurrency.limitXAtATimeQues[purpose][i]);
                            });
                            break;
                        }
                    }
                    console.log('OAAT_LIMX end limitXAtATime ' + purpose);
                });
            });
        });
    }
    // -----------------
    // CANCELLABLE DELAY
    // -----------------
    // start waiting for a pause that can be cancelled
    static startCancellableDelay(ms) {
        return __awaiter(this, void 0, void 0, function* () {
            // ability to cancel the timeout, init to a dummy value to allow code to compile
            let delayTimeout = 0; //global.setTimeout(()=>null,1);
            var f;
            var dr;
            [f, dr] = yield DelayedResult.createDelayedResult(function (resolve) {
                return __awaiter(this, void 0, void 0, function* () {
                    delayTimeout = global.setTimeout(resolve, ms);
                });
            });
            f(); // call the function to start the timeout
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
        });
    }
    // ------------------
    // DO FUNC OR TIMEOUT
    // ------------------
    static doFuncOrTimeout(timeout, action) {
        return __awaiter(this, void 0, void 0, function* () {
            let funcOver = false; // flag if action is done or timeout has happened
            var ourTimeout; // ability to cancel time limit if work is done first
            var promiseDoneOrTimedout; // how we will resolve this promise
            let p = new Promise(function (resolve) {
                promiseDoneOrTimedout = resolve;
            });
            limitTime(timeout);
            doJob(action);
            return p;
            function limitTime(timeout) {
                return __awaiter(this, void 0, void 0, function* () {
                    let delay = yield Concurrency.startCancellableDelay(timeout);
                    ourTimeout = delay.timeout;
                    yield delay.promise;
                    if (!funcOver) {
                        funcOver = true;
                        promiseDoneOrTimedout([null, true]); // resolves the promise returned by doFuncOrTimeout. Null result, true for timeout
                        return;
                    }
                });
            }
            function doJob(action) {
                return __awaiter(this, void 0, void 0, function* () {
                    let res = yield action();
                    if (!funcOver) {
                        funcOver = true;
                        global.clearTimeout(ourTimeout); // stop the timeout if the job finishes first
                        promiseDoneOrTimedout([res, false]); // resolves promise with the result of the action, false for not timeout
                        return;
                    }
                });
            }
        });
    }
    // ------------
    // THROTTLE JOB
    // ------------
    // ensure a job takes at least a min duration to complete
    static throttleJob(minDuration, action) {
        return __awaiter(this, void 0, void 0, function* () {
            let pWork = action();
            yield Concurrency.pause(minDuration);
            return yield pWork; // if the job finished during the pause return the result, otherwise return the result when the job finishes
        });
    }
    // get the result for purpose from cache, or by doing action and then cache the result for cacheDuration ms, -1 is cache forever, 0 is only cache concurrent requests
    static doOnce(purpose, action, cacheDuration) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Concurrency.currentDoOnceReqeusts[purpose]) {
                Concurrency.currentDoOnceReqeusts[purpose] = [];
            }
            ; // ensure storage is initiated for requests wating for the specified purpose
            // reply from cache if have previous answer
            if (Concurrency.cachedDoOnceValues[purpose]) {
                return Concurrency.cachedDoOnceValues[purpose]; // return the value for the purpose
            }
            // find out if this is the first request to arrive (do test syncrhonously)
            let dr = yield Concurrency.limitToOneAtATime('doOnce_' + purpose, function () {
                return __awaiter(this, void 0, void 0, function* () {
                    return [Concurrency.currentDoOnceReqeusts[purpose].length == 0, new Promise(function (resolve) {
                            return __awaiter(this, void 0, void 0, function* () {
                                Concurrency.currentDoOnceReqeusts[purpose].push(resolve);
                            });
                        })];
                });
            });
            let a = yield dr.getResult();
            if (a != null) {
                let [isFirst, p] = a;
                // if it is the first get the value for the purpose
                if (isFirst) {
                    Concurrency.executeJobNotifyAndCacheResult(purpose, action, cacheDuration);
                }
                return p; // return the promise waiting on the value for the purpose
            }
            return Promise.resolve();
        });
    }
    // share same result with all concurrent reuests for a given purpose. Option to cache result for futher requests (-1 for ever, 0 no cache, 1+ cache duration in ms)
    static executeJobNotifyAndCacheResult(purpose, action, cacheDuration) {
        return __awaiter(this, void 0, void 0, function* () {
            // execute the job to get the value
            let jobValue = yield action();
            // notify the value to all requests waiting on it
            while (Concurrency.currentDoOnceReqeusts[purpose].length > 0) {
                let resolveRequest = Concurrency.currentDoOnceReqeusts[purpose].shift();
                if (resolveRequest != undefined) {
                    resolveRequest(jobValue);
                }
            }
            // and cache the value if requried
            switch (cacheDuration) {
                case -1: // keep results in cache (until ram is cleared)
                    Concurrency.cachedDoOnceValues[purpose] = jobValue;
                    return;
                case 0: // results not cache, just concurrent requests share same answer
                    return;
                default: // cache for a specified number of ms
                    Concurrency.cachedDoOnceValues[purpose] = jobValue;
                    yield Concurrency.pause(cacheDuration);
                    delete Concurrency.cachedDoOnceValues[purpose];
                    return;
            }
        });
    }
    // ------------
    // DO ALL ASYNC
    // ------------
    // start a bunch of async functions and continue once they are all done
    static doAllAsync(jobs) {
        return __awaiter(this, void 0, void 0, function* () {
            // create an array to track when each job provided is completed
            let completed = new Array(jobs.length).fill(false);
            let results = new Array(jobs.length);
            // return a promise we will notify when all jobs have been done
            var promiseAllCompleted; // how we will resolve the doAll promise
            let p = new Promise(function (resolve) {
                promiseAllCompleted = resolve;
            });
            // asynchronously start all the jobs
            for (var i = 0; i < jobs.length; i++) {
                doJob(i); // continue without waiting for job to complete
            }
            return p;
            // when each job completes, record that the job is done
            function doJob(i) {
                return __awaiter(this, void 0, void 0, function* () {
                    results[i] = yield jobs[i]();
                    completed[i] = true;
                    // if all jobs are done resolve our promise to notify when all are done
                    if (completed.every(Boolean)) {
                        promiseAllCompleted(results);
                    }
                });
            }
        });
    }
    static inMemorySequenceTracking(purpose, sequence) {
        let retval = new GTS.DM.WrappedResult();
        // ensure storage for sequence for purpose
        if (!Concurrency.expectedSequenceLookup[purpose]) {
            Concurrency.expectedSequenceLookup[purpose] = 1;
        }
        // get the number of the expected sequence (starts at 1)
        let expectedSequence = Concurrency.expectedSequenceLookup[purpose];
        //console.log({log:'sequence test', purpose:purpose, sequence:sequence,expectedSequence:expectedSequence});
        // return "RunNow" when the sequence is that expected
        if (sequence == expectedSequence) {
            Concurrency.expectedSequenceLookup[purpose] = ++sequence;
            return retval.setData("RunNow");
        }
        // return "RunSoon" if the sequence is due to run soon
        if (sequence < (expectedSequence + 10)) {
            return retval.setData("RunSoon");
        }
        // return "Invalid" if the sequence is already run or is too far in the future
        return retval.setData("Invalid");
    }
    static doSequencedJob(purpose, sequence, action, actionArgs, seqCheckAndIncr, seqCheckArgs) {
        return __awaiter(this, void 0, void 0, function* () {
            // default to in memory sequence checking if no function provided
            if (seqCheckAndIncr == undefined) {
                seqCheckAndIncr = Concurrency.inMemorySequenceTracking;
            }
            // inspect to start the scheduled jobs one at a time, only scheduling is synchronous, running of the jobs is asynchronous
            var drSyncSchedule;
            yield new Promise(function (resolveOneAtATimeAccessScheduled) {
                return __awaiter(this, void 0, void 0, function* () {
                    drSyncSchedule = yield Concurrency.limitToOneAtATime('synchronousTalk_' + purpose, // que identifier (can have multiple ques run in parallel)
                    function (purp, seq, act, actArgs, sqChkIncr, sqChkIncrArgs) {
                        return __awaiter(this, void 0, void 0, function* () {
                            console.log('OAAT_SEQJOB starting synchronousTalk_' + purpose);
                            if (!Concurrency.sequencedJobsWaiting[purp]) {
                                Concurrency.sequencedJobsWaiting[purp] = {};
                            }
                            let seqCheck = yield sqChkIncr(purp, seq, ...sqChkIncrArgs);
                            // Check if got and incremented sequence from db successfully
                            if (seqCheck.error) {
                                console.log('OAAT_SEQJOB error checking and incrementing talk sequence in the db');
                                console.log(seqCheck.message);
                                console.log('OAAT_SEQJOB end synchronousTalk_' + purpose);
                                return Promise.reject('Error double checking sequence to talk in the db');
                            }
                            switch (seqCheck.data) {
                                case "RunNow":
                                    // The sequence of the job at hand is the expected sequence
                                    // Prepare a delayed result that does the job
                                    var fDoResolveNow;
                                    var drNow;
                                    yield new Promise(function (varsSet) {
                                        return __awaiter(this, void 0, void 0, function* () {
                                            [fDoResolveNow, drNow] = yield DelayedResult.createDelayedResult(function (resolve) {
                                                return __awaiter(this, void 0, void 0, function* () {
                                                    resolve(act(purp, seq, ...actArgs));
                                                });
                                            });
                                            varsSet();
                                        });
                                    });
                                    console.log('OAAT_SEQJOB Running job now ' + purp + '_' + seq);
                                    fDoResolveNow(); // asynchronously start the job
                                    // resolve any scheduled jobs that are ready to do
                                    while (Concurrency.sequencedJobsWaiting[purp].hasOwnProperty(++seq)) {
                                        let r = yield sqChkIncr(purp, seq, ...sqChkIncrArgs);
                                        if (r.error) {
                                            console.log('OAAT_SEQJOB error checking and incrementing talk sequence in the db for qued job');
                                            console.log(r.message);
                                            console.log('OAAT_SEQJOB end synchronousTalk_' + purpose);
                                            return Promise.reject('Error double checking sequence to talk in the db for qued job');
                                        }
                                        console.log({ runNextResult: r });
                                        if (r.data == "RunNow") {
                                            console.log('OAAT_SEQJOB Running waiting job');
                                            let s = Concurrency.sequencedJobsWaiting[purp][seq];
                                            s.startJob();
                                            delete Concurrency.sequencedJobsWaiting[purp][seq];
                                        }
                                    }
                                    console.log('OAAT_SEQJOB end synchronousTalk_' + purpose);
                                    return drNow;
                                case "RunSoon":
                                    // the job at hand is due to run soon, schedule it to be done when the jobs required before it are started
                                    var fDoResolveSoon;
                                    var drSoon;
                                    yield new Promise(function (varsSet) {
                                        return __awaiter(this, void 0, void 0, function* () {
                                            [fDoResolveSoon, drSoon] = yield DelayedResult.createDelayedResult(function (resolve) {
                                                return __awaiter(this, void 0, void 0, function* () {
                                                    resolve(act(purp, seq, ...actArgs));
                                                });
                                            });
                                            varsSet();
                                        });
                                    });
                                    let s = new SequencedJobWaiting(fDoResolveSoon, function () {
                                        // clear job from que
                                        delete Concurrency.sequencedJobsWaiting[purp][seq];
                                        // somehow reject the promise
                                        drSoon.reject('timedout');
                                    });
                                    Concurrency.sequencedJobsWaiting[purp][seq] = s;
                                    console.log('OAAT_SEQJOB Qued to run soon ' + purp + '_' + seq);
                                    // Put a timer on this, advance jobs have to arrive not just close in sequence, but close in time
                                    global.setTimeout(s.timeoutJob, 5000);
                                    console.log('OAAT_SEQJOB end synchronousTalk_' + purpose);
                                    return drSoon;
                                case "Invalid":
                                    console.log('OAAT_SEQJOB In Invalid ' + purp + '_' + seq);
                                    console.log('OAAT_SEQJOB end synchronousTalk_' + purpose);
                                    return Promise.reject("Invalid Sequence.");
                                default:
                                    console.log('OAAT_SEQJOB In default ' + purp + '_' + seq + ' ' + seqCheck.data);
                                    console.log('OAAT_SEQJOB end synchronousTalk_' + purpose);
                                    return Promise.reject("Unknown Result of Sequence Check.");
                            }
                        });
                    }, purpose, sequence, action, actionArgs !== null && actionArgs !== void 0 ? actionArgs : [], seqCheckAndIncr, seqCheckArgs !== null && seqCheckArgs !== void 0 ? seqCheckArgs : [] // parameters to the function that is run
                    );
                    resolveOneAtATimeAccessScheduled();
                });
            });
            // One At a Time access now scheduled (and could be already running)
            let haveError = false;
            let error = '';
            var dr2;
            yield new Promise(function (resolveVarsSet) {
                drSyncSchedule.getResult()
                    .then((dr) => {
                    if (!dr) {
                        haveError = true;
                        error = error + 'Seq Check Error: void delayed result returned';
                    }
                    else {
                        dr2 = dr;
                    }
                    resolveVarsSet();
                    return;
                })
                    .catch((err) => {
                    console.log(err);
                    haveError = true;
                    error = error + 'Seq Check Error: ' + err;
                    resolveVarsSet();
                    return;
                });
            });
            if (haveError) {
                return Promise.reject(error);
            }
            else {
                // Sequence Job now scheduled (and could be already running)
                let sjr = yield dr2.getResult();
                // Sequence job has been executed, return the value from the executed job
                return sjr;
            }
        });
    }
}
exports.Concurrency = Concurrency;
// -------------
// ONE AT A TIME
// -------------
// allow limit on concurrency to be within a defined purpose
Concurrency.limitOneAtATimePromises = {};
// -------------
// X AT A TIME
// -------------
// allow limit on x at a time to be within a defined purpose
Concurrency.limitXAtATimeQues = {};
// -------
// DO ONCE
// -------
// cached values from doOnce calls (values cached for purpose)
Concurrency.cachedDoOnceValues = {};
// lists of pending doOnce calls (grouped by purpose). This is the resolve function to finish the promise being awaited on
Concurrency.currentDoOnceReqeusts = {};
// --------------------
// SEQUENCED START JOBS
// --------------------
Concurrency.expectedSequenceLookup = {};
Concurrency.sequencedJobsWaiting = {};
