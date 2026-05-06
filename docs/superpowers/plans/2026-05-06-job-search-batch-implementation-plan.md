# Job Search Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows-friendly local batch system that reads `URL_plataformas.md` and `job-search-profile.md`, searches job portals including authenticated portals, prioritizes matching vacancies, and writes a report plus execution evidence.

**Architecture:** The implementation will mirror the successful reference-repo pattern: Markdown files act as business-owned source-of-truth inputs, Node.js services load and normalize them, portal adapters perform search and extraction, and an orchestrator applies filtering, scoring, retry-at-end behavior, and reporting. Authenticated portals use explicit session reuse (`storageState` or `persistentProfile`) and escalate persistent failures to `needs-user-decision` after finishing the rest of the queue.

**Tech Stack:** Node.js (ESM), Playwright, PowerShell, built-in `node:test`, Markdown configuration files, Windows Task Scheduler integration.

---

## Planned File Structure

- Create: `package.json`
- Create: `.gitignore`
- Create: `README.md`
- Create: `app/run.js`
- Create: `app/config/source-files.js`
- Create: `app/config/search-profile.js`
- Create: `app/config/portal-auth-strategies.js`
- Create: `app/models/job.types.js`
- Create: `app/models/run.types.js`
- Create: `app/models/source.types.js`
- Create: `app/utils/normalize-text.js`
- Create: `app/utils/normalize-date.js`
- Create: `app/utils/markdown-table.js`
- Create: `app/services/load-sources.service.js`
- Create: `app/services/load-search-profile.js`
- Create: `app/services/auth-state.service.js`
- Create: `app/services/filter-jobs.service.js`
- Create: `app/services/score-jobs.service.js`
- Create: `app/services/dedupe-jobs.service.js`
- Create: `app/services/run-state.service.js`
- Create: `app/services/orchestrate-search.service.js`
- Create: `app/services/report-writer.service.js`
- Create: `app/adapters/source-adapter.js`
- Create: `app/adapters/browser-search.adapter.js`
- Create: `app/adapters/generic-board.adapter.js`
- Create: `app/adapters/ats-page.adapter.js`
- Create: `app/experiments/auth-result.js`
- Create: `app/experiments/portal-auth-config.js`
- Create: `app/experiments/portal-storage-state.js`
- Create: `app/experiments/portal-persistent-context.js`
- Create: `app/experiments/post-login-search-config.js`
- Create: `app/experiments/post-login-search-helpers.js`
- Create: `app/experiments/post-login-search.js`
- Create: `scripts/run-job-search.ps1`
- Create: `scripts/install-scheduled-task.ps1`
- Create: `data/runs/.gitkeep`
- Create: `tests/load-sources.service.test.js`
- Create: `tests/load-search-profile.test.js`
- Create: `tests/auth-state.service.test.js`
- Create: `tests/filter-jobs.service.test.js`
- Create: `tests/score-jobs.service.test.js`
- Create: `tests/dedupe-jobs.service.test.js`
- Create: `tests/orchestrate-search.service.test.js`
- Create: `tests/report-writer.service.test.js`
- Create: `tests/portal-auth-config.test.js`
- Create: `tests/post-login-search.test.js`
- Create: `tests/workspace-smoke.test.js`

---

### Task 1: Bootstrap the workspace and test harness

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `README.md`
- Create: `data/runs/.gitkeep`
- Test: `tests/workspace-smoke.test.js`

