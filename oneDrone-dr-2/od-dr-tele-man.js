/**
 * Created by Wonseok Jung in KETI on 2024-03-05.
 */

require("moment-timezone");
const moment = require("moment");
moment.tz.setDefault("Asia/Seoul");
const dgram = require("dgram");
const mqtt = require("mqtt");
const { nanoid } = require("nanoid");

global.conf = require("./conf");

const { mavlink10, MAVLink10Processor } = require("./mavlibrary/mavlink1");
const { mavlink20, MAVLink20Processor } = require("./mavlibrary/mavlink2");

let SitlHost = "127.0.0.1";
let SitlDronePort = process.argv[2] ? process.argv[2] : 14557;
let SitlGcsPort = process.argv[3] ? process.argv[3] : 14558;

let SitlDroneUdp = null;
let SitlGcsUdp = dgram.createSocket("udp4");

let my_sortie_name = "unknown";

let my_system_id = 8;

// dr broker (Local)
let dr_mqtt_client = null;
// od-dr-tele-relay.js
let sub_gcs_topic =
  "/Mobius/" +
  conf.drone_info.gcs +
  "/GCS_Data/" +
  conf.drone_info.drone +
  "/sitl";
let pub_drone_topic =
  "/Mobius/" +
  conf.drone_info.gcs +
  "/Drone_Data/" +
  conf.drone_info.drone +
  "/disarm/sitl";

let pub_sortie_topic = "/od/tele/relay/man/sortie/orig";

// for etc
let pub_parse_heartbeat = "/od/tele/broadcast/man/hb/orig"; // '/TELE/drone/hb';
let pub_parse_global_position_int = "/od/tele/broadcast/man/gpi/orig"; // '/TELE/drone/gpi';
let pub_parse_batt_low_volt = "/od/tele/broadcast/man/batt_low_volt/orig"; // '/TELE/drone/batt_low_volt/res';
let pub_parse_wp_yaw_behavior = "/od/tele/broadcast/man/wp_yaw_behavior/orig"; // '/TELE/drone/wp_yaw_behavior';
let pub_parse_distance_sensor = "/od/tele/broadcast/man/distance_sensor/orig"; // '/TELE/drone/distance_sensor';
let pub_parse_battery = "/od/tele/broadcast/man/battery/orig"; // '/TELE/drone/battery';
let pub_parse_timesync = "/od/tele/broadcast/man/timesync/orig"; // '/TELE/drone/timesync';
let pub_parse_system_time = "/od/tele/broadcast/man/system_time/orig"; // '/TELE/drone/system_time';

// RC 응답 전달하는 토픽
let pub_res_topic =
  "/Mobius/" +
  conf.drone_info.gcs +
  "/Res_Data/" +
  conf.drone_info.drone +
  "/sitl";

init();

function init() {
  dr_mqtt_connect("127.0.0.1");

  mavPortOpening();
}

const MavLinkProtocolV1 = {
  NAME: "MAV_V1",
  START_BYTE: 0xfe,
  PAYLOAD_OFFSET: 6,
  CHECKSUM_LENGTH: 2,
  SYS_ID: 254,
  COMP_ID: 1,
};

const MavLinkProtocolV2 = {
  NAME: "MAV_V2",
  START_BYTE: 0xfd,
  PAYLOAD_OFFSET: 10,
  CHECKSUM_LENGTH: 2,
  SYS_ID: 254,
  COMP_ID: 1,
  IFLAG_SIGNED: 0x01,
};

const KNOWN_PROTOCOLS_BY_STX = {
  [MavLinkProtocolV1.START_BYTE]: MavLinkProtocolV1,
  [MavLinkProtocolV2.START_BYTE]: MavLinkProtocolV2,
};

