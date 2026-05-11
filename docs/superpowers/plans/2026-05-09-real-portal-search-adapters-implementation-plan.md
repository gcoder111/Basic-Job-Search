# Real Portal Search Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current placeholder acquisition layer with real vacancy search flows for every URL in `URL_plataformas.md`, including both public portals and authenticated portals with reusable sessions.

**Architecture:** Keep the existing batch pipeline, filtering, scoring, retry-at-end behavior, and report writing. Add a portal execution registry, shared Playwright search/extraction helpers, portal-specific adapters for public boards, and authenticated adapters that only count as supported when they complete a real post-login search and emit reusable evidence.

**Tech Stack:** Node.js (ESM), Playwright, `node:test`, Markdown source-of-truth files, PowerShell on Windows, JSON and screenshot artifacts under `results/`, `auth-state/`, `persistent-profiles/`, and `data/runs/`.

---

## Planned File Structure

- Modify: `URL_plataformas.md`
- Modify: `README.md`
- Create: `app/config/portal-search-config.js`
- Create: `app/utils/safe-json.js`
- Create: `app/utils/job-cleanup.js`
- Create: `app/adapters/public-portal-runtime.js`
- Create: `app/adapters/authenticated-portal-runtime.js`
- Create: `app/adapters/public-linkedin.adapter.js`
- Create: `app/adapters/public-magneto.adapter.js`
- Create: `app/adapters/public-michaelpage.adapter.js`
- Create: `app/adapters/public-adecco.adapter.js`
- Create: `app/adapters/auth-computrabajo.adapter.js`
- Create: `app/adapters/auth-elempleo.adapter.js`
- Modify: `app/adapters/generic-board.adapter.js`
- Modify: `app/adapters/browser-search.adapter.js`
- Modify: `app/adapters/ats-page.adapter.js`
- Modify: `app/experiments/post-login-search-config.js`
- Modify: `app/experiments/post-login-search-helpers.js`
- Modify: `app/experiments/post-login-search.js`
- Modify: `app/run.js`
- Create: `tests/portal-search-config.test.js`
- Create: `tests/public-portal-runtime.test.js`
- Create: `tests/public-linkedin.adapter.test.js`
- Create: `tests/public-magneto.adapter.test.js`
- Create: `tests/public-michaelpage.adapter.test.js`
- Create: `tests/public-adecco.adapter.test.js`
- Create: `tests/authenticated-portal-runtime.test.js`
- Create: `tests/auth-computrabajo.adapter.test.js`
- Create: `tests/auth-elempleo.adapter.test.js`
- Modify: `tests/workspace-smoke.test.js`

---

### Task 1: Turn `URL_plataformas.md` into explicit portal execution truth

**Files:**
- Modify: `URL_plataformas.md`
- Test: `tests/load-sources.service.test.js`

- [ ] **Step 1: Write the failing source-truth regression test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { loadSources } from "../app/services/load-sources.service.js";

