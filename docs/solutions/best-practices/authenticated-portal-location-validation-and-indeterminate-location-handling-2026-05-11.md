---
title: Authenticated portal location validation and indeterminate location handling
date: 2026-05-11
category: best-practices
module: job-search-batch
problem_type: best_practice
component: assistant
severity: high
applies_when:
  - An authenticated portal must survive a real post-login search before batch execution
  - A portal supports multipage keyword search and shortlist generation
  - Card extraction may fail to expose a trustworthy location for some vacancies
  - The shortlist must respect target location rules from job-search-profile.md
tags:
  - authenticated-search
  - computrabajo
  - elempleo
  - location-validation
  - shortlist-quality
  - multipage-pagination
---

# Authenticated portal location validation and indeterminate location handling

## Context

Recent authenticated portal runs on `Elempleo` and `Computrabajo` showed that a portal can look healthy while still leaking bad shortlist quality in two different ways: the session may not truly survive a real search, and the card parser may fail to recover location cleanly enough to enforce target-city rules.

The `Computrabajo` batch exposed both sides of that risk. Real post-login validation worked, multipage search worked, and cross-keyword aggregation worked, but one shortlisted vacancy from `Yumbo, Valle del Cauca` still reached `job_postings_to_check.md` because the business rule for location was too permissive and the card parser did not always capture location reliably.

## Guidance

Use this flow for authenticated portal batches:

1. Validate authentication with a real post-login search, not just a successful home page load.
2. Read the multipage click cap from `job-search-profile.md` before running each keyword.
3. Aggregate results across all visited pages and keywords before filtering and scoring.
4. Treat target location as a required shortlist condition by default.
5. Do not let location be the only useful description signal. A vacancy still needs at least one additional useful signal such as experience, education, or modality.
6. If the listing card does not expose a reliable location, attempt an additional validation step before discarding the vacancy.
7. If the additional validation still cannot determine the location, do not discard the vacancy for that reason alone. Allow it to continue only if it still passes the other filters.
8. If that indeterminate-location vacancy survives into `job_postings_to_check.md`, add the exact note `ubicacion no es posible de determinar`.

For `Computrabajo`, prefer extracting these card fields explicitly instead of using broad `textContent` fallbacks:

- `h2 a.js-o-link` for title and canonical vacancy URL
- `[offer-grid-article-company-url]` for company
- `p.fs16.fc_base.mt5 span` for location
- `div.fs13.mt15` for modality
- `p.fs13.fc_aux.mt15` for visible publication date

## Why This Matters

Without this rule set, shortlist quality drifts in ways that are hard to notice at first:

- authenticated support looks complete even when the session has not survived a real search
- multipage acquisition increases coverage but also increases the impact of parser mistakes
- a strong title plus recency can incorrectly keep out-of-scope vacancies when location is not enforced
- weak card extraction can silently hide location and produce misleading shortlist confidence

The important nuance is that `location missing` and `location outside target` are not the same condition. A vacancy outside the target location should be discarded. A vacancy whose location remains indeterminate even after extra validation should be allowed through only with explicit reviewer-facing uncertainty.

## When to Apply

- When a portal is authenticated and must prove reusable-session behavior with evidence
- When keyword-by-keyword portal runs use multipage navigation
- When card parsers are good enough for first-pass shortlist logic but not always perfect
- When human review depends on `job_postings_to_check.md` being both selective and honest about uncertainty

## Examples

Example of the rule that should now apply:

- A `Computrabajo` vacancy in `Yumbo, Valle del Cauca` should not survive just because the title matches `cumplimiento` and the card exposes `Presencial`.
- A vacancy with no recoverable location after extra validation may still survive, but the report must include `ubicacion no es posible de determinar`.

Example of the parser shape that proved more reliable on `Computrabajo`:

```js
const title = card.querySelector("h2 a.js-o-link")?.textContent || "";
const url = new URL(card.querySelector("h2 a.js-o-link")?.getAttribute("href") || "", "https://co.computrabajo.com").toString();
const company = card.querySelector("[offer-grid-article-company-url]")?.textContent || "";
const location = card.querySelector("p.fs16.fc_base.mt5 span")?.textContent || "";
const modality = card.querySelector("div.fs13.mt15")?.textContent || "";
const publicationDateRaw = card.querySelector("p.fs13.fc_aux.mt15")?.textContent || "";
```

Example of the shortlist exception handling:

```js
if (matchedSignals.location.length === 0 && locationValidationStatus === "undetermined") {
  job.locationNote = "ubicacion no es posible de determinar";
}
```

## Related

- `job-search-profile.md`
- `AGENTS.md`
- `docs/solutions/best-practices/portal-multipage-search-scoring-and-deduplication-2026-05-10.md`
- `results/computrabajo-batch-summary-latest.json`
- `job_postings_to_check.md`
