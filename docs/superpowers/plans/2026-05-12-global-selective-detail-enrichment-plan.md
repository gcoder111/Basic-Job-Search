# Global Selective Detail Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize real-detail enrichment across authenticated and public portal searches so promising cards can be validated with bounded detail reads before the strict filter runs.

**Architecture:** Move candidate selection, generic detail parsing, detail-page fetching, and job-field merging into a shared service. Keep each portal adapter responsible for card extraction and, when needed, a portal-specific detail parser, while both authenticated and public runtimes gain an `enrichJobsAfterSearch` hook that can open a bounded number of detail pages inside the existing Playwright context. The filter stays strict and unchanged; shortlist quality improves because the batch sees richer evidence, not because thresholds are relaxed.

**Tech Stack:** Node.js ESM, Playwright, JSDOM, `node:test`, existing Markdown source-of-truth docs, JSON/Markdown run artifacts.

---

## Planned File Structure

- Create: `app/services/detail-enrichment.service.js`
- Modify: `app/adapters/auth-elempleo.adapter.js`
- Modify: `app/adapters/auth-computrabajo.adapter.js`
- Modify: `app/adapters/browser-search.adapter.js`
- Modify: `app/experiments/post-login-search.js`
- Modify: `app/adapters/public-portal-runtime.js`
- Modify: `app/adapters/public-linkedin.adapter.js`
- Modify: `app/adapters/public-magneto.adapter.js`
- Modify: `app/adapters/public-adecco.adapter.js`
- Modify: `app/adapters/public-michaelpage.adapter.js`
- Modify: `app/run.js`
- Create: `tests/detail-enrichment.service.test.js`
- Modify: `tests/elempleo-detail-enrichment.integration.test.js`
- Modify: `tests/auth-computrabajo.adapter.test.js`
- Modify: `tests/post-login-search.test.js`
- Modify: `tests/public-portal-runtime.test.js`
- Modify: `docs/solutions/best-practices/selective-detail-enrichment-for-promising-portal-cards-2026-05-12.md`

### Task 1: Add the shared detail-enrichment service

**Files:**
- Create: `app/services/detail-enrichment.service.js`
- Create: `tests/detail-enrichment.service.test.js`

- [ ] **Step 1: Write the failing shared-service tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  enrichJobsWithDetails,
  extractGenericDetailFromText,
  selectPromisingDetailCandidates,
} from "../app/services/detail-enrichment.service.js";

const profile = {
  titleKeywords: ["riesgo", "cumplimiento", "compliance"],
  locationSignals: ["bogota"],
  experienceSignals: ["2 anos de experiencia"],
  educationSignals: ["ingenieria industrial", "administracion de empresas"],
  modalitySignals: ["hibrido", "presencial"],
};

test("selectPromisingDetailCandidates keeps a single-title card when preview signals already hint at fit", () => {
  const candidates = selectPromisingDetailCandidates({
    jobs: [{
      title: "Analista de Riesgo",
      url: "https://example.com/job-1",
      location: "Bogota",
      modality: "Hibrido",
      publicationDateRaw: "Ayer",
      description: "Administrador de empresas",
    }],
    profile,
    now: "2026-05-12T12:00:00.000Z",
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].job.url, "https://example.com/job-1");
});

test("selectPromisingDetailCandidates rejects a single-title card backed only by location", () => {
  const candidates = selectPromisingDetailCandidates({
    jobs: [{
      title: "Analista de Riesgo",
      url: "https://example.com/job-2",
      location: "Bogota",
      publicationDateRaw: "Ayer",
      description: "",
    }],
    profile,
    now: "2026-05-12T12:00:00.000Z",
  });

  assert.equal(candidates.length, 0);
});

test("extractGenericDetailFromText preserves full body text for later filtering", () => {
  const detail = extractGenericDetailFromText("  Riesgo operativo  hibrido  2 anos de experiencia  ");
  assert.equal(detail.description, "Riesgo operativo hibrido 2 anos de experiencia");
});

test("enrichJobsWithDetails merges fetched detail text back into promising jobs", async () => {
  const jobs = await enrichJobsWithDetails({
    jobs: [{
      title: "Analista de Riesgo",
      url: "https://example.com/job-3",
      location: "Bogota",
      modality: "Hibrido",
      publicationDateRaw: "Ayer",
      description: "Administrador de empresas",
    }],
    profile,
    now: "2026-05-12T12:00:00.000Z",
    fetchDetailText: async () => "2 anos de experiencia en cumplimiento hibrido",
  });

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].detailDescription.includes("cumplimiento"), true);
});
```

- [ ] **Step 2: Run the shared-service tests to verify they fail**

Run: `node --test tests/detail-enrichment.service.test.js`
Expected: FAIL with module-not-found because `app/services/detail-enrichment.service.js` does not exist yet.

- [ ] **Step 3: Implement the shared selection, fetch, parse, and merge service**

```js
import { normalizePublicationDate } from "../utils/normalize-date.js";
import { normalizeForMatch } from "../utils/normalize-text.js";

