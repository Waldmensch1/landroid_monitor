'use strict';

const worx = require(__dirname + '/lib/api');
const tools = require(__dirname + '/lib/tools');
const settings = require('./settings.json');

const ERRORCODES = {
    0: 'No error',
    1: 'Trapped',
    2: 'Lifted',
    3: 'Wire missing',
    4: 'Outside wire',
    5: 'Raining',
    6: 'Close door to mow',
    7: 'Close door to go home',
    8: 'Blade motor blocked',
    9: 'Wheel motor blocked',
    10: 'Trapped timeout',
    11: 'Upside down',
    12: 'Battery low',
    13: 'Reverse wire',
    14: 'Charge error',
    15: 'Timeout finding home',
    16: 'Mower locked',
    17: 'Battery over temperature',
};
const STATUSCODES = {
    0: 'IDLE',
    1: 'Home',
    2: 'Start sequence',
    3: 'Leaving home',
    4: 'Follow wire',
    5: 'Searching home',
    6: 'Searching wire',
    7: 'Mowing',
    8: 'Lifted',
    9: 'Trapped',
    10: 'Blade blocked',
    11: 'Debug',
    12: 'Remote control',
    30: 'Going home',
    31: 'Zone training',
    32: 'Border Cut',
    33: 'Searching zone',
    34: 'Pause'
};

var counter = 0;

tools.getUID((uid) => {
    settings.UID = uid;
    console.log(settings)

    const mqtt = require('mqtt');
    var mqttsender = mqtt.connect(settings.localMQTTServer, [{ port: settings.localMQTTServer_port }])
    var WorxCloud = new worx(settings);

    WorxCloud.on('connect', worxc => {
        console.log('sucess conect!');
    });

    WorxCloud.on('found', function (mower) {
        console.log(`found Mower! \n ${JSON.stringify(mower, null, 2)}`);
    });

    WorxCloud.on('mqtt', (mower, data) => {
        counter++;

        if (settings.send_rawdata === true) {
            let status_raw = `${settings.mqtt_prefix}${data.cfg.sn}/raw`;
            mqttsender.publish(status_raw, `${JSON.stringify(data)}`);
            //console.log(data);
        }

        // Status events
        if (mower.getStateChanged(data.dat.ls) === true || settings.filter_events === false) {
            let status = `${settings.mqtt_prefix}${data.cfg.sn}/status`;
            let status_ext = `${settings.mqtt_prefix}${data.cfg.sn}/status_ext`;
            console.log(`${tools.getTimestamp()} ${data.cfg.sn} Send: ${status} = ${data.dat.ls} (${STATUSCODES[data.dat.ls]}) Count: ${counter}`);

            mqttsender.publish(status, `${data.dat.ls}`);
            mqttsender.publish(status_ext, `${STATUSCODES[data.dat.ls]}`);
        } else {
            console.log(`${tools.getTimestamp()} ${data.cfg.sn} State unchanged: ${data.dat.ls} (${STATUSCODES[data.dat.ls]}) Count: ${counter}`);
        }

        // Error events
        if (mower.getErrorChanged(data.dat.le) === true || settings.filter_events === false) {
            let error = `${settings.mqtt_prefix}${data.cfg.sn}/error`;
            let error_ext = `${settings.mqtt_prefix}${data.cfg.sn}/error_ext`;
            mqttsender.publish(error, `${data.dat.le}`);
            mqttsender.publish(error_ext, `${ERRORCODES[data.dat.le]}`);
            console.log(`${tools.getTimestamp()} ${data.cfg.sn} Send: ${error} = ${data.dat.le} (${ERRORCODES[data.dat.le]}) Count: ${counter}`);
        }
    });

    WorxCloud.on('error', err => {
        console.log(`ERROR: ${err}`);
    });
})

