#!/bin/bash
# Connect WSL2 to your Android phone via wireless ADB.
# Run this at the start of each dev session.
#
# Usage: ./scripts/adb-connect.sh [ip] [port]
#   ip    default: 192.168.64.4
#   port  default: prompted from you (check phone → Developer Options → Wireless debugging)

ADB=/mnt/c/Users/HP/AppData/Local/Android/Sdk/platform-tools/adb.exe
IP=${1:-192.168.64.4}

if [ -n "$2" ]; then
  PORT=$2
else
  read -rp "Connection port (from phone → Wireless debugging): " PORT
fi

echo "Connecting to $IP:$PORT ..."
"$ADB" connect "$IP:$PORT"

echo ""
echo "Devices:"
"$ADB" devices