function findStartOfPacket(buffer) {
  const stxv1 = buffer.indexOf(MavLinkProtocolV1.START_BYTE);
  const stxv2 = buffer.indexOf(MavLinkProtocolV2.START_BYTE);

  if (stxv1 >= 0 && stxv2 >= 0) {
    // in the current buffer both STX v1 and v2 are found - get the first one
    if (stxv1 < stxv2) {
      return stxv1;
    } else {
      return stxv2;
    }
  } else if (stxv1 >= 0) {
    // in the current buffer STX v1 is found
    return stxv1;
  } else if (stxv2 >= 0) {
    // in the current buffer STX v2 is found
    return stxv2;
  } else {
    // no STX found
    return null;
  }
}

function getPacketProtocol(buffer) {
  return KNOWN_PROTOCOLS_BY_STX[buffer.readUInt8(0)] || null;
}

function readPacketLength(buffer, Protocol) {
  // check if the current buffer contains the entire message
  const payloadLength = buffer.readUInt8(1);
  return (
    Protocol.PAYLOAD_OFFSET +
    payloadLength +
    Protocol.CHECKSUM_LENGTH +
    (isV2Signed(buffer) ? 13 : 0)
  );
}

function isV2Signed(buffer) {
  const protocol = buffer.readUInt8(0);
  if (protocol === MavLinkProtocolV2.START_BYTE) {
    const flags = buffer.readUInt8(2);
    return !!(flags & MavLinkProtocolV2.IFLAG_SIGNED);
  }
}

// RC 응답 데이터 Buffer < header data 00 00 00 00 crc > -> data = 21(ON) or 00(OFF)
const resON = "ff2100000000";
const resOFF = "ff0000000000";

let res = resOFF;
let mavRC_t_id = null;
let mavRc_fail_t_id = null;
let mavRCsequence = 0;

const crc8_Table = [
  0,
  94,
  188,
  226,
  97,
  63,
  221,
  131,
  194,
  156,
  126,
  32,
  163,
  253,
  31,
  65, // 0 ~ 15
  157,
  195,
  33,
  127,
  252,
  162,
  64,
  30,
  95,
  1,
  227,
  189,
  62,
  96,
  130,
  220, // 16 ~ 31
  35,
  125,
  159,
  193,
  66,
  28,
  254,
  160,
  225,
  191,
  93,
  3,
  128,
  222,
  60,
  98, // 32 ~ 47
  190,
  224,
  2,
  92,
  223,
  129,
  99,
  61,
  124,
  34,
  192,
  158,
  29,
  67,
  161,
  255, // 48 ~ 63
  70,
  24,
  250,
  164,
  39,
  121,
  155,
  197,
  132,
  218,
  56,
  102,
  229,
  187,
  89,
  7, // 64 ~ 79
  219,
  133,
  103,
  57,
  186,
  228,
  6,
  88,
  25,
  71,
  165,
  251,
  120,
  38,
  196,
  154, // 80 ~ 95
  101,
  59,
  217,
  135,
  4,
  90,
  184,
  230,
  167,
  249,
  27,
  69,
  198,
  152,
  122,
  36, // 96 ~ 111
  248,
  166,
  68,
  26,
  153,
  199,
  37,
  123,
  58,
  100,
  134,
  216,
  91,
  5,
  231,
  185, // 112 ~ 127
  140,
  210,
  48,
  110,
  237,
  179,
  81,
  15,
  78,
  16,
  242,
  172,
  47,
  113,
  147,
  205, // 128 ~ 143
  17,
  79,
  173,
  243,
  112,
  46,
  204,
  146,
  211,
  141,
  111,
  49,
  178,
  236,
  14,
  80, // 144 ~ 159
  175,
  241,
  19,
  77,
  206,
  144,
  114,
  44,
  109,
  51,
  209,
  143,
  12,
  82,
  176,
  238, // 160 ~ 175
  50,
  108,
  142,
  208,
  83,
  13,
  239,
  177,
  240,
  174,
  76,
  18,
  145,
  207,
  45,
  115, // 176 ~ 191
  202,
  148,
  118,
  40,
  171,
  245,
  23,
  73,
  8,
  86,
  180,
  234,
  105,
  55,
  213,
  139, // 192 ~ 207
  87,
  9,
  235,
  181,
  54,
  104,
  138,
  212,
  149,
  203,
  41,
  119,
  244,
  170,
  72,
  22, // 208 ~ 223
  233,
  183,
  85,
  11,
  136,
  214,
  52,
  106,
  43,
  117,
  151,
  201,
  74,
  20,
  246,
  168, // 224 ~ 239
  116,
  42,
  200,
  150,
  21,
  75,
  169,
  247,
  182,
  232,
  10,
  84,
  215,
  137,
  107,
  53, // 240 ~ 255
];

