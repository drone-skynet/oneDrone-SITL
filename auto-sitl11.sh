#!/usr/bin/sh

#TestDrone11
gnome-terminal --title="SITL11" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 구의 -I10 --sysid=240 --out=127.0.0.1:14575 --out=udpin:127.0.0.1:14576'
sleep 0.5
gnome-terminal --title="SITL11-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-11 && node od-dr-tele-man.js 14575 14576'
sleep 0.5
gnome-terminal --title="SITL11-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-11 && node od-dr-tele-relay.js 11'
sleep 0.5
gnome-terminal --title="SITL11-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-11 && node od-dr-rc-relay.js'