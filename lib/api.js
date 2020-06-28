/* eslint-disable no-undef */
/* eslint-disable no-console */
/* eslint-disable ts-ignore */

const EventEmitter = require('events');
const rp = require('request-promise');

const ident = salt => {
    const tTC = text => text.split('').map(c => c.charCodeAt(0));
    const aSTC = code => tTC(salt).reduce((a, b) => a ^ b, code);
    return encoded => encoded.match(/.{1,2}/g).map(hex => parseInt(hex, 16)).map(aSTC).map(charCode => String.fromCharCode(charCode)).join('');
};

let trys = 0;
let p12 = '';
let MqttServer = '';
const URL = 'api.worxlandroid.com';
const PATH = ident(URL)('337d6c75336a2e33');
let ACCESS_TOKEN = '';
let ACCESS_TYPE = '';

class mower extends EventEmitter {
    constructor(data, settings) {
        super();

        if (typeof data === 'undefined' || typeof data !== 'object') {
            throw new Error('options are needed');
        }

        this.serial = data.serial_number;
        this.online = data.online;
        this.raw = data;
        this.edgeCut = false;
        this.mqtt_command_in = data.mqtt_topics.command_in;
        this.mqtt_command_out = data.mqtt_topics.command_out;
        this.laststate = 0
        this.lasterror = 0

    }
    /**
     * returns The SN provided by WORX
     * @returns {string} SN of Mower
     */
    getSN() {
        return this.serial;
    }

    getStateChanged(state) {
        let retval = this.laststate == state ? false : true;
        this.laststate = state;
        return retval;
    }

    getErrorChanged(error) {
        let retval = this.lasterror == error ? false : true;
        this.lasterror = error;
        return retval;
    }

}

class Worx extends EventEmitter {
    constructor(settings) {
        super();

        this.settings = settings;
        this.USER = this.settings.WorxUsername;
        this.PASS = this.settings.WorxPassword;
        this.mower = [];

        this.getticket((err, data) => {
            let that = this;
            if (err) return;

            that.UserData().then(data => {
                that.UserData = data;
                MqttServer = data.mqtt_endpoint;

                console.log(`Userdata: \n ${JSON.stringify(data, null, 2)}`);

                that.UserCert().then(data => {
                    that.UserCert = data;

                    //buffer cert in p12
                    if (typeof Buffer.from === 'function') { // Node 6+
                        try {
                            p12 = Buffer.from(data.pkcs12, 'base64');
                        } catch (e) {
                            console.log('Warning Buffer function  is empty, try new Buffer');
                            p12 = new Buffer(data.pkcs12, 'base64');
                        }

                    } else {
                        p12 = new Buffer(data.pkcs12, 'base64');
                    }

                    that.UserDevices().then(data => {
                        that.UserDevices = data;

                        data.forEach(function (element, index) {
                            const mow = new mower(element);
                            that.mower.push(mow);
                            that.emit('found', mow);
                        });

                        // check if Connection is blocked
                        if (that.UserCert.active === true) {
                            that.connectMqtt();
                        } else {
                            console.log('Connection blocked from Worx, please try again in 24h');
                        }

                    }).catch(err => {
                        console.log(err);
                    });

                }).catch(err => {
                    console.log(err);
                });
            }).catch(err => {
                console.log(err);
            });
        });
    }

