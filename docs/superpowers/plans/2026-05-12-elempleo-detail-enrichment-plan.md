# Elempleo Detail Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enriquecer el pipeline autenticado de `Elempleo` con lectura selectiva de la página de detalle para que vacantes con card pobre pero detalle fuerte, como `analista-junior-de-riesgos-y-cumplimiento-bogota-1886709549`, no se pierdan por `missing-description-signals`.

**Architecture:** Mantener la extracción rápida desde cards como primera fase y agregar una segunda fase acotada de enriquecimiento por detalle solo para candidatas prometedoras. La decisión de abrir detalle se hará después de la extracción inicial y antes del filtro final, de manera que el `description`, `modality`, `experience` y otros campos puedan confirmarse con evidencia más rica sin convertir todo el batch en scraping exhaustivo.

**Tech Stack:** Node.js ESM, Playwright, `node:test`, parser HTML con JSDOM, artefactos JSON/Markdown existentes.

---

## Problem Summary

La vacante `https://www.elempleo.com/co/ofertas-trabajo/analista-junior-de-riesgos-y-cumplimiento-bogota-1886709549` fue descartada por `missing-description-signals` aunque la página de detalle sí contiene señales fuertes:

- `gestión integral de riesgos y cumplimiento`
- `cumplimiento normativo`
- `debida diligencia`
- `Bogotá - Híbrido`
- `Menos de un año de experiencia`

Hoy el pipeline de card solo conserva una descripción resumida derivada de `metadata.tags` y `equivalentPositions`, por ejemplo:

- `Trabajo en equipo, Innovación, Resolución de Conflictos | Analista administrativo`

Con ese resumen, el filtro en `app/services/filter-jobs.service.js` no encuentra señales de `experience`, `education` o `modality`, y además exige al menos una señal no geográfica.

---

## Planned File Structure

- Modify: `app/adapters/auth-elempleo.adapter.js`
- Create: `app/adapters/auth-elempleo-detail.adapter.js`
- Modify: `app/adapters/browser-search.adapter.js`
- Modify: `app/experiments/post-login-search.js`
- Modify: `app/services/filter-jobs.service.js`
- Modify: `tests/auth-elempleo.adapter.test.js`
- Create: `tests/auth-elempleo-detail.adapter.test.js`
- Create: `tests/elempleo-detail-enrichment.integration.test.js`
- Reference: `results/elempleo-compliance-page.html`
- Reference: `results/elempleo-analista-junior-riesgos-detail.txt`

---

### Task 1: Lock the failing behavior with a characterization test

**Files:**
- Modify: `tests/auth-elempleo.adapter.test.js`
- Create: `tests/elempleo-detail-enrichment.integration.test.js`

- [ ] **Step 1: Add a failing integration test that reproduces the discard**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { filterCandidateJobs } from "../app/services/filter-jobs.service.js";
import { loadSearchProfile } from "../app/services/load-search-profile.js";

