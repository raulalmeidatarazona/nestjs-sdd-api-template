import ts from "typescript";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve, relative, sep } from "node:path";

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? files(path)
      : path.endsWith(".ts")
        ? [path]
        : [];
  });
}

const root = resolve("src");
const violations = [];
for (const file of files(root)) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const layer = relative(root, file).split(sep)[0];
  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text;
      const target = specifier.startsWith(".")
        ? relative(root, resolve(dirname(file), specifier)).split(sep)[0]
        : "external";
      if (
        layer === "domain" &&
        target !== "node:crypto" &&
        target !== "external"
      )
        violations.push(`${file}: domain imports ${specifier}`);
      if (layer === "domain" && target === "external")
        violations.push(`${file}: domain imports ${specifier}`);
      if (
        layer === "application" &&
        !["domain", "application", "external"].includes(target)
      )
        violations.push(`${file}: application imports ${specifier}`);
      if (
        layer === "application" &&
        target === "external" &&
        !specifier.startsWith("node:")
      )
        violations.push(`${file}: application imports external ${specifier}`);
      if (layer === "adapters" && target === "adapters") {
        const fromAdapter = relative(root, file).split(sep)[1];
        const toAdapter = relative(
          root,
          resolve(dirname(file), specifier),
        ).split(sep)[1];
        if (fromAdapter !== toAdapter)
          violations.push(`${file}: cross-adapter import ${specifier}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
if (violations.length) {
  console.error("Architecture violations:\n" + violations.join("\n"));
  process.exit(1);
}
console.log("Architecture: OK");
