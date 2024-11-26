/**
 * Created by Wonseok Jung in KETI on 2024-03-05.
 */

require("moment-timezone");
const moment = require("moment");
moment.tz.setDefault("Asia/Seoul");
const fs = require("fs");
const { exec, spawn } = require("child_process");
const mqtt = require("mqtt");
const { nanoid } = require("nanoid");
const util = require("util");

global.conf = require("./conf");

let onem2m_client = require("./http_adn");

global.gimbalPortInfo = {
  portnum: "",
  baudrate: 115200,
};

let my_sortie_name = "disarm";

// dr broker (Local)
// Local
let dr_mqtt_client = null;
let sub_drone_topic =
  "/Mobius/" +
  conf.drone_info.gcs +
  "/Drone_Data/" +
  conf.drone_info.drone +
  "/+/sitl";
let pub_gcs_topic =
  "/Mobius/" +
  conf.drone_info.gcs +
  "/GCS_Data/" +
  conf.drone_info.drone +
  "/sitl";
let sub_sortie_topic = "/od/tele/relay/man/sortie/orig";
let sub_msw_data_topic = [];
let pub_msw_control_topic = [];

// mobius broker (LTE)
let mobius_mqtt_client = null;
let pub_lte_drone_topic =
  "/Mobius/" +
  conf.drone_info.gcs +
  "/Drone_Data/" +
  conf.drone_info.drone +
  "/" +
  my_sortie_name +
  "/orig";
let sub_lte_gcs_topic =
  "/Mobius/" +
  conf.drone_info.gcs +
  "/GCS_Data/" +
  conf.drone_info.drone +
  "/orig";
let pub_lte_msw_data_topic = [];
let sub_lte_msw_control_topic = [];
// RC 응답 전달하는 토픽
let pub_lte_res_topic =
  "/Mobius/" +
  conf.drone_info.gcs +
  "/Mav_Res_Data/" +
  conf.drone_info.drone +
  "/lte";

let noti_topic = "";

let MQTT_SUBSCRIPTION_ENABLE = 0;

let my_gcs_name = "";
let my_parent_cnt_name = "";
let my_cnt_name = "";
let my_command_parent_name = "";
let my_command_name = "";
let my_gimbal_parent = "";
let my_gimbal_name = "";

let my_drone_type = "ardupilot";
let my_system_id = 8;

let sh_state = "rtvct";

const retry_interval = 2500;
const normal_interval = 100;

let return_count = 0;
let request_count = 0;

// for GCS
let GCSData = {};

// for mission control
let MissionControlData = {};
let mct_id = null;
let mc_disconnected = true;
let mctrl_sequence = 0;

init();

function init() {
  set_resource();
}

function gcs_noti_handler(message) {
  console.log(
    "GCS - [" +
      moment().format("YYYY-MM-DD hh:mm:ssSSS") +
      "] " +
      message.toString("hex")
  );

  if (dr_mqtt_client) {
    dr_mqtt_client.publish(pub_gcs_topic, message);
  }
}

