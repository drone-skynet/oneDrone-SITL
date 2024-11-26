/**
 * Created by Wonseok Jung in KETI on 2024-02-26.
 */

const {nanoid} = require("nanoid");
const mqtt = require("mqtt");
require("moment-timezone");
const moment = require('moment');
moment.tz.setDefault("Asia/Seoul");

let conf = require('./conf');

const {mavlink10, MAVLink10Processor} = require('./mavlibrary/mavlink1');
const {mavlink20, MAVLink20Processor} = require('./mavlibrary/mavlink2');

let mavlink = mavlink20;
let mavlinkParser = MAVLink20Processor;

// dr broker (Local)
let dr_mqtt_client = null;
// RC 응답 수신 토픽
let sub_res_topic = '/Mobius/' + conf.drone_info.gcs + '/Res_Data/' + conf.drone_info.drone + '/sitl';

// mobius broker (LTE)
let mobius_mqtt_client = null;
// RC 데이터 수신하는 토픽
let sub_lte_rc_topic = '/Mobius/' + conf.drone_info.gcs + '/Rc_Data/' + conf.drone_info.drone + '/lte';
// RC 응답 전달하는 토픽
let pub_lte_res_topic = '/Mobius/' + conf.drone_info.gcs + '/Res_Data/' + conf.drone_info.drone + '/lte';

let rcData = {};
let t_id = null;
let disconnected = true;

dr_mqtt_connect('127.0.0.1');

mobius_mqtt_connect(conf.drone_info.host);

const SBUS_MIN = 25;
const SBUS_MAX = 225;
const RC_MIN = 1000;
const RC_MAX = 2000;

function dr_mqtt_connect(serverip) {
    if (!dr_mqtt_client) {
        let connectOptions = {
            host: serverip,
            port: 1883,
            protocol: "mqtt",
            keepalive: 10,
            clientId: 'od-dr-rc-relay_' + nanoid(15),
            protocolId: "MQTT",
            protocolVersion: 4,
            clean: true,
            reconnectPeriod: 2 * 1000,
            connectTimeout: 30 * 1000,
            queueQoSZero: false,
            rejectUnauthorized: false
        }

        dr_mqtt_client = mqtt.connect(connectOptions);

        dr_mqtt_client.on('connect', () => {
            console.log('dr_mqtt_client is connected to ( ' + serverip + ' )');

            dr_mqtt_client.subscribe(sub_res_topic, () => {
                console.log('[dr_mqtt_client] sub_res_topic is subscribed: ' + sub_res_topic);
            });
        });

        dr_mqtt_client.on('message', (topic, message) => {
            if (topic === sub_res_topic) {
                if (mobius_mqtt_client) {
                    mobius_mqtt_client.publish(pub_lte_res_topic, message, () => {
                        // console.log("[LTE](" + moment().format('YYYY-MM-DD hh:mm:ssSSS') + ") send to " + pub_lte_res_topic + " -", message.toString('hex'));
                    });
                }
            }
        });

        dr_mqtt_client.on('error', (err) => {
            console.log('[dr_mqtt_client error] ' + err.message);
        });
    }
}

function mobius_mqtt_connect(serverip) {
    if (!mobius_mqtt_client) {
        let connectOptions = {
            host: serverip,
            port: 1883,
            protocol: "mqtt",
            keepalive: 10,
            clientId: 'od-dr-rc-relay_lte_' + nanoid(15),
            protocolId: "MQTT",
            protocolVersion: 4,
            clean: true,
            reconnectPeriod: 2 * 1000,
            connectTimeout: 30 * 1000,
            queueQoSZero: false,
            rejectUnauthorized: false
        }

        mobius_mqtt_client = mqtt.connect(connectOptions);

        mobius_mqtt_client.on('connect', () => {
            console.log('mobius_mqtt_client is connected to ( ' + serverip + ' )');

            if (sub_lte_rc_topic !== '') {
                mobius_mqtt_client.subscribe(sub_lte_rc_topic, () => {
                    console.log('[mobius_mqtt_client] sub_lte_rc_topic is subscribed: ' + sub_lte_rc_topic);
                });
            }
        });

        mobius_mqtt_client.on('message', (topic, message) => {
            if (topic === sub_lte_rc_topic && disconnected) {
                let RC_data = message.toString('hex');
                let sequence = parseInt(RC_data.substring(0, 2), 16);
                let rcRawData = RC_data.slice(2);

                if (rcData.hasOwnProperty(sequence)) {
                    delete rcData[sequence];
                    return;
                }

                console.log('[LTE-RC]', sequence);

                channel_val(rcRawData);
            }
        });

        mobius_mqtt_client.on('error', (err) => {
            console.log('[mobius_mqtt_client error] ' + err.message);
        });
    }
}

