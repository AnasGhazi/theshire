#!/bin/sh
# Starts as root only to discover the Docker socket's group, then drops to the unprivileged
# `node` user (uid 1000) with that one extra group. The socket's gid differs between hosts.
set -eu
export HOME=/home/node
if [ -S /var/run/docker.sock ]; then
  exec setpriv --reuid=1000 --regid=1000 --groups="$(stat -c %g /var/run/docker.sock)" -- "$@"
fi
exec setpriv --reuid=1000 --regid=1000 --clear-groups -- "$@"
