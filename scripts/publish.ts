/**
 * One-shot publish: bump → build webui → compile all → publish npm → git push.
 *
 * Usage:
 *   bun run scripts/publish.ts           # publish current version
 *   bun run scripts/publish.ts --dry-run # npm publish --dry-run
 */
import { resolve } from "path";
import { readFileSync, readdirSync } from "fs";
import { execSync } from "child_process";

const ROOT = resolve(import.meta.dir, "..");
const dryRun = process.argv.includes("--dry-run");

function run(cmd: string, cwd = ROOT) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

// Step 0: Ensure all versions are synced
const version = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8")).version;
console.log(`\n=== Publishing v${version} ===`);
run(`bun run scripts/bump.ts ${version}`);

// Step 1: Build webui + inline
console.log("\n=== Building WebUI ===");
run("bun run scripts/build-webui.ts");

// Step 2: Compile all platforms
console.log("\n=== Compiling all platforms ===");
run("bun run scripts/compile-all.ts");

// Step 3: Publish platform packages
const npmArgs = ["publish", "--access", "public"];
if (dryRun) npmArgs.push("--dry-run");

const pkgBase = resolve(ROOT, ".npm-packages");
const platformDirs = readdirSync(pkgBase, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

console.log("\n=== Publishing platform packages ===");
for (const dir of platformDirs) {
  const pkgDir = resolve(pkgBase, dir);
  const name = JSON.parse(readFileSync(resolve(pkgDir, "package.json"), "utf-8")).name;
  console.log(`\nPublishing ${name}@${version}...`);
  const r = Bun.spawnSync(["npm", ...npmArgs], {
    cwd: pkgDir,
    stdio: ["inherit", "inherit", "inherit"],
  });
  if (r.exitCode !== 0) {
    console.error(`Failed to publish ${name}`);
    process.exit(1);
  }
}

// Step 4: Publish main package
console.log("\n=== Publishing main package ===");
const main = Bun.spawnSync(["npm", ...npmArgs], {
  cwd: ROOT,
  stdio: ["inherit", "inherit", "inherit"],
});
if (main.exitCode !== 0) {
  console.error("Failed to publish main package");
  process.exit(1);
}

console.log(`\n=== v${version} published${dryRun ? " (dry run)" : ""} ===`);
