#!/usr/bin/sh

#TestDrone8
gnome-terminal --title="SITL8" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 군자 -I7 --sysid=243 --out=127.0.0.1:14569 --out=udpin:127.0.0.1:14570'
sleep 0.5
gnome-terminal --title="SITL8-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-8 && node od-dr-tele-man.js 14569 14570'
sleep 0.5
gnome-terminal --title="SITL8-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-8 && node od-dr-tele-relay.js 8'
sleep 0.5
gnome-terminal --title="SITL8-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-8 && node od-dr-rc-relay.js'