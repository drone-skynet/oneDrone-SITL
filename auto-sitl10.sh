#!/usr/bin/sh

#TestDrone10
gnome-terminal --title="SITL10" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 아차산 -I9 --sysid=241 --out=127.0.0.1:14573 --out=udpin:127.0.0.1:14574'
sleep 0.5
gnome-terminal --title="SITL10-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-10 && node od-dr-tele-man.js 14573 14574'
sleep 0.5
gnome-terminal --title="SITL10-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-10 && node od-dr-tele-relay.js 10'
sleep 0.5
gnome-terminal --title="SITL10-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-10 && node od-dr-rc-relay.js'