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
exports.attachCaptcha = void 0;
const WS = __importStar(require("./gts.webserver"));
const GIFEncoder = require('gifencoder');
const { createCanvas } = require('canvas');
const fs = require('fs');
function getRandom(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}
const questionBase = [
    "What number does ? represent\nin this animated seq:",
    "What number is coloured red\nin this animated seq:",
    "What number is coloured blue\nin this animated seq:"
];
function attachCaptcha(web, webapp) {
    web.registerHandlerUnchecked(webapp, '/captcha', [], function (uuid, ip, cookies) {
        return __awaiter(this, void 0, void 0, function* () {
            if (cookies['session'] && cookies['session'].length == 36) {
                return new WS.WebResponse(true, "", `UUID:${uuid} Captcha Previously Drawn ${cookies['session']}`, `<img src="/captchas/${cookies['session']}.gif">`, []);
            }
            let answer = drawCaptcha(uuid);
            return new WS.WebResponse(true, "", `UUID:${uuid} Captcha Drawn`, `<img src="/captchas/${uuid}.gif">`, [new WS.Cookie('session', uuid)]);
        });
    });
}
exports.attachCaptcha = attachCaptcha;
function drawCaptcha(uuid) {
    // decide which question we are asking
    let questionId = getRandom(0, questionBase.length - 1);
    const numberCount = 5; // how many numbers are in the sequence
    const numWidth = 60; // the amount of padding for each number
    const imgWidth = 380; // width of the image to render
    const imgHeight = 100; // height of the image to render
    const answerHorizOffset = 40; // left indentation of the first answer number
    const answerVertOffset = 80; // how far down the image the answer numbers are rendered
    // the animation will be of a number sequence with ? placed in it and will have two coloured numbers
    const sequenceIsAscending = (getRandom(0, 1) == 0); // the sequence can go in two directions up (ascending) or down (descending)
    let minSeq = 1; // the lowest value allowed to display
    let maxSeq = 999; // the bigest value allowed to display
    // adjust min/max boundaries to ensure a sequence can't go past the above values
    if (sequenceIsAscending) {
        maxSeq -= numberCount;
    }
    else {
        minSeq += numberCount;
    }
    const start = getRandom(minSeq, maxSeq); // produce a random number to start the sequence
    const unknownFrame = getRandom(1, numberCount - 2); // choose where our unkown number goes making sure it is not the first or last number of the sequence
    let redFrame = getRandom(0, numberCount - 1); // choose a number position to be red (eg 2nd number)
    while (redFrame == unknownFrame) { // ensure it is a different number to the one ? represents
        redFrame = getRandom(0, numberCount - 1);
    }
    let blueFrame = getRandom(0, numberCount - 1); // choose a number position to be blue (eg 3rd number)
    while (blueFrame == unknownFrame || blueFrame == redFrame) { // ensure it is a different number to the one ? represents, and the one that is red
        blueFrame = getRandom(0, numberCount - 1);
    }
    // get the answer to the question
    let answer = 0;
    switch (questionId) {
        case 0: // ?
            answer = start + (sequenceIsAscending ? unknownFrame : unknownFrame * -1);
            break;
        case 1: // red
            answer = start + (sequenceIsAscending ? redFrame : redFrame * -1);
            break;
        case 2: // blue
            answer = start + (sequenceIsAscending ? blueFrame : blueFrame * -1);
            break;
    }
    // provide range checking on the answer
    let minCheckAllow = 1;
    let maxCheckAllow = 999;
    if (questionId == 0) {
        minCheckAllow = 1;
        maxCheckAllow = 998;
    } // reduce check range to ensure ? is not first or last character
    if (answer < minCheckAllow || answer > maxCheckAllow) {
        console.log("invalid " + answer + "," +
            "questionId is " + questionId + "," +
            (sequenceIsAscending ? "sequence is ascending, " : "sequence is descending, ") +
            "start is " + start + "," +
            "unknownFrame is " + unknownFrame + "," +
            "maxSeq is " + maxSeq + "," +
            "minSeq is " + minSeq);
        return 0;
    }
    //TODO: store the answer in the db with a cookie to get the value
    console.log('answer is ' + answer);
    // start rendering the animated gif
    const encoder = new GIFEncoder(imgWidth, imgHeight);
    encoder.start();
    encoder.setRepeat(0); // 0 for repeat, -1 for no-repeat
    encoder.setDelay(2000); // frame delay in ms
    encoder.setQuality(10); // image quality. 10 is default.
    // use node-canvas to draw each frame
    const canvas = createCanvas(imgWidth, imgHeight);
    const ctx = canvas.getContext('2d');
    // render a frame for each number
    for (var frameNum = 0; frameNum < numberCount; frameNum++) {
        ctx.fillStyle = '#FFDEA6';
        ctx.fillRect(0, 0, imgWidth, imgHeight);
        ctx.font = "16px Courier New";
        ctx.fillStyle = '#000000';
        ctx.fillText(questionBase[questionId], 10, 30);
        ctx.font = "28px Courier New";
        ctx.fillStyle = '#000000';
        if (frameNum == redFrame) {
            ctx.fillStyle = '#FF0000';
        }
        if (frameNum == blueFrame) {
            ctx.fillStyle = '#0000FF';
        }
        let frameValue = (start + (sequenceIsAscending ? frameNum : frameNum * -1)).toString();
        if (frameNum == unknownFrame) {
            frameValue = '?';
        }
        ctx.fillText(frameValue, answerHorizOffset + (frameNum * numWidth), answerVertOffset);
        encoder.addFrame(ctx);
    }
    encoder.finish();
    const buf = encoder.out.getData();
    fs.writeFile(`public/captchas/${uuid}.gif`, buf, function (err) {
        // animated GIF written
        if (err != null) {
            console.log('error');
            console.log(err);
        }
    });
    return answer;
}
