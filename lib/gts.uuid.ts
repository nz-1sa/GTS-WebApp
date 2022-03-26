import * as GTS from "./gts";
import * as DBCore from "./gts.db";
import * as Threading from './gts.threading';
import *  as WebApp from './gts.webapp';

// make a unique identifier, it is a timestamp first uuid and includes the mac of the machine made on
export async function newUUID(): Promise<string>{
	// start the uniqueness from the time it is generated, as the number of milliseconds since January 1, 1970)
	const  ticks:number = new Date().getTime();
	const ticksHex:string = GTS.HexUtils.encodeNumber(ticks);
	if(ticksHex.length != 12){	//TODO: improve this quick error handling
		return '';
	}
	const uuidA = ticksHex.substring(0,8);	// length 8
	const uuidB = ticksHex.substring(8);		// length 4
	
	// add to the uniqueness by using a random number from measuring code execurtion
	// local testing only gave 20 values so combine with a random number
	let delayRand:string = (await randomDelay()).toString(10)+Math.random().toString().substring(1);
	
	const seedC:Function = xmur3(delayRand);
	const randC:Function = mulberry32(seedC());
	const uuidC:string = '6'+rand2string(randC(),4).substring(1);	// length 4
	
	// keep our randomness at least as random as the random function by including it in our random
	let normalRand:number = Math.floor(Math.random() * 65535);
	const uuidD:string = GTS.HexUtils.encodeNumber(normalRand);	// length 4
	
	// use the mac address to reduce conflicts between machines
	const mac = WebApp.getServerMAC();
	const uuidE = mac.split(':').join('');		// length 12

	// return a uuid as a string joined from the above parts,	lengths: 8-4-4-4-12
	return `${uuidA}-${uuidB}-${uuidC}-${uuidD}-${uuidE}`;

	// get a hex string from a random number between 0 and 1
	// number of chars must be even
	function rand2string(r:number, chars:number){
		let rnd:number = Number(r.toFixed(chars));
		rnd = Math.floor(rnd*10**(chars+1));
		const str = '0'+rnd.toString(16);
		return str.substring(0,chars);
	}
}

export async function addTestUUIDs(sessionUUID:string):Promise<GTS.DM.WrappedResult<boolean>>{
	let fetchBatch:GTS.DM.WrappedResult<number> = await DB.getNewBatchNum(sessionUUID);
	if(fetchBatch.error || fetchBatch.data == null){
		return new GTS.DM.WrappedResult<boolean>().setError('Unable to get batch number\r\n'+fetchBatch.message);
	}
	for(var i:number = 0; i < 100; i++){
		await DB.addTestUUID( await newUUID(), fetchBatch.data!, sessionUUID);
	}
	return new GTS.DM.WrappedResult<boolean>().setData(true);
}

// get a randomness from slight extra delay introduced in calls to setTimeout
async function randomDelay(): Promise<number>{
	var startTime:number = new Date().getTime();
	await Threading.pause(10);
	var endTime:number = new Date().getTime();
	return(endTime - startTime);
}

// Mulberry32 is a simple generator with a 32-bit state
// Param a is a random seed
// https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
function mulberry32(a:number):Function {
	return function() {
	  var t = a += 0x6D2B79F5;
	  t = Math.imul(t ^ t >>> 15, t | 1);
	  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
	  return ((t ^ t >>> 14) >>> 0) / 4294967296;
	}
}

// hash functions are very good at generating seeds from short strings
// seed generator based on MurmurHash3's mixing function
// https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
function xmur3(str:string):Function {
	for(var i = 0, h = 1779033703 ^ str.length; i < str.length; i++) {
		h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
		h = h << 13 | h >>> 19;
	} return function() {
		h = Math.imul(h ^ (h >>> 16), 2246822507);
		h = Math.imul(h ^ (h >>> 13), 3266489909);
		return (h ^= h >>> 16) >>> 0;
	}
}

namespace DB{
	export async function getNewBatchNum( uuid: string): Promise<GTS.DM.WrappedResult<number>>{
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> =  await DBCore.getConnection('getDecimals', uuid);
		if(fetchConn.error || fetchConn.data == null){
			return new GTS.DM.WrappedResult<number>().setError('DB Connection error\r\n'+fetchConn.message);
		}
		let client:DBCore.Client = fetchConn.data!;
		const res = await client.query('CALL getTestUUIDBatchNum(0);');
		if(res.rowCount == 0){ return new GTS.DM.WrappedResult<number>().setData(-1); }
		return new GTS.DM.WrappedResult<number>().setData(res.rows[0].num);
	}
	
	export async function addTestUUID(testUUID:string, batchNum:number, uuid:string ): Promise<GTS.DM.WrappedResult<void>>{
		let fetchConn:GTS.DM.WrappedResult<DBCore.Client> = await DBCore.getConnection('addTestUUID', uuid);
		if(fetchConn.error || fetchConn.data == null){
			return new GTS.DM.WrappedResult<void>().setError('DB Connection error\r\n'+fetchConn.message);
		}
		let parts:string[] = testUUID.split('-');
		let client:DBCore.Client = fetchConn.data!;
		await client.query( 'CALL addTestUUID($1,$2,$3,$4,$5,$6);',[batchNum, parts[0], parts[1], parts[2], parts[3], parts[4]]);
		return new GTS.DM.WrappedResult<void>().setNoData();
	}
}