export const DEFAULT_DETAIL_ENRICHMENT_POLICY = {
  maxDetailViewsPerKeyword: 5,
  multiTitleMatchThreshold: 2,
  minSignalGroupsForSingleTitleMatch: 2,
  minNonLocationSignalGroupsForSingleTitleMatch: 1,
};

function normalizeList(values = []) {
  return values.map((value) => normalizeForMatch(value)).filter(Boolean);
}

function findMatches(haystack, candidates = []) {
  const normalizedCandidates = normalizeList(candidates);
  const matches = [];

  for (const candidate of normalizedCandidates) {
    if (candidate && haystack.includes(candidate) && !matches.includes(candidate)) {
      matches.push(candidate);
    }
  }

  return matches;
}

function buildSignalTokenPrefixes(values = []) {
  const prefixes = new Set();

  for (const value of normalizeList(values)) {
    for (const token of value.split(/\s+/)) {
      if (token.length < 8) {
        continue;
      }

      prefixes.add(token.slice(0, 8));
    }
  }

  return [...prefixes];
}

export function collectTitleMatches(title, profile = {}) {
  const normalizedTitle = normalizeForMatch(title);
  return normalizeList(profile.titleKeywords).filter((keyword) => normalizedTitle.includes(keyword));
}

export function collectPreviewSignals(job, profile = {}) {
  const normalizedPreview = normalizeForMatch(
    [job?.description || "", job?.location || "", job?.modality || "", job?.experience || "", job?.education || ""]
      .filter(Boolean)
      .join(" "),
  );
  const educationMatches = findMatches(normalizedPreview, profile.educationSignals);
  const fuzzyEducationMatches =
    educationMatches.length > 0
      ? educationMatches
      : buildSignalTokenPrefixes(profile.educationSignals).filter((prefix) => normalizedPreview.includes(prefix));

  return {
    location: findMatches(normalizedPreview, profile.locationSignals),
    experience: findMatches(normalizedPreview, profile.experienceSignals),
    education: fuzzyEducationMatches,
    modality: findMatches(normalizedPreview, profile.modalitySignals),
  };
}

export function countSignalGroups(matchedSignals = {}) {
  return ["location", "experience", "education", "modality"].reduce(
    (count, signalName) => count + (matchedSignals[signalName]?.length > 0 ? 1 : 0),
    0,
  );
}

export function countNonLocationSignalGroups(matchedSignals = {}) {
  return ["experience", "education", "modality"].reduce(
    (count, signalName) => count + (matchedSignals[signalName]?.length > 0 ? 1 : 0),
    0,
  );
}

export function selectPromisingDetailCandidates({ jobs = [], profile = {}, now = new Date(), policy = {} } = {}) {
  const resolvedPolicy = { ...DEFAULT_DETAIL_ENRICHMENT_POLICY, ...policy };

  return jobs
    .map((job, index) => {
      const titleMatches = collectTitleMatches(job?.title || "", profile);
      const publicationDate = normalizePublicationDate(job?.publicationDateRaw || job?.publicationDate || "", { now });
      const previewSignals = collectPreviewSignals(job, profile);

      return {
        index,
        job,
        titleMatches,
        previewSignals,
        isRecent: publicationDate.isRecent,
      };
    })
    .filter(
      ({ job, titleMatches, previewSignals, isRecent }) =>
        Boolean(job?.url) &&
        isRecent &&
        (
          titleMatches.length >= resolvedPolicy.multiTitleMatchThreshold ||
          (titleMatches.length >= 1 &&
            countSignalGroups(previewSignals) >= resolvedPolicy.minSignalGroupsForSingleTitleMatch &&
            countNonLocationSignalGroups(previewSignals) >=
              resolvedPolicy.minNonLocationSignalGroupsForSingleTitleMatch)
        ),
    )
    .sort(
      (left, right) =>
        right.titleMatches.length - left.titleMatches.length ||
        countNonLocationSignalGroups(right.previewSignals) -
          countNonLocationSignalGroups(left.previewSignals) ||
        countSignalGroups(right.previewSignals) - countSignalGroups(left.previewSignals) ||
        left.index - right.index,
    )
    .slice(0, resolvedPolicy.maxDetailViewsPerKeyword);
}

