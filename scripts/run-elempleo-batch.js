import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import {
  enrichElempleoJobsWithDetails,
  extractElempleoJobsFromHtml,
} from "../app/adapters/auth-elempleo.adapter.js";
import { loadSearchProfile } from "../app/services/load-search-profile.js";
import { loadSources } from "../app/services/load-sources.service.js";
import { filterCandidateJobs } from "../app/services/filter-jobs.service.js";
import { scoreCandidateJobs } from "../app/services/score-jobs.service.js";
import { dedupeScoredJobs } from "../app/services/dedupe-jobs.service.js";
import { writeJobSearchArtifacts } from "../app/services/report-writer.service.js";
import { getPostLoginSearchConfig } from "../app/experiments/post-login-search-config.js";
import { getPortalConfig } from "../app/experiments/portal-auth-config.js";
import {
  buildKeywordSlug,
  collectPageSignals,
  submitPortalSearch,
} from "../app/experiments/post-login-search-helpers.js";

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function canonicalizeUrl(url) {
  const raw = cleanText(url);
  if (!raw) {
    return "";
  }

  const absolute = new URL(raw, "https://www.elempleo.com");
  absolute.hash = "";
  return absolute.toString();
}

function buildFingerprint(url, title, company) {
  return url || `${cleanText(title).toLowerCase()}::${cleanText(company).toLowerCase()}`;
}

function mergeJob(existing, incoming, source, keyword, pageNumber) {
  if (!existing) {
    return {
      ...incoming,
      sourceId: source.sourceId,
      portalKey: source.portalKey,
      sourceDisplayName: source.displayName,
      searchKeywords: [keyword],
      pagesSeen: [pageNumber],
      appearanceCount: 1,
    };
  }

  return {
    ...existing,
    title: cleanText(incoming.title).length > cleanText(existing.title).length ? incoming.title : existing.title,
    company:
      cleanText(incoming.company).length > cleanText(existing.company).length
        ? incoming.company
        : existing.company,
    location:
      cleanText(incoming.location).length > cleanText(existing.location).length
        ? incoming.location
        : existing.location,
    modality:
      cleanText(incoming.modality).length > cleanText(existing.modality).length
        ? incoming.modality
        : existing.modality,
    publicationDateRaw: existing.publicationDateRaw || incoming.publicationDateRaw,
    description:
      cleanText(incoming.description).length > cleanText(existing.description).length
        ? incoming.description
        : existing.description,
    searchKeywords: [...new Set([...(existing.searchKeywords || []), keyword])],
    pagesSeen: [...new Set([...(existing.pagesSeen || []), pageNumber])].sort((left, right) => left - right),
    appearanceCount: (existing.appearanceCount || 0) + 1,
  };
}

async function fetchElempleoDetailText(page, jobUrl) {
  const detailPage = await page.context().newPage();

  try {
    await detailPage.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await detailPage.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => {});
    await detailPage.waitForTimeout(1000);
    return await detailPage.locator("body").innerText();
  } finally {
    await detailPage.close().catch(() => {});
  }
}

async function extractPageJobs(page, profile) {
  const jobs = await extractElempleoJobsFromHtml(await page.content());
  const enrichedJobs = await enrichElempleoJobsWithDetails({
    jobs,
    profile,
    now: new Date(),
    fetchDetailText: async (job) => fetchElempleoDetailText(page, job.url),
  });

  return enrichedJobs.map((job) => ({
    title: cleanText(job.title),
    url: canonicalizeUrl(job.url),
    company: cleanText(job.company),
    location: cleanText(job.location),
    modality: cleanText(job.modality),
    publicationDateRaw: cleanText(job.publicationDateRaw),
    description: cleanText(job.description),
    detailDescription: cleanText(job.detailDescription),
    experience: cleanText(job.experience),
    education: cleanText(job.education),
  }));
}

