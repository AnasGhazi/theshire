#!/bin/sh
# Source code arrives on stdin; it is written to a file, never interpolated into a command.
set -eu
cat > /tmp/main.py
exec python3 /tmp/main.py
