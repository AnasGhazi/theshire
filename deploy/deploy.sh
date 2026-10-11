#!/bin/sh
# Builds the images locally, ships them to the server over SSH, and restarts the stack.
# Images are built for the machine running this script, so build on an arm64 Mac for a
# Graviton (t4g) server, or pass DOCKER_DEFAULT_PLATFORM=linux/arm64 elsewhere.
#   deploy/deploy.sh <server-ip-or-hostname>
set -eu
HOST=${1:?usage: deploy/deploy.sh <server-ip-or-hostname>}
KEY=${SSH_KEY:-$HOME/.ssh/theshire_aws_ed25519}
remote() { ssh -i "$KEY" -o BatchMode=yes "ubuntu@$HOST" "$@"; }

docker compose build
docker save theshire-api:latest theshire-web:latest theshire/runner-python:latest theshire/runner-node:latest \
  | gzip -1 | remote 'gunzip | docker load'
scp -q -i "$KEY" docker-compose.yml docker-compose.prod.yml "ubuntu@$HOST:/opt/theshire/"
scp -q -i "$KEY" deploy/Caddyfile "ubuntu@$HOST:/opt/theshire/deploy/"
remote 'cd /opt/theshire && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans && docker image prune -f'
echo "Deployed. Verify with: npm run check:deployment -- https://<your-site>"
