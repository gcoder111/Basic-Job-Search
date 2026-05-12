import test from "node:test";
import assert from "node:assert/strict";
import { buildExperimentPaths, buildPersistentProfilePaths } from "../app/experiments/auth-result.js";
import {
  buildPortalDirectSearchUrl,
  buildKeywordSlug,
  submitPortalSearch,
} from "../app/experiments/post-login-search-helpers.js";
import { getPostLoginSearchConfig } from "../app/experiments/post-login-search-config.js";

class FakeLocator {
  constructor(page, selector) {
    this.page = page;
    this.selector = selector;
  }

  first() {
    return this;
  }

  async count() {
    return this.page.getSelectorCount(this.selector);
  }

  async fill(value) {
    if (!(await this.count())) {
      throw new Error(`Selector not available for fill: ${this.selector}`);
    }

    this.page.fills.push({ selector: this.selector, value, url: this.page.url() });
  }

  async press(key) {
    this.page.presses.push({ selector: this.selector, key, url: this.page.url() });
  }

  async click() {
    this.page.clicks.push({ selector: this.selector, url: this.page.url() });
  }
}

class FakePage {
  constructor({ currentUrl, selectorCountsByUrl = {} }) {
    this.currentUrl = currentUrl;
    this.selectorCountsByUrl = selectorCountsByUrl;
    this.gotos = [];
    this.fills = [];
    this.clicks = [];
    this.presses = [];
  }

  url() {
    return this.currentUrl;
  }

  locator(selector) {
    return new FakeLocator(this, selector);
  }

  async goto(url) {
    this.currentUrl = url;
    this.gotos.push(url);
  }

  async waitForLoadState() {
    return undefined;
  }

  async waitForTimeout() {
    return undefined;
  }

  getSelectorCount(selector) {
    return this.selectorCountsByUrl[this.currentUrl]?.[selector] || 0;
  }
}

test("Elempleo post-login search config uses storageState selectors", () => {
  const config = getPostLoginSearchConfig("elempleo");

  assert.equal(config.sessionStrategy, "storageState");
  assert.equal(config.submitButtonSelector, "button.js-searchHeader");
  assert.equal(
    config.directSearchUrlPattern,
    "https://www.elempleo.com/co/ofertas-empleo/trabajo-{keywordSlug}",
  );
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

test("buildPortalDirectSearchUrl uses the configured keyword slug placeholder", () => {
  const config = getPostLoginSearchConfig("elempleo");
  assert.equal(
    buildPortalDirectSearchUrl(config, "riesgo operativo"),
    "https://www.elempleo.com/co/ofertas-empleo/trabajo-riesgo-operativo",
  );
});

test("submitPortalSearch prefers ui submission when the search input is available", async () => {
  const config = getPostLoginSearchConfig("elempleo");
  const page = new FakePage({
    currentUrl: "https://www.elempleo.com/co/homeusuario",
    selectorCountsByUrl: {
      "https://www.elempleo.com/co/homeusuario": {
        "input.js-searchbox-input.tt-input": 1,
        "button.js-searchHeader": 1,
      },
    },
  });

  const result = await submitPortalSearch(page, config, "compliance");

  assert.equal(result.strategy, "ui-submit");
  assert.equal(page.fills.length, 1);
  assert.equal(page.clicks.length, 1);
  assert.deepEqual(page.gotos, []);
});

test("submitPortalSearch recovers by navigating to a search entry url before using the ui", async () => {
  const config = {
    ...getPostLoginSearchConfig("computrabajo"),
    searchEntryUrls: [
      "https://candidato.co.computrabajo.com/candidate/home",
      "https://candidato.co.computrabajo.com/candidate/jobs",
    ],
  };
  const page = new FakePage({
    currentUrl: "https://candidato.co.computrabajo.com/candidate/other",
    selectorCountsByUrl: {
      "https://candidato.co.computrabajo.com/candidate/home": {},
      "https://candidato.co.computrabajo.com/candidate/jobs": {
        "#prof-cat-search-input": 1,
        'button:has-text("Buscar empleos")': 1,
      },
    },
  });

  const result = await submitPortalSearch(page, config, "riesgo");

  assert.equal(result.strategy, "ui-submit");
  assert.equal(result.recoveryUrl, "https://candidato.co.computrabajo.com/candidate/jobs");
  assert.deepEqual(page.gotos, [
    "https://candidato.co.computrabajo.com/candidate/home",
    "https://candidato.co.computrabajo.com/candidate/jobs",
  ]);
});

test("submitPortalSearch falls back to a direct url when Elempleo input recovery is unavailable", async () => {
  const config = getPostLoginSearchConfig("elempleo");
  const page = new FakePage({
    currentUrl: "https://www.elempleo.com/co/homeusuario",
    selectorCountsByUrl: {
      "https://www.elempleo.com/co/homeusuario": {},
    },
  });

  const result = await submitPortalSearch(page, config, "riesgo operativo");

  assert.equal(result.strategy, "direct-url");
  assert.equal(
    result.directSearchUrl,
    "https://www.elempleo.com/co/ofertas-empleo/trabajo-riesgo-operativo",
  );
  assert.deepEqual(page.gotos, [
    "https://www.elempleo.com/co/ofertas-empleo/trabajo-riesgo-operativo",
  ]);
});