const RC_LENGTH = 68;

function SBUS2RC(x) {
    return ((x - SBUS_MIN) / (SBUS_MAX - SBUS_MIN)) * RC_MIN + (RC_MAX - RC_MIN)
}

function channel_val(rc_data) {
    let header1 = rc_data.substring(0, 2);
    if (header1 === 'ff') {
        let RCData = rc_data.substring(0, RC_LENGTH);

        // console.log('RC - [' + moment().format('YYYY-MM-DD hh:mm:ssSSS') + '] ', RCData);
        if (RCData !== '') {
            Parse_RcData(RCData);
        }
    }
}

function mavlinkGenerateMessage(src_sys_id, src_comp_id, type, params) {
    try {
        mavlinkParser = new MAVLink20Processor(null/*logger*/, src_sys_id, src_comp_id);

        var mavMsg = null;
        var genMsg = null;

        switch (type) {
            case mavlink.MAVLINK_MSG_ID_RC_CHANNELS_OVERRIDE:
                mavMsg = new mavlink.messages.rc_channels_override(params.target_system,
                    params.target_component,
                    params.ch1_raw,
                    params.ch2_raw,
                    params.ch3_raw,
                    params.ch4_raw,
                    params.ch5_raw,
                    params.ch6_raw,
                    params.ch7_raw,
                    params.ch8_raw,
                    params.ch9_raw,
                    params.ch10_raw,
                    params.ch11_raw,
                    params.ch12_raw,
                    params.ch13_raw,
                    params.ch14_raw,
                    params.ch15_raw,
                    params.ch16_raw,
                    // params.ch17_raw,
                    // params.ch18_raw,
                );
                break;
        }
    }
    catch (e) {
        console.log('MAVLINK EX:' + e);
    }

    if (mavMsg) {
        genMsg = Buffer.from(mavMsg.pack(mavlinkParser));
        //console.log('>>>>> MAVLINK OUTGOING MSG: ' + genMsg.toString('hex'));
    }

    return genMsg;
}

function Parse_RcData(rc_data) {
    let rc_value = {};
    rc_value.target_system = conf.drone_info.system_id;
    rc_value.target_component = 1;
    rc_value.ch1_raw = SBUS2RC(parseInt(rc_data.substring(2, 4), 16));
    rc_value.ch2_raw = SBUS2RC(parseInt(rc_data.substring(4, 6), 16));
    rc_value.ch3_raw = SBUS2RC(parseInt(rc_data.substring(6, 8), 16));
    rc_value.ch4_raw = SBUS2RC(parseInt(rc_data.substring(8, 10), 16));
    rc_value.ch5_raw = SBUS2RC(parseInt(rc_data.substring(10, 12), 16));
    rc_value.ch6_raw = SBUS2RC(parseInt(rc_data.substring(12, 14), 16));
    rc_value.ch7_raw = SBUS2RC(parseInt(rc_data.substring(14, 16), 16));
    rc_value.ch8_raw = SBUS2RC(parseInt(rc_data.substring(16, 18), 16));
    rc_value.ch9_raw = SBUS2RC(parseInt(rc_data.substring(18, 20), 16));
    rc_value.ch10_raw = SBUS2RC(parseInt(rc_data.substring(20, 22), 16));
    rc_value.ch11_raw = SBUS2RC(parseInt(rc_data.substring(22, 24), 16));
    rc_value.ch12_raw = SBUS2RC(parseInt(rc_data.substring(24, 26), 16));
    rc_value.ch13_raw = SBUS2RC(parseInt(rc_data.substring(26, 28), 16));
    rc_value.ch14_raw = SBUS2RC(parseInt(rc_data.substring(28, 30), 16));
    rc_value.ch15_raw = SBUS2RC(parseInt(rc_data.substring(30, 32), 16));
    rc_value.ch16_raw = SBUS2RC(parseInt(rc_data.substring(32, 34), 16));

    try {
        if (mavlink === null) {
            console.log('mavlink variable is null')
        }
        else {
            let rc_signal = mavlinkGenerateMessage(255, 0xbe, mavlink.MAVLINK_MSG_ID_RC_CHANNELS_OVERRIDE, rc_value);
            if (!rc_signal) {
                console.log("mavlink message is null");
            }
            else {
                if (dr_mqtt_client) {
                    dr_mqtt_client.publish('/Mobius/' + conf.drone_info.gcs + '/GCS_Data/' + conf.drone_info.drone + '/sitl', rc_signal, () => {
                        // console.log('/Mobius/' + conf.drone_info.gcs + '/GCS_Data/' + conf.drone_info.drone + '/sitl', rc_signal.toString('hex'));
                    });
                }
            }
        }
    }
    catch (ex) {
        console.log('[ERROR] ' + ex);
    }
}