export function extractGenericDetailFromText(bodyText = "") {
  return {
    description: String(bodyText).replace(/\s+/g, " ").trim(),
  };
}

export function mergeDetailIntoJob(job, detail = {}) {
  if (!detail?.description) {
    return job;
  }

  return {
    ...job,
    detailDescription: detail.description,
    experience: detail.experience || job?.experience || "",
    education: detail.education || job?.education || "",
    detailLocation: detail.location || job?.detailLocation || "",
    detailModality: detail.modality || job?.detailModality || "",
    modality: detail.modality || job?.modality || "",
  };
}

export async function enrichJobsWithDetails({
  jobs = [],
  profile = {},
  now = new Date(),
  policy = {},
  fetchDetailText,
  parseDetailText = extractGenericDetailFromText,
} = {}) {
  if (typeof fetchDetailText !== "function" || jobs.length === 0) {
    return jobs;
  }

  const enrichedJobs = [...jobs];
  const candidates = selectPromisingDetailCandidates({ jobs, profile, now, policy });

  for (const candidate of candidates) {
    const detailText = await fetchDetailText(candidate.job);
    if (!detailText) {
      continue;
    }

    const detail = typeof detailText === "string" ? parseDetailText(detailText) : detailText;
    enrichedJobs[candidate.index] = mergeDetailIntoJob(candidate.job, detail);
  }

  return enrichedJobs;
}

export async function fetchDetailTextWithNewPage(page, jobUrl) {
  const detailPage = await page.context().newPage();

  try {
    await detailPage.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await detailPage.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => {});
    await detailPage.waitForTimeout(1000);
    return await detailPage.locator("body").innerText();
  } finally {
    await detailPage.close().catch(() => {});
  }
}
```

- [ ] **Step 4: Run the shared-service tests again**

Run: `node --test tests/detail-enrichment.service.test.js`
Expected: PASS

- [ ] **Step 5: Commit the shared service**

```bash
git add app/services/detail-enrichment.service.js tests/detail-enrichment.service.test.js
git commit -m "feat: add shared detail enrichment service"
```

---

### Task 2: Refactor Elempleo to use the shared service and expose a separate enrichment hook

**Files:**
- Modify: `app/adapters/auth-elempleo.adapter.js`
- Modify: `tests/elempleo-detail-enrichment.integration.test.js`

- [ ] **Step 1: Add a failing test for the new live-search hook shape**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { getElempleoLiveSearchOptions } from "../app/adapters/auth-elempleo.adapter.js";

test("Elempleo live search options expose extract and enrich hooks separately", () => {
  const options = getElempleoLiveSearchOptions({
    profile: {
      titleKeywords: ["riesgo", "cumplimiento"],
      locationSignals: ["bogota"],
      experienceSignals: ["2 anos de experiencia"],
      educationSignals: ["ingenieria industrial", "administracion de empresas"],
      modalitySignals: ["hibrido"],
    },
    now: "2026-05-12T12:00:00.000Z",
  });

  assert.equal(typeof options.extractJobsAfterSearch, "function");
  assert.equal(typeof options.enrichJobsAfterSearch, "function");
});
```

- [ ] **Step 2: Run the Elempleo detail tests to verify the new assertion fails**

Run: `node --test tests/elempleo-detail-enrichment.integration.test.js`
Expected: FAIL because `getElempleoLiveSearchOptions` still performs enrichment inside `extractJobsAfterSearch` and does not expose `enrichJobsAfterSearch`.

- [ ] **Step 3: Replace the local selector logic with shared wrappers and split the hooks**

