.PHONY: bootstrap fmt arch sdd secrets secrets-history deps test typecheck coverage security fast check run migrate integration

bootstrap:
	git config core.hooksPath .githooks

fmt:
	pnpm format:check

arch:
	pnpm arch

sdd:
	python3 scripts/check_sdd.py --staged

secrets:
	python3 scripts/check_secrets.py

secrets-history:
	docker run --rm -v "$$(pwd):/repo" -w /repo zricethezav/gitleaks@sha256:cdbb7c955abce02001a9f6c9f602fb195b7fadc1e812065883f695d1eeaba854 git -v --no-banner --redact /repo

deps:
	pnpm install --frozen-lockfile --lockfile-only --offline

test:
	pnpm test

typecheck:
	pnpm typecheck

coverage:
	pnpm coverage

security:
	pnpm audit --audit-level high --prod

integration:
	@set -e; set -a; if test -f .env; then . ./.env; fi; set +a; \
	: "$${TEST_DATABASE_URL:?TEST_DATABASE_URL is required}"; \
	if test "$${TEST_DATABASE_URL}" = "$${DATABASE_URL:-}"; then echo 'Test database must be separate'; exit 1; fi; \
	DATABASE_URL="$${TEST_DATABASE_URL}" sh scripts/migrate.sh; \
	TEST_DATABASE_URL="$${TEST_DATABASE_URL}" pnpm vitest run test/postgres.integration.spec.ts

fast: fmt arch sdd secrets deps typecheck test

check: fast coverage security secrets-history integration
	pnpm build

run:
	@set -a; . ./.env; set +a; pnpm dev

migrate:
	@set -a; . ./.env; set +a; sh scripts/migrate.sh