function Calc_CRC_8(DataArray, Length) {
  let i;
  let crc;

  crc = 0x01;
  DataArray = Buffer.from(DataArray, "hex");
  for (i = 1; i < Length; i++) {
    crc = crc8_Table[crc ^ DataArray[i]];
  }
  return crc;
}

function gcs_noti_handler(topic, message) {
  console.log(
    "GCS - [" +
      moment().format("YYYY-MM-DD hh:mm:ssSSS") +
      "] " +
      message.toString("hex")
  );

  let mavGCSData = message.toString("hex");
  let msg_id;
  let ver = mavGCSData.substring(0, 2);

  if (ver === "fd") {
    msg_id = parseInt(
      mavGCSData.substring(18, 20) +
        mavGCSData.substring(16, 18) +
        mavGCSData.substring(14, 16),
      16
    );
  } else {
    msg_id = parseInt(mavGCSData.substring(10, 12).toLowerCase(), 16);
  }

  if (msg_id === mavlink.MAVLINK_MSG_ID_RC_CHANNELS_OVERRIDE) {
    if (SitlGcsUdp) {
      SitlGcsUdp.send(
        message,
        0,
        message.length,
        SitlGcsPort,
        SitlHost,
        (err) => {
          if (err) {
            console.log("UDP message send error", err);
            return;
          } else {
            if (mavRC_t_id) {
              clearInterval(mavRc_fail_t_id);
              clearTimeout(mavRC_t_id);
            }

            let crc = Calc_CRC_8(resON, 6);
            let hex_crc = crc.toString(16);
            res = resON + hex_crc;

            res = mavRCsequence.toString(16).padStart(2, "0") + res;

            if (dr_mqtt_client) {
              dr_mqtt_client.publish(
                pub_res_topic,
                Buffer.from(res, "hex"),
                () => {
                  res = "";
                }
              );
            }

            mavRCsequence++;
            mavRCsequence %= 255;

            mavRC_t_id = setTimeout(() => {
              let crc = Calc_CRC_8(resON, 6);
              let hex_crc = crc.toString(16);
              res = resOFF + hex_crc;
              mavRC_t_id = null;

              res = mavRCsequence.toString(16).padStart(2, "0") + res;

              mavRc_fail_t_id = setInterval(() => {
                if (dr_mqtt_client) {
                  dr_mqtt_client.publish(
                    pub_res_topic,
                    Buffer.from(res, "hex"),
                    () => {}
                  );
                }
              }, 80);

              mavRCsequence++;
              mavRCsequence %= 255;
            }, 3000);
          }
        }
      );
    }
  } else {
    if (SitlGcsUdp) {
      SitlGcsUdp.send(
        message,
        0,
        message.length,
        SitlGcsPort,
        SitlHost,
        (err) => {
          if (err) {
            console.log("UDP message send error", err);
            return;
          }
        }
      );
    }
  }
}

function dr_mqtt_connect(serverip) {
  if (!dr_mqtt_client) {
    let connectOptions = {
      host: serverip,
      port: conf.cse.mqttport,
      protocol: "mqtt",
      keepalive: 10,
      clientId: "od-dr-tele-man_" + nanoid(15),
      protocolId: "MQTT",
      protocolVersion: 4,
      clean: true,
      reconnectPeriod: 2 * 1000,
      connectTimeout: 30 * 1000,
      queueQoSZero: false,
      rejectUnauthorized: false,
    };

    dr_mqtt_client = mqtt.connect(connectOptions);

    dr_mqtt_client.on("connect", () => {
      console.log("dr_mqtt_client is connected to ( " + serverip + " )");

      if (sub_gcs_topic !== "") {
        dr_mqtt_client.subscribe(sub_gcs_topic, () => {
          console.log(
            "[dr_mqtt_client] sub_gcs_topic is subscribed: " + sub_gcs_topic
          );
        });
      }
    });

    dr_mqtt_client.on("message", (topic, message) => {
      if (topic === sub_gcs_topic) {
        gcs_noti_handler(topic, message);
      }
    });

    dr_mqtt_client.on("error", (err) => {
      console.log("[dr_mqtt_client] (error) " + err.message);
    });
  }
}

