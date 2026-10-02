.PHONY: bootstrap fmt arch sdd secrets secrets-history deps test typecheck coverage security fast check run migrate integration agent-check

bootstrap:
	git config core.hooksPath .githooks

fmt:
	pnpm format:check

arch:
	pnpm arch

sdd:
	node scripts/repo-gates.mjs sdd --staged

secrets:
	node scripts/repo-gates.mjs secrets

secrets-history:
	docker run --rm -v "$$(pwd):/repo" -w /repo zricethezav/gitleaks@sha256:cdbb7c955abce02001a9f6c9f602fb195b7fadc1e812065883f695d1eeaba854 git -v --no-banner --redact /repo

deps:
	pnpm install --frozen-lockfile --lockfile-only --offline

test:
	pnpm test
	node --test scripts/repo-gates.test.mjs

typecheck:
	pnpm typecheck

coverage:
	pnpm coverage

security:
	pnpm audit --audit-level high --prod

agent-check:
	npm ci --prefix agents/mcp --ignore-scripts
	npm test --prefix agents/mcp
	npm audit --prefix agents/mcp --audit-level high

integration:
	@set -e; set -a; if test -f .env; then . ./.env; fi; set +a; \
	: "$${TEST_DATABASE_URL:?TEST_DATABASE_URL is required}"; \
	if test "$${TEST_DATABASE_URL}" = "$${DATABASE_URL:-}"; then echo 'Test database must be separate'; exit 1; fi; \
	DATABASE_URL="$${TEST_DATABASE_URL}" sh scripts/migrate.sh; \
	TEST_DATABASE_URL="$${TEST_DATABASE_URL}" pnpm vitest run test/postgres.integration.spec.ts

fast: fmt arch sdd secrets deps typecheck test agent-check

check: fast coverage security secrets-history integration
	pnpm build

run:
	@set -a; . ./.env; set +a; pnpm dev

migrate:
	@set -a; . ./.env; set +a; sh scripts/migrate.sh