function set_resource() {
  let info;
  conf.cnt = [];
  conf.sub = [];

  if (conf.drone_info.hasOwnProperty("gcs")) {
    my_gcs_name = conf.drone_info.gcs;
  } else {
    my_gcs_name = "KETI_MUV";
  }

  if (conf.drone_info.hasOwnProperty("host")) {
    conf.cse.host = conf.drone_info.host;
  }

  // set container for drone
  info = {};
  info.parent = "/Mobius/" + conf.drone_info.gcs;
  info.name = "Drone_Data";
  conf.cnt.push(JSON.parse(JSON.stringify(info)));

  info = {};
  info.parent = "/Mobius/" + conf.drone_info.gcs + "/Drone_Data";
  info.name = conf.drone_info.drone;
  conf.cnt.push(JSON.parse(JSON.stringify(info)));

  info.parent =
    "/Mobius/" + conf.drone_info.gcs + "/Drone_Data/" + conf.drone_info.drone;
  info.name = my_sortie_name;
  conf.cnt.push(JSON.parse(JSON.stringify(info)));

  my_parent_cnt_name = info.parent;
  my_cnt_name = my_parent_cnt_name + "/" + info.name;

  // set container for mission -> LTE
  info = {};
  info.parent = "/Mobius/" + conf.drone_info.gcs;
  info.name = "Mission_Data";
  conf.cnt.push(JSON.parse(JSON.stringify(info)));

  info = {};
  info.parent = "/Mobius/" + conf.drone_info.gcs + "/Mission_Data";
  info.name = conf.drone_info.drone;
  conf.cnt.push(JSON.parse(JSON.stringify(info)));

  info = {};
  info.parent =
    "/Mobius/" + conf.drone_info.gcs + "/Mission_Data/" + conf.drone_info.drone;
  info.name = "msw_lte";
  conf.cnt.push(JSON.parse(JSON.stringify(info)));

  info = {};
  info.parent =
    "/Mobius/" +
    conf.drone_info.gcs +
    "/Mission_Data/" +
    conf.drone_info.drone +
    "/msw_lte";
  info.name = "LTE";
  conf.cnt.push(JSON.parse(JSON.stringify(info)));

  sub_msw_data_topic.push(info.parent + "/" + info.name + "/orig");
  pub_lte_msw_data_topic.push(info.parent + "/" + info.name);

  /*
    try {  // run default mission of lte
        setTimeout(npm_install, 10, 'msw_lte_simul', 'msw_lte_simul_msw_lte_simul');
    }
    catch (e) {
        console.log(e.message);
    }
    */

  // set container for mission
  if (conf.drone_info.hasOwnProperty("mission")) {
    for (let mission_name in conf.drone_info.mission) {
      if (conf.drone_info.mission.hasOwnProperty(mission_name)) {
        let arguments = [];

        info = {};
        info.parent =
          "/Mobius/" +
          conf.drone_info.gcs +
          "/Mission_Data/" +
          conf.drone_info.drone;
        info.name = mission_name;
        conf.cnt.push(JSON.parse(JSON.stringify(info)));

        let chk_cnt = "container";
        if (conf.drone_info.mission[mission_name].hasOwnProperty(chk_cnt)) {
          for (let idx in conf.drone_info.mission[mission_name][chk_cnt]) {
            if (
              conf.drone_info.mission[mission_name][chk_cnt].hasOwnProperty(idx)
            ) {
              arguments.push(
                conf.drone_info.mission[mission_name][chk_cnt][idx]
              );

              let container_name =
                conf.drone_info.mission[mission_name][chk_cnt][idx].split(
                  ":"
                )[0];
              info = {};
              info.parent =
                "/Mobius/" +
                conf.drone_info.gcs +
                "/Mission_Data/" +
                conf.drone_info.drone +
                "/" +
                mission_name;
              info.name = container_name;
              conf.cnt.push(JSON.parse(JSON.stringify(info)));

              sub_msw_data_topic.push(info.parent + "/" + info.name + "/orig");
              pub_lte_msw_data_topic.push(info.parent + "/" + info.name);
            }
          }
        }

        chk_cnt = "sub_container";
        if (conf.drone_info.mission[mission_name].hasOwnProperty(chk_cnt)) {
          for (let idx in conf.drone_info.mission[mission_name][chk_cnt]) {
            if (
              conf.drone_info.mission[mission_name][chk_cnt].hasOwnProperty(idx)
            ) {
              let container_name =
                conf.drone_info.mission[mission_name][chk_cnt][idx];

              info = {};
              info.parent =
                "/Mobius/" +
                conf.drone_info.gcs +
                "/Mission_Data/" +
                conf.drone_info.drone +
                "/" +
                mission_name;
              info.name = container_name;
              conf.cnt.push(JSON.parse(JSON.stringify(info)));

              pub_msw_control_topic.push(
                info.parent + "/" + info.name + "/orig"
              );
              sub_lte_msw_control_topic.push(info.parent + "/" + info.name);

              info = {};
              info.parent =
                "/Mobius/" +
                conf.drone_info.gcs +
                "/Mission_Data/" +
                conf.drone_info.drone +
                "/" +
                mission_name +
                "/" +
                container_name;
              info.name = "sub_msw";
              info.nu =
                "mqtt://" + conf.cse.host + "/" + conf.ae.id + "?ct=json";
              conf.sub.push(JSON.parse(JSON.stringify(info)));
            }
          }
        }

        chk_cnt = "git";
        if (conf.drone_info.mission[mission_name].hasOwnProperty(chk_cnt)) {
          let repo_arr =
            conf.drone_info.mission[mission_name][chk_cnt].split("/");
          let directory_name =
            mission_name +
            "_" +
            repo_arr[repo_arr.length - 1].replace(".git", "");
          try {
            if (fs.existsSync("./" + directory_name)) {
              setTimeout(git_pull, 10, mission_name, directory_name, arguments);
            } else {
              setTimeout(
                git_clone,
                10,
                mission_name,
                directory_name,
                conf.drone_info.mission[mission_name][chk_cnt],
                arguments
              );
            }
          } catch (e) {
            console.log(e.message);
          }
        }
      }
    }
  }

  if (conf.drone_info.hasOwnProperty("type")) {
    my_drone_type = conf.drone_info.type;
  } else {
    my_drone_type = "ardupilot";
  }

  if (conf.drone_info.hasOwnProperty("system_id")) {
    my_system_id = conf.drone_info.system_id;
  } else {
    my_system_id = 8;
  }

  // set container for GCS
  info = {};
  info.parent = "/Mobius/" + conf.drone_info.gcs;
  info.name = "GCS_Data";
  conf.cnt.push(JSON.parse(JSON.stringify(info)));

  info = {};
  info.parent = "/Mobius/" + conf.drone_info.gcs + "/GCS_Data";
  info.name = conf.drone_info.drone;
  conf.cnt.push(JSON.parse(JSON.stringify(info)));

  my_command_parent_name = info.parent;
  my_command_name = my_command_parent_name + "/" + info.name;

  // set container for Gimbal
  if (conf.drone_info.hasOwnProperty("gimbal")) {
    info = {};
    info.parent = "/Mobius/" + conf.drone_info.gcs;
    info.name = "Gimbal_Data";
    conf.cnt.push(JSON.parse(JSON.stringify(info)));

    info = {};
    info.parent = "/Mobius/" + conf.drone_info.gcs + "/Gimbal_Data";
    info.name = conf.drone_info.drone;
    conf.cnt.push(JSON.parse(JSON.stringify(info)));

    info.parent =
      "/Mobius/" +
      conf.drone_info.gcs +
      "/Gimbal_Data/" +
      conf.drone_info.drone;
    info.name = my_sortie_name;
    conf.cnt.push(JSON.parse(JSON.stringify(info)));

    my_gimbal_parent = info.parent;
    my_gimbal_name = my_gimbal_parent + "/" + info.name;

    if (conf.drone_info.gimbal.hasOwnProperty("portnum")) {
      gimbalPortInfo.portnum = conf.drone_info.gimbal.portnum.toString();
    }

    if (conf.drone_info.gimbal.hasOwnProperty("baudrate")) {
      gimbalPortInfo.baudrate = conf.drone_info.gimbal.baudrate.toString();
    }

    if (conf.drone_info.gimbal.hasOwnProperty("type")) {
      if (conf.drone_info.gimbal.type.toLowerCase() === "simplebgc") {
        require("./Gimbal/gimbal_SBGC");
      } else if (conf.drone_info.gimbal.type.toLowerCase() === "viewpro") {
        require("./Gimbal/gimbal_viewpro");
      }
    }
  }

  MQTT_SUBSCRIPTION_ENABLE = 1;

  sh_state = "crtct";

  setTimeout(http_watchdog, normal_interval);
}