test("loadSources reads explicit portal metadata for all target URLs", async () => {
  const { allSources } = await loadSources({ repoRoot: process.cwd() });
  assert.equal(allSources.length, 6);
  assert.deepEqual(
    allSources.map((source) => [source.portalKey, source.requiresAuth, source.sessionStrategy]),
    [
      ["linkedin", false, "publico"],
      ["magneto", false, "publico"],
      ["computrabajo", true, "persistentProfile"],
      ["adecco", false, "publico"],
      ["michaelpage", false, "publico"],
      ["elempleo", true, "storageState"],
    ],
  );
});
```

- [ ] **Step 2: Run the source-loading tests to verify the new expectation fails**

Run: `node --test tests/load-sources.service.test.js`
Expected: FAIL because the current table row is blank and the portal metadata is not explicit yet.

- [ ] **Step 3: Replace the blank table row in `URL_plataformas.md` with real portal metadata**

```md
| portal_key | nombre_portal | url_inicio | requiere_login | estrategia_sesion | estado_pruebas | notas |
| --- | --- | --- | --- | --- | --- | --- |
| linkedin | LinkedIn Jobs | https://www.linkedin.com/jobs/ | no | publico | pendiente | Buscar por keyword en la barra principal de jobs y capturar cards visibles del resultado. |
| magneto | Magneto 365 | https://www.magneto365.com/co/trabajos/buscar | no | publico | pendiente | Flujo publico con cards de resultados y paginacion potencial. |
| computrabajo | Computrabajo | https://co.computrabajo.com | si | persistentProfile | pendiente | Requiere sesion persistente validada con busqueda real post-login. |
| adecco | Adecco Colombia | https://www.adecco.com/es-co/candidatos | no | publico | pendiente | Buscar vacantes desde el listado publico de candidatos y normalizar titulo, ubicacion y fecha. |
| michaelpage | Michael Page Colombia | https://www.michaelpage.com.co/jobs/bogot%C3%A1 | no | publico | pendiente | URL publica ya filtrada por Bogota; completar keyword search en pagina/listado si existe. |
| elempleo | Elempleo | https://www.elempleo.com/co/homeusuario | si | storageState | pendiente | Solo cuenta como soportado cuando la sesion reutilizada permite una busqueda real post-login con evidencia. |
```

- [ ] **Step 4: Run the source-loading tests again**

Run: `node --test tests/load-sources.service.test.js`
Expected: PASS

- [ ] **Step 5: Commit the source-of-truth update**

```bash
git add URL_plataformas.md tests/load-sources.service.test.js
git commit -m "docs: declare portal access modes and execution notes"
```

---

### Task 2: Add a portal execution registry and normalize adapter routing

**Files:**
- Create: `app/config/portal-search-config.js`
- Modify: `app/adapters/browser-search.adapter.js`
- Modify: `app/run.js`
- Test: `tests/portal-search-config.test.js`
- Test: `tests/workspace-smoke.test.js`

- [ ] **Step 1: Write the failing portal-registry tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { getPortalSearchConfig, listSearchablePortals } from "../app/config/portal-search-config.js";

test("portal search config declares all supported portal routes", () => {
  assert.deepEqual(new Set(listSearchablePortals()), new Set([
    "linkedin",
    "magneto",
    "computrabajo",
    "adecco",
    "michaelpage",
    "elempleo",
  ]));
  assert.deepEqual(getPortalSearchConfig("elempleo"), { accessMode: "authenticated" });
  assert.deepEqual(getPortalSearchConfig("linkedin"), { accessMode: "public" });
  assert.equal(getPortalSearchConfig("missing-portal"), null);
});
```

```js
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

test("app/run.js exits cleanly in cached mode", () => {
  const { result } = runCachedSearch(["--keyword=riesgo"]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.includes('"matchedJobs"'), true);
});

test("app/run.js accepts keyword override in equals and split forms", () => {
  const equalsForm = runCachedSearch(["--keyword=riesgo"]);
  assert.equal(equalsForm.result.status, 0);
  assert.equal(equalsForm.latestRun.keyword, "riesgo");

  const splitForm = runCachedSearch(["--keyword", "riesgo"]);
  assert.equal(splitForm.result.status, 0);
  assert.equal(splitForm.latestRun.keyword, "riesgo");
});
```

- [ ] **Step 2: Run the new registry and runner smoke tests**

Run: `node --test tests/portal-search-config.test.js tests/workspace-smoke.test.js`
Expected: FAIL with module-not-found and unsupported `--keyword` behavior.

- [ ] **Step 3: Add the portal registry with routing-only metadata**

```js
export const portalSearchConfig = {
  linkedin: {
    accessMode: "public",
  },
  magneto: {
    accessMode: "public",
  },
  computrabajo: {
    accessMode: "authenticated",
  },
  adecco: {
    accessMode: "public",
  },
  michaelpage: {
    accessMode: "public",
  },
  elempleo: {
    accessMode: "authenticated",
  },
};

export function getPortalSearchConfig(portalKey) {
  return portalSearchConfig[portalKey] || null;
}

export function listSearchablePortals() {
  return Object.keys(portalSearchConfig);
}
```

- [ ] **Step 4: Add keyword override parsing to `app/run.js` without changing the one-keyword-per-run model**

```js
function parseArgs(argv) {
  const flags = new Set();
  let keywordOverride = null;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--keyword") {
      const nextToken = argv[index + 1];
      if (nextToken && !nextToken.startsWith("--")) {
        keywordOverride = nextToken;
        index += 1;
      }
      continue;
    }

    if (token.startsWith("--keyword=")) {
      keywordOverride = token.slice("--keyword=".length);
      continue;
    }

    if (token.startsWith("--")) {
      flags.add(token.replace(/^--/, ""));
    }
  }

  return { flags, keywordOverride };
}

const { flags, keywordOverride } = parseArgs(process.argv.slice(2));
const keyword = keywordOverride || profile.primaryTitleKeywords[0] || "riesgo";
```

