#!/usr/bin/sh

#TestDrone16
gnome-terminal --title="SITL16" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 뚝섬 -I15 --sysid=235 --out=127.0.0.1:14585 --out=udpin:127.0.0.1:14586'
sleep 0.5
gnome-terminal --title="SITL16-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-16 && node od-dr-tele-man.js 14585 14586'
sleep 0.5
gnome-terminal --title="SITL16-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-16 && node od-dr-tele-relay.js 16'
sleep 0.5
gnome-terminal --title="SITL16-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-16 && node od-dr-rc-relay.js'