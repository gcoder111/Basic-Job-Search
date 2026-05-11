import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

function runCachedSearch(args) {
  const result = spawnSync(process.execPath, ["app/run.js", "--cached", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  const latestRun = JSON.parse(fs.readFileSync("data/runs/latest.json", "utf8"));

  return { result, latestRun };
}

test("workspace skeleton exists", () => {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

  assert.equal(fs.existsSync("package.json"), true);
  assert.equal(fs.statSync("app").isDirectory(), true);
  assert.equal(fs.statSync("tests").isDirectory(), true);

  for (const key of [
    "test",
    "run",
    "run:cached",
    "probe:post-login",
    "auth:portal",
    "auth:persistent",
    "schedule:install",
  ]) {
    assert.equal(Object.hasOwn(packageJson.scripts, key), true);
  }
});

test("app/run.js exits cleanly in cached mode", () => {
  const { result } = runCachedSearch(["--keyword=compliance"]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.includes('"selectedSourceCount"'), true);
});

test("app/run.js accepts keyword override in equals and split forms", () => {
  const equalsForm = runCachedSearch(["--keyword=riesgo"]);
  assert.equal(equalsForm.result.status, 0);
  assert.equal(equalsForm.latestRun.keyword, "riesgo");

  const splitForm = runCachedSearch(["--keyword", "riesgo"]);
  assert.equal(splitForm.result.status, 0);
  assert.equal(splitForm.latestRun.keyword, "riesgo");
});
