import { getPortalSearchConfig } from "./config/portal-search-config.js";
import { acquireFromAtsPage } from "./adapters/ats-page.adapter.js";
import { createBrowserSearchAdapter } from "./adapters/browser-search.adapter.js";
import { acquireFromGenericBoard } from "./adapters/generic-board.adapter.js";
import { loadSearchProfile } from "./services/load-search-profile.js";
import { loadSources } from "./services/load-sources.service.js";
import { orchestrateSearch } from "./services/orchestrate-search.service.js";
import { writeJobSearchArtifacts } from "./services/report-writer.service.js";

function parseArgs(argv) {
  const flags = new Set();
  let keywordOverride = null;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--keyword") {
      const nextToken = argv[index + 1];
      if (nextToken && !nextToken.startsWith("--")) {
        keywordOverride = nextToken;
        index += 1;
      }
      continue;
    }

    if (token.startsWith("--keyword=")) {
      keywordOverride = token.slice("--keyword=".length);
      continue;
    }

    if (token.startsWith("--")) {
      flags.add(token.replace(/^--/, ""));
    }
  }

  return { flags, keywordOverride };
}

const { flags, keywordOverride } = parseArgs(process.argv.slice(2));
const workspaceRoot = process.cwd();
const profile = await loadSearchProfile({ repoRoot: workspaceRoot });
const { allSources } = await loadSources({ repoRoot: workspaceRoot });
const keyword = keywordOverride || profile.primaryTitleKeywords[0] || "riesgo";
const useCachedResults = flags.has("cached");
const browserAdapter = createBrowserSearchAdapter({
  workspaceRoot,
  keyword,
  useCachedResults,
});

const runSummary = await orchestrateSearch({
  sources: allSources,
  profile,
  now: new Date(),
  acquireJobs: async (source, phase) => {
    const portalConfig = getPortalSearchConfig(source.portalKey);
    const accessMode = portalConfig?.accessMode || (source.requiresAuth ? "authenticated" : "public");

    if (accessMode === "authenticated") {
      return browserAdapter(source, phase);
    }

    return source.portalKey
      ? acquireFromGenericBoard(source, {
          workspaceRoot,
          keyword,
          phase,
          useCachedResults,
        })
      : acquireFromAtsPage(source);
  },
});

const runRecord = {
  runId: new Date().toISOString().replace(/[:.]/g, "-"),
  keyword,
  selectedJobs: runSummary.selectedJobs,
  discardedJobs: runSummary.discardedJobs,
  sourceStatuses: runSummary.sourceStatuses,
};

const artifactPaths = await writeJobSearchArtifacts({
  workspaceRoot,
  runRecord,
});

console.log(
  JSON.stringify(
    {
      selectedSourceCount: allSources.length,
      matchedJobs: runSummary.selectedJobs.length,
      markdownPath: artifactPaths.markdownPath,
      jsonPath: artifactPaths.jsonPath,
    },
    null,
    2,
  ),
);
