import path from "node:path";
import { chromium } from "playwright";
import { buildKeywordSlug } from "../experiments/post-login-search-helpers.js";
import { cleanupJob } from "../utils/job-cleanup.js";
import { normalizeForMatch } from "../utils/normalize-text.js";
import { writeJsonFile } from "../utils/safe-json.js";

export function normalizeExtractedJobs(jobs = []) {
  return jobs.map(cleanupJob).filter((job) => job.title && job.url);
}

export function trimJobsToUniqueUrls(jobs = []) {
  const seen = new Set();
  const uniqueJobs = [];

  for (const job of jobs) {
    const key = normalizeForMatch(job.url);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueJobs.push(job);
  }

  return uniqueJobs;
}

export async function runPublicPortalSearch({
  workspaceRoot,
  source,
  keyword,
  portalConfig,
  extractJobs,
}) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const keywordSlug = buildKeywordSlug(keyword);
  const resultPath = path.join(
    workspaceRoot,
    "results",
    `${source.portalKey}-public-search-${keywordSlug}.json`,
  );
  const screenshotPath = path.join(
    workspaceRoot,
    "results",
    `${source.portalKey}-public-search-${keywordSlug}.png`,
  );

  try {
    await page.goto(portalConfig.startUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const extractedJobs = await extractJobs(page, keyword);
    const jobs = trimJobsToUniqueUrls(normalizeExtractedJobs(extractedJobs));

    await page.screenshot({ path: screenshotPath, fullPage: true });
    await writeJsonFile(resultPath, {
      portal: source.portalKey,
      keyword,
      verdict: jobs.length > 0 ? "search-success" : "no-results",
      jobCount: jobs.length,
      jobs,
      screenshotPath,
    });

    return {
      jobs,
      resultPath,
      screenshotPath,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}
