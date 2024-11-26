#!/usr/bin/sh

#TestDrone14
gnome-terminal --title="SITL14" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 뚝섬유원지 -I13 --sysid=237 --out=127.0.0.1:14581 --out=udpin:127.0.0.1:14582'
sleep 0.5
gnome-terminal --title="SITL14-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-14 && node od-dr-tele-man.js 14581 14582'
sleep 0.5
gnome-terminal --title="SITL14-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-14 && node od-dr-tele-relay.js 14'
sleep 0.5
gnome-terminal --title="SITL14-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-14 && node od-dr-rc-relay.js'