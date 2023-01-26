#!/usr/bin/env bash

set -eu

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <tailnet_hostname> <alias>"
  exit 1
fi

TAILNET_HOSTNAME=$1
ALIAS_HOSTNAME=$2

if [ "$(grep -c -F ${ALIAS_HOSTNAME} /etc/hosts)" -eq 0 ]; then
  TAILNET_IP=$(tailscale ip --4 ${TAILNET_HOSTNAME})
  echo "Mapping ${ALIAS_HOSTNAME} to $TAILNET_IP"
  echo "$TAILNET_IP ${ALIAS_HOSTNAME}" >> /etc/hosts
else
  echo "Already configured"
fi
