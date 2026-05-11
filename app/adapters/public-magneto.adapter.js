import { JSDOM } from "jsdom";
import { createAcquireResult } from "./source-adapter.js";
import { runPublicPortalSearch } from "./public-portal-runtime.js";

export async function extractMagnetoJobsFromHtml(html) {
  const document = new JSDOM(html).window.document;

  return [...document.querySelectorAll("article, .job-list-item, .vacancy-item")].map((card) => {
    const link = card.querySelector("a[href]");
    const textNodes = [...card.querySelectorAll("span, small, p")].map((node) => node.textContent || "");

    return {
      title: link?.textContent || card.querySelector("h2, h3")?.textContent || "",
      url: link?.href || "",
      company: textNodes[0] || "",
      location: textNodes[1] || "",
      publicationDateRaw: textNodes[2] || "",
      description: card.textContent || "",
    };
  });
}

export async function acquireMagnetoJobs({
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
        .locator('input[type="search"], input[name*="cargo" i], input[placeholder*="cargo" i]')
        .first();

      if ((await searchInput.count().catch(() => 0)) > 0) {
        await searchInput.fill(currentKeyword);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2000);
      }

      return extractMagnetoJobsFromHtml(await page.content());
    },
  });

  return createAcquireResult(source, {
    status: jobs.length > 0 ? "success" : "no-results",
    note: "",
    jobs,
  });
}