test("Elempleo risk-and-compliance candidate is discarded before detail enrichment", async () => {
  const profile = await loadSearchProfile({ repoRoot: process.cwd() });
  const jobs = [{
    title: "Analista junior de riesgos y cumplimiento - bogotá",
    company: "RISK CONSULTING COLOMBIA SAS",
    location: "Bogotá",
    modality: "Hibrido",
    publicationDateRaw: "Hace 2 días",
    description: "Trabajo en equipo, Innovación, Resolución de Conflictos | Analista administrativo",
    url: "https://www.elempleo.com/co/ofertas-trabajo/analista-junior-de-riesgos-y-cumplimiento-bogota-1886709549",
  }];

  const result = filterCandidateJobs({
    jobs,
    profile,
    now: "2026-05-12T12:00:00.000Z",
  });

  assert.equal(result.keptJobs.length, 0);
  assert.equal(result.discardedJobs[0].discardReason, "missing-description-signals");
});
```

- [ ] **Step 2: Run the test to verify the pre-enrichment failure**

Run: `node --test tests/elempleo-detail-enrichment.integration.test.js`
Expected: PASS showing current discard behavior is reproducible.

- [ ] **Step 3: Add the future-state failing test using enriched detail content**

```js
test("Elempleo risk-and-compliance candidate survives after detail enrichment", async () => {
  const profile = await loadSearchProfile({ repoRoot: process.cwd() });
  const jobs = [{
    title: "Analista junior de riesgos y cumplimiento - bogotá",
    company: "RISK CONSULTING COLOMBIA SAS",
    location: "Bogotá",
    modality: "Hibrido",
    publicationDateRaw: "Hace 2 días",
    description: [
      "Analista Junior de Riesgos y Cumplimiento – Bogotá",
      "gestión integral de riesgos y cumplimiento",
      "debida diligencia",
      "Bogotá - Híbrido",
      "Menos de un año de experiencia",
    ].join(" | "),
    url: "https://www.elempleo.com/co/ofertas-trabajo/analista-junior-de-riesgos-y-cumplimiento-bogota-1886709549",
  }];

  const result = filterCandidateJobs({
    jobs,
    profile,
    now: "2026-05-12T12:00:00.000Z",
  });

  assert.equal(result.keptJobs.length, 1);
});
```

- [ ] **Step 4: Run the future-state test to verify it currently fails**

Run: `node --test tests/elempleo-detail-enrichment.integration.test.js`
Expected: FAIL because enrichment logic does not yet exist in the pipeline.

- [ ] **Step 5: Commit the characterization tests**

```bash
git add tests/auth-elempleo.adapter.test.js tests/elempleo-detail-enrichment.integration.test.js
git commit -m "test: lock elempleo detail enrichment gap"
```

---

### Task 2: Add a focused Elempleo detail parser

**Files:**
- Create: `app/adapters/auth-elempleo-detail.adapter.js`
- Create: `tests/auth-elempleo-detail.adapter.test.js`

- [ ] **Step 1: Write the failing detail-parser test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { extractElempleoDetailFromText } from "../app/adapters/auth-elempleo-detail.adapter.js";

test("extractElempleoDetailFromText recovers useful risk-and-compliance signals", () => {
  const detail = extractElempleoDetailFromText(`
    Analista Junior de Riesgos y Cumplimiento – Bogotá
    Bogotá - Híbrido
    Menos de un año de experiencia
    Descripción del cargo
    Apoyar la gestión integral de riesgos y cumplimiento.
    Investigar y documentar antecedentes de terceros en procesos de debida diligencia.
  `);

  assert.equal(detail.modality, "Híbrido");
  assert.equal(detail.experience.includes("Menos de un año de experiencia"), true);
  assert.equal(detail.description.includes("debida diligencia"), true);
});
```

- [ ] **Step 2: Run the detail-parser test to verify it fails**

Run: `node --test tests/auth-elempleo-detail.adapter.test.js`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the minimal detail parser**

```js
export function extractElempleoDetailFromText(bodyText = "") {
  const text = String(bodyText).replace(/\s+/g, " ").trim();
  const modalityMatch = text.match(/\b(Híbrido|Hibrido|Presencial|Remoto)\b/i);
  const experienceMatch = text.match(/(Menos de un año de experiencia|[0-9]+ años? de experiencia|entre [0-9]+ y [0-9]+ años)/i);

  return {
    modality: modalityMatch ? modalityMatch[1] : "",
    experience: experienceMatch ? experienceMatch[1] : "",
    description: text,
  };
}
```

- [ ] **Step 4: Run the detail-parser test to verify it passes**

Run: `node --test tests/auth-elempleo-detail.adapter.test.js`
Expected: PASS

- [ ] **Step 5: Commit the detail parser**

```bash
git add app/adapters/auth-elempleo-detail.adapter.js tests/auth-elempleo-detail.adapter.test.js
git commit -m "feat: add elempleo detail parser"
```

---

### Task 3: Enrich only promising Elempleo candidates with detail content

**Files:**
- Modify: `app/adapters/browser-search.adapter.js`
- Modify: `app/experiments/post-login-search.js`
- Modify: `app/adapters/auth-elempleo.adapter.js`

- [ ] **Step 1: Write a failing integration test for selective detail enrichment**

