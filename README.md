# The Shire

An interactive coding-course platform: Markdown lessons with runnable Python/JavaScript cells, executed in locked-down Docker containers. See [PLAN.md](PLAN.md) for the full design and milestones.

> Work in progress. Currently at **M0 (scaffold)**.

## Requirements

- Node 24+ (ships with npm 11, which this repo's lockfile needs)
- Docker (for the sandbox runner from M1 onward, and for `docker compose`)

## Develop

```sh
npm install
npm run dev          # API on :4000, web on :3000
```

| Command             | What it does                         |
| ------------------- | ------------------------------------ |
| `npm run lint`      | ESLint + Prettier check              |
| `npm run typecheck` | `tsc --noEmit` in every workspace    |
| `npm test`          | Vitest across all workspaces         |
| `npm run build`     | Build the API bundle and Next.js app |

Or run everything in containers:

```sh
docker compose up --build
```

## Layout

```
apps/api         Fastify service (GET /api/health)
apps/web         Next.js frontend (placeholder)
packages/shared  Zod schemas + types shared by api and web
```
