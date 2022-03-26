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
exports.DB = exports.ThreadingLog = exports.attachThreadingDebugInterface = exports.doWithTimeout = exports.throttle = exports.singleLock = exports.doAllAsync = exports.multiThreadDoOnce = exports.delayCancellable = exports.CancellableDelay = exports.pause = void 0;
const GTS = __importStar(require("./gts"));
const DBCore = __importStar(require("./gts.db"));
const WS = __importStar(require("./gts.webserver"));
const PATH = require('path');
const doLogging = false; // if thread debug logging is being recorded
let threadingLogId = 0; // incrementing ids for sequencing of log entries
const threadingLogGroup = new Date().getTime(); // single server, the id is in groups of when the file loaded
// introduce a delay in code by allowing await for a setTimeout
function pause(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
exports.pause = pause;
// holds a promise to wait for, and the ability to cancel the delay the promise is waiting for
class CancellableDelay {
    constructor(pTimeout, pPromise) {
        this.timeout = pTimeout;
        this.promise = pPromise;
    }
}
exports.CancellableDelay = CancellableDelay;
// use setTimeout to introduce a delay in code that can be cancelled by using clearTimeout
function delayCancellable(ms) {
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
exports.delayCancellable = delayCancellable;
let doOnceStatus = {};
let doOnceWaiting = {};
function multiThreadDoOnce(purpose, uuid, action) {
    return __awaiter(this, void 0, void 0, function* () {
        if (doLogging) {
            yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'multiThreadDoOnce', purpose, 'entered function'), uuid);
        }
        let jobStatus = doOnceStatus[purpose] ? doOnceStatus[purpose] : 0;
        doOnceStatus[purpose] = ++jobStatus;
        if (!doOnceWaiting[purpose]) {
            doOnceWaiting[purpose] = [];
        }
        var jobValue;
        if (jobStatus == 1) { // first in, do the job
            if (doLogging) {
                yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'multiThreadDoOnce', purpose, 'starting job'), uuid);
            }
            jobValue = yield action(uuid);
            if (doLogging) {
                yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'multiThreadDoOnce', purpose, 'finished job'), uuid);
            }
            doOnceStatus[purpose] = jobStatus = 100; // flag the job has been done, no more threads will be added now to waiting to resolve
            // release any threads waiting on the completion of the job
            let waitingToResolve = doOnceWaiting[purpose];
            for (var i = 0; i < waitingToResolve.length; i++) {
                waitingToResolve[i].resolve(jobValue); // let any and all waiting in the que proceed now the job is done
                if (doLogging) {
                    yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, waitingToResolve[i].uuid, 'multiThreadDoOnce', purpose, 'resumed thread waiting for job'), uuid);
                }
            }
            waitingToResolve = doOnceWaiting[purpose] = []; // clear list now they are all resolved
            return new Promise(function (resolve, reject) { resolve(jobValue); });
        }
        if (jobStatus < 100) { // que additional requests that arrive while the job is being done
            doOnceStatus[purpose] = --jobStatus; // keep tracing value low, while waiting for the job to be done
            return new Promise(function (resolve, reject) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (doLogging) {
                        yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'multiThreadDoOnce', purpose, 'Pausing thread while waiting for job'), uuid);
                    }
                    doOnceWaiting[purpose].push({ uuid: uuid, resolve: resolve });
                });
            });
        }
        if (jobStatus == 200) { // reset tracking to prevent too large a number being used
            doOnceStatus[purpose] = jobStatus = 100; // numbers 100 and above show the job has been done
        }
        // nothing to do as it was already done once
        if (doLogging) {
            yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'multiThreadDoOnce', purpose, 'job was already completed'), uuid);
        }
        return new Promise(function (resolve, reject) { resolve(jobValue); });
    });
}
exports.multiThreadDoOnce = multiThreadDoOnce;
// start a bunch of async functions and continue once they are all done
function doAllAsync(jobs, uuid, purpose) {
    return __awaiter(this, void 0, void 0, function* () {
        if (doLogging) {
            yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'doAllAsync', purpose, 'start with ' + jobs.length + ' jobs'), uuid);
        }
        // create an array to track when each job provided is completed
        let results = new Array(jobs.length).fill(false);
        // return a promise we will notify when all jobs have been done
        var promiseAllResolve; // how we will resolve this promise
        let p = new Promise(function (resolve, reject) {
            promiseAllResolve = resolve;
        });
        // asynchronously start all the jobs
        for (var i = 0; i < jobs.length; i++) {
            if (doLogging) {
                yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'doAllAsync', purpose, `started job ${i}`), uuid);
            }
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
                    if (doLogging) {
                        yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'doAllAsync', purpose, `finished job ${i}, all jobs done`), uuid);
                    }
                    promiseAllResolve();
                }
                else if (doLogging) {
                    yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'doAllAsync', purpose, `finished job ${i}`), uuid);
                }
            });
        }
    });
}
exports.doAllAsync = doAllAsync;
let singleLockStatus = {};
let singleLockWaiting = {};
// Que jobs doing each on in turn in the order they arrive
function singleLock(purpose, uuid, action, doLog) {
    return __awaiter(this, void 0, void 0, function* () {
        if (doLog === undefined) {
            doLog = doLogging;
        } // if no param is given to do logging, use the default
        if (doLog) {
            yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'SingleLock', purpose, 'new job/thread arrives'), uuid);
        }
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
            if (doLog) {
                yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'SingleLock', purpose, 'job already being processed, ' + existingJobCount + ' jobs in the que'), uuid);
            }
            //console.log(`${uuid} ${purpose} job already being processed, ${existingJobCount} jobs in the que`);
            // return a promise that the job will be done when it can be
            return new Promise(function (resolve, reject) {
                return __awaiter(this, void 0, void 0, function* () {
                    // que this job to be done when possible
                    singleLockWaiting[purpose].push({ uuid: uuid, action: action, resolve: resolve, process: function (uuid, action, resolve) {
                            return __awaiter(this, void 0, void 0, function* () {
                                if (doLog) {
                                    yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'SingleLock', purpose, 'qued job being processed'), uuid);
                                }
                                //console.log(`${uuid} ${purpose} qued job being processed`);
                                // do this job when the time comes
                                let jobValue = yield action(uuid);
                                if (doLog) {
                                    yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'SingleLock', purpose, 'qued job done'), uuid);
                                }
                                //console.log(`${uuid} ${purpose} qued job done`);
                                let r = singleLockWaiting[purpose].shift();
                                if (r) {
                                    // and when it is done process the next job in the que if any
                                    let existingJobCount = singleLockWaiting[purpose].length;
                                    if (doLog) {
                                        yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'SingleLock', purpose, 'got another qued job, ' + existingJobCount + ' more in que'), uuid);
                                    }
                                    //console.log(`${uuid} ${purpose} found another job qued`);
                                    r.process(r.uuid, r.action, r.resolve);
                                }
                                else {
                                    // flag that processing is finished if we have just done the last job in the que
                                    jobProcessing = singleLockStatus[purpose] = false;
                                    if (doLog) {
                                        yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'SingleLock', purpose, 'que finished'), uuid);
                                    }
                                    //console.log(`${uuid} ${purpose} que finished`);
                                }
                                // let the thread continue that was waiting for the job to be done
                                resolve(jobValue);
                                if (doLog) {
                                    yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'SingleLock', purpose, 'job/thread released'), uuid);
                                }
                                //console.log(`${uuid} ${purpose} qued job released`);
                            });
                        } });
                    if (doLog) {
                        yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'SingleLock', purpose, 'job qued'), uuid);
                    }
                });
            });
        }
        // start the job if there are no others to wait for
        singleLockStatus[purpose] = jobProcessing = true;
        if (doLog) {
            yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'SingleLock', purpose, 'start processing job'), uuid);
        }
        //console.log(`${uuid} ${purpose} start processing job`);
        let jobValueFirst = yield action(uuid);
        if (doLog) {
            yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'SingleLock', purpose, 'job done'), uuid);
        }
        //console.log(`${uuid} ${purpose} job done`);
        let r = singleLockWaiting[purpose].shift();
        if (r) {
            // and when it is done process a job in the que if any
            let existingJobCount = singleLockWaiting[purpose].length;
            if (doLog) {
                yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'SingleLock', purpose, 'got a qued job, ' + existingJobCount + ' more in que'), uuid);
            }
            //console.log(`${uuid} ${purpose} found a qued job`);
            r.process(r.uuid, r.action, r.resolve);
        }
        else {
            // flag that processing is finished if there is no que
            jobProcessing = singleLockStatus[purpose] = false;
            if (doLog) {
                yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'SingleLock', purpose, 'que not used'), uuid);
            }
        }
        // let the thread continue that called to have the job done
        if (doLog) {
            yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'SingleLock', purpose, 'job released'), uuid);
        }
        //console.log(`${uuid} ${purpose} job released`);
        return jobValueFirst;
    });
}
exports.singleLock = singleLock;
let throttleStatus = {};
let throttleWaiting = {};
let throttleLastDone = {};
// Que jobs doing each on in turn in the order they arrive, with a delay between jobs
function throttle(uuid, purpose, delay, action, doLog) {
    return __awaiter(this, void 0, void 0, function* () {
        if (doLog === undefined) {
            doLog = doLogging;
        } // if no param is given to do logging, use the default
        if (doLog) {
            yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'Throttle', purpose, 'new job/thread arrives'), uuid);
        }
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
            if (doLog) {
                yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'Throttle', purpose, 'job already being processed, ' + existingJobCount + ' jobs in the que'), uuid);
            }
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
                                    if (doLog) {
                                        yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'Throttle', purpose, `enforced delay of ${delay - delayDone}`), uuid);
                                    }
                                    //console.log(`Throttle delaying ${delay-delayDone}`);
                                    yield pause(delay - delayDone);
                                    //console.log('Throttle delay done');
                                }
                                //console.log('qued job being processed');
                                if (doLog) {
                                    yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'Throttle', purpose, 'qued job being processed'), uuid);
                                }
                                // do this job when the time comes
                                let jobValue = yield action(uuid);
                                // record when job is done
                                throttleLastDone[purpose] = new Date().getTime();
                                if (doLog) {
                                    yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'Throttle', purpose, 'qued job done'), uuid);
                                }
                                //console.log('job done');
                                // try and process next job in the que
                                let r = throttleWaiting[purpose].shift();
                                if (r) {
                                    // and when it is done process the next job in the que if any
                                    let existingJobCount = throttleWaiting[purpose].length;
                                    if (doLog) {
                                        yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'Throttle', purpose, 'got another qued job, ' + existingJobCount + ' more in que'), uuid);
                                    }
                                    r.process(r.uuid, r.action, r.resolve);
                                }
                                else {
                                    // flag that processing is finished if we have just done the last job in the que
                                    jobProcessing = throttleStatus[purpose] = false;
                                    if (doLog) {
                                        yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'Throttle', purpose, 'que finished'), uuid);
                                    }
                                }
                                // let the thread continue that was waiting for the job to be done
                                resolve(jobValue);
                                if (doLog) {
                                    yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'Throttle', purpose, 'job/thread released'), uuid);
                                }
                            });
                        } });
                    if (doLog) {
                        yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'Throttle', purpose, 'job qued'), uuid);
                    }
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
            if (doLog) {
                yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'Throttle', purpose, `enforced delay of ${delay - delayDoneFirst}`), uuid);
            }
            //console.log(`Throttle delaying ${delay-delayDoneFirst}`);
            yield pause(delay - delayDoneFirst);
            //console.log('Throttle delay done');
        }
        //console.log('start processing job');
        if (doLog) {
            yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'Throttle', purpose, 'start processing job'), uuid);
        }
        // do the job
        let jobValueFirst = yield action(uuid);
        // record when job is done
        throttleLastDone[purpose] = new Date().getTime();
        if (doLog) {
            yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'Throttle', purpose, 'job done'), uuid);
        }
        //console.log('job done');
        // try and process any job in the que
        let r = throttleWaiting[purpose].shift();
        if (r) {
            // and when it is done process a job in the que if any
            let existingJobCount = throttleWaiting[purpose].length;
            if (doLog) {
                yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'Throttle', purpose, 'got a qued job, ' + existingJobCount + ' more in que'), uuid);
            }
            r.process(r.uuid, r.action, r.resolve);
        }
        else {
            // flag that processing is finished if there is no que
            jobProcessing = throttleStatus[purpose] = false;
            if (doLog) {
                yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'Throttle', purpose, 'que not used'), uuid);
            }
        }
        // let the thread continue that called to have the job done
        if (doLog) {
            yield DB.addThreadingLog(new ThreadingLog().setNew(++threadingLogId, threadingLogGroup, uuid, 'Throttle', purpose, 'job released'), uuid);
        }
        //console.log(`${uuid} ${purpose} job released`);
        return jobValueFirst;
    });
}
exports.throttle = throttle;
function doWithTimeout(uuid, timeout, action) {
    return __awaiter(this, void 0, void 0, function* () {
        let funcOver = false;
        var ourTimeout; // ability to cancel time limit if work is done first
        var promiseDoneOrTimedout; // how we will resolve this promise
        let p = new Promise(function (resolve, reject) {
            promiseDoneOrTimedout = resolve;
        });
        //console.log('done init');
        limitTime(uuid, timeout);
        //console.log('called limitTime');
        doJob(uuid, action);
        //console.log('called doJob');
        return p;
        function limitTime(uuid, timeout) {
            return __awaiter(this, void 0, void 0, function* () {
                let delay = yield delayCancellable(timeout);
                ourTimeout = delay.timeout;
                yield delay.promise;
                if (!funcOver) {
                    funcOver = true;
                    console.log('timeout finished first');
                    promiseDoneOrTimedout(null);
                    return;
                }
                console.log('timeout finished after doJob');
            });
        }
        function doJob(uuid, action) {
            return __awaiter(this, void 0, void 0, function* () {
                let res = yield action(uuid);
                if (!funcOver) {
                    funcOver = true;
                    //console.log('doJob finished first');
                    clearTimeout(ourTimeout);
                    //console.log('time limit timeout cleared');
                    promiseDoneOrTimedout(res);
                    //console.log('promise resolved');
                    return;
                }
                console.log('doJob finished after timeout');
            });
        }
    });
}
exports.doWithTimeout = doWithTimeout;
function attachThreadingDebugInterface(web, webapp) {
    webapp.get('/threadinglogs', (req, res) => res.sendFile(PATH.join(__dirname, '../threadinglogs.html')));
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
class SingleLockWaitingJob {
    constructor(pUuid, pAction, pResolve, pProcess) {
        this.uuid = pUuid;
        this.action = pAction;
        this.resolve = pResolve;
        this.process = pProcess;
    }
}
class DoOnceWaitingJob {
    constructor(pUuid, pAction, pResolve, pProcess) {
        this.uuid = pUuid;
        this.resolve = pResolve;
    }
}
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
})(DB = exports.DB || (exports.DB = {}));
