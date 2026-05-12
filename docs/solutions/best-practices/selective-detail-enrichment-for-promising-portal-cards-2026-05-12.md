---
title: Selective detail enrichment for promising portal cards
date: 2026-05-12
category: best-practices
module: job-search-batch
problem_type: best_practice
component: assistant
severity: high
applies_when:
  - A portal card has a usable title match but weak description signals
  - Opening every vacancy detail page would make the batch too expensive
  - The portal exposes stable vacancy URLs and a readable detail page
  - The shortlist must stay strict without losing real matches
tags:
  - detail-enrichment
  - portal-search
  - shortlist-quality
  - elempleo
  - authenticated-search
  - parser-recovery
---

# Selective detail enrichment for promising portal cards

## Context

`Elempleo` exposed a reusable shortlist-quality problem: some cards are good enough to look promising, but too weak to survive the final filter if the batch only reads the listing snippet.

The concrete failure was `https://www.elempleo.com/co/ofertas-trabajo/analista-gestion-de-riesgos-1886710001`. Its card showed a valid title, recent date, location, modality, and education hints, but the batch still discarded it as `missing-description-signals` because the card text alone did not confirm enough non-location signals.

After adding bounded detail enrichment before the final filter, the same `Elempleo` batch changed from:

- 1 shortlisted vacancy in `data/runs/2026-05-12T22-02-34-803Z.json`
- to 7 shortlisted vacancies in `data/runs/2026-05-12T22-15-37-048Z.json`

The rescued vacancy now carries real detail fields in `data/runs/latest.json`, including:

- `detailDescription`
- `experience: 2 anos de experiencia`
- `education: Ingenieria industrial`

## Guidance

Use a two-stage evaluation flow for any portal that can expose stable detail pages:

1. Extract and normalize result-card data first.
2. Run a cheap promise check on the card itself.
3. Open only a bounded number of promising detail pages.
4. Merge detail fields back into the job record before the final filter.
5. Keep the final filter strict. Detail enrichment should rescue real matches, not weaken business rules.
6. Persist the enriched evidence in run artifacts so the shortlist decision stays explainable.

The promise check should not require a perfect card. A single strong title match can still justify opening detail if the card already hints at fit through non-location signals such as:

- modality
- education-like terms
- experience-like terms

Recommended shape:

```js
const candidates = jobs
  .map((job) => ({
    job,
    titleMatches: collectTitleMatches(job.title, profile),
    previewSignals: collectPreviewSignals(job, profile),
    isRecent: normalizePublicationDate(job.publicationDateRaw, { now }).isRecent,
  }))
  .filter(({ job, titleMatches, previewSignals, isRecent }) =>
    job.url &&
    isRecent &&
    (
      titleMatches.length >= 2 ||
      (titleMatches.length >= 1 &&
        countNonLocationSignalGroups(previewSignals) >= 1 &&
        countSignalGroups(previewSignals) >= 2)
    )
  )
  .slice(0, maxDetailViewsPerKeyword);
```

Recommended merge shape:

```js
return {
  ...job,
  detailDescription: detail.description,
  experience: detail.experience || job.experience || "",
  education: detail.education || job.education || "",
  modality: detail.modality || job.modality || "",
};
```

This keeps the expensive part bounded while still letting the final filter see the real evidence that lives in the vacancy detail page.

## Why This Matters

Without this pattern, the batch makes a bad trade:

- keeping the filter strict protects shortlist quality
- but card-only evaluation can silently drop real matches

Opening every detail page is not a good answer either. It slows the batch, increases portal fragility, and makes failures harder to recover from.

Selective detail enrichment is the middle path:

- the card remains the first-pass gate
- detail is used only when the card is promising but incomplete
- the final shortlist still depends on real profile signals

This is especially important for authenticated portals, where a reusable session is expensive and the batch should spend that session on the most informative pages.

## When to Apply

- When a portal card often shows generic tags, equivalent positions, or marketing copy instead of real requirements
- When the detail page reliably exposes richer description, experience, education, or modality data
- When the filter requires at least one non-location signal and card-only extraction misses it
- When a portal-specific parser is being promoted from "good enough for cards" to "safe for shortlist decisions"

Do not apply this by opening every result detail page. The point is selective enrichment, not exhaustive crawling.

## Examples

Example of the rescued `Elempleo` case:

- Card title: `Analista gestion de riesgos`
- Card snippet: `analista de riesgos | Administrador de empresas, Ingeniero industrial`
- Pre-enrichment result: discarded as `missing-description-signals`
- Post-enrichment result: shortlisted with `priority: high` and `score: 15`

Example of the reusable lesson:

- The portal-specific part is the detail parser.
- The reusable part is the flow: card first, bounded detail second, strict filter last.

That means future platforms should not copy `Elempleo` selectors blindly. They should reuse the same decision pattern with their own detail parser and selectors.

## Related

- `AGENTS.md`
- `job-search-profile.md`
- `app/adapters/auth-elempleo.adapter.js`
- `app/services/filter-jobs.service.js`
- `scripts/run-elempleo-batch.js`
- `docs/solutions/best-practices/portal-multipage-search-scoring-and-deduplication-2026-05-10.md`
- `docs/solutions/best-practices/authenticated-portal-location-validation-and-indeterminate-location-handling-2026-05-11.md`
- `data/runs/2026-05-12T22-15-37-048Z.json`
