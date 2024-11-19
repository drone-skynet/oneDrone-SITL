#!/usr/bin/sh

#TestDrone5
gnome-terminal --title="SITL5" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 성수 -I4 --sysid=246 --out=127.0.0.1:14563 --out=udpin:127.0.0.1:14564'
sleep 0.5
gnome-terminal --title="SITL5-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-5 && node od-dr-tele-man.js 14563 14564'
sleep 0.5
gnome-terminal --title="SITL5-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-5 && node od-dr-tele-relay.js 5'
sleep 0.5
gnome-terminal --title="SITL5-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-5 && node od-dr-rc-relay.js'
