import { JSDOM } from "jsdom";

export async function extractElempleoJobsFromHtml(html) {
  const document = new JSDOM(html).window.document;

  return [...document.querySelectorAll("article, .result-item, .js-job-item")].map((card) => ({
    title: card.querySelector("a")?.textContent || "",
    url: card.querySelector("a")?.href || "",
    company: card.querySelector(".company, span")?.textContent || "",
    location: card.textContent || "",
    publicationDateRaw: card.querySelector("time, .date")?.textContent || "",
    description: card.textContent || "",
  }));
}

export function getElempleoLiveSearchOptions() {
  return {
    extractJobsAfterSearch: async (page) => extractElempleoJobsFromHtml(await page.content()),
  };
}
