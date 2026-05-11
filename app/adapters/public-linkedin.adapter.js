import { JSDOM } from "jsdom";
import { createAcquireResult } from "./source-adapter.js";
import { runPublicPortalSearch } from "./public-portal-runtime.js";

export async function extractLinkedinJobsFromHtml(html) {
  const document = new JSDOM(html).window.document;

  return [...document.querySelectorAll(".base-search-card")].map((card) => ({
    title: card.querySelector("h3")?.textContent || "",
    company: card.querySelector("h4")?.textContent || "",
    url: card.querySelector("a")?.href || "",
    location: card.querySelector(".job-search-card__location")?.textContent || "",
    publicationDateRaw:
      card.querySelector("time")?.textContent ||
      card.querySelector("time")?.getAttribute("datetime") ||
      "",
    description: "",
  }));
}

export async function acquireLinkedinJobs({
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
      await page
        .locator('input[placeholder*="Search by title" i], input[placeholder*="empleo" i]')
        .first()
        .fill(currentKeyword);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
      return extractLinkedinJobsFromHtml(await page.content());
    },
  });

  return createAcquireResult(source, {
    status: jobs.length > 0 ? "success" : "no-results",
    note: "",
    jobs,
  });
}
