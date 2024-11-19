#!/usr/bin/sh

#TestDrone3
gnome-terminal --title="SITL3" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 건대입구 -I2 --sysid=248 --out=127.0.0.1:14559 --out=udpin:127.0.0.1:14560'
sleep 0.5
gnome-terminal --title="SITL3-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-3 && node od-dr-tele-man.js 14559 14560'
sleep 0.5
gnome-terminal --title="SITL3-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-3 && node od-dr-tele-relay.js 3'
sleep 0.5
gnome-terminal --title="SITL3-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-3 && node od-dr-rc-relay.js'

