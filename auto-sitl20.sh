#!/usr/bin/sh

#TestDrone20
gnome-terminal --title="SITL20" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 중곡 -I19 --sysid=231 --out=127.0.0.1:14593 --out=udpin:127.0.0.1:14954'
sleep 0.5
gnome-terminal --title="SITL20-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-20 && node od-dr-tele-man.js 14593 14954'
sleep 0.5
gnome-terminal --title="SITL20-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-20 && node od-dr-tele-relay.js 20'
sleep 0.5
gnome-terminal --title="SITL20-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-20 && node od-dr-rc-relay.js'