function send_request_data_stream_command(
  req_stream_id,
  req_message_rate,
  start_stop
) {
  let btn_params = {};
  btn_params.target_system = my_system_id;
  btn_params.target_component = 1;
  btn_params.req_stream_id = req_stream_id;
  btn_params.req_message_rate = req_message_rate;
  btn_params.start_stop = start_stop;

  try {
    let msg = mavlinkGenerateMessage(
      255,
      0xbe,
      mavlink.MAVLINK_MSG_ID_REQUEST_DATA_STREAM,
      btn_params
    );
    if (!msg) {
      console.log("[send_request_data_stream_command] mavlink message is null");
    } else {
      if (SitlGcsUdp) {
        SitlGcsUdp.send(msg, 0, msg.length, SitlGcsPort, SitlHost, (err) => {
          if (err) {
            console.log("UDP message send error", err);
            return;
          }
        });
      }
    }
  } catch (ex) {
    console.log("[ERROR] ", ex);
  }
}

function send_param_get_command(param_id) {
  let btn_params = {};
  btn_params.target_system = my_system_id;
  btn_params.target_component = 1;
  btn_params.param_id = param_id;
  btn_params.param_index = -1;

  try {
    let msg = mavlinkGenerateMessage(
      255,
      0xbe,
      mavlink.MAVLINK_MSG_ID_PARAM_REQUEST_READ,
      btn_params
    );
    if (!msg) {
      console.log("[send_param_get_command] mavlink message is null");
    } else {
      if (SitlGcsUdp) {
        SitlGcsUdp.send(msg, 0, msg.length, SitlGcsPort, SitlHost, (err) => {
          if (err) {
            console.log("UDP message send error", err);
            return;
          }
        });
      }
    }
  } catch (ex) {
    console.log("[ERROR] " + ex);
  }
}

function mavlinkGenerateMessage(src_sys_id, src_comp_id, type, params) {
  let mavlinkParser;
  if (mavVersion === "v1") {
    mavlinkParser = new MAVLink10Processor(
      null /*logger*/,
      src_sys_id,
      src_comp_id
    );
  } else if (mavVersion === "v2") {
    mavlinkParser = new MAVLink20Processor(
      null /*logger*/,
      src_sys_id,
      src_comp_id
    );
  }
  let mavMsg = null;
  let genMsg = null;
  try {
    switch (type) {
      case mavlink.MAVLINK_MSG_ID_PARAM_SET:
        mavMsg = new mavlink.messages.param_set(
          params.target_system,
          params.target_component,
          params.param_id,
          params.param_value,
          params.param_type
        );
        break;
      case mavlink.MAVLINK_MSG_ID_REQUEST_DATA_STREAM:
        mavMsg = new mavlink.messages.request_data_stream(
          params.target_system,
          params.target_component,
          params.req_stream_id,
          params.req_message_rate,
          params.start_stop
        );
        break;
      case mavlink.MAVLINK_MSG_ID_PARAM_REQUEST_READ:
        mavMsg = new mavlink.messages.param_request_read(
          params.target_system,
          params.target_component,
          params.param_id,
          params.param_index
        );
        break;
      case mavlink.MAVLINK_MSG_ID_RC_CHANNELS_OVERRIDE:
        mavMsg = new mavlink.messages.rc_channels_override(
          params.target_system,
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
          params.ch16_raw
          // params.ch17_raw,
          // params.ch18_raw,
        );
        break;
      case mavlink.MAVLINK_MSG_ID_SET_MODE:
        mavMsg = new mavlink.messages.set_mode(
          params.target_system,
          params.base_mode,
          params.custom_mode
        );
        break;
    }
  } catch (e) {
    console.log("MAVLINK EX:" + e);
  }

  if (mavMsg) {
    genMsg = Buffer.from(mavMsg.pack(mavlinkParser));
    //console.log('>>>>> MAVLINK OUTGOING MSG: ' + genMsg.toString('hex'));
  }

  return genMsg;
}

