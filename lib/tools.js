const uuidv1 = require('uuid/v1')
const fs = require("fs");

/**
 * Tests whether the given variable is a real object and not an Array
 * @param {any} it The variable to test
 * @returns {it is Record<string, any>}
 */
function isObject(it) {
    // This is necessary because:
    // typeof null === 'object'
    // typeof [] === 'object'
    // [] instanceof Object === true
    return Object.prototype.toString.call(it) === '[object Object]';
}

/**
 * Tests whether the given variable is really an Array
 * @param {any} it The variable to test
 * @returns {it is any[]}
 */
function isArray(it) {
    if (typeof Array.isArray === 'function') return Array.isArray(it);
    return Object.prototype.toString.call(it) === '[object Array]';
}

function getTimestamp() {
    let current_datetime = new Date()
    return formatted_string("0000", current_datetime.getFullYear(), "l") + "-"
        + formatted_string("00", (current_datetime.getMonth() + 1), "l") + "-"
        + formatted_string("00", current_datetime.getDate(), "l") + " "
        + formatted_string("00", current_datetime.getHours(), "l") + ":"
        + formatted_string("00", current_datetime.getMinutes(), "l") + ":"
        + formatted_string("00", current_datetime.getSeconds(), "l")
}

function formatted_string(pad, user_str, pad_pos) {
    if (typeof user_str === 'undefined')
        return pad;
    if (pad_pos == 'l') {
        return (pad + user_str).slice(-pad.length);
    }
    else {
        return (user_str + pad).substring(0, pad.length);
    }
}

function getUID(cb) {
    fs.readFile("./uid.txt", function (err, buf) {
        if (err) {
            let uid = uuidv1();
            fs.writeFile("./uid.txt", uid, (err) => {
                if (err) console.log(err);
            });
            console.log(`no stored uid found, created new ${uid}`);
            cb(uid);
        } else {
            let uid = buf.toString();
            console.log(`stored uid found ${uid}`);
            cb(uid);
        }
    });
}


module.exports = {
    isArray,
    isObject,
    getTimestamp,
    getUID
};