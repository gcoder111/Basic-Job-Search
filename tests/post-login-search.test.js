import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExperimentPaths,
  buildPersistentProfilePaths,
} from "../app/experiments/auth-result.js";
import { buildKeywordSlug } from "../app/experiments/post-login-search-helpers.js";
import { getPostLoginSearchConfig } from "../app/experiments/post-login-search-config.js";

test("Elempleo post-login search config uses storageState selectors", () => {
  const config = getPostLoginSearchConfig("elempleo");

  assert.equal(config.sessionStrategy, "storageState");
  assert.equal(config.submitButtonSelector, "button.js-searchHeader");
});

test("experiment path helpers separate auth-state and persistent profiles", () => {
  const storagePaths = buildExperimentPaths("C:\\repo\\basic-job-search", "elempleo");
  const persistentPaths = buildPersistentProfilePaths("C:\\repo\\basic-job-search", "computrabajo");

  assert.equal(storagePaths.storageStatePath.endsWith("auth-state\\elempleo.json"), true);
  assert.equal(storagePaths.resultPath.endsWith("results\\elempleo-storage-state-result.json"), true);
  assert.equal(persistentPaths.userDataDir.endsWith("persistent-profiles\\computrabajo"), true);
  assert.equal(
    persistentPaths.resultPath.endsWith("results\\computrabajo-persistent-context-result.json"),
    true,
  );
});

test("buildKeywordSlug keeps artifact names Windows-friendly", () => {
  assert.equal(buildKeywordSlug("riesgo operativo"), "riesgo-operativo");
});