function mavPortOpening() {
  if (!SitlDroneUdp) {
    SitlDroneUdp = dgram.createSocket("udp4");
    SitlDroneUdp.bind(SitlDronePort, SitlHost);

    SitlDroneUdp.on("listening", mavPortOpen);
    SitlDroneUdp.on("message", mavPortData);
    SitlDroneUdp.on("close", mavPortClose);
    SitlDroneUdp.on("error", mavPortError);
  }
}

function mavPortOpen() {
  console.log(
    "UDP socket connect to " +
      SitlDroneUdp.address().address +
      ":" +
      SitlDroneUdp.address().port
  );
}

function mavPortClose() {
  console.log("mavPort closed.");

  setTimeout(mavPortOpening, 2000);
}

function mavPortError(error) {
  console.log("[mavPort error]: " + error.message);

  setTimeout(mavPortOpening, 2000);
}

let mavStrFromDrone = Buffer.from([]);
let mavVersion = "unknown";
let reqDataStream = false;
let mavPacket = null;
let mavlink = mavlink20;
let mav_t_id = null;

function mavPortData(data) {
  mavStrFromDrone = Buffer.concat([mavStrFromDrone, data]);

  while (Buffer.byteLength(mavStrFromDrone) > 0) {
    const offset = findStartOfPacket(mavStrFromDrone);
    if (offset === null) {
      break;
    }

    if (offset > 0) {
      mavStrFromDrone = mavStrFromDrone.slice(offset);
    }

    const Protocol = getPacketProtocol(mavStrFromDrone);

    if (
      mavStrFromDrone.length <
      Protocol.PAYLOAD_OFFSET + Protocol.CHECKSUM_LENGTH
    ) {
      break;
    }

    const expectedBufferLength = readPacketLength(mavStrFromDrone, Protocol);
    if (mavStrFromDrone.length < expectedBufferLength) {
      break;
    }

    const mavBuffer = mavStrFromDrone.slice(0, expectedBufferLength);

    try {
      if (Protocol.NAME === "MAV_V1") {
        mavVersion = "v1";
        mavlink = mavlink10;
        const mavParser = new MAVLink10Processor(
          null /*logger*/,
          Protocol.SYS_ID,
          Protocol.COMP_ID
        );
        mavPacket = mavParser.decode(mavBuffer);
      } else if (Protocol.NAME === "MAV_V2") {
        mavVersion = "v2";
        mavlink = mavlink20;
        const mavParser = new MAVLink20Processor(
          null /*logger*/,
          Protocol.SYS_ID,
          Protocol.COMP_ID
        );
        mavPacket = mavParser.decode(mavBuffer);
      }
      // console.log(mavVersion, mavPacket._msgbuf.toString('hex'))

      if (dr_mqtt_client) {
        dr_mqtt_client.publish(pub_drone_topic, mavPacket._msgbuf);
      }

      setTimeout(parseMavFromDrone, 0, mavPacket);

      mavStrFromDrone = mavStrFromDrone.slice(expectedBufferLength);
    } catch (e) {
      console.log(
        "[mavParse]",
        e.message,
        "\n",
        mavStrFromDrone.toString("hex")
      );
      mavStrFromDrone = mavStrFromDrone.slice(1);
    }
  }

  if (!reqDataStream) {
    mav_t_id = setTimeout(() => {
      setTimeout(
        send_request_data_stream_command,
        1,
        mavlink.MAV_DATA_STREAM_RAW_SENSORS,
        3,
        1
      );
      setTimeout(
        send_request_data_stream_command,
        3,
        mavlink.MAV_DATA_STREAM_EXTENDED_STATUS,
        3,
        1
      );
      setTimeout(
        send_request_data_stream_command,
        5,
        mavlink.MAV_DATA_STREAM_RC_CHANNELS,
        3,
        1
      );
      setTimeout(
        send_request_data_stream_command,
        7,
        mavlink.MAV_DATA_STREAM_POSITION,
        3,
        1
      );
      setTimeout(
        send_request_data_stream_command,
        9,
        mavlink.MAV_DATA_STREAM_EXTRA1,
        3,
        1
      );
      setTimeout(
        send_request_data_stream_command,
        11,
        mavlink.MAV_DATA_STREAM_EXTRA2,
        3,
        1
      );
      setTimeout(
        send_request_data_stream_command,
        13,
        mavlink.MAV_DATA_STREAM_EXTRA3,
        3,
        1
      );
      console.log(
        "========================================\n  Send request data stream command\n========================================"
      );
      setTimeout(send_param_get_command, 15, "BATT_LOW_VOLT", 1);

      reqDataStream = true;
    }, 3 * 1000);
  } else {
    clearTimeout(mav_t_id);
    mav_t_id = null;
  }
}