function http_watchdog() {
  if (sh_state === "crtct") {
    console.log("[sh_state] : " + sh_state);
    create_cnt_all(request_count, (status, count) => {
      if (status === 9999) {
        setTimeout(http_watchdog, retry_interval);
      } else {
        request_count = ++count;
        return_count = 0;
        if (conf.cnt.length <= count) {
          sh_state = "delsub";
          request_count = 0;
          return_count = 0;

          setTimeout(http_watchdog, normal_interval);
        }
      }
    });
  } else if (sh_state === "delsub") {
    console.log("[sh_state] : " + sh_state);
    delete_sub_all(request_count, (status, count) => {
      if (status === 9999) {
        setTimeout(http_watchdog, retry_interval);
      } else {
        request_count = ++count;
        return_count = 0;
        if (conf.sub.length <= count) {
          sh_state = "crtsub";
          request_count = 0;
          return_count = 0;

          setTimeout(http_watchdog, normal_interval);
        }
      }
    });
  } else if (sh_state === "crtsub") {
    console.log("[sh_state] : " + sh_state);
    create_sub_all(request_count, (status, count) => {
      if (status === 9999) {
        setTimeout(http_watchdog, retry_interval);
      } else {
        request_count = ++count;
        return_count = 0;
        if (conf.sub.length <= count) {
          sh_state = "crtci";

          dr_mqtt_connect("127.0.0.1");

          mobius_mqtt_connect(conf.drone_info.host);

          ready_for_notification();

          setTimeout(http_watchdog, normal_interval);
        }
      }
    });
  } else if (sh_state === "crtci") {
    console.log("[sh_state] : " + sh_state);
  }
}

function ready_for_notification() {
  for (let i = 0; i < conf.sub.length; i++) {
    if (conf.sub[i].name) {
      let notification_url = new URL(conf.sub[i].nu);
      if (notification_url.protocol === "mqtt:") {
        if (notification_url.hostname === "autoset") {
          conf.sub[i]["nu"] = "mqtt://" + conf.cse.host + "/" + conf.ae.id;
          noti_topic = util.format("/oneM2M/req/+/%s/#", conf.ae.id);
        } else if (notification_url.hostname === conf.cse.host) {
          noti_topic = util.format("/oneM2M/req/+/%s/#", conf.ae.id);
        } else {
          noti_topic = util.format("%s", notification_url.pathname);
        }
      }
    }
  }
}

function git_clone(mission_name, directory_name, repository_url, arguments) {
  console.log("[Git] Mission(" + mission_name + ") cloning...");
  try {
    require("fs-extra").removeSync("./" + directory_name);
  } catch (e) {
    console.log(e.message);
  }

  let gitClone = spawn("git", ["clone", repository_url, directory_name]);

  gitClone.stdout.on("data", (data) => {
    console.log("[ " + mission_name + " ] stdout: " + data);
  });

  gitClone.stderr.on("data", (data) => {
    console.log("[ " + mission_name + " ] stderr: " + data);
  });

  gitClone.on("exit", (code) => {
    console.log("[ " + mission_name + " ] exit: " + code);

    setTimeout(npm_install, 5000, mission_name, directory_name, arguments);
  });

  gitClone.on("error", (code) => {
    console.log("[ " + mission_name + " ] error: " + code);
  });
}

function git_pull(mission_name, directory_name, arguments) {
  console.log("[Git] Mission(" + mission_name + ") pull...");
  try {
    let cmd;
    if (process.platform === "win32") {
      cmd = "git";
    } else {
      cmd = "git";
    }

    let gitPull = spawn(cmd, ["pull"], {
      cwd: process.cwd() + "/" + directory_name,
    });

    gitPull.stdout.on("data", (data) => {
      console.log("[ " + mission_name + " ] stdout: " + data);
    });

    gitPull.stderr.on("data", (data) => {
      console.log("[ " + mission_name + " ] stderr: " + data);
      if (data.includes("Could not resolve host")) {
        setTimeout(npm_install, 1000, mission_name, directory_name, arguments);
      }
    });

    gitPull.on("exit", (code) => {
      console.log("[ " + mission_name + " ] exit: " + code);

      setTimeout(npm_install, 1000, mission_name, directory_name, arguments);
    });

    gitPull.on("error", (code) => {
      console.log("[ " + mission_name + " ] error: " + code);
    });
  } catch (e) {
    console.log(e.message);
  }
}

