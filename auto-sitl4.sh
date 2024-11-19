#!/usr/bin/sh

#TestDrone4
gnome-terminal --title="SITL4" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 건대입구 -I3 --sysid=247 --out=127.0.0.1:14561 --out=udpin:127.0.0.1:14562'
sleep 0.5
gnome-terminal --title="SITL4-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-4 && node od-dr-tele-man.js 14561 14562'
sleep 0.5
gnome-terminal --title="SITL4-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-4 && node od-dr-tele-relay.js 4'
sleep 0.5
gnome-terminal --title="SITL4-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-4 && node od-dr-rc-relay.js'