```js
import { JSDOM } from "jsdom";
import { extractElempleoDetailFromText } from "./auth-elempleo-detail.adapter.js";
import {
  DEFAULT_DETAIL_ENRICHMENT_POLICY,
  enrichJobsWithDetails,
  fetchDetailTextWithNewPage,
  selectPromisingDetailCandidates,
} from "../services/detail-enrichment.service.js";

export const MAX_ELEMPLEO_DETAIL_VIEWS_PER_KEYWORD = 5;

const elempleoDetailPolicy = {
  ...DEFAULT_DETAIL_ENRICHMENT_POLICY,
  maxDetailViewsPerKeyword: MAX_ELEMPLEO_DETAIL_VIEWS_PER_KEYWORD,
};

export function selectElempleoDetailCandidates({ jobs = [], profile = {}, now = new Date() } = {}) {
  return selectPromisingDetailCandidates({
    jobs,
    profile,
    now,
    policy: elempleoDetailPolicy,
  });
}

export async function enrichElempleoJobsWithDetails({
  jobs = [],
  profile = {},
  now = new Date(),
  fetchDetailText,
} = {}) {
  return enrichJobsWithDetails({
    jobs,
    profile,
    now,
    policy: elempleoDetailPolicy,
    fetchDetailText,
    parseDetailText: (detailText) =>
      typeof detailText === "string" ? extractElempleoDetailFromText(detailText) : detailText,
  });
}

export function getElempleoLiveSearchOptions({ profile = {}, now = new Date() } = {}) {
  return {
    extractJobsAfterSearch: async (page) => extractElempleoJobsFromHtml(await page.content()),
    enrichJobsAfterSearch: async ({ page, jobs }) =>
      enrichElempleoJobsWithDetails({
        jobs,
        profile,
        now,
        fetchDetailText: async (job) => fetchDetailTextWithNewPage(page, job.url),
      }),
  };
}
```

- [ ] **Step 4: Run the Elempleo regression tests again**

Run: `node --test tests/elempleo-detail-enrichment.integration.test.js tests/auth-elempleo.adapter.test.js`
Expected: PASS

- [ ] **Step 5: Commit the Elempleo refactor**

```bash
git add app/adapters/auth-elempleo.adapter.js tests/elempleo-detail-enrichment.integration.test.js
git commit -m "refactor: move elempleo detail enrichment onto shared service"
```

---

### Task 3: Add the authenticated runtime enrichment hook and enable Computrabajo

**Files:**
- Modify: `app/adapters/auth-computrabajo.adapter.js`
- Modify: `app/adapters/browser-search.adapter.js`
- Modify: `app/experiments/post-login-search.js`
- Modify: `tests/auth-computrabajo.adapter.test.js`
- Modify: `tests/post-login-search.test.js`

- [ ] **Step 1: Add failing tests for the authenticated enrichment hook**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { getComputrabajoLiveSearchOptions } from "../app/adapters/auth-computrabajo.adapter.js";
import { applyLiveSearchEnrichment } from "../app/experiments/post-login-search.js";

test("Computrabajo live search options expose extract and enrich hooks", () => {
  const options = getComputrabajoLiveSearchOptions({
    profile: {
      titleKeywords: ["riesgo"],
      locationSignals: ["bogota"],
      experienceSignals: ["2 anos de experiencia"],
      educationSignals: ["ingenieria industrial"],
      modalitySignals: ["hibrido"],
    },
    now: "2026-05-12T12:00:00.000Z",
  });

  assert.equal(typeof options.extractJobsAfterSearch, "function");
  assert.equal(typeof options.enrichJobsAfterSearch, "function");
});

test("applyLiveSearchEnrichment passes page, jobs, portalKey, and keyword to the optional hook", async () => {
  const page = { kind: "fake-page" };
  const jobs = [{ title: "Analista de Riesgo", url: "https://example.com/job-4" }];

  const enriched = await applyLiveSearchEnrichment({
    page,
    portalKey: "computrabajo",
    keyword: "riesgo",
    jobs,
    options: {
      enrichJobsAfterSearch: async (context) => {
        assert.equal(context.page, page);
        assert.equal(context.portalKey, "computrabajo");
        assert.equal(context.keyword, "riesgo");
        return context.jobs.map((job) => ({ ...job, detailDescription: "cumplimiento hibrido" }));
      },
    },
  });

  assert.equal(enriched[0].detailDescription, "cumplimiento hibrido");
});
```

- [ ] **Step 2: Run the authenticated-detail tests to verify they fail**

Run: `node --test tests/auth-computrabajo.adapter.test.js tests/post-login-search.test.js`
Expected: FAIL because `getComputrabajoLiveSearchOptions` does not expose `enrichJobsAfterSearch` and `applyLiveSearchEnrichment` does not exist yet.

- [ ] **Step 3: Implement the generic authenticated hook and wire Computrabajo into it**

```js
// app/adapters/auth-computrabajo.adapter.js
import { JSDOM } from "jsdom";
import {
  DEFAULT_DETAIL_ENRICHMENT_POLICY,
  enrichJobsWithDetails,
  extractGenericDetailFromText,
  fetchDetailTextWithNewPage,
} from "../services/detail-enrichment.service.js";

export const MAX_COMPUTRABAJO_DETAIL_VIEWS_PER_KEYWORD = 5;

