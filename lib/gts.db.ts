import * as GTS from "./gts";
import * as Threading from "./gts.threading";
import Pg from 'pg';

// Client connections returned are pg Pool Clients
export type Client = Pg.PoolClient;

// Create a pg Pool from a saved database connection string
const dbConn:string|undefined = process.env.DATABASE_URL;
const pool:Pg.Pool = new Pg.Pool({
	connectionString: dbConn,
	ssl: { rejectUnauthorized: false }
});

// Build our own connection caching on top of pg Pool
export class ClientPool{
	openConnections: GTS.DM.HashTable<Pg.PoolClient> = {};
	releasedConnections: Pg.PoolClient[] = [];
	delayedClose: NodeJS.Timeout|null = null;
}
var clientPool:ClientPool = new ClientPool();

// get a connection to the database, uuid identifies the connection, and purpose provides info for debug logging
// when finished call releaseConnection specifying the uuid
// passing an in-use uuid to getConnection returns the currently open connection for the uuid
// for 12 seconds after a connection is released it will be held in our pool waiting to be re-used
// passing an uuid not in-use to getConnection returns a connection from our pool if available
// a connection is opened in the underlying pg pool if none is available in our pool
export async function getConnection(purpose: string, uuid: string): Promise<GTS.DM.WrappedResult<Pg.PoolClient>>{
	// prepare our return value (a client connection wrapped with error info)
	let retval:GTS.DM.WrappedResult<Pg.PoolClient> = new GTS.DM.WrappedResult();
	
	// try to get an alrady open client for the uuid
	let client:Pg.PoolClient = clientPool.openConnections[uuid];
	if(client){ return retval.setData(client); }								// provide the connection to the caller
	
	// Require that only one thread can be opening a connection at a time, others will be qued
	let connResult:GTS.DM.WrappedResult<Pg.PoolClient> = await Threading.singleLock<GTS.DM.WrappedResult<Pg.PoolClient>>('openDbConnection',uuid, async function(uuid:string){
		// when a connection request comes out of the que, if the connection for the uuid has already been opened, return that open connection
		let c:Pg.PoolClient = clientPool.openConnections[uuid];	
		if(c){ return new GTS.DM.WrappedResult().setData(c); }	// provide the connection to variable connResult
		
		// return a connection from our pool if available
		let testC:Pg.PoolClient|undefined = clientPool.releasedConnections.pop();
		if(testC){																			// as undefined type casts to false we know that it must be a client inside this test
			clientPool.openConnections[uuid] = testC!;						// store the client for future connections in the request
			return new GTS.DM.WrappedResult().setData(testC!);	// provide the connection to variable connResult
		}
		
		// request a connection from the underlying pg pool
		try{
			c = await pool.connect();
		} catch(err) {																	// return the error info if trying to open the connection causes an error
			console.error(`${Date.now()} error connecting to pool`);
			return new GTS.DM.WrappedResult().setError('error connecting to db\r\n'+err);
		}
		if(c){
			clientPool.openConnections[uuid] = c;								// store the client is open for the uuid
			return new GTS.DM.WrappedResult().setData(c);			// provide the connection to variable connResult
		}
		console.error(`${Date.now()} connection not got`);			// return there was an error if we did not get a connection
		return new GTS.DM.WrappedResult().setError('connection not got for db\r\n');
	}, false);	//this trailing false says don't log the threading used to open a db connection, so as not enter a recursive loop;   log thread -> connect to db -> log thread -> connect to db -> ...
	
	// We know have the result of opening the connection in connResult
	if(connResult.error){																// return to caller error info if there was an error opening the connection
		console.error(`${Date.now()} error getting connection ${connResult.message}`);
		retval.setError(connResult.message);
		return retval;
	}
	if(connResult.data == null){													// return to caller there was an error if the connection returned is null
		console.error(`${Date.now()} error got connection was null`);
		retval.setError('Opening connection returned null');
		return retval;
	}
	client = connResult.data!;																	// we now have a connection that didn't error, and is not null
	return retval.setData(client);													// provide the connection to the caller
}

// check if there is a connection ready, each open connection is identified by a uuid
export function hasConnection(uuid:string):boolean{
	if(clientPool.openConnections[uuid]){return true;}else{return false;}
}

// make connection available for others for up to 12 seconds when it is finished with
export async function releaseConnection(uuid: string): Promise<void>{
	var client = clientPool.openConnections[uuid];							// first try to get the open connection to release
	if(client){
		delete clientPool.openConnections[uuid];							// remove it from the open connections
		clientPool.releasedConnections.push(client);						// add it to the released connections
		
		if(clientPool.delayedClose){												// clear any previous 12s countdown to close released connections
			clearTimeout(clientPool.delayedClose);
		}
		clientPool.delayedClose = setTimeout(function(){				// start a new countdown of 12 seconds to close released connections
			closeReleasedConnections();
		}, 12000);
	}
}

// 12 seconds after a connection is released, with no other connections being released, close released connections
async function closeReleasedConnections(): Promise<void>{
	var cons = clientPool.releasedConnections;
	clientPool.releasedConnections = [];
	while(cons.length>0){
		var con = cons.pop();
		if(con){await con.release();}
	}
}