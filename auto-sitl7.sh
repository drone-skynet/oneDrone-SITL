#!/usr/bin/sh

#TestDrone7
gnome-terminal --title="SITL7" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 군자 -I6 --sysid=244 --out=127.0.0.1:14567 --out=udpin:127.0.0.1:14568'
sleep 0.5
gnome-terminal --title="SITL7-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-7 && node od-dr-tele-man.js 14567 14568'
sleep 0.5
gnome-terminal --title="SITL7-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-7 && node od-dr-tele-relay.js 7'
sleep 0.5
gnome-terminal --title="SITL7-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-7 && node od-dr-rc-relay.js'