const computrabajoDetailPolicy = {
  ...DEFAULT_DETAIL_ENRICHMENT_POLICY,
  maxDetailViewsPerKeyword: MAX_COMPUTRABAJO_DETAIL_VIEWS_PER_KEYWORD,
};

export async function enrichComputrabajoJobsWithDetails({
  jobs = [],
  profile = {},
  now = new Date(),
  fetchDetailText,
} = {}) {
  return enrichJobsWithDetails({
    jobs,
    profile,
    now,
    policy: computrabajoDetailPolicy,
    fetchDetailText,
    parseDetailText: extractGenericDetailFromText,
  });
}

export function getComputrabajoLiveSearchOptions({ profile = {}, now = new Date() } = {}) {
  return {
    extractJobsAfterSearch: async (page) => extractComputrabajoJobsFromHtml(await page.content()),
    enrichJobsAfterSearch: async ({ page, jobs }) =>
      enrichComputrabajoJobsWithDetails({
        jobs,
        profile,
        now,
        fetchDetailText: async (job) => fetchDetailTextWithNewPage(page, job.url),
      }),
  };
}
```

```js
// app/experiments/post-login-search.js
export async function applyLiveSearchEnrichment({
  page,
  portalKey,
  keyword,
  jobs = [],
  options = {},
} = {}) {
  if (typeof options.enrichJobsAfterSearch !== "function") {
    return jobs;
  }

  return options.enrichJobsAfterSearch({
    page,
    portalKey,
    keyword,
    jobs,
  });
}

// inside runPortalSearch(...)
const extractedJobs = extractJobsAfterSearch ? await extractJobsAfterSearch(page) : [];
const jobs = await applyLiveSearchEnrichment({
  page,
  portalKey,
  keyword,
  jobs: extractedJobs,
  options,
});
```

```js
// app/adapters/browser-search.adapter.js
const liveSearchOptionsByPortal = {
  computrabajo: () => getComputrabajoLiveSearchOptions({ profile, now }),
  elempleo: () => getElempleoLiveSearchOptions({ profile, now }),
};
```

```js
// app/experiments/post-login-search.js CLI path
const liveSearchOptionsByPortal = {
  computrabajo: () => getComputrabajoLiveSearchOptions({ profile, now: new Date() }),
  elempleo: () => getElempleoLiveSearchOptions({ profile, now: new Date() }),
};
```

- [ ] **Step 4: Run the authenticated-detail tests again**

Run: `node --test tests/auth-computrabajo.adapter.test.js tests/post-login-search.test.js`
Expected: PASS

- [ ] **Step 5: Commit the authenticated hook**

```bash
git add app/adapters/auth-computrabajo.adapter.js app/adapters/browser-search.adapter.js app/experiments/post-login-search.js tests/auth-computrabajo.adapter.test.js tests/post-login-search.test.js
git commit -m "feat: add authenticated detail enrichment hook"
```

---

### Task 4: Add the public runtime enrichment hook and enable all public adapters

**Files:**
- Modify: `app/adapters/public-portal-runtime.js`
- Modify: `app/adapters/public-linkedin.adapter.js`
- Modify: `app/adapters/public-magneto.adapter.js`
- Modify: `app/adapters/public-adecco.adapter.js`
- Modify: `app/adapters/public-michaelpage.adapter.js`
- Modify: `app/run.js`
- Modify: `tests/public-portal-runtime.test.js`

- [ ] **Step 1: Add a failing test for public-job enrichment after normalization and dedupe**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { finalizePublicJobs } from "../app/adapters/public-portal-runtime.js";

test("finalizePublicJobs normalizes, dedupes, and then applies optional enrichment", async () => {
  const jobs = await finalizePublicJobs({
    extractedJobs: [
      { title: "Analista de Riesgo", url: "https://example.com/job-5", publicationDateRaw: "Ayer" },
      { title: "Duplicado", url: "https://example.com/job-5", publicationDateRaw: "Ayer" },
    ],
    source: { portalKey: "linkedin" },
    keyword: "riesgo",
    page: { kind: "fake-page" },
    enrichJobsAfterSearch: async ({ jobs: currentJobs }) =>
      currentJobs.map((job) => ({ ...job, detailDescription: "2 anos de experiencia hibrido" })),
  });

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].detailDescription.includes("2 anos"), true);
});
```

- [ ] **Step 2: Run the public-runtime tests to verify they fail**

Run: `node --test tests/public-portal-runtime.test.js`
Expected: FAIL because `finalizePublicJobs` does not exist yet.

- [ ] **Step 3: Add the public runtime hook and enable each public adapter with the shared service**