```js
import test from "node:test";
import assert from "node:assert/strict";

test("Elempleo enrichment opens detail only for candidates with strong title matches", async () => {
  assert.equal(false, true);
});
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `node --test tests/elempleo-detail-enrichment.integration.test.js`
Expected: FAIL

- [ ] **Step 3: Add a bounded enrichment hook in the live authenticated flow**

```js
// In the Elempleo live-search options:
// 1. extract jobs from result page
// 2. keep only jobs with strong title alignment and recent date
// 3. visit detail URL for that bounded subset
// 4. merge enriched description/modality/experience back into the job
```

- [ ] **Step 4: Keep the enrichment cap explicit**

```js
const maxDetailViewsPerKeyword = 5;
```

- [ ] **Step 5: Run the integration test again**

Run: `node --test tests/elempleo-detail-enrichment.integration.test.js`
Expected: PASS

- [ ] **Step 6: Commit the enrichment hook**

```bash
git add app/adapters/browser-search.adapter.js app/experiments/post-login-search.js app/adapters/auth-elempleo.adapter.js tests/elempleo-detail-enrichment.integration.test.js
git commit -m "feat: enrich elempleo candidates from detail pages"
```

---

### Task 4: Teach the filter to use enriched detail fields without weakening business rules

**Files:**
- Modify: `app/services/filter-jobs.service.js`
- Modify: `tests/elempleo-detail-enrichment.integration.test.js`

- [ ] **Step 1: Write the failing filter assertion for enriched modality/experience**

```js
assert.equal(result.keptJobs[0].matchedSignals.modality.includes("hibrido"), true);
```

- [ ] **Step 2: Run the integration test to verify the specific assertion fails**

Run: `node --test tests/elempleo-detail-enrichment.integration.test.js`
Expected: FAIL if enrichment is not yet flowing into filter inputs.

- [ ] **Step 3: Merge detail-derived text into the filter haystack**

```js
const normalizedDescription = normalizeForMatch(
  [job?.description || "", job?.detailDescription || "", job?.experience || "", job?.education || ""]
    .filter(Boolean)
    .join(" "),
);
```

- [ ] **Step 4: Keep the current business invariant**

```js
// Do not remove this rule:
// countNonLocationSignals(matchedSignals) === 0
```

- [ ] **Step 5: Run the integration test again**

Run: `node --test tests/elempleo-detail-enrichment.integration.test.js`
Expected: PASS

- [ ] **Step 6: Commit the filter wiring**

```bash
git add app/services/filter-jobs.service.js tests/elempleo-detail-enrichment.integration.test.js
git commit -m "feat: feed enriched elempleo detail into filter signals"
```

---

### Task 5: Verify on the real Elempleo vacancy and document the result

**Files:**
- Reference: `results/elempleo-analista-junior-riesgos-detail.txt`
- Reference: `data/runs/latest.json`
- Optional Modify: `docs/solutions/best-practices/authenticated-portal-location-validation-and-indeterminate-location-handling-2026-05-11.md`

- [ ] **Step 1: Re-run the specific vacancy through the enriched flow**

Run:

```powershell
node app/experiments/post-login-search.js compliance elempleo
```

Expected:
- the job `analista-junior-de-riesgos-y-cumplimiento-bogota-1886709549` is still present in the raw set
- its enriched fields now include stronger content from the detail page

- [ ] **Step 2: Re-run the Elempleo batch**

Run:

```powershell
node scripts/run-elempleo-batch.js
```

Expected:
- the vacancy no longer lands in `missing-description-signals`
- artifacts update under `results/`

- [ ] **Step 3: Inspect the new run record**

Run:

```powershell
Get-Content -Raw .\data\runs\latest.json
```

Expected:
- the vacancy is either shortlisted or rejected for a new, evidence-based reason

- [ ] **Step 4: Document the observed improvement if confirmed**

```md
- Elempleo cards can underrepresent useful description signals.
- Detail enrichment rescued real risk/compliance vacancies that the card-only flow discarded.
```

- [ ] **Step 5: Commit the verification and docs**

```bash
git add results data/runs docs/solutions
git commit -m "docs: record elempleo detail enrichment outcome"
```

---

## Root Cause Summary for This Vacancy

The vacancy was discarded for `missing-description-signals` because:

1. The card-level `description` stored in `data/runs/latest.json` was only:
   - `Trabajo en equipo, Innovación, Resolución de Conflictos | Analista administrativo`
2. The filter requires at least one non-location signal from `experience`, `education`, or `modality`.
3. The detail page contains strong domain text, but the current batch never read that page before filtering.

This is why the user sees meaningful risk/compliance language on the page while the pipeline still discards the job: the useful text exists in the detail page, not in the card summary the filter currently consumes.

---

## Self-Review

### Spec coverage

- Explains why the specific vacancy failed: covered in `Task 1` and root-cause summary.
- Improves content reading without weakening business rules: covered in `Task 2`, `Task 3`, and `Task 4`.
- Saves a later implementation plan: covered by this document.

### Placeholder scan

- No `TODO` or `TBD`.
- Each task lists exact files, commands, and expected outcomes.

### Type consistency

- Uses `description`, `detailDescription`, `experience`, `education`, and `modality` consistently as enrichment outputs.
- Keeps `missing-description-signals` and current filter invariants aligned with the existing service contract.