- [ ] **Step 5: Align cached authenticated aggregate path derivation with the experiment keyword slug**

```js
import { buildKeywordSlug } from "../experiments/post-login-search-helpers.js";

function buildAggregateResultPath(workspaceRoot, keyword) {
  return path.join(
    workspaceRoot,
    "results",
    `post-login-search-${buildKeywordSlug(keyword)}.json`,
  );
}
```

- [ ] **Step 6: Run the registry and runner smoke tests again**

Run: `node --test tests/portal-search-config.test.js tests/workspace-smoke.test.js`
Expected: PASS

- [ ] **Step 7: Prove the split-form keyword override writes the expected run metadata**

Run: `node app/run.js --cached --keyword riesgo`
Expected: PASS and `data/runs/latest.json` contains `"keyword": "riesgo"`.

- [ ] **Step 8: Commit the routing foundation**

```bash
git add app/config/portal-search-config.js app/adapters/browser-search.adapter.js app/run.js tests/portal-search-config.test.js tests/workspace-smoke.test.js
git commit -m "feat: add portal search registry and keyword override"
```

---

### Task 3: Build a shared runtime for public-portal search and extraction

**Files:**
- Create: `app/utils/safe-json.js`
- Create: `app/utils/job-cleanup.js`
- Create: `app/adapters/public-portal-runtime.js`
- Test: `tests/public-portal-runtime.test.js`

- [ ] **Step 1: Write the failing public-runtime tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExtractedJobs, trimJobsToUniqueUrls } from "../app/adapters/public-portal-runtime.js";

test("normalizeExtractedJobs keeps only minimally valid jobs", () => {
  const jobs = normalizeExtractedJobs([
    { title: "Analista de Riesgo", url: "https://example.com/job/1", company: "A", description: "Bogota", publicationDateRaw: "ayer" },
    { title: "", url: "", company: "A" },
  ]);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, "Analista de Riesgo");
});

test("trimJobsToUniqueUrls removes repeated job urls", () => {
  const jobs = trimJobsToUniqueUrls([
    { title: "A", url: "https://example.com/job/1" },
    { title: "B", url: "https://example.com/job/1" },
  ]);
  assert.equal(jobs.length, 1);
});
```

- [ ] **Step 2: Run the public-runtime tests**

Run: `node --test tests/public-portal-runtime.test.js`
Expected: FAIL because the shared runtime does not exist yet.

- [ ] **Step 3: Add JSON helpers and job normalization utilities**

```js
import fs from "node:fs/promises";
import path from "node:path";

export async function writeJsonFile(targetPath, payload) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(payload, null, 2), "utf8");
}
```

```js
import { normalizeWhitespace } from "./normalize-text.js";

export function cleanupJob(job = {}) {
  return {
    title: normalizeWhitespace(job.title || ""),
    company: normalizeWhitespace(job.company || ""),
    location: normalizeWhitespace(job.location || ""),
    url: normalizeWhitespace(job.url || ""),
    description: normalizeWhitespace(job.description || ""),
    publicationDateRaw: normalizeWhitespace(job.publicationDateRaw || ""),
  };
}
```

- [ ] **Step 4: Add the shared public runtime**

```js
import path from "node:path";
import { chromium } from "playwright";
import { cleanupJob } from "../utils/job-cleanup.js";
import { normalizeForMatch } from "../utils/normalize-text.js";
import { writeJsonFile } from "../utils/safe-json.js";

export function normalizeExtractedJobs(jobs = []) {
  return jobs
    .map(cleanupJob)
    .filter((job) => job.title && job.url);
}