function npm_install(mission_name, directory_name, arguments) {
  console.log("npm_install [ " + mission_name + " ]");

  try {
    let cmd;
    if (process.platform === "win32") {
      cmd = "npm.cmd";
    } else {
      cmd = "npm";
    }

    let npmInstall = spawn(cmd, ["install"], {
      cwd: process.cwd() + "/" + directory_name,
    });

    npmInstall.stdout.on("data", (data) => {
      console.log("[ " + mission_name + " ] stdout: " + data);
    });

    npmInstall.stderr.on("data", (data) => {
      console.log("[ " + mission_name + " ] stderr: " + data);
    });

    npmInstall.on("exit", (code) => {
      console.log("[ " + mission_name + " ] exit: " + code);

      setTimeout(fork_msw, 10, mission_name, directory_name, arguments);
    });

    npmInstall.on("error", (code) => {
      console.log("[ " + mission_name + " ] error: " + code);

      setTimeout(npm_install, 1000, mission_name, directory_name, arguments);
    });
  } catch (e) {
    console.log(e.message);
  }
}

function fork_msw(mission_name, directory_name, arguments) {
  console.log("fork_msw [ " + mission_name + " ]");

  exec("pm2 list", (error, stdout, stderr) => {
    if (error) {
      console.log("[ " + mission_name + " ] error: " + error);
    }
    if (stdout) {
      console.log("[ " + mission_name + " ] stdout: \n" + stdout);
      let pm2_lists = stdout.split("\n");
      if (mission_name === "msw_webrtc_crow") {
        let pm2_names = [];
        for (let idx in pm2_lists) {
          if (pm2_lists.hasOwnProperty(idx)) {
            let pm2_list = pm2_lists[idx].split("│");
            let name = pm2_list[2];
            if (name !== undefined && name.includes("msw")) {
              pm2_names.push(name.trim(" ", ""));
            }
          }
        }

        if (arguments) {
          for (let c_idx in arguments) {
            if (arguments.hasOwnProperty(c_idx)) {
              let pm2_mission_name =
                mission_name + "_" + arguments[c_idx].split("=")[0];

              if (pm2_names.includes(pm2_mission_name)) {
                let nodeMsw = exec(
                  "pm2 restart " + pm2_mission_name + " -- " + arguments[c_idx],
                  { cwd: process.cwd() + "/" + directory_name }
                );
                nodeMsw.stdout.on("data", (data) => {
                  console.log(
                    "[ " + mission_name + " ] restart stdout: \n" + data
                  );
                });

                nodeMsw.stderr.on("data", (data) => {
                  console.log(
                    "[ " + mission_name + " ] restart stderr: " + data
                  );
                });

                nodeMsw.on("exit", (code) => {
                  console.log("[ " + mission_name + " ] restart exit: " + code);
                });

                nodeMsw.on("error", (code) => {
                  console.log(
                    "[ " + mission_name + " ] restart error: " + code
                  );

                  setTimeout(npm_install, 10, directory_name, arguments);
                });
              } else {
                let nodeMsw = exec(
                  "pm2 start " +
                    mission_name +
                    ".js --name " +
                    pm2_mission_name +
                    " -- " +
                    arguments[c_idx],
                  { cwd: process.cwd() + "/" + directory_name }
                );
                nodeMsw.stdout.on("data", (data) => {
                  console.log(
                    "[ " + mission_name + " ] start stdout: \n" + data
                  );
                });

                nodeMsw.stderr.on("data", (data) => {
                  console.log("[ " + mission_name + " ] start stderr: " + data);
                });

                nodeMsw.on("exit", (code) => {
                  console.log("[ " + mission_name + " ] start exit: " + code);
                });

                nodeMsw.on("error", (code) => {
                  console.log("[ " + mission_name + " ] start error: " + code);

                  setTimeout(npm_install, 10, directory_name, arguments);
                });
              }
            }
          }
        } else {
          // arguments = undefined
          if (pm2_names.includes(mission_name)) {
            let nodeMsw = exec(
              "pm2 restart " + mission_name + ".js -- undefined=webcam",
              { cwd: process.cwd() + "/" + directory_name }
            );
            nodeMsw.stdout.on("data", (data) => {
              console.log("[ " + mission_name + " ] stdout: \n" + data);
            });

            nodeMsw.stderr.on("data", (data) => {
              console.log("[ " + mission_name + " ] stderr: " + data);
            });

            nodeMsw.on("exit", (code) => {
              console.log("[ " + mission_name + " ] exit: " + code);
            });

            nodeMsw.on("error", (code) => {
              console.log("[ " + mission_name + " ] error: " + code);

              setTimeout(npm_install, 10, directory_name, arguments);
            });
          } else {
            let nodeMsw = exec(
              "pm2 start " + mission_name + ".js -- undefined=webcam",
              { cwd: process.cwd() + "/" + directory_name }
            );
            nodeMsw.stdout.on("data", (data) => {
              console.log("[ " + mission_name + " ] stdout: \n" + data);
            });

            nodeMsw.stderr.on("data", (data) => {
              console.log("[ " + mission_name + " ] stderr: " + data);
            });

            nodeMsw.on("exit", (code) => {
              console.log("[ " + mission_name + " ] exit: " + code);
            });

            nodeMsw.on("error", (code) => {
              console.log("[ " + mission_name + " ] error: " + code);

              setTimeout(npm_install, 10, directory_name, arguments);
            });
          }
        }
      } else {
        let process_name = mission_name;
        if (process.argv.length > 2) {
          process_name = mission_name + "_" + process.argv[2];
        }

        if (!stdout.includes(process_name)) {
          let nodeMsw = exec(
            "pm2 start " + mission_name + ".js --name " + process_name,
            { cwd: process.cwd() + "/" + directory_name }
          );
          nodeMsw.stdout.on("data", (data) => {
            console.log("[ " + process_name + " ] stdout: \n" + data);
          });

          nodeMsw.stderr.on("data", (data) => {
            console.log("[ " + process_name + " ] stderr: " + data);
          });

          nodeMsw.on("exit", (code) => {
            console.log("[ " + process_name + " ] exit: " + code);
          });

          nodeMsw.on("error", (code) => {
            console.log("[ " + process_name + " ] error: " + code);

            setTimeout(npm_install, 10, directory_name, arguments);
          });
        } else {
          let nodeMsw = exec("pm2 restart " + process_name, {
            cwd: process.cwd() + "/" + directory_name,
          });
          nodeMsw.stdout.on("data", (data) => {
            console.log("[ " + process_name + " ] stdout: \n" + data);
          });

          nodeMsw.stderr.on("data", (data) => {
            console.log("[ " + process_name + " ] stderr: " + data);
          });

          nodeMsw.on("exit", (code) => {
            console.log("[ " + process_name + " ] exit: " + code);
          });

          nodeMsw.on("error", (code) => {
            console.log("[ " + process_name + " ] error: " + code);

            setTimeout(npm_install, 10, directory_name, arguments);
          });
        }
      }
    }
    if (stderr) {
      console.log("stderr: " + stderr);
    }
  });
}

