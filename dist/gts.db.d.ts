/// <reference types="node" />
import * as GTS from "./gts";
import Pg from 'pg';
export declare type Client = Pg.PoolClient;
export declare class ClientPool {
    connections: Pg.PoolClient[];
    delayedRelease: NodeJS.Timeout | null;
    openConnections: GTS.DM.HashTable<Pg.PoolClient>;
}
export declare function hasConnection(uuid: string): boolean;
export declare function getConnection(purpose: string, uuid: string): Promise<GTS.DM.WrappedResult<Pg.PoolClient>>;
export declare function releaseConnection(uuid: string): Promise<void>;
