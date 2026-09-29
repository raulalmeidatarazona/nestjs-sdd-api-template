# NestJS backend API template

A small NestJS service skeleton with spec-driven development, ports and adapters, explicit command/query classes, PostgreSQL transaction + outbox, strict quality gates and operational runbooks. The sample Job context is replaceable. Read [the map](docs/INDEX.md) and [API contract](docs/openapi.yaml) before expanding the template.

## Start a new service

Requires Node.js 24.14+, pnpm 11.5+, Python 3, PostgreSQL 16+ (Docker Compose is included), `psql` for remote migrations (local Docker includes it), and Git.

```sh
git clone <this-repository> my-service
cd my-service
pnpm install --frozen-lockfile
cp .env.example .env
make bootstrap
docker compose up -d db
make migrate
make check
make run
```

Rename the package and repository, replace the sample API key, and amend the constitution before business work. `make bootstrap` installs versioned hooks in this clone. Use GitHub **Use this template** when available.

```sh
set -a; . ./.env; set +a
curl -sS -H "Authorization: Bearer $API_KEY"   -H 'Idempotency-Key: demo-1' -H 'Content-Type: application/json'   -d '{"name":"example"}' http://localhost:3000/v1/jobs
curl -sS http://localhost:3000/live
curl -sS http://localhost:3000/ready
```

The app reads environment variables; `make run` loads `.env` locally. In development, events remain durable in the outbox without a receiver. Set `EVENT_WEBHOOK_URL` and `EVENT_WEBHOOK_TOKEN` to start delivery. Production requires HTTPS and a token. Receivers must deduplicate `X-Event-Id` and return 2xx only after durable processing. Delivery is at least once.

## Work with an agent

1. Read `AGENTS.md` and `docs/INDEX.md`.
2. Create `specs/features/<id>/` from `specs/templates/feature/` and agree on `spec.md`.
3. Plan slices in `plan.md`, implement one slice, record actual checks in `validation.md`.
4. Run `make check`, review the diff and open a PR. See `docs/WORKFLOW.md` for prompt examples.

## Gates and repository setup

- `make fast`: formatting, architecture, SDD, secrets, typecheck, unit tests.
- `make check`: full build/coverage, dependency audit and isolated PostgreSQL integration tests.
- `.githooks/pre-commit` runs the fast gate; `.githooks/pre-push` runs the full gate; CI repeats it.
- Set GitHub repository as a template and protect `main`: require `quality`, PR review and no force/direct push. Enable Dependabot and secret scanning where available.

See `docs/OPERATIONS.md` before production. The sample API key is a bootstrap guard, not a product authorization system.
