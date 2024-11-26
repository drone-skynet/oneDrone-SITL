#!/usr/bin/sh

#TestDrone12
gnome-terminal --title="SITL12" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 구의 -I11 --sysid=239 --out=127.0.0.1:14577 --out=udpin:127.0.0.1:14578'
sleep 0.5
gnome-terminal --title="SITL12-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-12 && node od-dr-tele-man.js 14577 14578'
sleep 0.5
gnome-terminal --title="SITL12-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-12 && node od-dr-tele-relay.js 12'
sleep 0.5
gnome-terminal --title="SITL12-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-12 && node od-dr-rc-relay.js'