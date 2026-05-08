import test from "node:test";
import assert from "node:assert/strict";
import { getPortalAuthState, resolveWorkspacePaths } from "../app/services/auth-state.service.js";

test("resolveWorkspacePaths keeps auth and artifact directories separated", () => {
  const paths = resolveWorkspacePaths("C:\\repo\\basic-job-search");

  assert.equal(paths.authStateDir.endsWith("auth-state"), true);
  assert.equal(paths.persistentProfilesDir.endsWith("persistent-profiles"), true);
  assert.equal(paths.resultsDir.endsWith("results"), true);
  assert.equal(paths.runsDir.endsWith("data\\runs"), true);
});

test("getPortalAuthState resolves a storageState path for elempleo", async () => {
  const state = await getPortalAuthState({
    workspaceRoot: "C:\\repo\\basic-job-search",
    portalKey: "elempleo",
  });

  assert.equal(state.sessionStrategy, "storageState");
  assert.equal(state.available, false);
  assert.equal(state.authPath.endsWith("auth-state\\elempleo.json"), true);
});

test("getPortalAuthState resolves a persistent profile path for computrabajo", async () => {
  const state = await getPortalAuthState({
    workspaceRoot: "C:\\repo\\basic-job-search",
    portalKey: "computrabajo",
  });

  assert.equal(state.sessionStrategy, "persistentProfile");
  assert.equal(state.available, false);
  assert.equal(state.authPath.endsWith("persistent-profiles\\computrabajo"), true);
});

test("getPortalAuthState returns a public strategy for unknown portals", async () => {
  const state = await getPortalAuthState({
    workspaceRoot: "C:\\repo\\basic-job-search",
    portalKey: "magneto",
  });

  assert.deepEqual(state, {
    portalKey: "magneto",
    sessionStrategy: "public",
    available: true,
    authPath: null,
  });
});