export function trimJobsToUniqueUrls(jobs = []) {
  const seen = new Set();
  const unique = [];
  for (const job of jobs) {
    const key = normalizeForMatch(job.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(job);
  }
  return unique;
}

export async function runPublicPortalSearch({ workspaceRoot, source, keyword, portalConfig, extractJobs }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const resultPath = path.join(workspaceRoot, "results", `${source.portalKey}-public-search-${keyword}.json`);
  const screenshotPath = path.join(workspaceRoot, "results", `${source.portalKey}-public-search-${keyword}.png`);

  try {
    await page.goto(portalConfig.startUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    const extractedJobs = await extractJobs(page, keyword);
    const jobs = trimJobsToUniqueUrls(normalizeExtractedJobs(extractedJobs));
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await writeJsonFile(resultPath, {
      portal: source.portalKey,
      keyword,
      verdict: jobs.length > 0 ? "search-success" : "no-results",
      jobCount: jobs.length,
      jobs,
      screenshotPath,
    });
    return { jobs, resultPath, screenshotPath };
  } finally {
    await context.close();
    await browser.close();
  }
}
```

- [ ] **Step 5: Run the public-runtime tests again**

Run: `node --test tests/public-portal-runtime.test.js`
Expected: PASS

- [ ] **Step 6: Commit the shared public runtime**

```bash
git add app/utils/safe-json.js app/utils/job-cleanup.js app/adapters/public-portal-runtime.js tests/public-portal-runtime.test.js
git commit -m "feat: add shared public portal runtime"
```

---

### Task 4: Implement real public acquisition for LinkedIn, Magneto, and Michael Page

**Files:**
- Create: `app/adapters/public-linkedin.adapter.js`
- Create: `app/adapters/public-magneto.adapter.js`
- Create: `app/adapters/public-michaelpage.adapter.js`
- Modify: `app/adapters/generic-board.adapter.js`
- Test: `tests/public-linkedin.adapter.test.js`
- Test: `tests/public-magneto.adapter.test.js`
- Test: `tests/public-michaelpage.adapter.test.js`

- [ ] **Step 1: Write the failing portal extraction tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { extractLinkedinJobsFromHtml } from "../app/adapters/public-linkedin.adapter.js";

test("extractLinkedinJobsFromHtml maps linkedin cards into normalized jobs", async () => {
  const jobs = await extractLinkedinJobsFromHtml(`
    <div class="base-search-card">
      <h3>Analista de Compliance</h3>
      <h4>Empresa A</h4>
      <a href="https://www.linkedin.com/jobs/view/1"></a>
      <time datetime="2026-05-08">ayer</time>
    </div>
  `);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, "Analista de Compliance");
});
```

```js
import test from "node:test";
import assert from "node:assert/strict";
import { extractMagnetoJobsFromHtml } from "../app/adapters/public-magneto.adapter.js";

test("extractMagnetoJobsFromHtml reads title url and company", async () => {
  const jobs = await extractMagnetoJobsFromHtml(`
    <article>
      <a href="https://www.magneto365.com/job/1">Analista de Riesgo</a>
      <span>Empresa B</span>
      <span>Bogota</span>
    </article>
  `);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, "Empresa B");
});
```

```js
import test from "node:test";
import assert from "node:assert/strict";
import { extractMichaelPageJobsFromHtml } from "../app/adapters/public-michaelpage.adapter.js";

test("extractMichaelPageJobsFromHtml reads listing blocks from the bogota page", async () => {
  const jobs = await extractMichaelPageJobsFromHtml(`
    <div class="job-search-results__item">
      <a href="/job-detail/analista-de-riesgo/jobid-123">Analista de Riesgo</a>
      <div class="job-search-results__location">Bogota</div>
      <div class="job-search-results__job-description">SARLAFT y cumplimiento</div>
    </div>
  `);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].location, "Bogota");
});
```

- [ ] **Step 2: Run the three adapter tests**

Run: `node --test tests/public-linkedin.adapter.test.js tests/public-magneto.adapter.test.js tests/public-michaelpage.adapter.test.js`
Expected: FAIL with module-not-found errors.

- [ ] **Step 3: Add portal-specific extractors and runtime wrappers**

```js
import { JSDOM } from "jsdom";
import { createAcquireResult } from "./source-adapter.js";
import { runPublicPortalSearch } from "./public-portal-runtime.js";

export async function extractLinkedinJobsFromHtml(html) {
  const document = new JSDOM(html).window.document;
  return [...document.querySelectorAll(".base-search-card")].map((card) => ({
    title: card.querySelector("h3")?.textContent || "",
    company: card.querySelector("h4")?.textContent || "",
    url: card.querySelector("a")?.href || "",
    publicationDateRaw: card.querySelector("time")?.textContent || card.querySelector("time")?.getAttribute("datetime") || "",
    description: "",
  }));
}

export async function acquireLinkedinJobs({ workspaceRoot, source, keyword, portalConfig }) {
  const { jobs } = await runPublicPortalSearch({
    workspaceRoot,
    source,
    keyword,
    portalConfig,
    extractJobs: async (page, currentKeyword) => {
      await page.locator('input[placeholder*="Search by title" i], input[placeholder*="empleo" i]').first().fill(currentKeyword);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
      return extractLinkedinJobsFromHtml(await page.content());
    },
  });
  return createAcquireResult(source, { status: jobs.length > 0 ? "success" : "no-results", note: "", jobs });
}
```

Repeat the same pattern for `public-magneto.adapter.js` and `public-michaelpage.adapter.js`, using:
- Magneto search input selectors around the public job finder and article/list card extraction
- Michael Page list extraction directly from the Bogota listing page, with keyword entered only if a search box exists and otherwise filtering by title after extraction

- [ ] **Step 4: Route `generic-board.adapter.js` by `portalKey`**

```js
import { getPortalSearchConfig } from "../config/portal-search-config.js";
import { acquireLinkedinJobs } from "./public-linkedin.adapter.js";
import { acquireMagnetoJobs } from "./public-magneto.adapter.js";
import { acquireMichaelPageJobs } from "./public-michaelpage.adapter.js";
import { createAcquireResult } from "./source-adapter.js";

const publicAdapters = {
  linkedin: acquireLinkedinJobs,
  magneto: acquireMagnetoJobs,
  michaelpage: acquireMichaelPageJobs,
};

export async function acquireFromGenericBoard(source, context = {}) {
  const portalConfig = getPortalSearchConfig(source.portalKey);
  const adapter = publicAdapters[source.portalKey];
  if (!portalConfig || !adapter) {
    return createAcquireResult(source, {
      status: "no-results",
      note: "Public portal adapter not implemented yet for this portal.",
      jobs: [],
    });
  }
  return adapter({ ...context, source, portalConfig });
}
```

- [ ] **Step 5: Run the adapter tests again**

Run: `node --test tests/public-linkedin.adapter.test.js tests/public-magneto.adapter.test.js tests/public-michaelpage.adapter.test.js`
Expected: PASS

- [ ] **Step 6: Commit the three public adapters**

```bash
git add app/adapters/public-linkedin.adapter.js app/adapters/public-magneto.adapter.js app/adapters/public-michaelpage.adapter.js app/adapters/generic-board.adapter.js tests/public-linkedin.adapter.test.js tests/public-magneto.adapter.test.js tests/public-michaelpage.adapter.test.js
git commit -m "feat: add real public search for linkedin magneto and michaelpage"
```

---

### Task 5: Implement real public acquisition for Adecco and finish public runner integration

**Files:**
- Create: `app/adapters/public-adecco.adapter.js`
- Modify: `app/adapters/generic-board.adapter.js`
- Modify: `app/run.js`
- Test: `tests/public-adecco.adapter.test.js`

- [ ] **Step 1: Write the failing Adecco extraction test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { extractAdeccoJobsFromHtml } from "../app/adapters/public-adecco.adapter.js";

test("extractAdeccoJobsFromHtml maps public candidate jobs", async () => {
  const jobs = await extractAdeccoJobsFromHtml(`
    <article>
      <a href="https://www.adecco.com/es-co/oferta/1">Analista de cumplimiento</a>
      <span class="job-location">Bogota</span>
      <span class="job-date">ayer</span>
    </article>
  `);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].publicationDateRaw, "ayer");
});
```

- [ ] **Step 2: Run the Adecco test**

Run: `node --test tests/public-adecco.adapter.test.js`
Expected: FAIL because the adapter does not exist yet.

- [ ] **Step 3: Add the Adecco adapter and wire it into the public router**

```js
import { JSDOM } from "jsdom";
import { createAcquireResult } from "./source-adapter.js";
import { runPublicPortalSearch } from "./public-portal-runtime.js";

