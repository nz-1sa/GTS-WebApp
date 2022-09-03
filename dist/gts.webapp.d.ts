import * as GTS from "./gts";
export * as GTS from "./gts";
export * as UUID from "./gts.uuid";
export * as DBCore from "./gts.db";
export * as WS from "./gts.webserver";
export * as Threading from "./gts.threading";
export * as Captcha from "./gts.captcha";
export { WebResponse } from "./gts.webserver";
export declare class WrappedResult<T> extends GTS.DM.WrappedResult<T> {
}
export declare function getServerMAC(): string;
export declare function fetchJSON<T>(url: string): Promise<GTS.DM.WrappedResult<T>>;
export declare namespace Telegram {
    function sendMessage(msg: string, token: string, chatid: string): Promise<GTS.DM.WrappedResult<DM.SendMessageResult>>;
    namespace DM {
        interface SendMessageResult {
            ok: boolean;
            result: Result;
        }
        interface Result {
            message_id: number;
            sender_chat: SenderChat;
            chat: Chat;
            date: number;
            text: string;
        }
        interface SenderChat {
            id: number;
            title: string;
            username: string;
            type: string;
        }
        interface Chat {
            id: number;
            title: string;
            username: string;
            type: string;
        }
    }
}
