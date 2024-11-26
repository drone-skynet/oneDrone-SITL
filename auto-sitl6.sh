#!/usr/bin/sh

#TestDrone6
gnome-terminal --title="SITL6" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 성수 -I5 --sysid=245 --out=127.0.0.1:14565 --out=udpin:127.0.0.1:14566'
sleep 0.5
gnome-terminal --title="SITL6-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-6 && node od-dr-tele-man.js 14565 14566'
sleep 0.5
gnome-terminal --title="SITL6-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-6 && node od-dr-tele-relay.js 6'
sleep 0.5
gnome-terminal --title="SITL6-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-6 && node od-dr-rc-relay.js'