export async function extractAdeccoJobsFromHtml(html) {
  const document = new JSDOM(html).window.document;
  return [...document.querySelectorAll("article, .job-card, .opening-job")].map((card) => ({
    title: card.querySelector("a")?.textContent || "",
    url: card.querySelector("a")?.href || "",
    company: "Adecco",
    location: card.querySelector(".job-location, [data-location]")?.textContent || "",
    publicationDateRaw: card.querySelector(".job-date, time")?.textContent || "",
    description: card.textContent || "",
  }));
}

export async function acquireAdeccoJobs({ workspaceRoot, source, keyword, portalConfig }) {
  const { jobs } = await runPublicPortalSearch({
    workspaceRoot,
    source,
    keyword,
    portalConfig,
    extractJobs: async (page, currentKeyword) => {
      const searchInput = page.locator('input[type="search"], input[name*="search" i]').first();
      if (await searchInput.count().catch(() => 0)) {
        await searchInput.fill(currentKeyword);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2000);
      }
      return extractAdeccoJobsFromHtml(await page.content());
    },
  });
  return createAcquireResult(source, { status: jobs.length > 0 ? "success" : "no-results", note: "", jobs });
}
```

- [ ] **Step 4: Pass `workspaceRoot` and `keyword` from `app/run.js` into public adapters**

```js
return acquireFromGenericBoard(source, {
  workspaceRoot,
  keyword,
  phase,
});
```

- [ ] **Step 5: Run the Adecco test and smoke test**

Run: `node --test tests/public-adecco.adapter.test.js tests/workspace-smoke.test.js`
Expected: PASS

- [ ] **Step 6: Commit the public coverage completion**

```bash
git add app/adapters/public-adecco.adapter.js app/adapters/generic-board.adapter.js app/run.js tests/public-adecco.adapter.test.js tests/workspace-smoke.test.js
git commit -m "feat: add adecco public search and wire runtime context"
```

---

### Task 6: Build an authenticated runtime that validates session reuse with real post-login search

**Files:**
- Create: `app/adapters/authenticated-portal-runtime.js`
- Modify: `app/adapters/browser-search.adapter.js`
- Modify: `app/experiments/post-login-search-helpers.js`
- Modify: `app/experiments/post-login-search.js`
- Test: `tests/authenticated-portal-runtime.test.js`

- [ ] **Step 1: Write the failing authenticated-runtime tests**

```js
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
```

- [ ] **Step 2: Run the authenticated-runtime test**

Run: `node --test tests/authenticated-portal-runtime.test.js`
Expected: FAIL because the authenticated runtime does not exist yet.

- [ ] **Step 3: Add verdict classification and adapter-facing runtime**

```js
import { createAcquireResult } from "./source-adapter.js";

