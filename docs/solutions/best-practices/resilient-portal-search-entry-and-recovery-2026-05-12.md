---
title: Resilient portal search entry and recovery
date: 2026-05-12
category: best-practices
module: job-search-batch
problem_type: best_practice
component: assistant
severity: high
applies_when:
  - A portal batch must search multiple keywords in sequence
  - A portal search box is not reliably present after every navigation
  - An authenticated session survives, but the search entry UI is brittle
  - A portal exposes a stable search-results URL pattern that can be used as fallback
tags:
  - authenticated-search
  - search-recovery
  - elempleo
  - computrabajo
  - portal-helpers
---

# Resilient portal search entry and recovery

## Context

`Elempleo` exposed a recurring portal problem: the reusable authenticated session was valid, but the batch sometimes failed before searching the next keyword because the expected search input was not present or ready on the page that had just loaded.

The failure mode was not `login lost`. It was `search entry lost`. That distinction matters because the right fix is not to refresh auth blindly, but to recover a reliable way to launch the next search.

## Guidance

Use a resilient search-entry helper for portal batches instead of calling `fill()` directly on one selector.

Recommended recovery order:

1. Try the primary input selector on the current page.
2. Try any portal-specific alternate input selectors on the current page.
3. Re-enter one or more known search-entry URLs and retry the UI selectors.
4. If the portal has a stable search-results URL pattern, navigate directly to that URL as a final fallback.
5. If all strategies fail, raise one explicit error with the selectors and recovery attempts used.

Recommended config shape:

```js
{
  targetUrl: "https://www.elempleo.com/co/homeusuario",
  searchEntryUrls: ["https://www.elempleo.com/co/homeusuario"],
  keywordInputSelector: "input.js-searchbox-input.tt-input",
  keywordInputAlternates: ["input.js-searchbox-input"],
  submitAction: "click",
  submitButtonSelector: "button.js-searchHeader",
  directSearchUrlPattern: "https://www.elempleo.com/co/ofertas-empleo/trabajo-{keywordSlug}",
}
```

Recommended helper shape:

```js
const currentPageAttempt = await trySubmitSearchThroughUi(page, config, keyword, selectors, errors);
if (currentPageAttempt) return currentPageAttempt;

for (const recoveryUrl of config.searchEntryUrls) {
  await page.goto(recoveryUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  const recoveredAttempt = await trySubmitSearchThroughUi(page, config, keyword, selectors, errors);
  if (recoveredAttempt) return recoveredAttempt;
}

const directSearchUrl = buildPortalDirectSearchUrl(config, keyword);
if (directSearchUrl) {
  await page.goto(directSearchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  return { strategy: "direct-url", directSearchUrl };
}
```

## Why This Matters

Without this pattern, a portal can appear unstable even though the session is healthy. The batch then fails for the wrong reason:

- search loops stop early even when auth is still valid
- the same portal may pass one real post-login search but fail later in the keyword loop
- troubleshooting becomes noisy because `input missing` gets misread as `portal blocked`
- each portal script ends up re-implementing ad hoc recovery logic

This recovery pattern makes the failure mode honest and reusable. It keeps portal-specific knowledge in config and leaves the execution logic in one shared helper.

## When to Apply

- When a portal batch iterates several keywords in one run
- When the portal UI is partially dynamic or occasionally hides the search input
- When authenticated sessions remain valid but the search-entry surface is inconsistent
- When the portal exposes a deterministic search-results URL that can stand in for a UI submission

## Examples

Example from `Elempleo`:

- primary UI selector: `input.js-searchbox-input.tt-input`
- alternate UI selector: `input.js-searchbox-input`
- fallback URL pattern: `https://www.elempleo.com/co/ofertas-empleo/trabajo-{keywordSlug}`

This let the batch continue searching even when the personalized home page did not expose the expected search box consistently.

Example of a portal without direct URL fallback:

- `Computrabajo` can still use the same helper for current-page selector checks and recovery URLs
- if it lacks a stable direct-search URL pattern, it can leave `directSearchUrlPattern` as `null`

## Related

- `app/experiments/post-login-search-config.js`
- `app/experiments/post-login-search-helpers.js`
- `scripts/run-elempleo-batch.js`
- `docs/solutions/best-practices/portal-multipage-search-scoring-and-deduplication-2026-05-10.md`
