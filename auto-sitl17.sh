#!/usr/bin/sh

#TestDrone17
gnome-terminal --title="SITL17" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 강변 -I16 --sysid=234 --out=127.0.0.1:14587 --out=udpin:127.0.0.1:14588'
sleep 0.5
gnome-terminal --title="SITL17-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-17 && node od-dr-tele-man.js 14587 14588'
sleep 0.5
gnome-terminal --title="SITL17-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-17 && node od-dr-tele-relay.js 17'
sleep 0.5
gnome-terminal --title="SITL17-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-17 && node od-dr-rc-relay.js'