#!/bin/sh
set -eu

node_bin="$(command -v node || readlink /proc/1/exe)"
if [ ! -x "$node_bin" ]; then
  echo 'RECOVERY_NODE_NOT_FOUND' >&2
  exit 1
fi

exec "$node_bin" /app/scripts/recover-owner-password.mjs --apply
