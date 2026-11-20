import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const args = process.argv.slice(2);
const bundleAt = args.indexOf("--bundle");
const withoutLauncher = args.includes("--without-launcher");
const launcher = process.env.TEYRA_CLI || "teyra-cli";

function checkWithLauncher() {
  const run = spawnSync(launcher, ["check", root], { stdio: "inherit" });
  if (run.error) {
    console.error(`The launcher's rules were NOT checked: ${launcher} was not found. Build teyra-cli from the launcher and put it on PATH or set TEYRA_CLI to its path, or pass --without-launcher to skip them.`);
    process.exit(1);
  }
  if (run.status !== 0) process.exit(run.status ?? 1);
}

if (withoutLauncher) {
  console.warn("The launcher's rules were NOT checked: run teyra-cli check on this folder before pushing.");
} else {
  checkWithLauncher();
}

const problems = [];

function folders(path) {
  const dir = join(root, path);
  return existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
}

function jsonFiles(path) {
  const dir = join(root, path);
  return existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(".json")).sort().map((name) => `${path}/${name}`) : [];
}

function readAll(path) {
  return jsonFiles(path).flatMap((file) => {
    try {
      return [JSON.parse(readFileSync(join(root, file), "utf8"))];
    } catch (error) {
      problems.push(`${file}: ${error.message}`);
      return [];
    }
  });
}

const games = readAll("games");
const builds = readAll("builds");
const olderGames = [];
const olderBuilds = [];
for (const name of folders("formats")) {
  olderGames.push(...readAll(`formats/${name}/games`));
  olderBuilds.push(...readAll(`formats/${name}/builds`));
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

if (bundleAt >= 0) {
  const [file, version] = args.slice(bundleAt + 1, bundleAt + 3);
  if (!file || !/^v\d+\.\d+\.\d+$/.test(version ?? "")) {
    console.error("usage: node scripts/check.mjs [--without-launcher] --bundle <file> v<major>.<minor>.<patch>");
    process.exit(1);
  }
  const catalog = { version, games: [...games, ...olderGames], builds: [...builds, ...olderBuilds] };
  writeFileSync(file, `${JSON.stringify(catalog, null, 2)}\n`);
}

if (withoutLauncher) {
  console.log(`${games.length} games, ${builds.length} builds, ${olderGames.length + olderBuilds.length} copies in older formats`);
}
