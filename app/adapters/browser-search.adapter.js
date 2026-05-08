import fs from "node:fs/promises";
import path from "node:path";
import { createAcquireResult } from "./source-adapter.js";

function buildAggregateResultPath(workspaceRoot, keyword) {
  return path.join(
    workspaceRoot,
    "results",
    `post-login-search-${keyword.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`,
  );
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

    return createAcquireResult(source, {
      status: cachedResult.verdict === "search-success" ? "success" : "needs-user-decision",
      note: "Loaded from cached validated post-login evidence.",
      jobs: cachedResult.jobs || [],
    });
  };
}
