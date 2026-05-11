import test from "node:test";
import assert from "node:assert/strict";
import {
  getPortalSearchConfig,
  listSearchablePortals,
} from "../app/config/portal-search-config.js";

test("portal search config declares all supported portal routes", () => {
  assert.deepEqual(new Set(listSearchablePortals()), new Set([
    "linkedin",
    "magneto",
    "computrabajo",
    "adecco",
    "michaelpage",
    "elempleo",
  ]));
  assert.deepEqual(getPortalSearchConfig("elempleo"), {
    accessMode: "authenticated",
  });
  assert.deepEqual(getPortalSearchConfig("linkedin"), {
    accessMode: "public",
  });
  assert.equal(getPortalSearchConfig("missing-portal"), null);
});