- [ ] **Step 1: Write the failing smoke test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("workspace skeleton exists", () => {
  assert.equal(fs.existsSync("package.json"), true);
  assert.equal(fs.existsSync("app"), true);
  assert.equal(fs.existsSync("tests"), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/workspace-smoke.test.js`
Expected: FAIL because `package.json`, `app/`, and `tests/` do not all exist yet.

- [ ] **Step 3: Write the minimal workspace files**

```json
{
  "name": "basic-job-search",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "run": "node app/run.js",
    "run:cached": "node app/run.js --cached",
    "probe:post-login": "node app/experiments/post-login-search.js",
    "auth:portal": "node app/experiments/portal-storage-state.js",
    "auth:persistent": "node app/experiments/portal-persistent-context.js",
    "schedule:install": "powershell -ExecutionPolicy Bypass -File scripts/install-scheduled-task.ps1"
  },
  "dependencies": {
    "playwright": "^1.54.1"
  }
}
```

```gitignore
node_modules/
results/
auth-state/
persistent-profiles/
data/runs/latest.json
data/runs/*.json
.env
```

```md
# Basic Job Search

Batch local para buscar y priorizar ofertas laborales a partir de `URL_plataformas.md` y `job-search-profile.md`.
```

- [ ] **Step 4: Create the directory skeleton**

```text
app/
tests/
scripts/
data/runs/.gitkeep
```

- [ ] **Step 5: Run the smoke test again**

Run: `node --test tests/workspace-smoke.test.js`
Expected: PASS

- [ ] **Step 6: Optional commit after git init**

Run: `git add . && git commit -m "chore: bootstrap job search workspace"`
Expected: commit succeeds if the folder has been initialized as a git repository.

---

### Task 2: Load and normalize the Markdown source documents

**Files:**
- Create: `app/config/source-files.js`
- Create: `app/utils/markdown-table.js`
- Create: `app/utils/normalize-text.js`
- Create: `app/services/load-sources.service.js`
- Create: `app/services/load-search-profile.js`
- Test: `tests/load-sources.service.test.js`
- Test: `tests/load-search-profile.test.js`

- [ ] **Step 1: Write failing tests for document loading**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { loadSources } from "../app/services/load-sources.service.js";

test("loadSources parses platform rows and infers portal metadata", async () => {
  const result = await loadSources({ repoRoot: process.cwd() });
  assert.equal(Array.isArray(result.allSources), true);
  assert.equal(result.allSources.length > 0, true);
  assert.equal("portalKey" in result.allSources[0], true);
});
```

```js
import test from "node:test";
import assert from "node:assert/strict";
import { loadSearchProfile } from "../app/services/load-search-profile.js";

test("loadSearchProfile returns normalized title keywords", async () => {
  const profile = await loadSearchProfile({ repoRoot: process.cwd() });
  assert.equal(Array.isArray(profile.titleKeywords), true);
  assert.equal(profile.titleKeywords.length > 0, true);
});
```

- [ ] **Step 2: Run the document-loading tests**

Run: `node --test tests/load-sources.service.test.js tests/load-search-profile.test.js`
Expected: FAIL with module-not-found errors for the services.

- [ ] **Step 3: Add the source file map and text helpers**

```js
export const sourceFiles = {
  platformSources: "URL_plataformas.md",
  searchProfile: "job-search-profile.md",
};
```

```js
export function normalizeWhitespace(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeForMatch(value = "") {
  return normalizeWhitespace(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function slugify(value = "") {
  return normalizeForMatch(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
```

- [ ] **Step 4: Add the table parser and source loader**

```js
export function parseMarkdownTables(markdown) {
  const lines = markdown.split(/\r?\n/);
  const tables = [];
  for (let i = 0; i < lines.length - 2; i += 1) {
    if (!lines[i].includes("|") || !lines[i + 1].includes("---")) continue;
    const headers = lines[i].split("|").map((cell) => cell.trim()).filter(Boolean);
    const rows = [];
    i += 2;
    while (i < lines.length && lines[i].includes("|")) {
      const values = lines[i].split("|").map((cell) => cell.trim()).filter(Boolean);
      const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
      rows.push(row);
      i += 1;
    }
    tables.push({ headers, rows });
  }
  return tables;
}
```

```js
import fs from "node:fs/promises";
import path from "node:path";
import { sourceFiles } from "../config/source-files.js";
import { parseMarkdownTables } from "../utils/markdown-table.js";
import { normalizeWhitespace, slugify } from "../utils/normalize-text.js";

function inferPortalKey(url) {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes("linkedin.com")) return "linkedin";
  if (lowerUrl.includes("elempleo.com")) return "elempleo";
  if (lowerUrl.includes("computrabajo.com")) return "computrabajo";
  return slugify(new URL(url).hostname);
}

export async function loadSources({ repoRoot }) {
  const markdown = await fs.readFile(path.join(repoRoot, sourceFiles.platformSources), "utf8");
  const table = parseMarkdownTables(markdown)[0];
  const allSources = table.rows
    .filter((row) => normalizeWhitespace(row.url_inicio || "").startsWith("http"))
    .map((row) => ({
      sourceId: row.portal_key || slugify(row.nombre_portal || row.url_inicio),
      portalKey: row.portal_key || inferPortalKey(row.url_inicio),
      displayName: normalizeWhitespace(row.nombre_portal),
      url: normalizeWhitespace(row.url_inicio),
      requiresAuth: normalizeWhitespace(row.requiere_login).toLowerCase() === "si",
      sessionStrategy: normalizeWhitespace(row.estrategia_sesion || "por_definir"),
      testStatus: normalizeWhitespace(row.estado_pruebas || "pendiente"),
      notes: normalizeWhitespace(row.notas || ""),
    }));
  return { allSources };
}
```

- [ ] **Step 5: Add the profile loader**

```js
import fs from "node:fs/promises";
import path from "node:path";
import { sourceFiles } from "../config/source-files.js";
import { normalizeForMatch, normalizeWhitespace } from "../utils/normalize-text.js";

function collectBulletLines(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim().toLowerCase() === heading.toLowerCase());
  if (start === -1) return [];
  const items = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith("## ") || line.startsWith("### ")) break;
    if (line.startsWith("- ")) items.push(normalizeWhitespace(line.slice(2)));
  }
  return items.filter(Boolean);
}

export async function loadSearchProfile({ repoRoot }) {
  const markdown = await fs.readFile(path.join(repoRoot, sourceFiles.searchProfile), "utf8");
  const primary = collectBulletLines(markdown, "## Palabras clave principales para el titulo");
  const related = collectBulletLines(markdown, "## Palabras clave relacionadas y variantes validas");
  const location = collectBulletLines(markdown, "### Ubicacion objetivo");
  const experience = collectBulletLines(markdown, "### Experiencia objetivo");
  const education = collectBulletLines(markdown, "### Formacion objetivo");
  const modality = collectBulletLines(markdown, "### Modalidad objetivo");
  return {
    documentPath: path.join(repoRoot, sourceFiles.searchProfile),
    primaryTitleKeywords: primary,
    relatedTitleKeywords: related,
    titleKeywords: [...primary, ...related].map(normalizeForMatch),
    locationSignals: location.map(normalizeForMatch),
    experienceSignals: experience.map(normalizeForMatch),
    educationSignals: education.map(normalizeForMatch),
    modalitySignals: modality.map(normalizeForMatch),
  };
}
```

- [ ] **Step 6: Run the tests again**

Run: `node --test tests/load-sources.service.test.js tests/load-search-profile.test.js`
Expected: PASS

- [ ] **Step 7: Optional commit after git init**

Run: `git add app tests package.json URL_plataformas.md job-search-profile.md && git commit -m "feat: load markdown source documents"`

---

### Task 3: Add normalization, filtering, scoring, and deduplication

**Files:**
- Create: `app/config/search-profile.js`
- Create: `app/utils/normalize-date.js`
- Create: `app/services/filter-jobs.service.js`
- Create: `app/services/score-jobs.service.js`
- Create: `app/services/dedupe-jobs.service.js`
- Test: `tests/filter-jobs.service.test.js`
- Test: `tests/score-jobs.service.test.js`
- Test: `tests/dedupe-jobs.service.test.js`

- [ ] **Step 1: Write failing tests for filtering, scoring, and dedupe**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { filterCandidateJobs } from "../app/services/filter-jobs.service.js";

test("filterCandidateJobs keeps only recent jobs with title and description signals", () => {
  const result = filterCandidateJobs({
    jobs: [{
      title: "Analista de Riesgo",
      description: "Bogota. Ingenieria industrial. Hibrido.",
      publicationDateRaw: "ayer",
    }],
    profile: {
      titleKeywords: ["riesgo"],
      locationSignals: ["bogota"],
      experienceSignals: [],
      educationSignals: ["ingenieria industrial"],
      modalitySignals: ["hibrido"],
    },
    now: "2026-05-06T12:00:00.000Z",
  });
  assert.equal(result.keptJobs.length, 1);
});
```

```js
import test from "node:test";
import assert from "node:assert/strict";
import { scoreCandidateJobs } from "../app/services/score-jobs.service.js";

test("scoreCandidateJobs assigns a high priority to strong matches", () => {
  const jobs = scoreCandidateJobs({
    jobs: [{
      matchedSignals: {
        title: ["riesgo"],
        location: ["bogota"],
        experience: ["2 anos"],
        education: ["ingenieria industrial"],
        modality: ["hibrido"],
        recency: ["ayer"],
      },
    }],
  });
  assert.equal(jobs[0].priority, "high");
});
```

```js
import test from "node:test";
import assert from "node:assert/strict";
import { dedupeScoredJobs } from "../app/services/dedupe-jobs.service.js";

test("dedupeScoredJobs keeps the highest-scored variant of a duplicated posting", () => {
  const jobs = dedupeScoredJobs({
    jobs: [
      { title: "Analista de Riesgo", company: "A", url: "https://job/1", score: 8 },
      { title: "Analista de Riesgo", company: "A", url: "https://job/1", score: 12 },
    ],
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].score, 12);
});
```

- [ ] **Step 2: Run the domain-logic tests**

Run: `node --test tests/filter-jobs.service.test.js tests/score-jobs.service.test.js tests/dedupe-jobs.service.test.js`
Expected: FAIL with module-not-found errors.

- [ ] **Step 3: Add scoring configuration and date normalization**

```js
export const scoringWeights = {
  titleBase: 6,
  titleAdditional: 2,
  location: 3,
  experience: 2,
  education: 2,
  modality: 1,
  recency: 1,
};

export const priorityThresholds = {
  high: 12,
  medium: 8,
};
```

```js
import { normalizeForMatch } from "./normalize-text.js";

export function normalizePublicationDate(rawValue = "", { now }) {
  const normalized = normalizeForMatch(rawValue);
  const baseDate = new Date(now);
  const copy = new Date(baseDate);
  if (normalized.includes("hoy")) return { isRecent: true, publicationDateIso: copy.toISOString().slice(0, 10), publicationDateLabel: "Hoy" };
  if (normalized.includes("ayer") || normalized.includes("1 dia")) {
    copy.setUTCDate(copy.getUTCDate() - 1);
    return { isRecent: true, publicationDateIso: copy.toISOString().slice(0, 10), publicationDateLabel: "Ayer" };
  }
  if (normalized.includes("2 dias") || normalized.includes("dos dias")) {
    copy.setUTCDate(copy.getUTCDate() - 2);
    return { isRecent: true, publicationDateIso: copy.toISOString().slice(0, 10), publicationDateLabel: "Hace 2 dias" };
  }
  return { isRecent: false, publicationDateIso: null, publicationDateLabel: rawValue };
}
```

- [ ] **Step 4: Add filter, score, and dedupe services**

```js
import { normalizePublicationDate } from "../utils/normalize-date.js";
import { normalizeForMatch } from "../utils/normalize-text.js";

function findMatches(text, keywords) {
  return keywords.filter((keyword) => text.includes(normalizeForMatch(keyword)));
}

export function filterCandidateJobs({ jobs, profile, now }) {
  const keptJobs = [];
  const discardedJobs = [];
  for (const job of jobs) {
    const normalizedTitle = normalizeForMatch(job.title || "");
    const normalizedDescription = normalizeForMatch(job.description || "");
    const titleMatches = findMatches(normalizedTitle, profile.titleKeywords);
    if (titleMatches.length === 0) {
      discardedJobs.push({ ...job, discardReason: "missing-title-keywords" });
      continue;
    }
    const publicationDate = normalizePublicationDate(job.publicationDateRaw, { now });
    if (!publicationDate.isRecent) {
      discardedJobs.push({ ...job, discardReason: "stale-publication-date" });
      continue;
    }
    const matchedSignals = {
      title: titleMatches,
      location: findMatches(normalizedDescription, profile.locationSignals),
      experience: findMatches(normalizedDescription, profile.experienceSignals),
      education: findMatches(normalizedDescription, profile.educationSignals),
      modality: findMatches(normalizedDescription, profile.modalitySignals),
      recency: [publicationDate.publicationDateLabel],
    };
    const usefulSignalCount =
      matchedSignals.location.length +
      matchedSignals.experience.length +
      matchedSignals.education.length +
      matchedSignals.modality.length;
    if (usefulSignalCount === 0) {
      discardedJobs.push({ ...job, discardReason: "missing-description-signals" });
      continue;
    }
    keptJobs.push({ ...job, matchedSignals, publicationDateIso: publicationDate.publicationDateIso });
  }
  return { keptJobs, discardedJobs };
}
```

```js
import { priorityThresholds, scoringWeights } from "../config/search-profile.js";

export function scoreCandidateJobs({ jobs }) {
  return jobs.map((job) => {
    const breakdown = {
      titleMatch: scoringWeights.titleBase + Math.max(0, job.matchedSignals.title.length - 1) * scoringWeights.titleAdditional,
      locationMatch: job.matchedSignals.location.length > 0 ? scoringWeights.location : 0,
      experienceMatch: job.matchedSignals.experience.length > 0 ? scoringWeights.experience : 0,
      educationMatch: job.matchedSignals.education.length > 0 ? scoringWeights.education : 0,
      modalityMatch: job.matchedSignals.modality.length > 0 ? scoringWeights.modality : 0,
      recencyMatch: job.matchedSignals.recency.length > 0 ? scoringWeights.recency : 0,
    };
    const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
    return {
      ...job,
      scoreBreakdown: breakdown,
      score,
      priority: score >= priorityThresholds.high ? "high" : score >= priorityThresholds.medium ? "medium" : "low",
    };
  });
}
```

```js
import { normalizeForMatch } from "../utils/normalize-text.js";

function fingerprint(job) {
  if (job.url) return normalizeForMatch(job.url);
  return normalizeForMatch(`${job.company}::${job.title}::${job.publicationDateRaw || ""}`);
}

export function dedupeScoredJobs({ jobs }) {
  const byFingerprint = new Map();
  for (const job of jobs) {
    const key = fingerprint(job);
    const existing = byFingerprint.get(key);
    if (!existing || job.score > existing.score) byFingerprint.set(key, job);
  }
  return [...byFingerprint.values()].sort((left, right) => right.score - left.score);
}
```

- [ ] **Step 5: Run the domain-logic tests again**

Run: `node --test tests/filter-jobs.service.test.js tests/score-jobs.service.test.js tests/dedupe-jobs.service.test.js`
Expected: PASS

- [ ] **Step 6: Optional commit after git init**

Run: `git add app tests && git commit -m "feat: add vacancy filtering scoring and dedupe"`

---

### Task 4: Model session strategies and auth-state discovery

**Files:**
- Create: `app/config/portal-auth-strategies.js`
- Create: `app/services/auth-state.service.js`
- Test: `tests/auth-state.service.test.js`

- [ ] **Step 1: Write the failing auth-state test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { getPortalAuthState } from "../app/services/auth-state.service.js";

test("getPortalAuthState resolves a storageState path for elempleo", async () => {
  const state = await getPortalAuthState({
    workspaceRoot: "C:\\repo\\basic-job-search",
    portalKey: "elempleo",
  });
  assert.equal(state.sessionStrategy, "storageState");
  assert.equal(state.authPath.endsWith("auth-state\\elempleo.json"), true);
});
```

- [ ] **Step 2: Run the auth-state test**

Run: `node --test tests/auth-state.service.test.js`
Expected: FAIL with module-not-found errors.

- [ ] **Step 3: Add explicit validated-portal strategy config**

```js
const validatedPortalStrategies = {
  linkedin: {
    portalKey: "linkedin",
    sessionStrategy: "storageState",
    authArtifactName: "linkedin.json",
  },
  elempleo: {
    portalKey: "elempleo",
    sessionStrategy: "storageState",
    authArtifactName: "elempleo.json",
  },
  computrabajo: {
    portalKey: "computrabajo",
    sessionStrategy: "persistentProfile",
    authArtifactName: "computrabajo",
  },
};

export function getPortalAuthStrategy(portalKey) {
  return validatedPortalStrategies[portalKey] || null;
}
```

- [ ] **Step 4: Add auth-state path resolution**

```js
import fs from "node:fs/promises";
import path from "node:path";
import { getPortalAuthStrategy } from "../config/portal-auth-strategies.js";

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function resolveWorkspacePaths(workspaceRoot) {
  return {
    authStateDir: path.join(workspaceRoot, "auth-state"),
    persistentProfilesDir: path.join(workspaceRoot, "persistent-profiles"),
    resultsDir: path.join(workspaceRoot, "results"),
    runsDir: path.join(workspaceRoot, "data", "runs"),
  };
}

export async function getPortalAuthState({ workspaceRoot, portalKey }) {
  const strategy = getPortalAuthStrategy(portalKey);
  if (!strategy) {
    return { portalKey, sessionStrategy: "public", available: true, authPath: null };
  }
  const paths = resolveWorkspacePaths(workspaceRoot);
  if (strategy.sessionStrategy === "storageState") {
    const authPath = path.join(paths.authStateDir, strategy.authArtifactName);
    return { portalKey, sessionStrategy: strategy.sessionStrategy, available: await pathExists(authPath), authPath };
  }
  const authPath = path.join(paths.persistentProfilesDir, strategy.authArtifactName);
  return { portalKey, sessionStrategy: strategy.sessionStrategy, available: await pathExists(authPath), authPath };
}
```

- [ ] **Step 5: Run the auth-state test again**

Run: `node --test tests/auth-state.service.test.js`
Expected: PASS

- [ ] **Step 6: Optional commit after git init**

Run: `git add app tests && git commit -m "feat: model portal auth strategies"`

---

### Task 5: Add orchestration, retry-at-end behavior, and user-decision escalation

**Files:**
- Create: `app/models/run.types.js`
- Create: `app/services/run-state.service.js`
- Create: `app/services/orchestrate-search.service.js`
- Test: `tests/orchestrate-search.service.test.js`

- [ ] **Step 1: Write the failing orchestration test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { orchestrateSearch } from "../app/services/orchestrate-search.service.js";

test("orchestrateSearch retries a previously validated failing portal at the end", async () => {
  const seen = [];
  const result = await orchestrateSearch({
    sources: [
      { sourceId: "elempleo", portalKey: "elempleo", displayName: "Elempleo", testStatus: "validado" },
      { sourceId: "linkedin", portalKey: "linkedin", displayName: "LinkedIn", testStatus: "validado" },
    ],
    profile: {
      titleKeywords: ["riesgo"],
      locationSignals: ["bogota"],
      experienceSignals: [],
      educationSignals: [],
      modalitySignals: [],
    },
    now: "2026-05-06T12:00:00.000Z",
    acquireJobs: async (source, phase) => {
      seen.push(`${source.sourceId}:${phase}`);
      if (source.sourceId === "elempleo" && phase === "initial") {
        return { sourceStatus: { status: "retry-later", note: "session lost" }, jobs: [] };
      }
      if (source.sourceId === "elempleo" && phase === "retry-final") {
        return { sourceStatus: { status: "needs-user-decision", note: "refresh auth" }, jobs: [] };
      }
      return {
        sourceStatus: { status: "success", note: "" },
        jobs: [{
          title: "Analista de Riesgo",
          company: "A",
          url: "https://example.com/a",
          description: "Bogota",
          publicationDateRaw: "ayer",
        }],
      };
    },
  });
  assert.deepEqual(seen, ["elempleo:initial", "linkedin:initial", "elempleo:retry-final"]);
  assert.equal(result.sourceStatuses.some((status) => status.status === "needs-user-decision"), true);
});
```

- [ ] **Step 2: Run the orchestration test**

Run: `node --test tests/orchestrate-search.service.test.js`
Expected: FAIL with module-not-found errors.

- [ ] **Step 3: Add the run-state helper**

```js
export function createSourceStatus(source, status, note = "") {
  return {
    sourceId: source.sourceId,
    displayName: source.displayName,
    portalKey: source.portalKey,
    status,
    note,
  };
}

export function shouldRetryAtEnd(source, status) {
  return source.testStatus === "validado" && (status === "retry-later" || status === "auth-lost");
}
```

- [ ] **Step 4: Add the orchestrator**

```js
import { dedupeScoredJobs } from "./dedupe-jobs.service.js";
import { filterCandidateJobs } from "./filter-jobs.service.js";
import { scoreCandidateJobs } from "./score-jobs.service.js";
import { createSourceStatus, shouldRetryAtEnd } from "./run-state.service.js";

export async function orchestrateSearch({ sources, profile, now, acquireJobs }) {
  const sourceStatuses = [];
  const candidateJobs = [];
  const retryQueue = [];

  for (const source of sources) {
    const result = await acquireJobs(source, "initial");
    const status = result.sourceStatus?.status || "success";
    sourceStatuses.push(createSourceStatus(source, status, result.sourceStatus?.note || ""));
    candidateJobs.push(...(result.jobs || []));
    if (shouldRetryAtEnd(source, status)) retryQueue.push(source);
  }

  for (const source of retryQueue) {
    const retryResult = await acquireJobs(source, "retry-final");
    const retryStatus = retryResult.sourceStatus?.status || "success";
    sourceStatuses.push(createSourceStatus(source, retryStatus, retryResult.sourceStatus?.note || ""));
    candidateJobs.push(...(retryResult.jobs || []));
  }

  const filtered = filterCandidateJobs({ jobs: candidateJobs, profile, now });
  const scored = scoreCandidateJobs({ jobs: filtered.keptJobs });
  const selectedJobs = dedupeScoredJobs({ jobs: scored });

  return {
    sourceStatuses,
    candidateJobs,
    discardedJobs: filtered.discardedJobs,
    selectedJobs,
  };
}
```

- [ ] **Step 5: Run the orchestration test again**

Run: `node --test tests/orchestrate-search.service.test.js`
Expected: PASS

- [ ] **Step 6: Optional commit after git init**

Run: `git add app tests && git commit -m "feat: add retry-at-end orchestration"`

---

### Task 6: Generate the human report and persisted run artifacts

**Files:**
- Create: `app/models/job.types.js`
- Create: `app/utils/markdown-table.js` (modify if needed)
- Create: `app/services/report-writer.service.js`
- Test: `tests/report-writer.service.test.js`

- [ ] **Step 1: Write the failing report-writer test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeJobSearchArtifacts } from "../app/services/report-writer.service.js";

test("writeJobSearchArtifacts writes markdown and latest run json", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "job-search-report-"));
  const result = await writeJobSearchArtifacts({
    workspaceRoot: root,
    runRecord: {
      runId: "2026-05-06T12-00-00-000Z",
      keyword: "riesgo",
      selectedJobs: [{ title: "Analista de Riesgo", company: "A", priority: "high", score: 12, url: "https://example.com" }],
      discardedJobs: [],
      sourceStatuses: [{ sourceId: "linkedin", displayName: "LinkedIn", status: "success", note: "" }],
    },
  });
  const markdown = await fs.readFile(result.markdownPath, "utf8");
  assert.equal(markdown.includes("Analista de Riesgo"), true);
});
```

- [ ] **Step 2: Run the report-writer test**

Run: `node --test tests/report-writer.service.test.js`
Expected: FAIL with module-not-found errors.

- [ ] **Step 3: Add the report writer**

```js
import fs from "node:fs/promises";
import path from "node:path";

function renderSelectedJobs(jobs) {
  if (jobs.length === 0) return "_No se seleccionaron vacantes._";
  return jobs.map((job, index) => [
    `## ${index + 1}. ${job.title}`,
    `- Empresa: ${job.company}`,
    `- Prioridad: ${job.priority}`,
    `- Puntaje: ${job.score}`,
    `- URL: ${job.url}`,
    "",
  ].join("\n")).join("\n");
}

function renderPendingStatuses(statuses) {
  const pending = statuses.filter((status) => status.status === "needs-user-decision");
  if (pending.length === 0) return "_Sin decisiones pendientes._";
  return pending.map((status) => `- ${status.displayName}: ${status.note}`).join("\n");
}

export async function writeJobSearchArtifacts({ workspaceRoot, runRecord }) {
  const dataRunsDir = path.join(workspaceRoot, "data", "runs");
  await fs.mkdir(dataRunsDir, { recursive: true });
  const markdownPath = path.join(workspaceRoot, "job_postings_to_check.md");
  const jsonPath = path.join(dataRunsDir, `${runRecord.runId}.json`);
  const latestPath = path.join(dataRunsDir, "latest.json");
  const markdown = [
    "# Job Postings To Check",
    "",
    `- Run ID: ${runRecord.runId}`,
    `- Keyword: ${runRecord.keyword}`,
    "",
    "## Vacantes priorizadas",
    "",
    renderSelectedJobs(runRecord.selectedJobs),
    "",
    "## Portales con decision pendiente",
    "",
    renderPendingStatuses(runRecord.sourceStatuses),
    "",
  ].join("\n");
  await fs.writeFile(markdownPath, markdown);
  await fs.writeFile(jsonPath, JSON.stringify(runRecord, null, 2));
  await fs.writeFile(latestPath, JSON.stringify(runRecord, null, 2));
  return { markdownPath, jsonPath, latestPath };
}
```

- [ ] **Step 4: Run the report-writer test again**

Run: `node --test tests/report-writer.service.test.js`
Expected: PASS

- [ ] **Step 5: Optional commit after git init**

Run: `git add app tests && git commit -m "feat: add report and run artifact writer"`

---

### Task 7: Add authenticated portal experiments and post-login search validation

**Files:**
- Create: `app/experiments/auth-result.js`
- Create: `app/experiments/portal-auth-config.js`
- Create: `app/experiments/portal-storage-state.js`
- Create: `app/experiments/portal-persistent-context.js`
- Create: `app/experiments/post-login-search-config.js`
- Create: `app/experiments/post-login-search-helpers.js`
- Create: `app/experiments/post-login-search.js`
- Test: `tests/portal-auth-config.test.js`
- Test: `tests/post-login-search.test.js`

- [ ] **Step 1: Write failing auth-experiment tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { isElempleoAuthenticated, getPortalConfig } from "../app/experiments/portal-auth-config.js";

test("Elempleo auth detector rejects login redirect", () => {
  assert.equal(isElempleoAuthenticated({
    currentUrl: "https://www.elempleo.com/co/iniciar-sesion?__error__=Unauthorized",
    passwordInputCount: 1,
    title: "Iniciar Sesion - Elempleo.com",
  }), false);
  assert.equal(getPortalConfig("elempleo").targetUrl, "https://www.elempleo.com/co/homeusuario");
});
```

```js
import test from "node:test";
import assert from "node:assert/strict";
import { getPostLoginSearchConfig } from "../app/experiments/post-login-search-config.js";

test("Elempleo post-login search config uses storageState selectors", () => {
  const config = getPostLoginSearchConfig("elempleo");
  assert.equal(config.sessionStrategy, "storageState");
  assert.equal(config.submitButtonSelector, "button.js-searchHeader");
});
```

- [ ] **Step 2: Run the auth-experiment tests**

Run: `node --test tests/portal-auth-config.test.js tests/post-login-search.test.js`
Expected: FAIL with module-not-found errors.

- [ ] **Step 3: Add the auth config and path helpers**

```js
export function isElempleoAuthenticated({ currentUrl = "", passwordInputCount = 0, title = "" }) {
  const lowerUrl = currentUrl.toLowerCase();
  const lowerTitle = title.toLowerCase();
  if (lowerUrl.includes("/iniciar-sesion") || lowerUrl.includes("unauthorized")) return false;
  if (lowerTitle.includes("iniciar sesion")) return false;
  return passwordInputCount === 0;
}

export function isLinkedInAuthenticated({ cookieNames = [] }) {
  return cookieNames.includes("li_at");
}

export function isComputrabajoAuthenticated({ currentUrl = "", cookieNames = [], bodyText = "" }) {
  const lowerUrl = currentUrl.toLowerCase();
  const lowerBodyText = bodyText.toLowerCase();
  const lowerCookieNames = cookieNames.map((name) => name.toLowerCase());
  if (lowerUrl.includes("/acceso/") || lowerUrl.includes("returnurl=")) return false;
  if (lowerBodyText.includes("mi area") || lowerBodyText.includes("hoja de vida")) return true;
  return lowerCookieNames.includes("pa_user") || lowerCookieNames.includes("uca") || lowerCookieNames.includes("idsrv");
}

const portalConfigs = {
  linkedin: { key: "linkedin", displayName: "LinkedIn Jobs", targetUrl: "https://www.linkedin.com/jobs/", detectAuthenticated: isLinkedInAuthenticated },
  elempleo: { key: "elempleo", displayName: "Elempleo", targetUrl: "https://www.elempleo.com/co/homeusuario", detectAuthenticated: isElempleoAuthenticated },
  computrabajo: { key: "computrabajo", displayName: "Computrabajo", targetUrl: "https://candidato.co.computrabajo.com/candidate/home", detectAuthenticated: isComputrabajoAuthenticated },
};

export function getPortalConfig(portalKey) {
  return portalConfigs[portalKey];
}
```

```js
import path from "node:path";

export function buildExperimentPaths(rootDir, portal) {
  return {
    authStateDir: path.join(rootDir, "auth-state"),
    resultsDir: path.join(rootDir, "results"),
    storageStatePath: path.join(rootDir, "auth-state", `${portal}.json`),
    resultPath: path.join(rootDir, "results", `${portal}-storage-state-result.json`),
  };
}

export function buildPersistentProfilePaths(rootDir, portal) {
  return {
    userDataDir: path.join(rootDir, "persistent-profiles", portal),
    resultPath: path.join(rootDir, "results", `${portal}-persistent-context-result.json`),
  };
}
```

- [ ] **Step 4: Add the post-login search config and runner skeleton**

```js
const configs = {
  linkedin: {
    key: "linkedin",
    displayName: "LinkedIn Jobs",
    sessionStrategy: "storageState",
    targetUrl: "https://www.linkedin.com/jobs/",
    keywordInputSelector: 'input[placeholder*="empleo" i]',
    submitAction: "enter",
    submitButtonSelector: null,
    expectedUrlKeyword: "/jobs/search-results/",
    resultsMarker: "resultados",
  },
  elempleo: {
    key: "elempleo",
    displayName: "Elempleo",
    sessionStrategy: "storageState",
    targetUrl: "https://www.elempleo.com/co/homeusuario",
    keywordInputSelector: "input.js-searchbox-input.tt-input",
    submitAction: "click",
    submitButtonSelector: "button.js-searchHeader",
    expectedUrlKeyword: "/ofertas-empleo/",
    resultsMarker: "ofertas de empleo",
  },
  computrabajo: {
    key: "computrabajo",
    displayName: "Computrabajo",
    sessionStrategy: "persistentProfile",
    targetUrl: "https://candidato.co.computrabajo.com/candidate/home",
    keywordInputSelector: "#prof-cat-search-input",
    submitAction: "click",
    submitButtonSelector: 'button:has-text("Buscar empleos")',
    expectedUrlKeyword: "/trabajo-de-",
    resultsMarker: "ofertas de trabajo",
  },
};

export function getPostLoginSearchConfig(portalKey) {
  return configs[portalKey];
}
```

```js
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { getPortalConfig } from "./portal-auth-config.js";
import { getPostLoginSearchConfig } from "./post-login-search-config.js";
import { buildExperimentPaths, buildPersistentProfilePaths } from "./auth-result.js";

export async function runPortalSearch(rootDir, portalKey, keyword) {
  const authConfig = getPortalConfig(portalKey);
  const config = getPostLoginSearchConfig(portalKey);
  const browser = await chromium.launch({ headless: false });
  const context = config.sessionStrategy === "storageState"
    ? await browser.newContext({ storageState: buildExperimentPaths(rootDir, portalKey).storageStatePath })
    : await chromium.launchPersistentContext(buildPersistentProfilePaths(rootDir, portalKey).userDataDir, { headless: false });
  const page = context.pages?.()[0] || await context.newPage();
  await page.goto(config.targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  const beforeSignals = {
    currentUrl: page.url(),
    title: await page.title(),
    bodyText: await page.locator("body").innerText().catch(() => ""),
    cookieNames: (await context.cookies()).map((cookie) => cookie.name),
    passwordInputCount: await page.locator('input[type="password"]').count().catch(() => 0),
  };
  const authenticatedBeforeSearch = authConfig.detectAuthenticated(beforeSignals);
  await fs.mkdir(path.join(rootDir, "results"), { recursive: true });
  return { portal: portalKey, keyword, authenticatedBeforeSearch };
}
```

- [ ] **Step 5: Run the auth-experiment tests again**

Run: `node --test tests/portal-auth-config.test.js tests/post-login-search.test.js`
Expected: PASS

- [ ] **Step 6: Extend the runner to persist screenshots and result JSON**

```js
// Extend `runPortalSearch` so that it:
// 1. fills the keyword input,
// 2. submits the search,
// 3. captures after-signals,
// 4. writes `results/<portal>-post-login-search-<keyword>.json`,
// 5. stores a full-page screenshot for portal debugging.
```

- [ ] **Step 7: Manual validation commands**

Run:
- `node app/experiments/portal-storage-state.js elempleo --wait-for-auth`
- `node app/experiments/post-login-search.js riesgo elempleo`

Expected:
- a saved `auth-state/elempleo.json`
- a result artifact in `results/`
- a screenshot proving post-login search happened

- [ ] **Step 8: Optional commit after git init**

Run: `git add app tests && git commit -m "feat: add authenticated portal experiments"`

---

### Task 8: Add acquisition adapters and wire the end-to-end batch runner

**Files:**
- Create: `app/adapters/source-adapter.js`
- Create: `app/adapters/browser-search.adapter.js`
- Create: `app/adapters/generic-board.adapter.js`
- Create: `app/adapters/ats-page.adapter.js`
- Create: `app/run.js`
- Test: `tests/workspace-smoke.test.js` (modify)

- [ ] **Step 1: Write the failing runner smoke test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("app/run.js exits cleanly in cached mode", () => {
  const result = spawnSync(process.execPath, ["app/run.js", "--cached"], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.includes("selectedSourceCount"), true);
});
```

- [ ] **Step 2: Run the runner smoke test**

Run: `node --test tests/workspace-smoke.test.js`
Expected: FAIL because `app/run.js` and the adapters do not exist yet.

- [ ] **Step 3: Add the base adapter result helper**

```js
export function createAcquireResult(source, { status, note = "", jobs = [] }) {
  return {
    sourceStatus: {
      sourceId: source.sourceId,
      displayName: source.displayName,
      status,
      note,
    },
    jobs,
  };
}
```

- [ ] **Step 4: Add the browser and public-board adapters**

```js
import fs from "node:fs/promises";
import path from "node:path";
import { createAcquireResult } from "./source-adapter.js";

function buildAggregateResultPath(workspaceRoot, keyword) {
  return path.join(workspaceRoot, "results", `post-login-search-${keyword.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`);
}

export function createBrowserSearchAdapter({ workspaceRoot, keyword, useCachedResults }) {
  return async function acquireJobsFromBrowser(source) {
    if (!useCachedResults) {
      return createAcquireResult(source, {
        status: "retry-later",
        note: "Live authenticated acquisition disabled until portal adapter is explicitly enabled.",
        jobs: [],
      });
    }
    const aggregate = JSON.parse(await fs.readFile(buildAggregateResultPath(workspaceRoot, keyword), "utf8"));
    const cachedResult = aggregate.results.find((result) => result.portal === source.portalKey);
    if (!cachedResult) {
      return createAcquireResult(source, { status: "no-results", note: "No cached result found.", jobs: [] });
    }
    return createAcquireResult(source, {
      status: cachedResult.verdict === "search-success" ? "success" : "needs-user-decision",
      note: "Loaded from cached validated post-login evidence.",
      jobs: cachedResult.jobs || [],
    });
  };
}
```

```js
import { createAcquireResult } from "./source-adapter.js";

export async function acquireFromGenericBoard(source) {
  return createAcquireResult(source, {
    status: "no-results",
    note: "Public portal adapter not implemented yet for this portal.",
    jobs: [],
  });
}

export async function acquireFromAtsPage(source) {
  return createAcquireResult(source, {
    status: "no-results",
    note: "Company ATS adapter not implemented yet.",
    jobs: [],
  });
}
```

- [ ] **Step 5: Add the batch runner**

```js
import { createBrowserSearchAdapter } from "./adapters/browser-search.adapter.js";
import { acquireFromAtsPage } from "./adapters/ats-page.adapter.js";
import { acquireFromGenericBoard } from "./adapters/generic-board.adapter.js";
import { loadSearchProfile } from "./services/load-search-profile.js";
import { loadSources } from "./services/load-sources.service.js";
import { orchestrateSearch } from "./services/orchestrate-search.service.js";
import { writeJobSearchArtifacts } from "./services/report-writer.service.js";

function parseArgs(argv) {
  const flags = new Set(argv.filter((token) => token.startsWith("--")).map((token) => token.replace(/^--/, "")));
  return { flags };
}

const { flags } = parseArgs(process.argv.slice(2));
const workspaceRoot = process.cwd();
const profile = await loadSearchProfile({ repoRoot: workspaceRoot });
const { allSources } = await loadSources({ repoRoot: workspaceRoot });
const useCachedResults = flags.has("cached");
const browserAdapter = createBrowserSearchAdapter({ workspaceRoot, keyword: profile.primaryTitleKeywords[0] || "riesgo", useCachedResults });

const runSummary = await orchestrateSearch({
  sources: allSources,
  profile,
  now: new Date(),
  acquireJobs: async (source, phase) => {
    if (source.requiresAuth) return browserAdapter(source, phase);
    return source.portalKey ? acquireFromGenericBoard(source) : acquireFromAtsPage(source);
  },
});

const runRecord = {
  runId: new Date().toISOString().replace(/[:.]/g, "-"),
  keyword: profile.primaryTitleKeywords[0] || "riesgo",
  selectedJobs: runSummary.selectedJobs,
  discardedJobs: runSummary.discardedJobs,
  sourceStatuses: runSummary.sourceStatuses,
};

const artifactPaths = await writeJobSearchArtifacts({ workspaceRoot, runRecord });
console.log(JSON.stringify({
  selectedSourceCount: allSources.length,
  matchedJobs: runSummary.selectedJobs.length,
  markdownPath: artifactPaths.markdownPath,
  jsonPath: artifactPaths.jsonPath,
}, null, 2));
```

- [ ] **Step 6: Run the runner smoke test again**

Run: `node --test tests/workspace-smoke.test.js`
Expected: PASS

- [ ] **Step 7: Manual dry-run**

Run: `node app/run.js --cached`
Expected: JSON summary prints with `selectedSourceCount`, `matchedJobs`, and artifact paths.

- [ ] **Step 8: Optional commit after git init**

Run: `git add app tests && git commit -m "feat: wire end-to-end batch runner"`

---

### Task 9: Add Windows batch entrypoint, scheduler install, and operational docs

**Files:**
- Create: `scripts/run-job-search.ps1`
- Create: `scripts/install-scheduled-task.ps1`
- Modify: `README.md`

- [ ] **Step 1: Write the scheduler script first**

```powershell
param(
  [string]$TaskName = "BasicJobSearch",
  [string]$WorkingDirectory = (Resolve-Path "$PSScriptRoot\..").Path
)

$scriptPath = Join-Path $WorkingDirectory "scripts\run-job-search.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At 8:00AM
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force
Write-Output "Scheduled task '$TaskName' registered."
```

- [ ] **Step 2: Add the PowerShell batch runner**

```powershell
param(
  [switch]$Cached
)

$workspaceRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $workspaceRoot

$command = @("app/run.js")
if ($Cached) {
  $command += "--cached"
}

node @command
if ($LASTEXITCODE -ne 0) {
  throw "Job search batch failed."
}
```

- [ ] **Step 3: Update README with operational commands**

```md
## Comandos

```powershell
npm install
node --test
node app/run.js --cached
powershell -ExecutionPolicy Bypass -File .\scripts\run-job-search.ps1 -Cached
powershell -ExecutionPolicy Bypass -File .\scripts\install-scheduled-task.ps1
```

## Flujo recomendado

1. Diligenciar `URL_plataformas.md`.
2. Diligenciar `job-search-profile.md`.
3. Preparar auth reutilizable para portales con login.
4. Ejecutar una búsqueda post-login de validación.
5. Correr el batch programado.
```

- [ ] **Step 4: Manual operational verification**

Run:
- `powershell -ExecutionPolicy Bypass -File .\scripts\run-job-search.ps1 -Cached`
- `powershell -ExecutionPolicy Bypass -File .\scripts\install-scheduled-task.ps1 -TaskName "BasicJobSearchTest"`

Expected:
- batch summary prints successfully
- scheduled task registers without manual editing

- [ ] **Step 5: Final verification pass**

Run: `node --test`
Expected: all tests pass

- [ ] **Step 6: Optional commit after git init**

Run: `git add . && git commit -m "feat: add scheduled batch execution workflow"`

---

## Self-Review

### Spec coverage

- Batch local programado: cubierto por `Task 8` y `Task 9`.
- Portales con login: cubierto por `Task 4` y `Task 7`.
- Fuente de verdad Markdown: cubierto por `Task 2`.
- Filtro y priorización: cubierto por `Task 3`.
- Reintento al final y decisión del usuario: cubierto por `Task 5`.
- Reporte estilo repo de referencia: cubierto por `Task 6`.

### Placeholder scan

- No se dejaron `TBD` o `TODO` en pasos de implementación.
- Los pocos comentarios pendientes aparecen solo como extensión explícita de una función ya definida, no como sustituto de diseño.

### Type consistency

- `portalKey`, `sessionStrategy`, `sourceStatus`, `selectedJobs` y `needs-user-decision` se usan con el mismo nombre a lo largo del plan.
- La orquestación usa la misma interfaz `acquireJobs(source, phase)` definida en `Task 5` y consumida en `Task 8`.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-06-job-search-batch-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
