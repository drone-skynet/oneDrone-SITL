#!/usr/bin/sh

#TestDrone19
gnome-terminal --title="SITL19" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 중곡 -I18 --sysid=232 --out=127.0.0.1:14591 --out=udpin:127.0.0.1:14592'
sleep 0.5
gnome-terminal --title="SITL19-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-19 && node od-dr-tele-man.js 14591 14592'
sleep 0.5
gnome-terminal --title="SITL19-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-19 && node od-dr-tele-relay.js 19'
sleep 0.5
gnome-terminal --title="SITL19-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-19 && node od-dr-rc-relay.js'