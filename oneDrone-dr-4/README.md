# oneDrone-SITL

for Ardupilot-based SITL(software in the loop)
***

## Preparation
### 1. WSL-ubuntu 20.04
 - Install ubuntu 20.04 from windows store
### 2. Node.js
```shell
$ curl -sL https://deb.nodesource.com/setup_20.x | sudo -E bash -
$ sudo apt-get install -y nodejs
```
### 3. PM2
```shell
$ sudo npm install -g pm2
```
### 4. Mosquitto broker
```shell
$ sudo apt-get install -y mosquitto
```
### 5. gnome-terminal
```shell
$ sudo apt-get install -y gnome-terminal
```
### 6. ArduPilot
```
$ git clone https://github.com/ArduPilot/ardupilot.git
```
### 7. Xming
 - Download [Xming](https://sourceforge.net/projects/xming/)

***

## Settings
### 1. oneDrone-SITL
```shell
$ git clone https://github.com/IoTKETI/oneDrone-SITL.git
$ cd oneDrone-SITL
$ npm install
```
### 2. ardupilot
[see Building ardupilot SITL code](https://ardupilot.org/dev/docs/building-setup-windows10_new.html).

### 3. mosquitto
```shell
$ sudo nano /etc/mosquitto/conf.d/default.conf
```
- edit
```
listener 1883
allow_anonymous true
```
```shell
$ sudo service mosquitto restart
```

### 4. edit drone_info.json
```shell
$ cd oneDrone-SITL/oneDrone-dr
$ nano drone_info.json
```
- edit
```json
{
    "id": "Dione",
    "approval_gcs": "MUV",
    "host": "gcs.iotocean.org",
    "drone": "KETI_Drone_1",
    "gcs": "KETI_GCS",
    "type": "ardupilot",
    "system_id": 202,
    "gcs_ip": "192.168.202.150"
}
```

## Run
- write `auto-sitl.sh`
```shell
$ nano auto-sitl.sh
```
```
#!/usr/bin/sh

gnome-terminal --title="SITL" -- sh -c 'cd /home/iotketi/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -I0 -L keti --out=127.0.0.1:14555 --out=udpin:127.0.0.1:14556'
sleep 0.5
gnome-terminal --title="SITL-tele-man" -- sh -c 'cd /home/iotketi/oneDrone-SITL/oneDrone-dr && node od-dr-tele-man.js 14555 14556'
sleep 0.5
gnome-terminal --title="SITL-tele-relay" -- sh -c 'cd /home/iotketi/oneDrone-SITL/oneDrone-dr && node od-dr-tele-relay.js 1'
sleep 0.5
gnome-terminal --title="SITL-rc-relay" -- sh -c 'cd /home/iotketi/oneDrone-SITL/oneDrone-dr && node od-dr-rc-relay.js'
```
- run auto-sitl.sh
```shell
$ sh auto-sitl.sh
```
