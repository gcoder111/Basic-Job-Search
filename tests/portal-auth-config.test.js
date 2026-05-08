import test from "node:test";
import assert from "node:assert/strict";
import {
  getPortalConfig,
  isComputrabajoAuthenticated,
  isElempleoAuthenticated,
  isLinkedInAuthenticated,
} from "../app/experiments/portal-auth-config.js";

test("Elempleo auth detector rejects login redirect", () => {
  assert.equal(
    isElempleoAuthenticated({
      currentUrl: "https://www.elempleo.com/co/iniciar-sesion?__error__=Unauthorized",
      passwordInputCount: 1,
      title: "Iniciar Sesion - Elempleo.com",
    }),
    false,
  );
  assert.equal(getPortalConfig("elempleo").targetUrl, "https://www.elempleo.com/co/homeusuario");
});

test("LinkedIn and Computrabajo auth detectors rely on portal-specific signals", () => {
  assert.equal(isLinkedInAuthenticated({ cookieNames: ["li_at"] }), true);
  assert.equal(
    isComputrabajoAuthenticated({
      currentUrl: "https://candidato.co.computrabajo.com/candidate/home",
      cookieNames: ["pa_user"],
      bodyText: "",
    }),
    true,
  );
});