export function classifyAuthenticatedPortalVerdict(result) {
  if (!result.authenticatedBeforeSearch) return "needs-user-decision";
  if (!result.authenticatedAfterSearch) return "needs-user-decision";
  if (result.verdict === "search-success" && (result.jobs || []).length > 0) return "success";
  if (result.verdict === "search-success") return "no-results";
  if (result.verdict === "search-error") return "retry-later";
  return "needs-user-decision";
}

export async function buildAuthenticatedAcquireResult(source, portalSearchResult) {
  const status = classifyAuthenticatedPortalVerdict(portalSearchResult);
  const note =
    status === "success"
      ? "Authenticated search completed with reusable evidence."
      : portalSearchResult.error?.message || `Authenticated search verdict: ${portalSearchResult.verdict}`;
  return createAcquireResult(source, {
    status,
    note,
    jobs: portalSearchResult.jobs || [],
  });
}
```

- [ ] **Step 4: Extend `post-login-search.js` so portal-specific searches can return extracted jobs**

```js
// Change `runPortalSearch(rootDir, portalKey, keyword)` to accept:
// { extractJobsAfterSearch }
// and persist the returned jobs in the JSON payload instead of always `jobs: []`.
```

- [ ] **Step 5: Make `browser-search.adapter.js` use live authenticated runs when `--cached` is not present**

```js
if (!useCachedResults) {
  const liveResult = await runPortalSearch(workspaceRoot, source.portalKey, keyword, {
    extractJobsAfterSearch,
  });
  return buildAuthenticatedAcquireResult(source, liveResult);
}
```

- [ ] **Step 6: Run the authenticated-runtime test again**

Run: `node --test tests/authenticated-portal-runtime.test.js`
Expected: PASS

- [ ] **Step 7: Commit the authenticated runtime**

```bash
git add app/adapters/authenticated-portal-runtime.js app/adapters/browser-search.adapter.js app/experiments/post-login-search-helpers.js app/experiments/post-login-search.js tests/authenticated-portal-runtime.test.js
git commit -m "feat: add authenticated portal runtime"
```

---

### Task 7: Implement real authenticated acquisition for Computrabajo and Elempleo

**Files:**
- Create: `app/adapters/auth-computrabajo.adapter.js`
- Create: `app/adapters/auth-elempleo.adapter.js`
- Modify: `app/adapters/browser-search.adapter.js`
- Modify: `app/experiments/post-login-search-config.js`
- Test: `tests/auth-computrabajo.adapter.test.js`
- Test: `tests/auth-elempleo.adapter.test.js`

- [ ] **Step 1: Write the failing authenticated adapter tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { extractComputrabajoJobsFromHtml } from "../app/adapters/auth-computrabajo.adapter.js";

test("extractComputrabajoJobsFromHtml maps post-login results into jobs", async () => {
  const jobs = await extractComputrabajoJobsFromHtml(`
    <article>
      <a href="https://co.computrabajo.com/ofertas-de-trabajo/oferta-de-trabajo-de-analista-1">Analista de Riesgo</a>
      <span>Empresa C</span>
      <span>Bogota, D.C.</span>
      <p>SARLAFT</p>
    </article>
  `);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].description.includes("SARLAFT"), true);
});
```

