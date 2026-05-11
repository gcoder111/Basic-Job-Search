import { createAcquireResult } from "./source-adapter.js";
import { getPortalSearchConfig } from "../config/portal-search-config.js";
import { acquireLinkedinJobs } from "./public-linkedin.adapter.js";
import { acquireMagnetoJobs } from "./public-magneto.adapter.js";
import { acquireMichaelPageJobs } from "./public-michaelpage.adapter.js";
import { acquireAdeccoJobs } from "./public-adecco.adapter.js";

const publicAdapters = {
  linkedin: acquireLinkedinJobs,
  magneto: acquireMagnetoJobs,
  adecco: acquireAdeccoJobs,
  michaelpage: acquireMichaelPageJobs,
};

export async function acquireFromGenericBoard(source, context = {}) {
  const portalConfig = getPortalSearchConfig(source.portalKey);
  const adapter = publicAdapters[source.portalKey];

  if (context.useCachedResults) {
    return createAcquireResult(source, {
      status: "no-results",
      note: "Cached mode skips live public portal navigation.",
      jobs: [],
    });
  }

  if (adapter && context.workspaceRoot && context.keyword) {
    try {
      return await adapter({
        ...context,
        source,
        portalConfig: {
          ...portalConfig,
          startUrl: source.url,
        },
      });
    } catch (error) {
      return createAcquireResult(source, {
        status: "retry-later",
        note: error?.message || "Public portal search failed.",
        jobs: [],
      });
    }
  }

  return createAcquireResult(source, {
    status: "no-results",
    note: "Public portal adapter not implemented yet for this portal.",
    jobs: [],
  });
}