function create_cnt_all(count, callback) {
  if (conf.cnt.length === 0) {
    callback(2001, count);
  } else {
    if (conf.cnt.hasOwnProperty(count)) {
      let parent = conf.cnt[count].parent;
      let rn = conf.cnt[count].name;
      onem2m_client.crtct(parent, rn, count, (rsc, res_body, count) => {
        if (rsc === 5106 || rsc === 2001 || rsc === 4105) {
          create_cnt_all(++count, (status, count) => {
            callback(status, count);
          });
        } else {
          callback(9999, count);
        }
      });
    } else {
      callback(2001, count);
    }
  }
}

function delete_sub_all(count, callback) {
  if (conf.sub.length === 0) {
    callback(2001, count);
  } else {
    if (conf.sub.hasOwnProperty(count)) {
      let target = conf.sub[count].parent + "/" + conf.sub[count].name;
      onem2m_client.delsub(target, count, (rsc, res_body, count) => {
        if (
          rsc === 5106 ||
          rsc === 2002 ||
          rsc === 2000 ||
          rsc === 4105 ||
          rsc === 4004
        ) {
          delete_sub_all(++count, (status, count) => {
            callback(status, count);
          });
        } else {
          callback(9999, count);
        }
      });
    } else {
      callback(2001, count);
    }
  }
}

