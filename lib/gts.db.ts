import * as GTS from "./gts";
import * as Threading from "./gts.threading";
import Pg from 'pg';

export type Client = Pg.PoolClient;

const dbConn:string|undefined = process.env.DATABASE_URL;
const pool:Pg.Pool = new Pg.Pool({
	connectionString: dbConn,
	ssl: {
		rejectUnauthorized: false
	}
});

export class ClientPool{
	connections: Pg.PoolClient[] = [];
	delayedRelease: NodeJS.Timeout|null = null;
	openConnections: GTS.DM.HashTable<Pg.PoolClient> = {};
}

// multi-threaded requests for db connections
var clientPool:ClientPool = new ClientPool();

// is there a connection ready
export function hasConnection(uuid:string):boolean{
	if(clientPool.openConnections[uuid]){return true;}else{return false;}
}

// get an available existing connection, or open a new one
export async function getConnection(purpose: string, uuid: string): Promise<GTS.DM.WrappedResult<Pg.PoolClient>>{
	//console.log(`UUID:${uuid} getting db connection, ${Object.keys(clientPool).length-2} already open, ${clientPool.connections.length} half closed`);
	let retval:GTS.DM.WrappedResult<Pg.PoolClient> = new GTS.DM.WrappedResult();
	//console.log(`Looking for ${uuid} in ${Object.keys(clientPool)}`);
	let dbConnStart = new Date().getTime();
	let client:Pg.PoolClient = clientPool.openConnections[uuid];		// first try to get existing client for the request
	if(client){
		//console.log(`UUID:${uuid} got existing db connection to use for ${purpose}`);
		retval.setData(client);
		return retval;								// make the client connection available to the caller
	}
	let fr:GTS.DM.WrappedResult<Pg.PoolClient> = await Threading.singleLock<GTS.DM.WrappedResult<Pg.PoolClient>>('openDbConnection',uuid, async function(uuid:string){
		//console.log(`UUID:${uuid} entered single lock`);
		let c:Pg.PoolClient = clientPool.openConnections[uuid];	// first try to get existing client for the request
		if(c){
			//console.log(`UUID:${uuid} existing db connection got after OneAtATime delay for ${purpose}`);
			return new GTS.DM.WrappedResult().setData(c);
		}
		let testC:Pg.PoolClient|undefined = clientPool.connections.pop();	// next try to get a recently finished connection
		if(testC){
			clientPool.openConnections[uuid] = testC!;					// store the client for future connections in the request
			//console.log(`UUID:${uuid} db connection recycled for ${purpose}`);
			return new GTS.DM.WrappedResult().setData(testC!);
		}
		try{
			c = await pool.connect();			// next request a client from pg Pool
		} catch(err) {
			console.error(`${Date.now()} error connecting to pool`);
			return new GTS.DM.WrappedResult().setError('error connecting to db\r\n'+err);
		}
		if(c){
			clientPool.openConnections[uuid] = c;					// store the client for future connections in the request
			let dbConnDone = new Date().getTime();
			//console.log(`UUID:${uuid} db connection opened in ${(dbConnDone-dbConnStart)/1000}s for ${purpose}`);
			return new GTS.DM.WrappedResult().setData(c);
		}
		console.log(`${Date.now()} connection not got`);
	},false);	//don't log the threading used to open a db connection, so as not enter a recursive loop;   log -> connect to db -> log -> connect to db -> ...
	if(fr.error || fr.data == null){
		console.log(`${Date.now()} error getting connection`);
		retval.setError(fr.message);
		return retval;
	}
	client = fr.data!;
	retval.setData(client);						// make the client connection available to the caller
	return retval;
}

// make connection available for others for up to 12 seconds when it is finished with
export async function releaseConnection(uuid: string): Promise<void>{
	var client = clientPool.openConnections[uuid];		// first try to get existing client for the request
	if(client){
		delete clientPool.openConnections[uuid];
		clientPool.connections.push(client);
		//console.log(`UUID:${uuid} db connection half closed`);
		
		if(clientPool.delayedRelease){										// clear any previous 12s countdowns
			clearTimeout(clientPool.delayedRelease);
		}
		clientPool.delayedRelease = setTimeout(function(){		// start a new countdown of 12 seconds
			closeAllConnections();
		}, 12000);
	}
}

// 12 seconds after a connection is released, with no other connections being released, close open connections
// close all connections from the db
async function closeAllConnections(): Promise<void>{
	var cons = clientPool.connections;
	//console.log(`${Date.now()} Full closing ${cons.length} half closed db connections`);
	clientPool.connections = [];
	while(cons.length>0){
		var con = cons.pop();
		if(con){await con.release();}
		//console.log(`connection closed`);
	}
}