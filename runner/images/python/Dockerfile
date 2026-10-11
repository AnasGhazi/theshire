FROM python:3.12-slim

# No package managers at runtime, and an unprivileged user with no home directory.
RUN pip uninstall -y pip setuptools wheel >/dev/null 2>&1 || true; \
    rm -rf /root/.cache /usr/local/bin/pip* \
    && useradd --uid 10001 --user-group --no-create-home --home-dir /tmp --shell /usr/sbin/nologin sandbox

COPY --chmod=0555 run.sh /usr/local/bin/sandbox-run

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOME=/tmp
USER 10001:10001
WORKDIR /tmp
ENTRYPOINT ["/usr/local/bin/sandbox-run"]
