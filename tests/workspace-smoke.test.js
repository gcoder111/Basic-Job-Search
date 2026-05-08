import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

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
  const result = spawnSync(process.execPath, ["app/run.js", "--cached"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout.includes("selectedSourceCount"), true);
});
