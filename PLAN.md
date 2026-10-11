# PLAN.md — The Shire: Mini Interactive Course Platform

> Work **one milestone at a time**, commit after each, and don't start the next milestone until the current one's acceptance criteria pass.

## 1. What we're building

A small Codédex/Educative-style platform: text lessons written in Markdown with **runnable code cells**. A learner edits Python or JavaScript in the browser, hits Run, and the backend executes it inside a locked-down Docker container and returns the output. Exercises can be auto-checked against test cases. Progress is tracked per learner.

**The engineering story (this is what goes on the resume):** safely running untrusted code with strict isolation and resource limits, plus a clean API that any UI can sit on top of.

**UI note:** the UI should look and feel like [Codédex](https://www.codedex.io/home): a dark navy, retro/pixel-game aesthetic with a top bar (breadcrumb + XP-style progress bar), a split lesson view (instructions on the left, editor + terminal on the right), and chunky pixel-style buttons. Full spec in section 8. Build the backend and API first and keep it fully UI-agnostic, then build the frontend (M4) against the typed API client. Don't copy any Codédex logos, mascots, illustrations, or brand assets; take the layout and feel only.

## 2. Tech stack

| Layer     | Choice                                                                                                               |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| Language  | TypeScript everywhere (strict mode), Node 24 LTS                                                                     |
| API       | Node 20+, Fastify, Zod for request/response validation                                                               |
| Sandbox   | Docker (one fresh container per run), via the Docker CLI or `dockerode`                                              |
| DB        | SQLite (`better-sqlite3`) for v1; keep data access behind a small repository module so it can move to Postgres later |
| Frontend  | Next.js (App Router) + Tailwind                                                                                      |
| Tests     | Vitest (unit + integration), Playwright (one smoke test, optional)                                                   |
| CI        | GitHub Actions: lint, typecheck, test                                                                                |
| Packaging | `docker-compose.yml` for local dev                                                                                   |

Languages supported for execution in v1: **Python 3.12** and **Node 24 (JavaScript)**. (Node 20 reached end-of-life in April 2026.)

## 3. Repo structure

```
/apps
  /api            # Fastify service
  /web            # Next.js frontend
/packages
  /shared         # Zod schemas + TS types shared by api and web
/runner
  /images
    python/Dockerfile
    node/Dockerfile
/content
  /courses
    /python-basics
      course.json
      01-hello-world.md
      02-loops.md
/docs
  api.md          # API contract (kept in sync with Zod schemas)
  security.md     # sandbox threat model + test results
docker-compose.yml
README.md
PLAN.md
```

## 4. Lesson format

Markdown with YAML frontmatter. Runnable blocks are fenced code with a `runnable` flag; exercises add test cases.

````md
---
id: python-basics-02
title: Loops
order: 2
---

Here's a loop. Try changing the range.

```python runnable
for i in range(3):
    print(i)
```

## Exercise: Sum to N

Write `sum_to(n)` that returns 1 + 2 + ... + n.

```python exercise
def sum_to(n):
    # your code here
    pass
```

```tests
- call: "print(sum_to(3))"
  expect: "6"
- call: "print(sum_to(10))"
  expect: "55"
```
````

Parse lessons into a structured JSON shape the API returns: `blocks: [{type: "markdown" | "runnable" | "exercise", ...}]`. The frontend should never parse raw Markdown for code blocks itself.

## 5. API contract

All JSON, validated with Zod, schemas live in `packages/shared`.

| Method | Path                        | Purpose                                                                                                                      |
| ------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/courses`              | List courses (id, title, description, lesson count)                                                                          |
| GET    | `/api/courses/:slug`        | Course detail + ordered lesson list                                                                                          |
| GET    | `/api/lessons/:id`          | Lesson as structured blocks                                                                                                  |
| POST   | `/api/run`                  | Execute code. Body: `{ language, code }`. Returns `{ stdout, stderr, exitCode, timedOut, oomKilled, truncated, durationMs }` |
| POST   | `/api/exercises/:id/submit` | Run learner code against the exercise's tests. Returns per-test pass/fail + overall result                                   |
| GET    | `/api/progress`             | Learner's completed lessons/exercises                                                                                        |
| PUT    | `/api/progress/:lessonId`   | Mark lesson complete                                                                                                         |
| GET    | `/api/health`               | Liveness + Docker availability check                                                                                         |

**Identity (v1):** anonymous learner. Issue a signed, HTTP-only cookie with a random learner ID on first visit. No signup. Design so real auth can replace it without touching route handlers (middleware that sets `request.learnerId`).

**Error shape:** `{ error: { code, message } }` with sensible HTTP statuses. Rate limit `/api/run` and `/api/exercises/*/submit` per learner and per IP.

## 6. Sandbox design (the core of the project)

Every run = a **new container**, destroyed after. Never reuse containers between runs.

Required flags/limits on every container:

- `--network none` (no network at all)
- `--memory 128m --memory-swap 128m`
- `--cpus 0.5`
- `--pids-limit 64` (stops fork bombs)
- `--read-only` root filesystem, plus a small `tmpfs` at `/tmp` (e.g. 16 MB)
- `--cap-drop ALL` and `--security-opt no-new-privileges`
- Run as a **non-root user** inside the image
- Hard wall-clock timeout (default **5s**), enforced by the host, which kills the container on expiry
- Cap captured stdout/stderr (e.g. **64 KB** each); mark `truncated: true` if exceeded
- Code delivered via stdin or a temp file mounted read-only. Never interpolate user code into a shell string.

Images: minimal (e.g. `python:3.12-slim`, `node:24-slim`), no extra tools, no pip/npm network access at runtime.

Also build:

- A **concurrency limiter** (e.g. max N simultaneous containers, queue the rest with a cap on queue length, reject with 429 beyond it).
- A **cleanup job** that removes orphaned containers on startup and periodically.

**Deployment warning:** never expose the Docker socket to a public-facing process casually. For the live demo, run the runner on a dedicated VM or isolated host with only the API able to reach it. Document the choice in `docs/security.md`. (Render-style managed hosts typically can't run Docker-in-Docker, so a small VPS is the likely path.)

## 7. Milestones

Each milestone has acceptance criteria. Don't move on until they pass.

### M0 — Scaffold

- Monorepo with `apps/api`, `apps/web`, `packages/shared`, TS strict, ESLint + Prettier, Vitest configured.
- `docker-compose.yml` brings up the API (and web placeholder).
- GitHub Actions workflow runs lint, typecheck, test.
- **Done when:** `npm run lint && npm run typecheck && npm test` pass locally and in CI; `GET /api/health` returns 200.

### M1 — Sandbox runner

- Build Python and Node runner images.
- Implement `runCode({ language, code })` per section 6, behind a small interface (`Runner`) so it can be mocked in tests.
- Implement the concurrency limiter and orphan cleanup.
- **Done when** `POST /api/run` returns correct output for normal code **and** all of these hostile cases are handled safely, each with an automated test:
  - infinite loop → `timedOut: true`, container killed
  - fork bomb → contained by pids limit, API stays healthy
  - memory hog (allocate GBs) → killed, clear error
  - network call (`requests.get`, `fetch`) → fails, no network
  - writing to the filesystem outside `/tmp` → fails
  - huge output (e.g. print in a loop) → truncated, `truncated: true`
  - reading host files / env secrets → nothing sensitive reachable
- Record results in `docs/security.md`.

### M2 — Content and API

- Lesson parser (frontmatter + fenced blocks → structured blocks), with unit tests including malformed input.
- Loader for `/content/courses`, with `GET /api/courses`, `/api/courses/:slug`, `/api/lessons/:id`.
- Two sample courses (e.g. Python Basics, JavaScript Basics) with at least **4 lessons each**, including at least 3 exercises with tests.
- **Done when:** all read endpoints return validated data, parser tests pass, and malformed lesson files fail loudly at load time, not at request time.

### M3 — Exercises and progress

- `POST /api/exercises/:id/submit`: run learner code plus each test call inside the sandbox, compare stdout to `expect`, return per-test results. Hidden tests must not leak expected outputs for tests marked hidden.
- Anonymous learner cookie middleware.
- Progress endpoints backed by SQLite, with migrations.
- Rate limiting on run/submit.
- **Done when:** a scripted flow (get lesson → submit wrong code → submit correct code → progress shows complete) passes as an integration test.

### M4 — Frontend (Codédex-style UI)

- Next.js pages implementing the section 8 design:
  - `/` course catalog
  - `/courses/[slug]` course page with lesson list
  - `/lessons/[id]` split lesson view: instructions on the left, editor + Run/Submit + terminal on the right
- Editor: CodeMirror or Monaco with line numbers and syntax highlighting.
- All data access goes through a single typed API client in `apps/web/lib/api.ts` using the shared Zod types. This is the **only** file the UI should need to call.
- **Done when:** a learner can open a lesson, run code, submit an exercise, and see progress update, all without touching the API manually.

### M5 — Hardening, tests, docs

- Test coverage report; target meaningful coverage on the parser, runner, and submit logic (don't chase a vanity number).
- Structured logging with a request ID; log run duration and outcome (never log full user code at info level).
- Config via env vars with validation at startup (timeouts, limits, concurrency, rate limits).
- `README.md`: what it is, architecture diagram (Mermaid is fine), run locally in one command, design decisions, known limitations.
- `docs/api.md` matches the Zod schemas.
- **Done when:** a fresh clone can be running with `docker compose up` following only the README.

### M6 — Deploy (optional but strongly recommended for the resume)

- Deploy API + runner to a small VPS (or equivalent) and the frontend to any static/Node host.
- Live demo URL in the README, with a note on limits (rate limits, no accounts).
- **Done when:** the public URL works end to end, and the hostile-input tests from M1 have been re-run against the deployed setup.

## 8. UI spec (Codédex-inspired)

Reference: https://www.codedex.io. Take the layout and feel only. No Codédex logos, mascots, illustrations, or brand assets.

**Look and feel**

- Dark navy base (page ~`#0a0f1e`, panels ~`#1a2236`, editor ~`#0e1f4a`), white body text, muted grey secondary text, blue links.
- A pixel/bitmap display font (e.g. Silkscreen or Press Start 2P from Google Fonts) for the logo, headings, and buttons; a clean sans-serif (e.g. Nunito) for lesson prose; a monospace for code and terminal.
- Chunky buttons with a hard offset bottom shadow: dark "Run" with a play icon, bright blue "Submit answer", yellow primary call to action.
- Section headers ("Instructions", "Help", "Terminal") sit on a slightly lighter band.
- Retro-game touches: XP-style progress bar, completion badges.

**Views**

1. **Top bar** (all pages): "The Shire" wordmark, breadcrumb (`Python / Hello World`), green segmented progress bar with % for the current course, settings icon.
2. **Course catalog:** grid of course cards (language icon, title, description, lesson count, progress).
3. **Course page:** ordered lesson list with per-lesson completion state, plus overall progress (lessons complete / total).
4. **Lesson page:** two columns divided by a vertical rule.
   - Left: "Instructions" header, rendered Markdown, syntax-highlighted static code blocks with a copy button, collapsible "Hint" under a "Help" header.
   - Right: a file tab (e.g. `exercise.py` with a language icon), an editor with line numbers, a bottom toolbar (`⋯` menu on the left, Run + Submit answer on the right), and a "Terminal" panel underneath showing stdout/stderr with a block cursor. Submit shows per-test pass/fail.
   - Runnable (non-exercise) code cells inside the instructions get a compact inline editor + Run + output.
   - On narrow screens the columns stack.

Rule: the UI never talks to Docker or the runner directly, only to `/api/*` through `apps/web/lib/api.ts`.

## 9. Working agreements for Claude Code

- Strict TypeScript; no `any` without a comment explaining why.
- Validate every request and response with the shared Zod schemas.
- Write the hostile-input tests for the sandbox **before** finishing the runner.
- Small commits with clear messages, one milestone per PR-sized chunk.
- If a requirement here is ambiguous or conflicts with reality (e.g. Docker not available), stop and ask rather than guessing.
- Never weaken a sandbox limit to make a test pass. Fix the test or ask.

## 10. Resume bullet targets (fill in real numbers at the end)

- Built an interactive coding-course platform (Next.js, TypeScript, Fastify, Docker) that executes untrusted Python/JS in isolated containers with network, memory, CPU, PID, and time limits.
- Tested the sandbox against hostile inputs (fork bombs, infinite loops, memory exhaustion, network and filesystem access); [N] automated tests, CI on every push.
- Designed a UI-agnostic REST API with shared Zod schemas and an exercise auto-grader; deployed at [live URL].
