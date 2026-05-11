import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
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

  const absolute = new URL(raw, "https://co.computrabajo.com");
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

async function extractPageJobs(page) {
  return page.locator("article.box_offer").evaluateAll((articles) =>
    articles.map((article) => {
      const titleLink = article.querySelector("h2 a.js-o-link");
      const companyLink = article.querySelector("[offer-grid-article-company-url]");
      const locationNode = article.querySelector("p.fs16.fc_base.mt5 span");
      const modalityNode = article.querySelector("div.fs13.mt15");
      const publicationDateNode = article.querySelector("p.fs13.fc_aux.mt15");
      const title = titleLink?.textContent || "";
      const url = titleLink?.getAttribute("href") || "";
      const company = companyLink?.textContent || "";
      const location = locationNode?.textContent || "";
      const modality = modalityNode?.textContent || "";
      const publicationDateRaw = publicationDateNode?.textContent || "";
      const description = [title, company, location, modality, publicationDateRaw]
        .filter(Boolean)
        .join(" | ");

      return { title, url, company, location, modality, publicationDateRaw, description };
    }),
  );
}

async function persistKeywordArtifacts({ workspaceRoot, page, keyword, payload }) {
  const keywordSlug = buildKeywordSlug(keyword);
  const resultPath = path.join(workspaceRoot, "results", `computrabajo-post-login-search-${keywordSlug}.json`);
  const screenshotPath = path.join(workspaceRoot, "results", `computrabajo-post-login-search-${keywordSlug}.png`);

  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
  await fs.writeFile(resultPath, JSON.stringify({ ...payload, screenshotPath }, null, 2), "utf8");

  return {
    jsonPath: resultPath,
    screenshotPath,
  };
}

async function ensureBatchProfileCopy(workspaceRoot) {
  const sourceDir = path.join(workspaceRoot, "persistent-profiles", "computrabajo");
  const targetDir = path.join(workspaceRoot, "persistent-profiles", "computrabajo-batch-run");

  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.cp(sourceDir, targetDir, { recursive: true, force: true });

  return targetDir;
}

async function main() {
  const workspaceRoot = process.cwd();
  const profile = await loadSearchProfile({ repoRoot: workspaceRoot });
  const { allSources } = await loadSources({ repoRoot: workspaceRoot });
  const source = allSources.find((item) => item.portalKey === "computrabajo");

  if (!source) {
    throw new Error("Computrabajo source not found in URL_plataformas.md");
  }

  const authConfig = getPortalConfig("computrabajo");
  const portalConfig = getPostLoginSearchConfig("computrabajo");
  const searchedKeywords = profile.primaryTitleKeywords;
  const nextClicksLimit = profile.multipageNextClicks || 0;
  const userDataDir = await ensureBatchProfileCopy(workspaceRoot);

  const context = await chromium.launchPersistentContext(userDataDir, { headless: false });
  const page = context.pages()[0] || (await context.newPage());
  const aggregated = new Map();
  const keywordRuns = [];

  try {
    await page.goto(portalConfig.targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    const accessSignals = await collectPageSignals(page, context);
    const authenticatedBeforeBatch = authConfig.detectAuthenticated(accessSignals);

    if (!authenticatedBeforeBatch) {
      throw new Error("Computrabajo session is not authenticated before batch start.");
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
        const extractedJobs = await extractPageJobs(page);
        pagesVisited.push({ pageNumber, url: page.url(), jobs: extractedJobs.length });

        for (const rawJob of extractedJobs) {
          const normalized = {
            title: cleanText(rawJob.title),
            url: canonicalizeUrl(rawJob.url),
            company: cleanText(rawJob.company),
            location: cleanText(rawJob.location),
            modality: cleanText(rawJob.modality),
            publicationDateRaw: cleanText(rawJob.publicationDateRaw),
            description: cleanText(rawJob.description),
          };

          if (!normalized.title || !normalized.url.includes("/ofertas-de-trabajo/")) {
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

        const nextLocator = page.locator('span.buildLink[title="Siguiente"]').first();
        if ((await nextLocator.count()) < 1) {
          stopReason = "next-control-missing";
          break;
        }

        const previousUrl = page.url();
        await nextLocator.click();
        await page.waitForURL((url) => url.href !== previousUrl, { timeout: 15000 }).catch(() => {});
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
          portal: "computrabajo",
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
  }

  const aggregatedJobs = [...aggregated.values()];
  const filtered = filterCandidateJobs({ jobs: aggregatedJobs, profile, now: new Date() });
  const scored = scoreCandidateJobs({ jobs: filtered.keptJobs });
  const selectedJobs = dedupeScoredJobs({ jobs: scored });
  const sourceStatus = {
    sourceId: source.sourceId,
    displayName: source.displayName,
    status: "success",
    note: `Batch completo ejecutado para Computrabajo con ${searchedKeywords.length} keywords y hasta ${nextClicksLimit} clicks en Siguiente por keyword.`,
  };
  const runRecord = {
    runId: new Date().toISOString().replace(/[:.]/g, "-"),
    keyword: "all-primary-keywords",
    portal: "computrabajo",
    searchedKeywords,
    multipageNextClicksConfigured: nextClicksLimit,
    selectedJobs,
    discardedJobs: filtered.discardedJobs,
    sourceStatuses: [sourceStatus],
  };
  const artifactPaths = await writeJobSearchArtifacts({ workspaceRoot, runRecord });

  await fs.writeFile(
    path.join(workspaceRoot, "results", "computrabajo-keyword-aggregate-latest.json"),
    JSON.stringify(
      {
        portal: "computrabajo",
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
    path.join(workspaceRoot, "results", "computrabajo-batch-summary-latest.json"),
    JSON.stringify(
      {
        portal: "computrabajo",
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
        portal: "computrabajo",
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
        summaryPath: path.join(workspaceRoot, "results", "computrabajo-batch-summary-latest.json"),
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
