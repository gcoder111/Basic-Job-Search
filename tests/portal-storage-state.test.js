import test from "node:test";
import assert from "node:assert/strict";
import { assertAuthenticatedStorageCapture } from "../app/experiments/portal-storage-state.js";
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
