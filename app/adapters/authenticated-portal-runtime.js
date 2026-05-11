import { createAcquireResult } from "./source-adapter.js";

export function classifyAuthenticatedPortalVerdict(result) {
  if (!result.authenticatedBeforeSearch) {
    return "needs-user-decision";
  }

  if (!result.authenticatedAfterSearch) {
    return "needs-user-decision";
  }

  if (result.verdict === "search-success" && (result.jobs || []).length > 0) {
    return "success";
  }

  if (result.verdict === "search-success") {
    return "no-results";
  }

  if (result.verdict === "search-error") {
    return "retry-later";
  }

  return "needs-user-decision";
}

export async function buildAuthenticatedAcquireResult(source, portalSearchResult) {
  const status = classifyAuthenticatedPortalVerdict(portalSearchResult);
  const note =
    status === "success"
      ? "Authenticated search completed with reusable evidence."
      : portalSearchResult.error?.message ||
        `Authenticated search verdict: ${portalSearchResult.verdict}`;

  return createAcquireResult(source, {
    status,
    note,
    jobs: portalSearchResult.jobs || [],
  });
}
