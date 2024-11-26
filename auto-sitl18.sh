#!/usr/bin/sh

#TestDrone18
gnome-terminal --title="SITL18" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 강변 -I17 --sysid=233 --out=127.0.0.1:14589 --out=udpin:127.0.0.1:14590'
sleep 0.5
gnome-terminal --title="SITL18-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-18 && node od-dr-tele-man.js 14589 14590'
sleep 0.5
gnome-terminal --title="SITL18-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-18 && node od-dr-tele-relay.js 18'
sleep 0.5
gnome-terminal --title="SITL18-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-18 && node od-dr-rc-relay.js'