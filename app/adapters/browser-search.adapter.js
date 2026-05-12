import fs from "node:fs/promises";
import path from "node:path";
import { createAcquireResult } from "./source-adapter.js";
import { buildAuthenticatedAcquireResult } from "./authenticated-portal-runtime.js";
import { getComputrabajoLiveSearchOptions } from "./auth-computrabajo.adapter.js";
import { getElempleoLiveSearchOptions } from "./auth-elempleo.adapter.js";
import { buildKeywordSlug } from "../experiments/post-login-search-helpers.js";
import { runPortalSearch } from "../experiments/post-login-search.js";

function buildAggregateResultPath(workspaceRoot, keyword) {
  return path.join(
    workspaceRoot,
    "results",
    `post-login-search-${buildKeywordSlug(keyword)}.json`,
  );
}

export function createBrowserSearchAdapter({
  workspaceRoot,
  keyword,
  profile = {},
  now = new Date(),
  useCachedResults,
}) {
  return async function acquireJobsFromBrowser(source, _phase, options = {}) {
    if (!useCachedResults) {
      const liveSearchOptionsByPortal = {
        computrabajo: getComputrabajoLiveSearchOptions,
        elempleo: () => getElempleoLiveSearchOptions({ profile, now }),
      };
      const liveSearchOptions = liveSearchOptionsByPortal[source.portalKey]?.() || {};
      const liveResult = await runPortalSearch(workspaceRoot, source.portalKey, keyword, {
        ...liveSearchOptions,
        ...options,
      });
      return buildAuthenticatedAcquireResult(source, liveResult);
    }

    let aggregate;
    try {
      aggregate = JSON.parse(
        await fs.readFile(buildAggregateResultPath(workspaceRoot, keyword), "utf8"),
      );
    } catch {
      return createAcquireResult(source, {
        status: "needs-user-decision",
        note: "No cached post-login aggregate evidence found.",
        jobs: [],
      });
    }

    const cachedResult = aggregate.results.find((result) => result.portal === source.portalKey);
    if (!cachedResult) {
      return createAcquireResult(source, {
        status: "no-results",
        note: "No cached result found.",
        jobs: [],
      });
    }

    return buildAuthenticatedAcquireResult(source, {
      ...cachedResult,
      error: cachedResult.error || null,
    });
  };
}
