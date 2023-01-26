#!/usr/bin/env bash

set -eu

if [ "$EUID" -ne 0 ]
  then echo "Please run as root"
  exit 1
fi

if [ "$(grep -c -F 'mongo' /etc/hosts)" -eq 0 ]; then
  NODE_IP=$(tailscale ip --4 rpi-bluey)
  echo "Mapping mongo to $NODE_IP"
  echo "$NODE_IP mongo" >> /etc/hosts
else
  echo "Already configured"
fi

