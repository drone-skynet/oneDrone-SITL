#!/usr/bin/sh

#TestDrone1
gnome-terminal --title="SITL1" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 어린이대공원 -I0 --sysid=250 --out=127.0.0.1:14555 --out=udpin:127.0.0.1:14556'
sleep 0.5
gnome-terminal --title="SITL1-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-1 && node od-dr-tele-man.js 14555 14556'
sleep 0.5
gnome-terminal --title="SITL1-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-1 && node od-dr-tele-relay.js 1'
sleep 0.5
gnome-terminal --title="SITL1-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-1 && node od-dr-rc-relay.js'