function create_sub_all(count, callback) {
  if (conf.sub.length === 0) {
    callback(2001, count);
  } else {
    if (conf.sub.hasOwnProperty(count)) {
      let parent = conf.sub[count].parent;
      let rn = conf.sub[count].name;
      let nu = conf.sub[count].nu;
      onem2m_client.crtsub(parent, rn, nu, count, (rsc, res_body, count) => {
        if (rsc === 5106 || rsc === 2001 || rsc === 4105) {
          create_sub_all(++count, (status, count) => {
            callback(status, count);
          });
        } else {
          callback(9999, count);
        }
      });
    } else {
      callback(2001, count);
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
      clientId: "od-dr-tele-relay_local_" + nanoid(15),
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

      // for local
      if (sub_drone_topic !== "") {
        dr_mqtt_client.subscribe(sub_drone_topic, () => {
          console.log(
            "[dr_mqtt_client] sub_drone_topic is subscribed: " + sub_drone_topic
          );
        });
      }
      if (sub_sortie_topic !== "") {
        dr_mqtt_client.subscribe(sub_sortie_topic, () => {
          console.log(
            "[dr_mqtt_client] sub_sortie_topic is subscribed: " +
              sub_sortie_topic
          );
        });
      }
      for (let idx in sub_msw_data_topic) {
        if (sub_msw_data_topic.hasOwnProperty(idx)) {
          dr_mqtt_client.subscribe(sub_msw_data_topic[idx], () => {
            console.log(
              "[dr_mqtt_client] sub_msw_data_topic[ " +
                idx +
                " ] is subscribed: " +
                sub_msw_data_topic[idx]
            );
          });
        }
      }
    });

    dr_mqtt_client.on("message", (topic, message) => {
      let topic_arr = topic.split("/");

      if (topic_arr[3] === "Drone_Data" && topic_arr[6] === "sitl") {
        if (mobius_mqtt_client) {
          mobius_mqtt_client.publish(pub_lte_drone_topic, message, () => {
            // console.log("[LTE](" + moment().format('YYYY-MM-DD hh:mm:ssSSS') + ") send to " + pub_lte_drone_topic + " -", message.toString('hex'));
          });
        }

        // send_aggr_to_Mobius(my_cnt_name, message.toString('hex'), 2000);
      } else if (topic === sub_sortie_topic) {
        let arr_message = message.toString().split(":");
        my_sortie_name = arr_message[0];
        let time_boot_ms = arr_message[1];

        if (my_sortie_name === "unknown-arm") {
          // 시작될 때 이미 드론이 시동이 걸린 상태
          // 모비우스 조회해서 현재 sortie를 찾아서 설정함
          let path =
            "http://" +
            conf.drone_info.gcs_ip +
            ":" +
            conf.cse.port +
            "/Mobius/" +
            conf.drone_info.gcs +
            "/Drone_Data/" +
            conf.drone_info.drone;
          let cra = moment().utc().format("YYYYMMDD");

          onem2m_client.getSortieLatest(path, cra, (status, uril) => {
            if (uril.length === 0) {
              // 현재 시동이 걸린 상태인데 오늘 생성된 sortie가 없다는 뜻이므로 새로 만듦
              my_sortie_name = moment().format("YYYY_MM_DD_T_HH_mm");

              pub_lte_drone_topic =
                "/Mobius/" +
                conf.drone_info.gcs +
                "/Drone_Data/" +
                conf.drone_info.drone +
                "/" +
                my_sortie_name +
                "/orig";
              my_cnt_name = my_parent_cnt_name + "/" + my_sortie_name;

              onem2m_client.createSortieContainer(
                my_parent_cnt_name + "?rcn=0",
                my_sortie_name,
                time_boot_ms,
                0,
                (rsc, res_body, count) => {}
              );
            } else {
              my_sortie_name = uril[0].split("/")[4];

              pub_lte_drone_topic =
                "/Mobius/" +
                conf.drone_info.gcs +
                "/Drone_Data/" +
                conf.drone_info.drone +
                "/" +
                my_sortie_name +
                "/orig";
              my_cnt_name = my_parent_cnt_name + "/" + my_sortie_name;
            }
          });
        } else if (my_sortie_name === "unknown-disarm") {
          // 시작될 때 드론이 시동이 꺼진 상태
          // disarm sortie 적용
          my_sortie_name = "disarm";

          pub_lte_drone_topic =
            "/Mobius/" +
            conf.drone_info.gcs +
            "/Drone_Data/" +
            conf.drone_info.drone +
            "/" +
            my_sortie_name +
            "/orig";
          my_cnt_name = my_parent_cnt_name + "/" + my_sortie_name;
        } else if (my_sortie_name === "disarm-arm") {
          // 드론이 꺼진 상태에서 시동이 걸리는 상태
          // 새로운 sortie 만들어 생성하고 설정
          my_sortie_name = moment().format("YYYY_MM_DD_T_HH_mm");

          pub_lte_drone_topic =
            "/Mobius/" +
            conf.drone_info.gcs +
            "/Drone_Data/" +
            conf.drone_info.drone +
            "/" +
            my_sortie_name +
            "/orig";
          my_cnt_name = my_parent_cnt_name + "/" + my_sortie_name;

          onem2m_client.createSortieContainer(
            my_parent_cnt_name + "?rcn=0",
            my_sortie_name,
            time_boot_ms,
            0,
            (rsc, res_body, count) => {}
          );
        } else if (my_sortie_name === "arm-disarm") {
          // 드론이 시동 걸린 상태에서 시동이 꺼지는 상태
          // disarm sortie 적용
          my_sortie_name = "disarm";

          pub_lte_drone_topic =
            "/Mobius/" +
            conf.drone_info.gcs +
            "/Drone_Data/" +
            conf.drone_info.drone +
            "/" +
            my_sortie_name +
            "/orig";
          my_cnt_name = my_parent_cnt_name + "/" + my_sortie_name;
        }
      } else if (
        topic_arr[3] === "Mission_Data" &&
        sub_msw_data_topic.includes(topic) &&
        topic_arr[7] === "orig"
      ) {
        let mission_name = topic_arr[5];
        let data_name = topic_arr[6];

        let _msw_data_topic =
          "/Mobius/" +
          conf.drone_info.gcs +
          "/Mission_Data/" +
          conf.drone_info.drone +
          "/" +
          mission_name +
          "/" +
          data_name;
        if (pub_lte_msw_data_topic.includes(_msw_data_topic)) {
          if (mobius_mqtt_client) {
            mobius_mqtt_client.publish(_msw_data_topic, message, () => {
              // try {
              //     onem2m_client.crtci(_msw_data_topic + '?rcn=0', 0, JSON.parse(message.toString()), null, () => {
              //     });
              // }
              // catch (e) {
              //     onem2m_client.crtci(_msw_data_topic + '?rcn=0', 0, message.toString(), null, () => {
              //     });
              // }
            });
          }
        }
      } else if (topic_arr[1] === "oneM2M") {
        let con;
        if (topic_arr[4] === conf.ae.id) {
          let json_msg = JSON.parse(message.toString());
          let mission_name;
          let control_name;
          if (json_msg.hasOwnProperty("pc")) {
            if (json_msg.pc.hasOwnProperty("m2m:sgn")) {
              if (json_msg.pc["m2m:sgn"].hasOwnProperty("nev")) {
                let topic_arr = json_msg.pc["m2m:sgn"].sur.split("/");
                mission_name = topic_arr[4];
                control_name = topic_arr[5];
              }
              if (json_msg.pc["m2m:sgn"].hasOwnProperty("nev")) {
                if (json_msg.pc["m2m:sgn"].nev.hasOwnProperty("rep")) {
                  if (
                    json_msg.pc["m2m:sgn"].nev.rep.hasOwnProperty("m2m:cin")
                  ) {
                    if (
                      json_msg.pc["m2m:sgn"].nev.rep["m2m:cin"].hasOwnProperty(
                        "con"
                      )
                    ) {
                      con = json_msg.pc["m2m:sgn"].nev.rep["m2m:cin"].con;
                      if (typeof con === "string") {
                        if (dr_mqtt_client) {
                          dr_mqtt_client.publish(
                            "/Mobius/" +
                              conf.drone_info.gcs +
                              "/Mission_Data/" +
                              conf.drone_info.drone +
                              "/" +
                              mission_name +
                              "/" +
                              control_name +
                              "/orig",
                            con
                          );
                        }
                      } else if (typeof con === "object") {
                        if (dr_mqtt_client) {
                          dr_mqtt_client.publish(
                            "/Mobius/" +
                              conf.drone_info.gcs +
                              "/Mission_Data/" +
                              conf.drone_info.drone +
                              "/" +
                              mission_name +
                              "/" +
                              control_name +
                              "/orig",
                            JSON.stringify(con)
                          );
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    dr_mqtt_client.on("error", (err) => {
      console.log("[dr_mqtt_client] (error) " + err.message);
    });
  }
}

function mobius_mqtt_connect(serverip) {
  if (!mobius_mqtt_client) {
    let connectOptions = {
      host: serverip,
      port: conf.cse.mqttport,
      protocol: "mqtt",
      keepalive: 10,
      clientId: "dr_tele_gcs_" + nanoid(15),
      protocolId: "MQTT",
      protocolVersion: 4,
      clean: true,
      reconnectPeriod: 2 * 1000,
      connectTimeout: 30 * 1000,
      queueQoSZero: false,
      rejectUnauthorized: false,
    };

    mobius_mqtt_client = mqtt.connect(connectOptions);

    mobius_mqtt_client.on("connect", () => {
      console.log("mobius_mqtt_client is connected to ( " + serverip + " )");

      if (noti_topic !== "") {
        mobius_mqtt_client.subscribe(noti_topic, () => {
          console.log(
            "[mobius_mqtt_client] noti_topic is subscribed: " + noti_topic
          );
        });
      }
      if (sub_lte_gcs_topic !== "") {
        mobius_mqtt_client.subscribe(sub_lte_gcs_topic, () => {
          console.log(
            "[mobius_mqtt_client] sub_lte_gcs_topic is subscribed: " +
              sub_lte_gcs_topic
          );
        });
      }
      for (let idx in sub_lte_msw_control_topic) {
        if (sub_lte_msw_control_topic.hasOwnProperty(idx)) {
          mobius_mqtt_client.subscribe(sub_lte_msw_control_topic[idx], () => {
            console.log(
              "[mobius_mqtt_client] sub_lte_msw_control_topic[ " +
                idx +
                " ] is subscribed: " +
                sub_lte_msw_control_topic[idx]
            );
          });
        }
      }
    });

    mobius_mqtt_client.on("message", (topic, message) => {
      let topic_arr = topic.split("/");

      if (topic.substring(0, 7) === "/oneM2M") {
        let con;
        let topic_arr = topic.split("/");
        if (topic_arr[4] === conf.ae.id) {
          let json_msg = JSON.parse(message.toString());
          let mission_name;
          let control_name;
          if (json_msg.hasOwnProperty("pc")) {
            if (json_msg.pc.hasOwnProperty("m2m:sgn")) {
              if (json_msg.pc["m2m:sgn"].hasOwnProperty("nev")) {
                let topic_arr = json_msg.pc["m2m:sgn"].sur.split("/");
                mission_name = topic_arr[4];
                control_name = topic_arr[5];
              }
              if (json_msg.pc["m2m:sgn"].hasOwnProperty("nev")) {
                if (json_msg.pc["m2m:sgn"].nev.hasOwnProperty("rep")) {
                  if (
                    json_msg.pc["m2m:sgn"].nev.rep.hasOwnProperty("m2m:cin")
                  ) {
                    if (
                      json_msg.pc["m2m:sgn"].nev.rep["m2m:cin"].hasOwnProperty(
                        "con"
                      )
                    ) {
                      con = json_msg.pc["m2m:sgn"].nev.rep["m2m:cin"].con;
                      if (typeof con === "string") {
                        if (dr_mqtt_client) {
                          dr_mqtt_client.publish(
                            "/Mobius/" +
                              conf.drone_info.gcs +
                              "/Mission_Data/" +
                              conf.drone_info.drone +
                              "/" +
                              mission_name +
                              "/" +
                              control_name +
                              "/orig",
                            con
                          );
                        }
                      } else if (typeof con === "object") {
                        if (dr_mqtt_client) {
                          dr_mqtt_client.publish(
                            "/Mobius/" +
                              conf.drone_info.gcs +
                              "/Mission_Data/" +
                              conf.drone_info.drone +
                              "/" +
                              mission_name +
                              "/" +
                              control_name +
                              "/orig",
                            JSON.stringify(con)
                          );
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } else if (topic === sub_lte_gcs_topic) {
        if (lte_res_t_id) {
          clearTimeout(lte_res_t_id);
          lte_res_t_id = null;
        }

        let gcsData = message.toString("hex");
        let sequence;
        let msg_id;
        let ver = gcsData.substring(0, 2);

        if (ver === "fd") {
          msg_id = parseInt(
            gcsData.substring(18, 20) +
              gcsData.substring(16, 18) +
              gcsData.substring(14, 16),
            16
          );
        } else {
          msg_id = parseInt(gcsData.substring(10, 12).toLowerCase(), 16);
        }

        if (msg_id === 70) {
          // MAVLINK_MSG_ID_RC_CHANNELS_OVERRIDE
          lte_res = resON;

          lte_res_t_id = setTimeout(() => {
            lte_res = resOFF;
          }, 5000);
        }

        if (gcsData.substring(0, 2) === "fe") {
          sequence = parseInt(gcsData.substring(4, 6), 16);
          if (GCSData.hasOwnProperty(sequence)) {
            delete GCSData[sequence];
            return;
          }
        } else if (gcsData.substring(0, 2) === "fd") {
          sequence = parseInt(gcsData.substring(8, 10), 16);
          if (GCSData.hasOwnProperty(sequence)) {
            delete GCSData[sequence];
            return;
          }
        }

        console.log("[LTE-GCS]", sequence);
        gcs_noti_handler(message);
      } else if (
        topic_arr[3] === "Mission_Data" &&
        sub_lte_msw_control_topic.includes(topic)
      ) {
        let mission_name = topic_arr[5];
        let control_name = topic_arr[6];
        let missionCtrlData;

        let _msw_control_topic =
          "/Mobius/" +
          conf.drone_info.gcs +
          "/Mission_Data/" +
          conf.drone_info.drone +
          "/" +
          mission_name +
          "/" +
          control_name +
          "/orig";

        try {
          missionCtrlData = JSON.parse(message.toString());
          if (missionCtrlData.hasOwnProperty("sequence")) {
            mctrl_sequence = missionCtrlData.sequence;
          } else {
            mctrl_sequence = mctrl_sequence + 1;
          }
          missionCtrlData = JSON.stringify(missionCtrlData);
          console.log("[LTE-Mission] JSON -", mctrl_sequence);
        } catch (e) {
          let _data = message.toString();
          mctrl_sequence = parseInt(_data.substring(0, 2), 16);
          if (Number(mctrl_sequence)) {
            missionCtrlData = _data.substring(2, _data.length);
          } else {
            missionCtrlData = _data;
            mctrl_sequence = mctrl_sequence + 1;
          }
          console.log("[LTE-Mission] string -", mctrl_sequence);
        }

        // if (MissionControlData.hasOwnProperty(mctrl_sequence)) {
        //     delete MissionControlData[mctrl_sequence];
        //     return;
        // }
        // else {
        if (mc_disconnected) {
          if (dr_mqtt_client) {
            // TODO: Mission 명령은 sequence 초기화 하도록 변경? 굳이 sequence 쌓을 필요 없을듯
            dr_mqtt_client.publish(_msw_control_topic, missionCtrlData);
          }
        }
      }
    });

    mobius_mqtt_client.on("error", (err) => {
      console.log("[mobius_mqtt_client] (error) " + err.message);
    });
  }
}

// RC 응답 데이터 Buffer < header data 00 00 00 00 crc > -> data = 21(ON) or 00(OFF)
const resON = "ff2100000000";
const resOFF = "ff0000000000";
let res_sequence = 0;
let lte_res = resOFF;
let lte_res_t_id = null;

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

setInterval(() => {
  let lte_crc = Calc_CRC_8(lte_res, 6);
  let lte_hex_crc = lte_crc.toString(16);
  lte_res += lte_hex_crc;
  let _lte_res = res_sequence.toString(16).padStart(2, "0") + lte_res;

  if (mobius_mqtt_client) {
    mobius_mqtt_client.publish(
      pub_lte_res_topic,
      Buffer.from(_lte_res, "hex"),
      () => {
        // console.log('[LTE]\tsend ' + _lte_res + ' to ' + pub_lte_res_topic)
      }
    );
  }

  lte_res = resOFF;

  res_sequence++;
  res_sequence %= 255;
}, 500);
