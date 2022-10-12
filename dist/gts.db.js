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
exports.releaseConnection = exports.hasConnection = exports.getConnection = exports.ClientPool = void 0;
const GTS = __importStar(require("./gts"));
const gts_concurrency_1 = require("./gts.concurrency");
const Pg = __importStar(require("pg"));
// Create a pg Pool from a saved database connection string
const dbConn = process.env.DATABASE_URL;
const pool = new Pg.Pool({
    connectionString: dbConn,
    ssl: { rejectUnauthorized: false }
});
// Build our own connection caching on top of pg Pool
class ClientPool {
    constructor() {
        this.openConnections = {};
        this.releasedConnections = [];
        this.delayedClose = null;
    }
}
exports.ClientPool = ClientPool;
var clientPool = new ClientPool();
// get a connection to the database, uuid identifies the connection, and purpose provides info for debug logging
// when finished call releaseConnection specifying the uuid
// passing an in-use uuid to getConnection returns the currently open connection for the uuid
// for 12 seconds after a connection is released it will be held in our pool waiting to be re-used
// passing an uuid not in-use to getConnection returns a connection from our pool if available
// a connection is opened in the underlying pg pool if none is available in our pool
function getConnection(purpose, uuid) {
    return __awaiter(this, void 0, void 0, function* () {
        // prepare our return value (a client connection wrapped with error info)
        let retval = new GTS.DM.WrappedResult();
        // try to get an alrady open client for the uuid
        let client = clientPool.openConnections[uuid];
        if (client) {
            return retval.setData(client);
        } // provide the connection to the caller
        // Require that only one thread can be opening a connection at a time, others will be qued
        let dr = yield gts_concurrency_1.Concurrency.limitToOneAtATime('openDbConnection', function (uuid) {
            return __awaiter(this, void 0, void 0, function* () {
                // when a connection request comes out of the que, if the connection for the uuid has already been opened, return that open connection
                let c = clientPool.openConnections[uuid];
                if (c) {
                    return new GTS.DM.WrappedResult().setData(c);
                } // provide the connection to variable connResult
                // return a connection from our pool if available
                let testC = clientPool.releasedConnections.pop();
                if (testC) { // as undefined type casts to false we know that it must be a client inside this test
                    clientPool.openConnections[uuid] = testC; // store the client for future connections in the request
                    return new GTS.DM.WrappedResult().setData(testC); // provide the connection to variable connResult
                }
                // request a connection from the underlying pg pool
                try {
                    c = yield pool.connect();
                }
                catch (err) { // return the error info if trying to open the connection causes an error
                    console.error(`${Date.now()} error connecting to pool`);
                    return new GTS.DM.WrappedResult().setError('error connecting to db\r\n' + err);
                }
                if (c) {
                    clientPool.openConnections[uuid] = c; // store the client is open for the uuid
                    return new GTS.DM.WrappedResult().setData(c); // provide the connection to variable connResult
                }
                console.error(`${Date.now()} connection not got`); // return there was an error if we did not get a connection
                return new GTS.DM.WrappedResult().setError('connection not got for db\r\n');
            });
        }, uuid);
        let connResult = yield dr.getResult();
        // We know have the result of opening the connection in connResult
        if (connResult.error) { // return to caller error info if there was an error opening the connection
            console.error(`${Date.now()} error getting connection ${connResult.message}`);
            retval.setError(connResult.message);
            return retval;
        }
        if (connResult.data == null) { // return to caller there was an error if the connection returned is null
            console.error(`${Date.now()} error got connection was null`);
            retval.setError('Opening connection returned null');
            return retval;
        }
        client = connResult.data; // we now have a connection that didn't error, and is not null
        return retval.setData(client); // provide the connection to the caller
    });
}
exports.getConnection = getConnection;
// check if there is a connection ready, each open connection is identified by a uuid
function hasConnection(uuid) {
    if (clientPool.openConnections[uuid]) {
        return true;
    }
    else {
        return false;
    }
}
exports.hasConnection = hasConnection;
// make connection available for others for up to 12 seconds when it is finished with
function releaseConnection(uuid) {
    return __awaiter(this, void 0, void 0, function* () {
        var client = clientPool.openConnections[uuid]; // first try to get the open connection to release
        if (client) {
            delete clientPool.openConnections[uuid]; // remove it from the open connections
            clientPool.releasedConnections.push(client); // add it to the released connections
            if (clientPool.delayedClose) { // clear any previous 12s countdown to close released connections
                clearTimeout(clientPool.delayedClose);
            }
            clientPool.delayedClose = setTimeout(function () {
                closeReleasedConnections();
            }, 12000);
        }
    });
}
exports.releaseConnection = releaseConnection;
// 12 seconds after a connection is released, with no other connections being released, close released connections
function closeReleasedConnections() {
    return __awaiter(this, void 0, void 0, function* () {
        var cons = clientPool.releasedConnections;
        clientPool.releasedConnections = [];
        while (cons.length > 0) {
            var con = cons.pop();
            if (con) {
                yield con.release();
            }
        }
    });
}
