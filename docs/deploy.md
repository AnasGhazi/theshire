# Deploying The Shire

The live demo runs on a single **AWS EC2 t4g.micro** (Graviton/arm64, 1 GB RAM + 2 GB swap, 12 GB encrypted gp3) in `us-east-1`, behind **Caddy** for automatic HTTPS, at **https://dashire.duckdns.org**.

```
Internet ──443──▶ Caddy ──▶ web (Next.js) ──/api──▶ api (Fastify) ──docker create/start──▶ sandbox containers
              (only published ports: 80, 443)        (no ports published)        (fresh per run, no network)
```

## Cost controls

The account is on the AWS **Free plan**: usage draws from AWS credits and can never be billed to a card unless the plan is upgraded. On top of that, the deployment avoids everything that makes AWS bills run away:

- **Fixed size.** One small instance; no auto-scaling, load balancer, NAT gateway, Lambda, or API Gateway.
- **CPU credits in `standard` mode**, so bursting throttles instead of billing.
- **No long-lived AWS keys.** The CLI uses `aws login` sessions; the instance has no IAM role.
- **App-level limits.** 2 concurrent sandbox runs (queue of 20), per-learner and per-IP rate limits.

Approximate credit burn: t4g.micro ~$6.1/month + 12 GB gp3 ~$1.0 + public IPv4 ~$3.7 = **~$10.8/month**.

## Security

- Security group: TCP 80/443 (and UDP 443) from anywhere; SSH only from the owner's IP.
- IMDSv2 required; the instance has no IAM role, so sandbox escapes would find no AWS credentials.
- Secrets live only in `/opt/theshire/.env` on the server (mode 600): a unique `COOKIE_SECRET` and the Google OAuth credentials.
- `docker-compose.prod.yml` refuses to start without those secrets, publishes no ports except Caddy's, sets secure cookies, and caps log sizes.

## First-time setup (what was done)

1. `aws ec2 import-key-pair` with a locally generated ed25519 key (`~/.ssh/theshire_aws_ed25519`).
2. Security group as above; `run-instances` with the Ubuntu 24.04 arm64 AMI, `--credit-specification CpuCredits=standard`, IMDSv2 required, an encrypted 12 GB root volume, and [`deploy/user-data.sh`](../deploy/user-data.sh) (installs Docker, adds swap).
3. An Elastic IP, and the DuckDNS name pointed at it.
4. Images built on an arm64 Mac and streamed over SSH (`docker save | ssh docker load`); no registry needed.
5. `/opt/theshire/.env` with `COOKIE_SECRET`, `PUBLIC_URL`, `SITE_ADDRESS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
6. `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`.
7. In Google Cloud Console: add `https://dashire.duckdns.org/api/auth/google/callback` as an authorized redirect URI and publish the OAuth consent screen.

## Updating

```sh
deploy/deploy.sh dashire.duckdns.org
npm run check:deployment -- https://dashire.duckdns.org
```

If your home IP changes, SSH stops working until the rule is updated:

```sh
aws ec2 authorize-security-group-ingress --group-name theshire-web \
  --protocol tcp --port 22 --cidr "$(curl -s https://checkip.amazonaws.com)/32"
```

## Verification

`npm run check:deployment -- https://dashire.duckdns.org` runs the hostile-input cases against the live API (see [security.md](security.md#deployed-results)), and `BASE_URL=https://dashire.duckdns.org npm run test:e2e` runs the browser smoke test against it. Both pass.