```js
// app/adapters/public-portal-runtime.js
import path from "node:path";
import { chromium } from "playwright";
import { buildKeywordSlug } from "../experiments/post-login-search-helpers.js";
import { cleanupJob } from "../utils/job-cleanup.js";
import { normalizeForMatch } from "../utils/normalize-text.js";
import { writeJsonFile } from "../utils/safe-json.js";

export async function runPublicPortalSearch({
  workspaceRoot,
  source,
  keyword,
  portalConfig,
  extractJobs,
  enrichJobsAfterSearch,
}) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const keywordSlug = buildKeywordSlug(keyword);
  const resultPath = path.join(
    workspaceRoot,
    "results",
    `${source.portalKey}-public-search-${keywordSlug}.json`,
  );
  const screenshotPath = path.join(
    workspaceRoot,
    "results",
    `${source.portalKey}-public-search-${keywordSlug}.png`,
  );

  try {
    await page.goto(portalConfig.startUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const extractedJobs = await extractJobs(page, keyword);
    const jobs = await finalizePublicJobs({
      extractedJobs,
      source,
      keyword,
      page,
      enrichJobsAfterSearch,
    });

    await page.screenshot({ path: screenshotPath, fullPage: true });
    await writeJsonFile(resultPath, {
      portal: source.portalKey,
      keyword,
      verdict: jobs.length > 0 ? "search-success" : "no-results",
      jobCount: jobs.length,
      jobs,
      screenshotPath,
    });

    return {
      jobs,
      resultPath,
      screenshotPath,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

export async function finalizePublicJobs({
  extractedJobs = [],
  source,
  keyword,
  page,
  enrichJobsAfterSearch,
} = {}) {
  const normalizedJobs = trimJobsToUniqueUrls(normalizeExtractedJobs(extractedJobs));

  if (typeof enrichJobsAfterSearch !== "function") {
    return normalizedJobs;
  }

  return enrichJobsAfterSearch({
    page,
    source,
    keyword,
    jobs: normalizedJobs,
  });
}
```

```js
// app/adapters/public-linkedin.adapter.js
import {
  DEFAULT_DETAIL_ENRICHMENT_POLICY,
  enrichJobsWithDetails,
  extractGenericDetailFromText,
  fetchDetailTextWithNewPage,
} from "../services/detail-enrichment.service.js";

const linkedinDetailPolicy = {
  ...DEFAULT_DETAIL_ENRICHMENT_POLICY,
  maxDetailViewsPerKeyword: 5,
};

export async function acquireLinkedinJobs({
  workspaceRoot,
  source,
  keyword,
  portalConfig,
  profile = {},
  now = new Date(),
}) {
  const { jobs } = await runPublicPortalSearch({
    workspaceRoot,
    source,
    keyword,
    portalConfig: {
      startUrl: portalConfig.startUrl || source.url,
    },
    extractJobs: async (page, currentKeyword) => {
      await page
        .locator('input[placeholder*="Search by title" i], input[placeholder*="empleo" i]')
        .first()
        .fill(currentKeyword);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
      return extractLinkedinJobsFromHtml(await page.content());
    },
    enrichJobsAfterSearch: async ({ page, jobs: extractedJobs }) =>
      enrichJobsWithDetails({
        jobs: extractedJobs,
        profile,
        now,
        policy: linkedinDetailPolicy,
        fetchDetailText: async (job) => fetchDetailTextWithNewPage(page, job.url),
        parseDetailText: extractGenericDetailFromText,
      }),
  });

  return createAcquireResult(source, {
    status: jobs.length > 0 ? "success" : "no-results",
    note: "",
    jobs,
  });
}
```

```js
// app/run.js
const runNow = new Date();
const browserAdapter = createBrowserSearchAdapter({
  workspaceRoot,
  keyword,
  profile,
  now: runNow,
  useCachedResults,
});

const runSummary = await orchestrateSearch({
  sources: allSources,
  profile,
  now: runNow,
  acquireJobs: async (source, phase) => {
    const portalConfig = getPortalSearchConfig(source.portalKey);
    const accessMode = portalConfig?.accessMode || (source.requiresAuth ? "authenticated" : "public");

    if (accessMode === "authenticated") {
      return browserAdapter(source, phase);
    }

    return source.portalKey
      ? acquireFromGenericBoard(source, {
          workspaceRoot,
          keyword,
          phase,
          useCachedResults,
          profile,
          now: runNow,
        })
      : acquireFromAtsPage(source);
  },
});
```

- [ ] **Step 4: Implement the remaining public adapters with the shared-service wiring**

