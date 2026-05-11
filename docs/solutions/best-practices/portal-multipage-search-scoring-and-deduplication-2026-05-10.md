---
title: Reusable multipage portal search, scoring, and deduplication pattern
date: 2026-05-10
category: best-practices
module: job-search-batch
problem_type: best_practice
component: assistant
severity: high
applies_when:
  - A portal returns many results across multiple pages for one keyword
  - A portal search is repeated across several keywords from job-search-profile.md
  - The batch needs one consolidated shortlist instead of per-keyword result piles
tags:
  - portal-search
  - multipage-pagination
  - result-deduplication
  - scoring
  - authenticated-search
  - elempleo
---

# Reusable multipage portal search, scoring, and deduplication pattern

## Context

`Elempleo` exposed a reusable search pattern that applies to the other portals in `URL_plataformas.md`: one real post-login search can return many result pages, and the same vacancy can appear under multiple keywords. A one-page extractor undercounts coverage, while a per-keyword report without deduplication overstates opportunity volume.

The concrete exercise on `Elempleo` searched 13 primary title keywords, paged through up to 7 `Siguiente` clicks per keyword, and produced these stages:

- 1330 raw result appearances across keyword/page combinations
- 1077 unique vacancies after URL-based deduplication
- 1069 unique vacancies after enriched extraction cleanup
- 6 final shortlisted vacancies after filter, recency validation, and scoring

This also surfaced an important regression: the recency parser was incorrectly treating strings like `Hace 1 semana` and `Hace 1 mes` as recent because alias matching was too broad.

## Guidance

Use the following flow for any portal that can return multiple pages for the same query:

1. Validate authentication first with a real post-login search, not just a successful home page load.
2. Search one keyword at a time using the source-of-truth keywords from `job-search-profile.md`.
3. For each keyword, paginate forward until one of these stop conditions happens:
   - the configured page cap is reached
   - the `Siguiente` control disappears
   - the `Siguiente` control stops changing the URL
4. Extract result-card metadata from the listing page before opening detail pages:
   - title
   - canonical vacancy URL
   - company
   - visible publication date
   - visible location
   - snippet text
   - any embedded structured metadata (for `Elempleo`, `data-ga4-offerdata`)
5. Aggregate results across all visited pages and all searched keywords.
6. Deduplicate by exact vacancy URL before applying shortlist logic.
7. Run filtering and scoring only after the aggregate result set is consolidated.
8. Persist intermediate artifacts incrementally so a partially completed run still leaves evidence.

Recommended pagination shape:

```js
for (let pageIndex = 1; pageIndex <= 8; pageIndex += 1) {
  extractCurrentResults();

  if (pageIndex === 8) break;

  const nextHref = await page.locator("a.js-btn-next").first().getAttribute("href").catch(() => null);
  if (!nextHref || nextHref === page.url()) break;

  const previousUrl = page.url();
  await page.locator("a.js-btn-next").first().click();
  await page.waitForURL((url) => url.href !== previousUrl, { timeout: 15000 });
}
```

Recommended aggregation and deduplication shape:

```js
const aggregated = new Map();

for (const job of extractedJobs) {
  const existing = aggregated.get(job.url);
  aggregated.set(job.url, mergeJob(existing, job, keyword, pageInfo));
}

const aggregatedJobs = [...aggregated.values()];
const filtered = filterCandidateJobs({ jobs: aggregatedJobs, profile, now: new Date() });
const scored = scoreCandidateJobs({ jobs: filtered.keptJobs });
const shortlisted = dedupeScoredJobs({ jobs: scored });
```

For portals like `Elempleo`, enrich the card extraction with any embedded metadata on the result tile before considering detail-page fetches. `data-ga4-offerdata` was enough to recover location, salary, and extra context without opening 1000+ vacancy pages.

Also keep the recency parser strict. Relative-day aliases must only match true day-level values (`hoy`, `ayer`, `hace 2 dias`). Do not let loose alias matching accidentally treat `Hace 1 semana` or `Hace 1 mes` as recent.

## Why This Matters

Without this pattern, portal support looks healthier than it really is:

- single-page extraction misses most of the searchable inventory
- keyword-by-keyword output inflates counts because the same vacancy appears several times
- scoring before consolidation wastes work and can rank duplicates as separate opportunities
- loose recency parsing can promote stale jobs into the shortlist
- a portal may appear “supported” even though the reusable session never survives a real search

The `Elempleo` run demonstrated all of these risks in one place. Before fixing recency, the shortlist ballooned to 109 results; after correcting the parser and reprocessing the same aggregate data, the shortlist dropped to 6 credible recent vacancies.

## When to Apply

- When a portal exposes explicit next-page navigation like `Siguiente`
- When the same portal is searched with multiple keywords in one run
- When portal cards contain enough snippet metadata to support first-pass filtering
- When authenticated portals need evidence that the session survives actual search navigation
- When a portal-specific adapter is being promoted from probe/experiment to reusable batch flow

## Examples

Example from `Elempleo`:

- Real auth validation succeeded only when the saved `storageState` could reopen `homeusuario`, submit `compliance`, and land on `/ofertas-empleo/trabajo-compliance`
- Pagination used `a.js-btn-next`
- Multipage crawl covered 70 result pages across 13 keywords
- Exact-URL dedupe removed 253 duplicate appearances from the initial result pool

Example of the recency bug that should not recur:

```js
for (const [alias, daysAgo] of RELATIVE_DAY_ALIASES.entries()) {
  if (normalizedValue === alias) {
    return daysAgo;
  }
}
```

This exact matching is safer than broad substring matching. Broad matching caused `1` in `Hace 1 mes` and `Hace 1 semana` to be interpreted as if the job were one day old.

Example of a remaining limitation:

- Listing-page snippets can still overstate fit because they may mention multiple cities or generic requirement text.
- The next refinement step for other portals is: multipage aggregate first, then enrich only the final shortlist by opening each vacancy detail page.

## Related

- `URL_plataformas.md`
- `job-search-profile.md`
- `docs/superpowers/specs/2026-05-06-job-search-batch-design.md`
- `docs/superpowers/plans/2026-05-09-real-portal-search-adapters-implementation-plan.md`
- `results/elempleo-multipage-exercise-latest.json`
- `results/elempleo-multipage-deduped-latest.json`
- `results/elempleo-shortlist-latest.json`
