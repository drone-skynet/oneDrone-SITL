#!/usr/bin/sh

#TestDrone13
gnome-terminal --title="SITL13" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 뚝섬유원지 -I12 --sysid=238 --out=127.0.0.1:14579 --out=udpin:127.0.0.1:14580'
sleep 0.5
gnome-terminal --title="SITL13-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-13 && node od-dr-tele-man.js 14579 14580'
sleep 0.5
gnome-terminal --title="SITL13-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-13 && node od-dr-tele-relay.js 13'
sleep 0.5
gnome-terminal --title="SITL13-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-13 && node od-dr-rc-relay.js'