```js
// app/adapters/public-magneto.adapter.js
import {
  DEFAULT_DETAIL_ENRICHMENT_POLICY,
  enrichJobsWithDetails,
  extractGenericDetailFromText,
  fetchDetailTextWithNewPage,
} from "../services/detail-enrichment.service.js";

const magnetoDetailPolicy = {
  ...DEFAULT_DETAIL_ENRICHMENT_POLICY,
  maxDetailViewsPerKeyword: 5,
};

export async function acquireMagnetoJobs({
  workspaceRoot,
  source,
  keyword,
  portalConfig,
  profile = {},
  now = new Date(),
}) {
  const { jobs } = await runPublicPortalSearch({
    workspaceRoot,
    source,
    keyword,
    portalConfig: {
      startUrl: portalConfig.startUrl || source.url,
    },
    extractJobs: async (page, currentKeyword) => {
      const searchInput = page
        .locator('input[type="search"], input[name*="cargo" i], input[placeholder*="cargo" i]')
        .first();

      if ((await searchInput.count().catch(() => 0)) > 0) {
        await searchInput.fill(currentKeyword);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2000);
      }

      return extractMagnetoJobsFromHtml(await page.content());
    },
    enrichJobsAfterSearch: async ({ page, jobs: extractedJobs }) =>
      enrichJobsWithDetails({
        jobs: extractedJobs,
        profile,
        now,
        policy: magnetoDetailPolicy,
        fetchDetailText: async (job) => fetchDetailTextWithNewPage(page, job.url),
        parseDetailText: extractGenericDetailFromText,
      }),
  });

  return createAcquireResult(source, {
    status: jobs.length > 0 ? "success" : "no-results",
    note: "",
    jobs,
  });
}
```

```js
// app/adapters/public-adecco.adapter.js
import {
  DEFAULT_DETAIL_ENRICHMENT_POLICY,
  enrichJobsWithDetails,
  extractGenericDetailFromText,
  fetchDetailTextWithNewPage,
} from "../services/detail-enrichment.service.js";

const adeccoDetailPolicy = {
  ...DEFAULT_DETAIL_ENRICHMENT_POLICY,
  maxDetailViewsPerKeyword: 5,
};

export async function acquireAdeccoJobs({
  workspaceRoot,
  source,
  keyword,
  portalConfig,
  profile = {},
  now = new Date(),
}) {
  const { jobs } = await runPublicPortalSearch({
    workspaceRoot,
    source,
    keyword,
    portalConfig: {
      startUrl: portalConfig.startUrl || source.url,
    },
    extractJobs: async (page, currentKeyword) => {
      const searchInput = page
        .locator('input[type="search"], input[name*="search" i]')
        .first();

      if ((await searchInput.count().catch(() => 0)) > 0) {
        await searchInput.fill(currentKeyword);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2000);
      }

      return extractAdeccoJobsFromHtml(await page.content());
    },
    enrichJobsAfterSearch: async ({ page, jobs: extractedJobs }) =>
      enrichJobsWithDetails({
        jobs: extractedJobs,
        profile,
        now,
        policy: adeccoDetailPolicy,
        fetchDetailText: async (job) => fetchDetailTextWithNewPage(page, job.url),
        parseDetailText: extractGenericDetailFromText,
      }),
  });

  return createAcquireResult(source, {
    status: jobs.length > 0 ? "success" : "no-results",
    note: "",
    jobs,
  });
}
```

```js
// app/adapters/public-michaelpage.adapter.js
import {
  DEFAULT_DETAIL_ENRICHMENT_POLICY,
  enrichJobsWithDetails,
  extractGenericDetailFromText,
  fetchDetailTextWithNewPage,
} from "../services/detail-enrichment.service.js";

const michaelPageDetailPolicy = {
  ...DEFAULT_DETAIL_ENRICHMENT_POLICY,
  maxDetailViewsPerKeyword: 5,
};

export async function acquireMichaelPageJobs({
  workspaceRoot,
  source,
  keyword,
  portalConfig,
  profile = {},
  now = new Date(),
}) {
  const { jobs } = await runPublicPortalSearch({
    workspaceRoot,
    source,
    keyword,
    portalConfig: {
      startUrl: portalConfig.startUrl || source.url,
    },
    extractJobs: async (page, currentKeyword) => {
      const searchInput = page
        .locator('input[type="search"], input[name*="search" i], input[placeholder*="search" i]')
        .first();

      if ((await searchInput.count().catch(() => 0)) > 0) {
        await searchInput.fill(currentKeyword);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2000);
      }

      const extractedJobs = await extractMichaelPageJobsFromHtml(await page.content());
      const normalizedKeyword = normalizeForMatch(currentKeyword);

      return extractedJobs.filter((job) =>
        normalizeForMatch(`${job.title} ${job.description}`).includes(normalizedKeyword),
      );
    },
    enrichJobsAfterSearch: async ({ page, jobs: extractedJobs }) =>
      enrichJobsWithDetails({
        jobs: extractedJobs,
        profile,
        now,
        policy: michaelPageDetailPolicy,
        fetchDetailText: async (job) => fetchDetailTextWithNewPage(page, job.url),
        parseDetailText: extractGenericDetailFromText,
      }),
  });

  return createAcquireResult(source, {
    status: jobs.length > 0 ? "success" : "no-results",
    note: "",
    jobs,
  });
}
```