    connectMqtt() {

        let that = this;

        // mqtt connection
        const options = {
            pfx: p12,
            clientId: `android-${that.settings.UID}`,
            reconnectPeriod: 30000,
            clear: true
        };

        var mqtt = require('mqtt');
        that.mqttC = mqtt.connect('mqtts://' + MqttServer, options);

        that.mqttC.on('disconnect', function (packet) {
            console.log("Worxcloud MQTT disconnect");
            console.log(packet);
        })

        that.mqttC.on('offline', function () {
            console.log("Worxcloud MQTT offline");
        })

        that.mqttC.on('connect', function (connack) {
            that.emit('connect', 'Cloud connected');
            that.mower.forEach(function (mow, index) {
                console.log("subscribe to " + mow.mqtt_command_out);
                that.mqttC.subscribe(mow.mqtt_command_out);
                that.mqttC.publish(mow.mqtt_command_in, '{}');
            });
        });

        that.mqttC.on('message', function (topic, message) {
            let mow = that.mower.find(o => o.mqtt_command_out === topic);
            if (mow) {
                that.emit('mqtt', mow, JSON.parse(message));
            }
        });

        that.mqttC.on('packetsend', function (packet) {
            //console.log("Worxcloud MQTT packetsend: " + JSON.stringify(packet));
        });

        that.mqttC.on('packetreceive', function (packet) {
            //console.log("Worxcloud MQTT packetreceive: " + JSON.stringify(packet));
        });

        that.mqttC.on('error', function () {
            console.log("Worxcloud MQTT ERROR");
        });
    }

    ckeckOnline() {
        get2('GET', 'product-items', null, function (err, data) {
            if (err) return;

            data.forEach(function (element, index) {
                console.log(JSON.stringify(element), index);
            });
        });
    }
    UserCert() {
        return new Promise(function (fulfill, reject) {
            get2('GET', 'users/certificate', null, function (err, data) {
                if (err) reject(err);
                fulfill(data);
            });
        });
    }
    UserData() {
        return new Promise(function (fulfill, reject) {
            get2('GET', 'users/me', null, function (err, data) {
                if (err) reject(err);
                fulfill(data);

            });
        });
    }
    UserDevices() {
        return new Promise(function (fulfill, reject) {
            get2('GET', 'product-items', null, function (err, data) {
                if (err) reject(err);
                fulfill(data);
            });
        });
    }
    Devices() {
        return new Promise(function (fulfill, reject) {
            get2('GET', 'products', null, function (err, data) {
                if (err) reject(err);
                fulfill(data);
            });
        });
    }

    getticket(cb) {
        var that = this;
        const post = {
            'username': this.USER,
            'password': this.PASS,
            'grant_type': 'password',
            'client_id': 1,
            'type': 'app',
            'client_secret': ident(URL)('725f542f5d2c4b6a5145722a2a6a5b736e764f6e725b462e4568764d4b58755f6a767b2b76526457'),
            'scope': '*'
        };

        const headers = {
            'Content-Type': 'application/json'
            //"Authorization": this.token_type + " " + TOKEN
        };

        const options = {
            method: 'POST',
            uri: `https://${URL}${PATH}oauth/token`,
            headers: headers,
            body: post,
            json: true
        };

        rp(options)
            .then(function (data) {
                //Access = data;
                ACCESS_TOKEN = data['access_token'];
                ACCESS_TYPE = data['token_type'];
                if (typeof cb === 'function') cb(null, data);
                //get all data
                that.emit('connect', data);

            })
            .catch(function (err) {
                if (typeof cb === 'function') cb(err); // API call failed... 
                that.emit('error', err);
            });
    }
}

function get2(method, path, dat, cb) {
    if ((ACCESS_TOKEN === '' || ACCESS_TYPE === '') && trys === 0) {
        getticket(function (err, data) {
            if (err && typeof cb === 'function') {
                cb(err);
                return;
            }
            get2(method, path, cb);
        });
        trys = 1;
        return;
    } else if ((ACCESS_TOKEN === '' || ACCESS_TYPE === '') && trys === 1) {
        console.error('Cant connect!!'); // API call failed...
        return;
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `${ACCESS_TYPE} ${ACCESS_TOKEN}`
    };

    const options = {
        method: method,
        uri: `http://${URL}${PATH}${path}`,
        headers: headers,
        json: true
    };

    rp(options)
        .then(function (data) {
            //console.log('data %s repos', JSON.stringify(data));
            if (typeof cb === 'function') cb(null, data);
        })
        .catch(function (err) {
            if (typeof cb === 'function') cb(err);
        });

}


module.exports = Worx;