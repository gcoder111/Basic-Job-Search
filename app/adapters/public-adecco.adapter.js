import { JSDOM } from "jsdom";
import { createAcquireResult } from "./source-adapter.js";
import { runPublicPortalSearch } from "./public-portal-runtime.js";

export async function extractAdeccoJobsFromHtml(html) {
  const document = new JSDOM(html).window.document;

  return [...document.querySelectorAll("article, .job-card, .opening-job")].map((card) => ({
    title: card.querySelector("a")?.textContent || "",
    url: card.querySelector("a")?.href || "",
    company: "Adecco",
    location: card.querySelector(".job-location, [data-location]")?.textContent || "",
    publicationDateRaw: card.querySelector(".job-date, time")?.textContent || "",
    description: card.textContent || "",
  }));
}

export async function acquireAdeccoJobs({
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
        .locator('input[type="search"], input[name*="search" i]')
        .first();

      if ((await searchInput.count().catch(() => 0)) > 0) {
        await searchInput.fill(currentKeyword);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2000);
      }

      return extractAdeccoJobsFromHtml(await page.content());
    },
  });

  return createAcquireResult(source, {
    status: jobs.length > 0 ? "success" : "no-results",
    note: "",
    jobs,
  });
}