- [ ] **Step 5: Run the public-runtime regression tests**

Run: `node --test tests/public-portal-runtime.test.js tests/public-linkedin.adapter.test.js tests/public-magneto.adapter.test.js tests/public-adecco.adapter.test.js tests/public-michaelpage.adapter.test.js`
Expected: PASS

- [ ] **Step 6: Commit the public hook**

```bash
git add app/adapters/public-portal-runtime.js app/adapters/public-linkedin.adapter.js app/adapters/public-magneto.adapter.js app/adapters/public-adecco.adapter.js app/adapters/public-michaelpage.adapter.js app/run.js tests/public-portal-runtime.test.js
git commit -m "feat: add public portal detail enrichment hook"
```

---

### Task 5: Run the full regression and document the now-global pattern

**Files:**
- Modify: `docs/solutions/best-practices/selective-detail-enrichment-for-promising-portal-cards-2026-05-12.md`

- [ ] **Step 1: Run the focused regression suite**

Run: `node --test tests/detail-enrichment.service.test.js tests/elempleo-detail-enrichment.integration.test.js tests/auth-computrabajo.adapter.test.js tests/post-login-search.test.js tests/public-portal-runtime.test.js`
Expected: PASS

- [ ] **Step 2: Run the full test suite**

Run: `node --test`
Expected: PASS

- [ ] **Step 3: Re-run the live Elempleo batch as the authenticated proof point**

Run: `node scripts/run-elempleo-batch.js`
Expected: the batch finishes successfully, refreshes `results/elempleo-batch-summary-latest.json`, and does not regress the already rescued `analista-gestion-de-riesgos-1886710001` vacancy back to `missing-description-signals`.

- [ ] **Step 4: Update the best-practice doc so it reflects both runtime families**

```md
## Architecture update

The reusable pattern is now implemented in one shared service and consumed by both runtime families:

- authenticated portals use `runPortalSearch(..., { enrichJobsAfterSearch })`
- public portals use `runPublicPortalSearch(..., { enrichJobsAfterSearch })`
- each portal keeps its own card extractor
- only portals that need structured detail parsing, such as `Elempleo`, add a custom parser
- all other portals can start with the generic body-text parser and still benefit from stricter evidence before filtering
```

- [ ] **Step 5: Commit the verification and docs**

```bash
git add docs/solutions/best-practices/selective-detail-enrichment-for-promising-portal-cards-2026-05-12.md results data/runs
git commit -m "docs: record global detail enrichment rollout"
```

---

## Self-Review

### Spec coverage

- Preserves the current business rule that title, recency, and useful description signals still decide shortlist eligibility: covered by `Task 1`, `Task 2`, and the unchanged `filter-jobs.service.js`.
- Makes the promising-card rescue reusable across authenticated and public platforms: covered by `Task 3` and `Task 4`.
- Keeps the batch bounded instead of opening every detail page: covered by `DEFAULT_DETAIL_ENRICHMENT_POLICY.maxDetailViewsPerKeyword`.
- Leaves Markdown source-of-truth business rules untouched: no task moves business criteria out of `job-search-profile.md`.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every code-changing step includes exact file paths, code snippets, commands, and expected outcomes.

### Type consistency

- `detailDescription`, `experience`, `education`, `detailLocation`, `detailModality`, and `modality` are used consistently in the shared merge contract.
- Both runtimes use the same `enrichJobsAfterSearch({ page, portalKey/source, keyword, jobs })` shape.
- The shared selector always receives `jobs`, `profile`, `now`, and `policy` with the same property names.

---

## Execution Preference

- Selected execution mode: `1. Subagent-Driven (recommended)`
- Required sub-skill at execution time: `superpowers:subagent-driven-development`
- Status: approved to execute later, but intentionally not started in this session
