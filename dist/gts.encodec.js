"use strict";
// Useage:
// Call encrypt to encrypt a unicode string into a string of hex pairs representing the encrypted content
// Call decrypt to decrypt a string of encrypted content as hex pairs into the original unicode string
Object.defineProperty(exports, "__esModule", { value: true });
exports.decrypt = exports.encrypt = void 0;
// Algorithms:
// Internally uses encodeURIComponent, decodeURIComponent, fromCharCode, and ports of murmurHash3_x86_128 and academic exploit fixed Corrected Block TEA
// Convert a string to an array of ints, each 32bit int containing four 8bit chars.
// Note: Chars must be standard ASCII 8bit to fit four per int.
// Javascript provides encodeURI function that can be used to pack a utf-8 string into 8bit ascii.
function ascii8bitStrToPackedInts(str) {
    let ints = new Array(Math.ceil(str.length / 4)); // The array will be a quater of the length of the string, rounding up to make room for any dangling chars in the final block.
    for (var i = 0; i < ints.length; i++) {
        // Pack the string into an array of ints (four 8bit chars per 32bit int)
        // Note: Loop will try to access past the end of the input string when the input is not divisible by 4.
        // When this happens charCodeAt returns NaN that the bitwise operators treat as 0.
        // This has the desired effect of packing trailing null chars that the decrypt strips.
        ints[i] = str.charCodeAt(i * 4) + (str.charCodeAt(i * 4 + 1) << 8) + (str.charCodeAt(i * 4 + 2) << 16) + (str.charCodeAt(i * 4 + 3) << 24);
    }
    return ints;
}
// Convert an array of 32 bit ints into a string of 8bit characters
function packedIntsToAscii8bitStr(ints) {
    let a = new Array(ints.length); // Each output array entry will be a string consisting of four characters unpacked from each 32bit int
    for (var i = 0; i < ints.length; i++) {
        // Mask the int to show just the last char stored in it, shifting the chars accross to get each desired.
        a[i] = String.fromCharCode(ints[i] & 0xFF, ints[i] >>> 8 & 0xFF, ints[i] >>> 16 & 0xFF, ints[i] >>> 24 & 0xFF);
    }
    return a.join(''); // Use Array.join() rather than repeated string appends for efficiency.
}
// Ensure hex codes are at least 2 chars wide by left padding with zero if required.
function padLeft(str) {
    if (str.length >= 2) {
        return str;
    }
    else {
        return padLeft("0" + str);
    } // Recurse to provide "00" from empty string.
}
// For each character in a unicode string return its char code. Result is an int array of the same length as the string
function unicodeStrToInts(str) {
    let ints = new Array(str.length);
    for (var i = 0; i < ints.length; i++) {
        ints[i] = str.charCodeAt(i);
    }
    return ints;
}
// get a hash (of four 32bit ints) from a unicode string
function murmurHash3(key, seed = 0) {
    return murmurHash3_x86_128(unicodeStrToInts(key), seed);
}
// hashing function ported to typescript from javascript found at https://github.com/bryc/code/blob/master/jshash/hashes/murmurhash3_128.js
function murmurHash3_x86_128(key, seed = 0) {
    function fmix32(h) {
        h ^= h >>> 16;
        h = Math.imul(h, 2246822507);
        h ^= h >>> 13;
        h = Math.imul(h, 3266489909);
        h ^= h >>> 16;
        return h;
    }
    var k1, k2, k3, k4, p1 = 597399067, p2 = 2869860233, p3 = 951274213, p4 = 2716044179;
    var h1 = seed ^ p1, h2 = seed ^ p2, h3 = seed ^ p3, h4 = seed ^ p4;
    for (var i = 0, b = key.length & -16; i < b;) {
        k1 = key[i + 3] << 24 | key[i + 2] << 16 | key[i + 1] << 8 | key[i];
        k1 = Math.imul(k1, p1);
        k1 = k1 << 15 | k1 >>> 17;
        h1 ^= Math.imul(k1, p2);
        h1 = h1 << 19 | h1 >>> 13;
        h1 += h2;
        h1 = Math.imul(h1, 5) + 1444728091 | 0; // |0 = prevent float
        i += 4;
        k2 = key[i + 3] << 24 | key[i + 2] << 16 | key[i + 1] << 8 | key[i];
        k2 = Math.imul(k2, p2);
        k2 = k2 << 16 | k2 >>> 16;
        h2 ^= Math.imul(k2, p3);
        h2 = h2 << 17 | h2 >>> 15;
        h2 += h3;
        h2 = Math.imul(h2, 5) + 197830471 | 0;
        i += 4;
        k3 = key[i + 3] << 24 | key[i + 2] << 16 | key[i + 1] << 8 | key[i];
        k3 = Math.imul(k3, p3);
        k3 = k3 << 17 | k3 >>> 15;
        h3 ^= Math.imul(k3, p4);
        h3 = h3 << 15 | h3 >>> 17;
        h3 += h4;
        h3 = Math.imul(h3, 5) + 2530024501 | 0;
        i += 4;
        k4 = key[i + 3] << 24 | key[i + 2] << 16 | key[i + 1] << 8 | key[i];
        k4 = Math.imul(k4, p4);
        k4 = k4 << 18 | k4 >>> 14;
        h4 ^= Math.imul(k4, p1);
        h4 = h4 << 13 | h4 >>> 19;
        h4 += h1;
        h4 = Math.imul(h4, 5) + 850148119 | 0;
        i += 4;
    }
    k1 = 0, k2 = 0, k3 = 0, k4 = 0;
    switch (key.length & 15) {
        case 15: k4 ^= key[i + 14] << 16;
        case 14: k4 ^= key[i + 13] << 8;
        case 13:
            k4 ^= key[i + 12];
            k4 = Math.imul(k4, p4);
            k4 = k4 << 18 | k4 >>> 14;
            h4 ^= Math.imul(k4, p1);
        case 12: k3 ^= key[i + 11] << 24;
        case 11: k3 ^= key[i + 10] << 16;
        case 10: k3 ^= key[i + 9] << 8;
        case 9:
            k3 ^= key[i + 8];
            k3 = Math.imul(k3, p3);
            k3 = k3 << 17 | k3 >>> 15;
            h3 ^= Math.imul(k3, p4);
        case 8: k2 ^= key[i + 7] << 24;
        case 7: k2 ^= key[i + 6] << 16;
        case 6: k2 ^= key[i + 5] << 8;
        case 5:
            k2 ^= key[i + 4];
            k2 = Math.imul(k2, p2);
            k2 = k2 << 16 | k2 >>> 16;
            h2 ^= Math.imul(k2, p3);
        case 4: k1 ^= key[i + 3] << 24;
        case 3: k1 ^= key[i + 2] << 16;
        case 2: k1 ^= key[i + 1] << 8;
        case 1:
            k1 ^= key[i];
            k1 = Math.imul(k1, p1);
            k1 = k1 << 15 | k1 >>> 17;
            h1 ^= Math.imul(k1, p2);
    }
    h1 ^= key.length;
    h2 ^= key.length;
    h3 ^= key.length;
    h4 ^= key.length;
    h1 += h2;
    h1 += h3;
    h1 += h4;
    h2 += h1;
    h3 += h1;
    h4 += h1;
    h1 = fmix32(h1);
    h2 = fmix32(h2);
    h3 = fmix32(h3);
    h4 = fmix32(h4);
    h1 += h2;
    h1 += h3;
    h1 += h4;
    h2 += h1;
    h3 += h1;
    h4 += h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}
