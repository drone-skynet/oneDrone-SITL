#!/usr/bin/sh

#TestDrone15
gnome-terminal --title="SITL15" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 뚝섬 -I14 --sysid=236 --out=127.0.0.1:14583 --out=udpin:127.0.0.1:14584'
sleep 0.5
gnome-terminal --title="SITL15-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-15 && node od-dr-tele-man.js 14583 14584'
sleep 0.5
gnome-terminal --title="SITL15-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-15 && node od-dr-tele-relay.js 15'
sleep 0.5
gnome-terminal --title="SITL15-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-15 && node od-dr-rc-relay.js'