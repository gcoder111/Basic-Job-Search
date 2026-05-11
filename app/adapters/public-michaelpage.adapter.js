import { JSDOM } from "jsdom";
import { createAcquireResult } from "./source-adapter.js";
import { normalizeForMatch } from "../utils/normalize-text.js";
import { runPublicPortalSearch } from "./public-portal-runtime.js";

function toAbsoluteMichaelPageUrl(url = "") {
  if (!url) {
    return "";
  }

  return url.startsWith("http") ? url : `https://www.michaelpage.com.co${url}`;
}

export async function extractMichaelPageJobsFromHtml(html) {
  const document = new JSDOM(html).window.document;

  return [...document.querySelectorAll(".job-search-results__item, article")].map((card) => ({
    title: card.querySelector("a")?.textContent || "",
    company: "Michael Page",
    url: toAbsoluteMichaelPageUrl(card.querySelector("a")?.getAttribute("href") || ""),
    location: card.querySelector(".job-search-results__location")?.textContent || "",
    publicationDateRaw: card.querySelector("time, .job-search-results__date")?.textContent || "",
    description: card.querySelector(".job-search-results__job-description")?.textContent || card.textContent || "",
  }));
}

export async function acquireMichaelPageJobs({
  workspaceRoot,
  source,
  keyword,
  portalConfig,
}) {
  const { jobs } = await runPublicPortalSearch({
    workspaceRoot,
    source,
    keyword,
    portalConfig: {
      startUrl: portalConfig.startUrl || source.url,
    },
    extractJobs: async (page, currentKeyword) => {
      const searchInput = page
        .locator('input[type="search"], input[name*="search" i], input[placeholder*="search" i]')
        .first();

      if ((await searchInput.count().catch(() => 0)) > 0) {
        await searchInput.fill(currentKeyword);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2000);
      }

      const extractedJobs = await extractMichaelPageJobsFromHtml(await page.content());
      const normalizedKeyword = normalizeForMatch(currentKeyword);

      return extractedJobs.filter((job) =>
        normalizeForMatch(`${job.title} ${job.description}`).includes(normalizedKeyword),
      );
    },
  });

  return createAcquireResult(source, {
    status: jobs.length > 0 ? "success" : "no-results",
    note: "",
    jobs,
  });
}
