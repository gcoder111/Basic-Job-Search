import { JSDOM } from "jsdom";

export async function extractComputrabajoJobsFromHtml(html) {
  const document = new JSDOM(html).window.document;

  return [...document.querySelectorAll("article.box_offer, article[data-offers-grid-offer-item-container]")].map(
    (card) => {
      const title = card.querySelector("h2 a.js-o-link")?.textContent || "";
      const rawUrl = card.querySelector("h2 a.js-o-link")?.getAttribute("href") || "";
      const url = rawUrl ? new URL(rawUrl, "https://co.computrabajo.com").toString() : "";
      const company = card.querySelector("[offer-grid-article-company-url]")?.textContent || "";
      const location = card.querySelector("p.fs16.fc_base.mt5 span")?.textContent || "";
      const modality = card.querySelector("div.fs13.mt15")?.textContent || "";
      const publicationDateRaw = card.querySelector("p.fs13.fc_aux.mt15")?.textContent || "";
      const description = [title, company, location, modality, publicationDateRaw]
        .map((value) => String(value || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(" | ");

      return {
        title: String(title).replace(/\s+/g, " ").trim(),
        url: String(url).replace(/#.*$/, "").trim(),
        company: String(company).replace(/\s+/g, " ").trim(),
        location: String(location).replace(/\s+/g, " ").trim(),
        modality: String(modality).replace(/\s+/g, " ").trim(),
        publicationDateRaw: String(publicationDateRaw).replace(/\s+/g, " ").trim(),
        description,
      };
    },
  );
}

export function getComputrabajoLiveSearchOptions() {
  return {
    extractJobsAfterSearch: async (page) => extractComputrabajoJobsFromHtml(await page.content()),
  };
}