let fc = {};
let flag_base_mode = 0;
let batt_low_volt_arr = [];

function parseMavFromDrone(mavPacket) {
  try {
    // console.log(mavPacket);
    if (mavPacket._id === mavlink.MAVLINK_MSG_ID_HEARTBEAT) {
      // #00 : HEARTBEAT
      fc.heartbeat = {};
      fc.heartbeat.type = mavPacket.type;
      if (fc.heartbeat.type !== mavlink.MAV_TYPE_ADSB) {
        my_system_id = mavPacket._header.srcSystem;
        fc.heartbeat.autopilot = mavPacket.autopilot;
        fc.heartbeat.base_mode = mavPacket.base_mode;
        fc.heartbeat.custom_mode = mavPacket.custom_mode;
        fc.heartbeat.system_status = mavPacket.system_status;
        fc.heartbeat.mavlink_version = mavPacket.mavlink_version;

        // if (dr_mqtt_client) {
        //     dr_mqtt_client.publish(pub_parse_heartbeat, JSON.stringify(fc.heartbeat));
        // }

        let armStatus = (fc.heartbeat.base_mode & 0x80) === 0x80;

        if (my_sortie_name === "unknown") {
          if (armStatus) {
            flag_base_mode++;
            if (flag_base_mode === 3) {
              my_sortie_name = "arm";

              pub_drone_topic =
                "/Mobius/" +
                conf.drone_info.gcs +
                "/Drone_Data/" +
                conf.drone_info.drone +
                "/" +
                my_sortie_name +
                "/sitl";

              dr_mqtt_client.publish(
                pub_sortie_topic,
                "unknown-arm:" + fc.global_position_int.time_boot_ms.toString()
              );
            }
          } else {
            flag_base_mode = 0;
            my_sortie_name = "disarm";

            pub_drone_topic =
              "/Mobius/" +
              conf.drone_info.gcs +
              "/Drone_Data/" +
              conf.drone_info.drone +
              "/" +
              my_sortie_name +
              "/sitl";

            dr_mqtt_client.publish(pub_sortie_topic, "unknown-disarm:0");
          }
        } else if (my_sortie_name === "disarm") {
          if (armStatus) {
            flag_base_mode++;
            if (flag_base_mode === 3) {
              my_sortie_name = "arm";
              my_sortie_name = moment().format("YYYY_MM_DD_T_HH_mm");

              pub_drone_topic =
                "/Mobius/" +
                conf.drone_info.gcs +
                "/Drone_Data/" +
                conf.drone_info.drone +
                "/" +
                my_sortie_name +
                "/sitl";

              dr_mqtt_client.publish(
                pub_sortie_topic,
                "disarm-arm:" + fc.global_position_int.time_boot_ms.toString()
              );
            }
          } else {
            flag_base_mode = 0;
            my_sortie_name = "disarm";
          }
        } else if (my_sortie_name === "arm") {
          if (armStatus) {
            my_sortie_name = "arm";
          } else {
            flag_base_mode = 0;
            my_sortie_name = "disarm";

            pub_drone_topic =
              "/Mobius/" +
              conf.drone_info.gcs +
              "/Drone_Data/" +
              conf.drone_info.drone +
              "/" +
              my_sortie_name +
              "/sitl";

            dr_mqtt_client.publish(pub_sortie_topic, "arm-disarm:0");
          }
        }
      }
    } else if (mavPacket._id === mavlink.MAVLINK_MSG_ID_GLOBAL_POSITION_INT) {
      // #33
      fc.global_position_int = {};
      fc.global_position_int.time_boot_ms = mavPacket.time_boot_ms;
      fc.global_position_int.lat = mavPacket.lat;
      fc.global_position_int.lon = mavPacket.lon;
      fc.global_position_int.alt = mavPacket.alt;
      fc.global_position_int.relative_alt = mavPacket.relative_alt;
      fc.global_position_int.vx = mavPacket.vx;
      fc.global_position_int.vy = mavPacket.vy;
      fc.global_position_int.vz = mavPacket.vz;
      fc.global_position_int.hdg = mavPacket.hdg;

      reqDataStream = true;
      clearTimeout(mav_t_id);
      mav_t_id = null;

      if (dr_mqtt_client) {
        dr_mqtt_client.publish(
          pub_parse_global_position_int,
          JSON.stringify(fc.global_position_int)
        );
      }
    } else if (mavPacket._id === mavlink.MAVLINK_MSG_ID_PARAM_VALUE) {
      let param_id = mavPacket.param_id;

      if (param_id === "wp_yaw_behavior") {
        fc.wp_yaw_behavior = {};
        fc.wp_yaw_behavior.id = mavPacket.param_id;
        fc.wp_yaw_behavior.id = fc.wp_yaw_behavior.id.replace(/\0/g, "");
        fc.wp_yaw_behavior.value = mavPacket.param_value;
        fc.wp_yaw_behavior.type = mavPacket.param_type;
        fc.wp_yaw_behavior.count = mavPacket.param_count;
        fc.wp_yaw_behavior.index = mavPacket.param_index;

        // if (dr_mqtt_client) {
        //     dr_mqtt_client.publish(pub_parse_wp_yaw_behavior, JSON.stringify(fc.wp_yaw_behavior));
        // }
      } else if (param_id.includes("BATT_LOW_VOLT")) {
        fc.batt_low_volt = {};
        fc.batt_low_volt.id = mavPacket.param_id;
        fc.batt_low_volt.id = fc.batt_low_volt.id.replace(/\0/g, "");
        fc.batt_low_volt.value = mavPacket.param_value;
        fc.batt_low_volt.type = mavPacket.param_type;
        fc.batt_low_volt.count = mavPacket.param_count;
        fc.batt_low_volt.index = mavPacket.param_index;

        batt_low_volt_arr.push(fc.batt_low_volt.value);

        for (let idx in batt_low_volt_arr) {
          if (batt_low_volt_arr.hasOwnProperty(idx)) {
            if (batt_low_volt_arr[idx] === fc.batt_low_volt.value) {
              if (batt_low_volt_arr.length >= 3) {
                // if (dr_mqtt_client) {
                //     dr_mqtt_client.publish(pub_parse_batt_low_volt, JSON.stringify(fc.batt_low_volt));
                // }
              } else {
                setTimeout(send_param_get_command, 15, "BATT_LOW_VOLT", 1);
              }
            } else {
              setTimeout(send_param_get_command, 15, "BATT_LOW_VOLT", 1);
            }
          }
        }
      }
    }
  } catch (e) {
    if (!e.toString().includes("RangeError")) {
      console.log("[parseMavFromDrone Error]", e);
    }
  }
}
