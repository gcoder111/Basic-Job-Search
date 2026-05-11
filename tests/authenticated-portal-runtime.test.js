import test from "node:test";
import assert from "node:assert/strict";
import { classifyAuthenticatedPortalVerdict } from "../app/adapters/authenticated-portal-runtime.js";

test("classifyAuthenticatedPortalVerdict escalates auth failures after real search attempt", () => {
  assert.equal(
    classifyAuthenticatedPortalVerdict({
      authenticatedBeforeSearch: true,
      authenticatedAfterSearch: false,
      jobs: [],
    }),
    "needs-user-decision",
  );
});
