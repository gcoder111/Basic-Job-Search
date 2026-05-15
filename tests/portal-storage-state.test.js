import test from "node:test";
import assert from "node:assert/strict";
import {
  assertAuthenticatedStorageCapture,
  waitForAuthenticatedSignals,
} from "../app/experiments/portal-storage-state.js";
import { getPortalConfig } from "../app/experiments/portal-auth-config.js";

test("assertAuthenticatedStorageCapture throws when the captured Elempleo session is still on login", () => {
  assert.throws(
    () =>
      assertAuthenticatedStorageCapture({
        portalConfig: getPortalConfig("elempleo"),
        authSignals: {
          currentUrl:
            "https://www.elempleo.com/co/iniciar-sesion?__error__=Unauthorized&__previous_url__=%2fco%2fhomeusuario%3f",
          title: "Iniciar Sesión - Elempleo.com",
          passwordInputCount: 1,
        },
      }),
    /not authenticated/i,
  );
});

test("assertAuthenticatedStorageCapture returns true for an authenticated Elempleo home page", () => {
  assert.equal(
    assertAuthenticatedStorageCapture({
      portalConfig: getPortalConfig("elempleo"),
      authSignals: {
        currentUrl: "https://www.elempleo.com/co/homeusuario",
        title: "Mi home de usuario – elempleo.com",
        passwordInputCount: 0,
      },
    }),
    true,
  );
});

test("waitForAuthenticatedSignals polls until the portal detector confirms authentication", async () => {
  const portalConfig = getPortalConfig("linkedin");
  const collectedSignals = [
    {
      currentUrl: "https://www.linkedin.com/jobs/",
      title: "LinkedIn Jobs",
      passwordInputCount: 1,
      cookieNames: [],
    },
    {
      currentUrl: "https://www.linkedin.com/feed/",
      title: "LinkedIn",
      passwordInputCount: 0,
      cookieNames: ["li_at"],
    },
  ];

  let index = 0;
  const result = await waitForAuthenticatedSignals({
    portalConfig,
    collectAuthSignals: async () => collectedSignals[Math.min(index++, collectedSignals.length - 1)],
    timeoutMs: 200,
    pollIntervalMs: 1,
  });

  assert.equal(result.authenticated, true);
  assert.equal(result.authSignals.cookieNames.includes("li_at"), true);
});

test("waitForAuthenticatedSignals returns the latest observed signals when timeout expires", async () => {
  const portalConfig = getPortalConfig("linkedin");

  const result = await waitForAuthenticatedSignals({
    portalConfig,
    collectAuthSignals: async () => ({
      currentUrl: "https://www.linkedin.com/jobs/",
      title: "LinkedIn Jobs",
      passwordInputCount: 1,
      cookieNames: [],
    }),
    timeoutMs: 10,
    pollIntervalMs: 1,
  });

  assert.equal(result.authenticated, false);
  assert.equal(result.authSignals.cookieNames.includes("li_at"), false);
});