// Encrypt  a string with a password and hex-encode the encrypted result. rolling changes to the seed should make it harder to break the encryption
// TEA Encryption: Use Corrected Block TEA to encrypt/decrypt a plaintext string using a 128-bit password. Uses academic exploit fix.
function encrypt(plaintext, password, seed = 0) {
    if (plaintext === undefined || plaintext.length === 0)
        return (''); // Empty/missing string stays the same, nothing to encrypt.
    if (password == undefined || password.length == 0) {
        return plaintext; // we can't encode if there is no password
    }
    // 'escape' plaintext so chars outside standard ascii work in single-byte packing, but keep spaces as spaces (not '%20') so encrypted text doesn't grow too long.
    // Can use encodeURI here rather than encodeURIComponent as encodeURI escapes fewer characters, but meets our single-byte packing requirement.
    let asciitext = encodeURI(plaintext).replace(/%20/g, ' ');
    // Convert the text to encode to an array of ints.
    let v = ascii8bitStrToPackedInts(asciitext);
    // The algorigthm needs at least 2 numbers (8 chars) to work. We can fudge this padding out short strings with nulls.
    if (v.length <= 1)
        v[1] = 0;
    // use murmurHash3 to get four 32bit ints from the password to use in the encryption
    let k = murmurHash3(password, seed);
    // Do the encryption.
    let n = v.length;
    let z = v[n - 1], y = v[0], delta = 0x9E3779B9;
    var mx, e, q = Math.floor(16 + 32 / n), sum = 0; // academic exploit fix; https://crypto.stackexchange.com/questions/12993/in-what-way-is-xxtea-really-vulnerable
    while (q-- > 0) { // 16 + 32/n operations gives between 16 & 32 mixes on each word.  Code without academic fix has 6 + 52/n operations which gives between 6 & 32 mixes on each word. [min length string is 2, n=2]
        sum += delta;
        e = sum >>> 2 & 3;
        for (var p = 0; p < n; p++) {
            y = v[(p + 1) % n];
            mx = (z >>> 5 ^ y << 2) + (y >>> 3 ^ z << 4) ^ (sum ^ y) + (k[p & 3 ^ e] ^ z);
            z = v[p] += mx;
        }
    }
    let ciphertext = packedIntsToAscii8bitStr(v);
    // Represent the cipher text as hex code pairs to allow for safe transport.
    let output = "";
    for (var x = 0; x < ciphertext.length; x++) {
        output += padLeft(ciphertext.charCodeAt(x).toString(16)).toUpperCase();
    }
    return output;
}
exports.encrypt = encrypt;
// Decrypt a hex encoded cipher text with a password and encryption seed.
function decrypt(ciphertexthex, password, seed = 0) {
    if (ciphertexthex === undefined || ciphertexthex.length === 0)
        return (''); // Empty/missing string stays the same, nothing to decrypt.
    if (password == undefined || password.length == 0) {
        return ciphertexthex; // we can't decode if there is no password
    }
    // Unpack the cipher text from hex code pairs.
    let ciphertext = '';
    for (var x = 0; x < ciphertexthex.length; x += 2) {
        ciphertext += String.fromCharCode(parseInt("0x" + ciphertexthex.substring(x, x + 2)));
    }
    // Convert the text to decode into an array of ints.
    let v = ascii8bitStrToPackedInts(ciphertext);
    // use murmurHash3 to get four 32bit ints from the password to use in the decryption
    let k = murmurHash3(password, seed);
    // Do the decryption.
    let n = v.length;
    let z = v[n - 1], y = v[0], delta = 0x9E3779B9;
    var mx, e, q = Math.floor(16 + 32 / n), sum = q * delta; // academic exploit fix; https://crypto.stackexchange.com/questions/12993/in-what-way-is-xxtea-really-vulnerable
    while (sum != 0) {
        e = sum >>> 2 & 3;
        for (var p = n - 1; p >= 0; p--) {
            z = v[p > 0 ? p - 1 : n - 1];
            mx = (z >>> 5 ^ y << 2) + (y >>> 3 ^ z << 4) ^ (sum ^ y) + (k[p & 3 ^ e] ^ z);
            y = v[p] -= mx;
        }
        sum -= delta;
    }
    let plaintext = packedIntsToAscii8bitStr(v);
    // Strip trailing null chars resulting from filling 4-char blocks.
    plaintext = plaintext.replace(/\0+$/, '');
    // The encoded text uses encodeURI to ensure that the characters fit inside single-byte packing. Restore them to their original values as the decoded output.
    // Use decodeURIComponent to ensure all escaped characters are restored.
    return decodeURIComponent(plaintext);
}
exports.decrypt = decrypt;
