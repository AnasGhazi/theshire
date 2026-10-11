FROM node:24-slim

# No package managers at runtime, and an unprivileged user with no home directory.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn* \
    && useradd --uid 10001 --user-group --no-create-home --home-dir /tmp --shell /usr/sbin/nologin sandbox

COPY --chmod=0555 run.sh /usr/local/bin/sandbox-run

ENV HOME=/tmp NODE_ENV=production
USER 10001:10001
WORKDIR /tmp
ENTRYPOINT ["/usr/local/bin/sandbox-run"]