async function persistKeywordArtifacts({ workspaceRoot, page, keyword, payload }) {
  const keywordSlug = buildKeywordSlug(keyword);
  const resultPath = path.join(workspaceRoot, "results", `elempleo-post-login-search-${keywordSlug}.json`);
  const screenshotPath = path.join(workspaceRoot, "results", `elempleo-post-login-search-${keywordSlug}.png`);

  await fs.mkdir(path.dirname(resultPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
  await fs.writeFile(resultPath, JSON.stringify({ ...payload, screenshotPath }, null, 2), "utf8");

  return {
    jsonPath: resultPath,
    screenshotPath,
  };
}

async function main() {
  const workspaceRoot = process.cwd();
  const profile = await loadSearchProfile({ repoRoot: workspaceRoot });
  const { allSources } = await loadSources({ repoRoot: workspaceRoot });
  const source = allSources.find((item) => item.portalKey === "elempleo");

  if (!source) {
    throw new Error("Elempleo source not found in URL_plataformas.md");
  }

  const authConfig = getPortalConfig("elempleo");
  const portalConfig = getPostLoginSearchConfig("elempleo");
  const searchedKeywords = profile.primaryTitleKeywords;
  const nextClicksLimit = profile.multipageNextClicks || 0;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: path.join(workspaceRoot, "auth-state", "elempleo.json"),
  });
  const page = await context.newPage();
  const aggregated = new Map();
  const keywordRuns = [];

  try {
    await page.goto(portalConfig.targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    const accessSignals = await collectPageSignals(page, context);
    const authenticatedBeforeBatch = authConfig.detectAuthenticated(accessSignals);

    if (!authenticatedBeforeBatch) {
      throw new Error("Elempleo session is not authenticated before batch start.");
    }

    for (const keyword of searchedKeywords) {
      await page.goto(portalConfig.targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1500);

      const beforeSignals = await collectPageSignals(page, context);
      const authenticatedBeforeSearch = authConfig.detectAuthenticated(beforeSignals);

      await submitPortalSearch(page, portalConfig, keyword);
      await page.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(2500);

      const pagesVisited = [];
      let nextClicksPerformed = 0;
      let pageNumber = 1;
      let stopReason = "configured-next-click-limit-reached";

      while (true) {
        const extractedJobs = await extractPageJobs(page, profile);
        pagesVisited.push({ pageNumber, url: page.url(), jobs: extractedJobs.length });

        for (const normalized of extractedJobs) {
          if (!normalized.title || !normalized.url.includes("/ofertas-trabajo/")) {
            continue;
          }

          const fingerprint = buildFingerprint(normalized.url, normalized.title, normalized.company);
          aggregated.set(
            fingerprint,
            mergeJob(aggregated.get(fingerprint), normalized, source, keyword, pageNumber),
          );
        }

        if (nextClicksPerformed >= nextClicksLimit) {
          stopReason = "configured-next-click-limit-reached";
          break;
        }

        const nextLocator = page.locator("a.js-btn-next").first();
        if ((await nextLocator.count()) < 1) {
          stopReason = "next-control-missing";
          break;
        }

        const previousUrl = page.url();
        const nextHref = await nextLocator.getAttribute("href").catch(() => null);
        if (!nextHref) {
          stopReason = "next-control-missing";
          break;
        }

        const nextUrl = new URL(nextHref, previousUrl).toString();
        if (nextUrl === previousUrl) {
          stopReason = "next-click-did-not-change-url";
          break;
        }

        await page.goto(nextUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
        await page.waitForTimeout(2500);

        if (page.url() === previousUrl) {
          stopReason = "next-click-did-not-change-url";
          break;
        }

        nextClicksPerformed += 1;
        pageNumber += 1;
      }

      const afterSignals = await collectPageSignals(page, context);
      const authenticatedAfterSearch = authConfig.detectAuthenticated(afterSignals);
      const jobsForKeyword = pagesVisited.reduce((sum, item) => sum + item.jobs, 0);
      const verdict = authenticatedBeforeSearch && authenticatedAfterSearch ? "search-success" : "auth-lost";
      const artifacts = await persistKeywordArtifacts({
        workspaceRoot,
        page,
        keyword,
        payload: {
          portal: "elempleo",
          keyword,
          sessionStrategy: portalConfig.sessionStrategy,
          authenticatedBeforeSearch,
          authenticatedAfterSearch,
          verdict,
          pagesVisited,
          nextClicksConfigured: nextClicksLimit,
          nextClicksPerformed,
          stopReason,
          jobs: jobsForKeyword,
        },
      });

      keywordRuns.push({
        keyword,
        verdict,
        authenticatedBeforeSearch,
        authenticatedAfterSearch,
        jobs: jobsForKeyword,
        pagesVisited,
        nextClicksConfigured: nextClicksLimit,
        nextClicksPerformed,
        stopReason,
        ...artifacts,
      });
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const aggregatedJobs = [...aggregated.values()];
  const filtered = filterCandidateJobs({ jobs: aggregatedJobs, profile, now: new Date() });
  const scored = scoreCandidateJobs({ jobs: filtered.keptJobs });
  const selectedJobs = dedupeScoredJobs({ jobs: scored });
  const sourceStatus = {
    sourceId: source.sourceId,
    displayName: source.displayName,
    status: "success",
    note: `Batch completo ejecutado para Elempleo con ${searchedKeywords.length} keywords y hasta ${nextClicksLimit} clicks en Siguiente por keyword.`,
  };
  const runRecord = {
    runId: new Date().toISOString().replace(/[:.]/g, "-"),
    keyword: "all-primary-keywords",
    portal: "elempleo",
    searchedKeywords,
    multipageNextClicksConfigured: nextClicksLimit,
    selectedJobs,
    discardedJobs: filtered.discardedJobs,
    sourceStatuses: [sourceStatus],
  };
  const artifactPaths = await writeJobSearchArtifacts({ workspaceRoot, runRecord });

  await fs.writeFile(
    path.join(workspaceRoot, "results", "elempleo-keyword-aggregate-latest.json"),
    JSON.stringify(
      {
        portal: "elempleo",
        searchedKeywords,
        multipageNextClicksConfigured: nextClicksLimit,
        keywordRuns,
        rawAppearanceCount: keywordRuns.reduce((sum, run) => sum + run.jobs, 0),
        uniqueAggregatedCount: aggregatedJobs.length,
        jobs: aggregatedJobs,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );

  await fs.writeFile(
    path.join(workspaceRoot, "results", "elempleo-batch-summary-latest.json"),
    JSON.stringify(
      {
        portal: "elempleo",
        searchedKeywords,
        multipageNextClicksConfigured: nextClicksLimit,
        keywordRuns,
        rawAppearanceCount: keywordRuns.reduce((sum, run) => sum + run.jobs, 0),
        totalNextClicksPerformed: keywordRuns.reduce((sum, run) => sum + run.nextClicksPerformed, 0),
        uniqueAggregatedCount: aggregatedJobs.length,
        filteredInCount: filtered.keptJobs.length,
        discardedCount: filtered.discardedJobs.length,
        shortlistedCount: selectedJobs.length,
        artifactPaths,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        portal: "elempleo",
        searchedKeywords: searchedKeywords.length,
        multipageNextClicksConfigured: nextClicksLimit,
        totalNextClicksPerformed: keywordRuns.reduce((sum, run) => sum + run.nextClicksPerformed, 0),
        rawAppearanceCount: keywordRuns.reduce((sum, run) => sum + run.jobs, 0),
        uniqueAggregatedCount: aggregatedJobs.length,
        filteredInCount: filtered.keptJobs.length,
        discardedCount: filtered.discardedJobs.length,
        shortlistedCount: selectedJobs.length,
        markdownPath: artifactPaths.markdownPath,
        latestRunPath: artifactPaths.latestPath,
        summaryPath: path.join(workspaceRoot, "results", "elempleo-batch-summary-latest.json"),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