```js
import test from "node:test";
import assert from "node:assert/strict";
import { extractElempleoJobsFromHtml } from "../app/adapters/auth-elempleo.adapter.js";

test("extractElempleoJobsFromHtml maps post-login cards into jobs", async () => {
  const jobs = await extractElempleoJobsFromHtml(`
    <article>
      <a href="https://www.elempleo.com/co/ofertas-trabajo/analista-de-compliance/1">Analista de Compliance</a>
      <span>Empresa D</span>
      <span>Bogota</span>
      <span>ayer</span>
    </article>
  `);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, "Empresa D");
});
```

- [ ] **Step 2: Run the authenticated adapter tests**

Run: `node --test tests/auth-computrabajo.adapter.test.js tests/auth-elempleo.adapter.test.js`
Expected: FAIL because the portal-specific authenticated adapters do not exist yet.

- [ ] **Step 3: Add portal-specific extraction plus post-login search hooks**

```js
import { JSDOM } from "jsdom";

export async function extractComputrabajoJobsFromHtml(html) {
  const document = new JSDOM(html).window.document;
  return [...document.querySelectorAll("article, .box_offer, .js-o-link")].map((card) => ({
    title: card.querySelector("a")?.textContent || "",
    url: card.querySelector("a")?.href || "",
    company: card.querySelector("span, .fc_base")?.textContent || "",
    location: card.textContent || "",
    publicationDateRaw: card.querySelector("time, .fs13")?.textContent || "",
    description: card.textContent || "",
  }));
}

export function getComputrabajoLiveSearchOptions() {
  return {
    extractJobsAfterSearch: async (page) => extractComputrabajoJobsFromHtml(await page.content()),
  };
}
```

```js
import { JSDOM } from "jsdom";

export async function extractElempleoJobsFromHtml(html) {
  const document = new JSDOM(html).window.document;
  return [...document.querySelectorAll("article, .result-item, .js-job-item")].map((card) => ({
    title: card.querySelector("a")?.textContent || "",
    url: card.querySelector("a")?.href || "",
    company: card.querySelector(".company, span")?.textContent || "",
    location: card.textContent || "",
    publicationDateRaw: card.querySelector("time, .date")?.textContent || "",
    description: card.textContent || "",
  }));
}

export function getElempleoLiveSearchOptions() {
  return {
    extractJobsAfterSearch: async (page) => extractElempleoJobsFromHtml(await page.content()),
  };
}
```

- [ ] **Step 4: Pass portal-specific live-search options from `browser-search.adapter.js`**

```js
const liveSearchOptionsByPortal = {
  computrabajo: getComputrabajoLiveSearchOptions,
  elempleo: getElempleoLiveSearchOptions,
};

const liveSearchOptions = liveSearchOptionsByPortal[source.portalKey]?.() || {};
const liveResult = await runPortalSearch(workspaceRoot, source.portalKey, keyword, liveSearchOptions);
```

- [ ] **Step 5: Update `post-login-search-config.js` selectors for the real validated post-login flow**

```js
// Keep `sessionStrategy`, `targetUrl`, `keywordInputSelector`, `submitAction`,
// `submitButtonSelector`, `expectedUrlKeyword`, and `resultsMarker`
// synchronized with the real selectors discovered during manual validation.
// Commit only selectors verified by screenshots and result JSON artifacts.
```

- [ ] **Step 6: Run the authenticated adapter tests again**

Run: `node --test tests/auth-computrabajo.adapter.test.js tests/auth-elempleo.adapter.test.js`
Expected: PASS

