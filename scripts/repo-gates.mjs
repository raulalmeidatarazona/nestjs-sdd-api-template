import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const secretPatterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub token", /gh[pousr]_[A-Za-z0-9_]{30,}/],
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
  [
    "credential assignment",
    /(?:password|secret|api[_-]?key|token)\s*[:=]\s*['"][A-Za-z0-9/+_=.-]{20,}['"]/i,
  ],
];

export function validateSdd(changed) {
  const code = changed.some((path) =>
    ["src/", "migrations/", "scripts/", "agents/mcp/"].some((prefix) =>
      path.startsWith(prefix),
    ),
  );
  const spec = changed.some(
    (path) =>
      (path.startsWith("specs/features/") || path.startsWith("specs/bugs/")) &&
      path.endsWith(".md"),
  );
  if (code && !spec) {
    throw new Error(
      "SDD gate: code, migration or MCP changes require a feature/bug spec or validation update",
    );
  }
}

export function detectSecrets(content) {
  return secretPatterns
    .filter(([, pattern]) => pattern.test(content))
    .map(([name]) => name);
}

function indexedPaths() {
  return execFileSync("git", ["ls-files", "-z"])
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

function runSdd(args) {
  let diffArgs = ["diff", "--name-only", "-z", "--diff-filter=ACMR"];
  if (args.length === 0 || (args.length === 1 && args[0] === "--staged")) {
    diffArgs.push("--cached");
  } else if (args.length === 2 && args[0] === "--base") {
    diffArgs.push(args[1] + "...HEAD");
  } else {
    throw new Error(
      "usage: node scripts/repo-gates.mjs sdd [--staged | --base <ref>]",
    );
  }
  validateSdd(
    execFileSync("git", diffArgs).toString("utf8").split("\0").filter(Boolean),
  );
  process.stdout.write("SDD gate: OK\n");
}

function runSecrets() {
  const violations = [];
  for (const path of indexedPaths()) {
    const content = execFileSync("git", ["show", ":" + path]);
    if (content.includes(0)) continue;
    for (const label of detectSecrets(content.toString("utf8"))) {
      violations.push(path + ": " + label);
    }
  }
  if (violations.length) {
    throw new Error(
      "Potential secrets found; inspect these files:\n" + violations.join("\n"),
    );
  }
  process.stdout.write("Secret scan: OK\n");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    switch (process.argv[2]) {
      case "sdd":
        runSdd(process.argv.slice(3));
        break;
      case "secrets":
        runSecrets();
        break;
      default:
        throw new Error("usage: node scripts/repo-gates.mjs <sdd|secrets>");
    }
  } catch (error) {
    process.stderr.write(String(error.message) + "\n");
    process.exitCode = 1;
  }
}
