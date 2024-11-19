#!/usr/bin/sh

#TestDrone2
gnome-terminal --title="SITL2" -- sh -c 'cd /home/shining17/ardupilot/Tools/autotest && ./sim_vehicle.py -v ArduCopter --console -L 어린이대공원 -I1 --sysid=249 --out=127.0.0.1:14557 --out=udpin:127.0.0.1:14558'
sleep 0.5
gnome-terminal --title="SITL2-tele-man" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-2 && node od-dr-tele-man.js 14557 14558'
sleep 0.5
gnome-terminal --title="SITL2-tele-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-2 && node od-dr-tele-relay.js 2'
sleep 0.5
gnome-terminal --title="SITL2-rc-relay" -- sh -c 'cd /home/shining17/oneDrone-SITL/oneDrone-dr-2 && node od-dr-rc-relay.js'