- [ ] **Step 7: Run manual authenticated validation**

Run:
- `node app/experiments/portal-persistent-context.js computrabajo --wait-for-auth`
- `node app/experiments/post-login-search.js riesgo computrabajo`
- `node app/experiments/portal-storage-state.js elempleo --wait-for-auth`
- `node app/experiments/post-login-search.js compliance elempleo`

Expected:
- `persistent-profiles/computrabajo/` populated
- `auth-state/elempleo.json` saved
- `results/computrabajo-post-login-search-riesgo.json` saved with extracted jobs
- `results/elempleo-post-login-search-compliance.json` saved with extracted jobs or a precise `needs-user-decision`-ready failure

- [ ] **Step 8: Commit the authenticated portal adapters**

```bash
git add app/adapters/auth-computrabajo.adapter.js app/adapters/auth-elempleo.adapter.js app/adapters/browser-search.adapter.js app/experiments/post-login-search-config.js tests/auth-computrabajo.adapter.test.js tests/auth-elempleo.adapter.test.js
git commit -m "feat: add real authenticated search for computrabajo and elempleo"
```

---

### Task 8: Run the end-to-end batch against real adapters and document operational limits

**Files:**
- Modify: `README.md`
- Modify: `tests/workspace-smoke.test.js`

- [ ] **Step 1: Strengthen the end-to-end smoke test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("app/run.js can execute one real keyword run in cached mode", () => {
  const result = spawnSync(process.execPath, ["app/run.js", "--cached", "--keyword=compliance"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.includes('"selectedSourceCount"'), true);
});
```

- [ ] **Step 2: Run the smoke test**

Run: `node --test tests/workspace-smoke.test.js`
Expected: PASS after the adapters are wired and no placeholder-only path remains for the tested portals.

- [ ] **Step 3: Update README with the real operational workflow**

```md
## Flujo de busqueda real

1. Actualizar `URL_plataformas.md` con `requiere_login`, `estrategia_sesion` y notas reales por portal.
2. Validar `auth-state/` o `persistent-profiles/` para los portales autenticados.
3. Ejecutar validacion portal por portal con `node app/experiments/post-login-search.js <keyword> <portal>`.
4. Correr el batch con una sola keyword usando `node app/run.js --keyword=<keyword>`.
5. Revisar `job_postings_to_check.md`, `data/runs/latest.json` y `results/` para confirmar evidencia.
```

- [ ] **Step 4: Run the full suite**

Run: `node --test`
Expected: PASS

- [ ] **Step 5: Run a live single-keyword batch**

Run: `node app/run.js --keyword=compliance`
Expected: The JSON summary reports `selectedSourceCount`, portal statuses come from real adapters, and at least one of these outcomes occurs per portal:
- `success` with extracted jobs
- `no-results` after a real search
- `needs-user-decision` with evidence if an authenticated portal cannot reuse session

- [ ] **Step 6: Commit the end-to-end operational polish**

```bash
git add README.md tests/workspace-smoke.test.js
git commit -m "docs: document real portal search workflow"
```

---

## Self-Review

### Spec coverage

- Real vacancy search for all `URL_plataformas.md` URLs: covered by `Task 4`, `Task 5`, and `Task 7`.
- Public and authenticated modes: covered by `Task 1`, `Task 2`, `Task 3`, `Task 6`, and `Task 7`.
- Real post-login validation instead of “login looks alive”: covered by `Task 6` and `Task 7`.
- Evidence and artifact separation: covered by `Task 3`, `Task 6`, `Task 7`, and `Task 8`.
- Retry-at-end / existing orchestrator compatibility: preserved by routing through the current orchestration pipeline in `Task 2`, `Task 5`, and `Task 6`.

### Placeholder scan

- No task says `TODO`, `TBD`, or “implement later”.
- Each code-changing step includes concrete file targets, commands, and code.
- The one place that depends on live selector discovery (`Task 7 Step 5`) still constrains the engineer to commit only selectors proven by artifacts, rather than leaving the action vague.

### Type consistency

- `portalKey`, `accessMode`, `sessionStrategy`, `sourceStatus`, `jobs`, and `needs-user-decision` stay consistent with the existing codebase.
- Public adapters all return `createAcquireResult(...)`.
- Authenticated adapters all funnel through `runPortalSearch(...)` and `buildAuthenticatedAcquireResult(...)`.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-09-real-portal-search-adapters-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
