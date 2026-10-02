# Validation: 0002

Validated locally on 2026-10-02 with Node.js 24.14, pnpm 11.5 and PostgreSQL 16.6.

## Evidence

- `make check`: passed, including formatting, architecture, staged SDD and secret gates, TypeScript typecheck/build, six focused tests, two PostgreSQL integration tests, 88.88% statement coverage, production dependency audit, Git history secret scan, MCP stdio tests and `npm audit` with no reported vulnerabilities.
- `npm test --prefix agents/mcp`: three tests passed; a real MCP client connected over stdio, listed tools, and traversal/symlink reads were refused.
- `opencode mcp list`: project server connected. Claude Code is not installed on this machine. Codex's project MCP config is loaded only after the checkout is trusted; its runtime connection was not exercised here.
- TypeScript 7.0.2 PR failed the architecture check because the published package has no compiler API; the official TypeScript 7.0 announcement confirms that limitation. Dependabot now ignores TypeScript major updates until a supported migration exists.

## Remaining work for a new service

Run `make check` in the clone, review the new service's threat model, and enable branch protection and a separate human reviewer on its GitHub repository. The example MCP tools are intentionally read-only.
