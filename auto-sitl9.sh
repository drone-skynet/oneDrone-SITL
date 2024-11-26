#!/usr/bin/sh

#TestDrone9
gnome-terminal --title="SITL9" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 아차산 -I8 --sysid=242 --out=127.0.0.1:14571 --out=udpin:127.0.0.1:14572'
sleep 0.5
gnome-terminal --title="SITL9-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-9 && node od-dr-tele-man.js 14571 14572'
sleep 0.5
gnome-terminal --title="SITL9-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-9 && node od-dr-tele-relay.js 9'
sleep 0.5
gnome-terminal --title="SITL9-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-9 && node od-dr-rc-relay.js'