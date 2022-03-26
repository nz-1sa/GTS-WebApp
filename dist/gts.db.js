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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.releaseConnection = exports.getConnection = exports.hasConnection = exports.ClientPool = void 0;
const GTS = __importStar(require("./gts"));
const Threading = __importStar(require("./gts.threading"));
const pg_1 = __importDefault(require("pg"));
const dbConn = process.env.DATABASE_URL;
const pool = new pg_1.default.Pool({
    connectionString: dbConn,
    ssl: {
        rejectUnauthorized: false
    }
});
class ClientPool {
    constructor() {
        this.connections = [];
        this.delayedRelease = null;
        this.openConnections = {};
    }
}
exports.ClientPool = ClientPool;
// multi-threaded requests for db connections
var clientPool = new ClientPool();
// is there a connection ready
function hasConnection(uuid) {
    if (clientPool.openConnections[uuid]) {
        return true;
    }
    else {
        return false;
    }
}
exports.hasConnection = hasConnection;
// get an available existing connection, or open a new one
function getConnection(purpose, uuid) {
    return __awaiter(this, void 0, void 0, function* () {
        //console.log(`UUID:${uuid} getting db connection, ${Object.keys(clientPool).length-2} already open, ${clientPool.connections.length} half closed`);
        let retval = new GTS.DM.WrappedResult();
        //console.log(`Looking for ${uuid} in ${Object.keys(clientPool)}`);
        let dbConnStart = new Date().getTime();
        let client = clientPool.openConnections[uuid]; // first try to get existing client for the request
        if (client) {
            //console.log(`UUID:${uuid} got existing db connection to use for ${purpose}`);
            retval.setData(client);
            return retval; // make the client connection available to the caller
        }
        let fr = yield Threading.singleLock('openDbConnection', uuid, function (uuid) {
            return __awaiter(this, void 0, void 0, function* () {
                //console.log(`UUID:${uuid} entered single lock`);
                let c = clientPool.openConnections[uuid]; // first try to get existing client for the request
                if (c) {
                    //console.log(`UUID:${uuid} existing db connection got after OneAtATime delay for ${purpose}`);
                    return new GTS.DM.WrappedResult().setData(c);
                }
                let testC = clientPool.connections.pop(); // next try to get a recently finished connection
                if (testC) {
                    clientPool.openConnections[uuid] = testC; // store the client for future connections in the request
                    //console.log(`UUID:${uuid} db connection recycled for ${purpose}`);
                    return new GTS.DM.WrappedResult().setData(testC);
                }
                try {
                    c = yield pool.connect(); // next request a client from pg Pool
                }
                catch (err) {
                    console.error(`${Date.now()} error connecting to pool`);
                    return new GTS.DM.WrappedResult().setError('error connecting to db\r\n' + err);
                }
                if (c) {
                    clientPool.openConnections[uuid] = c; // store the client for future connections in the request
                    let dbConnDone = new Date().getTime();
                    //console.log(`UUID:${uuid} db connection opened in ${(dbConnDone-dbConnStart)/1000}s for ${purpose}`);
                    return new GTS.DM.WrappedResult().setData(c);
                }
                console.log(`${Date.now()} connection not got`);
            });
        }, false); //don't log the threading used to open a db connection, so as not enter a recursive loop;   log -> connect to db -> log -> connect to db -> ...
        if (fr.error || fr.data == null) {
            console.log(`${Date.now()} error getting connection`);
            retval.setError(fr.message);
            return retval;
        }
        client = fr.data;
        retval.setData(client); // make the client connection available to the caller
        return retval;
    });
}
exports.getConnection = getConnection;
// make connection available for others for up to 12 seconds when it is finished with
function releaseConnection(uuid) {
    return __awaiter(this, void 0, void 0, function* () {
        var client = clientPool.openConnections[uuid]; // first try to get existing client for the request
        if (client) {
            delete clientPool.openConnections[uuid];
            clientPool.connections.push(client);
            //console.log(`UUID:${uuid} db connection half closed`);
            if (clientPool.delayedRelease) { // clear any previous 12s countdowns
                clearTimeout(clientPool.delayedRelease);
            }
            clientPool.delayedRelease = setTimeout(function () {
                closeAllConnections();
            }, 12000);
        }
    });
}
exports.releaseConnection = releaseConnection;
// 12 seconds after a connection is released, with no other connections being released, close open connections
// close all connections from the db
function closeAllConnections() {
    return __awaiter(this, void 0, void 0, function* () {
        var cons = clientPool.connections;
        //console.log(`${Date.now()} Full closing ${cons.length} half closed db connections`);
        clientPool.connections = [];
        while (cons.length > 0) {
            var con = cons.pop();
            if (con) {
                yield con.release();
            }
            //console.log(`connection closed`);
        }
    });
}
