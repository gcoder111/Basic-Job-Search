import { JSDOM } from "jsdom";
import { extractElempleoDetailFromText } from "./auth-elempleo-detail.adapter.js";
import { normalizePublicationDate } from "../utils/normalize-date.js";
import { normalizeForMatch } from "../utils/normalize-text.js";

const ELEMPLEO_BASE_URL = "https://www.elempleo.com";
export const MAX_ELEMPLEO_DETAIL_VIEWS_PER_KEYWORD = 5;

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function cleanModality(value = "") {
  return cleanText(value).replace(/^-+\s*/, "");
}

function safeParseMetadata(value = "") {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toAbsoluteUrl(rawUrl = "") {
  const normalized = cleanText(rawUrl);
  if (!normalized) {
    return "";
  }

  return new URL(normalized, ELEMPLEO_BASE_URL).toString();
}

function extractPublicationDate(card) {
  const selectorValue = cleanText(
    card.querySelector(".js-offer-date, .info-publish-date, time, .date")?.textContent || "",
  );
  if (selectorValue) {
    return selectorValue;
  }

  const text = cleanText(card.textContent || "");
  const relativeMatch = text.match(
    /\b(Hace\s+\d+\s+(?:horas?|dias?|semanas?|meses?)|Hoy|Ayer)\b/i,
  );
  return cleanText(relativeMatch?.[0] || "");
}

function buildDescription(card, metadata) {
  const descriptionText = cleanText(
    card.querySelector(".result-info-hover-li-description, .job-description, .offer-description")?.textContent || "",
  );
  const metadataTags = cleanText(metadata?.tags || "").replace(/,/g, ", ");
  const equivalentPositions = cleanText(metadata?.equivalentPositions || "");

  return [descriptionText, metadataTags, equivalentPositions].filter(Boolean).join(" | ");
}

function collectTitleMatches(title, profile = {}) {
  const normalizedTitle = normalizeForMatch(title);
  const titleKeywords = Array.isArray(profile.titleKeywords) ? profile.titleKeywords : [];
  const matches = [];

  for (const keyword of titleKeywords) {
    const normalizedKeyword = normalizeForMatch(keyword);
    if (normalizedKeyword && normalizedTitle.includes(normalizedKeyword) && !matches.includes(normalizedKeyword)) {
      matches.push(normalizedKeyword);
    }
  }

  return matches;
}

function normalizeList(values = []) {
  return values.map((value) => normalizeForMatch(value)).filter(Boolean);
}

function findMatches(haystack, candidates = []) {
  const normalizedCandidates = normalizeList(candidates);
  const matches = [];

  for (const candidate of normalizedCandidates) {
    if (candidate && haystack.includes(candidate) && !matches.includes(candidate)) {
      matches.push(candidate);
    }
  }

  return matches;
}

function buildSignalTokenPrefixes(values = []) {
  const prefixes = new Set();

  for (const value of normalizeList(values)) {
    for (const token of value.split(/\s+/)) {
      if (token.length < 8) {
        continue;
      }

      prefixes.add(token.slice(0, 8));
    }
  }

  return [...prefixes];
}

function collectPreviewSignals(job, profile = {}) {
  const normalizedDescription = normalizeForMatch(
    [job?.description || "", job?.location || "", job?.modality || "", job?.experience || "", job?.education || ""]
      .filter(Boolean)
      .join(" "),
  );
  const educationMatches = findMatches(normalizedDescription, profile.educationSignals);
  const educationTokenPrefixes = buildSignalTokenPrefixes(profile.educationSignals);
  const fuzzyEducationMatches =
    educationMatches.length === 0
      ? educationTokenPrefixes.filter((prefix) => normalizedDescription.includes(prefix))
      : [];

  return {
    location: findMatches(normalizedDescription, profile.locationSignals),
    experience: findMatches(normalizedDescription, profile.experienceSignals),
    education: educationMatches.length > 0 ? educationMatches : fuzzyEducationMatches,
    modality: findMatches(normalizedDescription, profile.modalitySignals),
  };
}

function countSignalGroups(matchedSignals = {}) {
  return ["location", "experience", "education", "modality"].reduce(
    (count, signalName) => count + (matchedSignals[signalName]?.length > 0 ? 1 : 0),
    0,
  );
}

function countNonLocationSignalGroups(matchedSignals = {}) {
  return ["experience", "education", "modality"].reduce(
    (count, signalName) => count + (matchedSignals[signalName]?.length > 0 ? 1 : 0),
    0,
  );
}

export function selectElempleoDetailCandidates({
  jobs = [],
  profile = {},
  now = new Date(),
  maxDetailViewsPerKeyword = MAX_ELEMPLEO_DETAIL_VIEWS_PER_KEYWORD,
} = {}) {
  return jobs
    .map((job, index) => {
      const titleMatches = collectTitleMatches(job?.title || "", profile);
      const publicationDate = normalizePublicationDate(
        job?.publicationDateRaw || job?.publicationDate || "",
        { now },
      );

      return {
        index,
        job,
        titleMatches,
        isRecent: publicationDate.isRecent,
        previewSignals: collectPreviewSignals(job, profile),
      };
    })
    .filter(
      ({ job, titleMatches, isRecent, previewSignals }) =>
        Boolean(job?.url) &&
        isRecent &&
        (
          titleMatches.length >= 2 ||
          (titleMatches.length >= 1 &&
            countNonLocationSignalGroups(previewSignals) >= 1 &&
            countSignalGroups(previewSignals) >= 2)
        ),
    )
    .sort(
      (left, right) =>
        right.titleMatches.length - left.titleMatches.length ||
        countNonLocationSignalGroups(right.previewSignals) -
          countNonLocationSignalGroups(left.previewSignals) ||
        countSignalGroups(right.previewSignals) - countSignalGroups(left.previewSignals) ||
        left.index - right.index,
    )
    .slice(0, maxDetailViewsPerKeyword);
}

function mergeElempleoDetailIntoJob(job, detail) {
  if (!detail?.description) {
    return job;
  }

  return {
    ...job,
    detailDescription: detail.description,
    experience: detail.experience || job?.experience || "",
    education: detail.education || job?.education || "",
    detailLocation: detail.location || job?.detailLocation || "",
    detailModality: detail.modality || job?.detailModality || "",
    modality: detail.modality || job?.modality || "",
  };
}

export async function enrichElempleoJobsWithDetails({
  jobs = [],
  profile = {},
  now = new Date(),
  maxDetailViewsPerKeyword = MAX_ELEMPLEO_DETAIL_VIEWS_PER_KEYWORD,
  fetchDetailText,
} = {}) {
  if (typeof fetchDetailText !== "function" || jobs.length === 0) {
    return jobs;
  }

  const enrichedJobs = [...jobs];
  const candidates = selectElempleoDetailCandidates({
    jobs,
    profile,
    now,
    maxDetailViewsPerKeyword,
  });

  for (const candidate of candidates) {
    const detailText = await fetchDetailText(candidate.job);
    if (!detailText) {
      continue;
    }

    const detail =
      typeof detailText === "string" ? extractElempleoDetailFromText(detailText) : detailText;
    enrichedJobs[candidate.index] = mergeElempleoDetailIntoJob(candidate.job, detail);
  }

  return enrichedJobs;
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

export async function extractElempleoJobsFromHtml(html) {
  const document = new JSDOM(html).window.document;

  return [...document.querySelectorAll(".js-area-bind.area-bind[data-url], .result-item .js-area-bind.area-bind[data-url], article[data-url]")]
    .map((card) => {
      const metadata = safeParseMetadata(card.getAttribute("data-ga4-offerdata") || "");
      const title = cleanText(
        metadata?.title ||
          card.querySelector(".js-offer-title, .titulo, h2 a, a[title]")?.textContent ||
          card.querySelector("a")?.textContent ||
          "",
      );
      const url = toAbsoluteUrl(
        card.getAttribute("data-url") ||
          card.querySelector(".js-offer-title, .titulo, h2 a, a[title]")?.getAttribute("href") ||
          card.querySelector("a")?.getAttribute("href") ||
          "",
      );
      const company = cleanText(
        metadata?.company ||
          card.querySelector(".js-offer-company, .info-company-name, .company")?.textContent ||
          "",
      );
      const location = cleanText(
        metadata?.location ||
          card.querySelector(".js-offer-city, .info-city")?.textContent ||
          "",
      );
      const modality = cleanModality(
        card.querySelector(".js-work-modality")?.textContent ||
          card.querySelector('[class*="modality"]')?.textContent ||
          "",
      );
      const publicationDateRaw = extractPublicationDate(card);
      const description = buildDescription(card, metadata);

      return {
        title,
        url,
        company,
        location,
        modality,
        publicationDateRaw,
        description,
      };
    })
    .filter((job) => job.title || job.url);
}

export function getElempleoLiveSearchOptions({
  profile = {},
  now = new Date(),
  maxDetailViewsPerKeyword = MAX_ELEMPLEO_DETAIL_VIEWS_PER_KEYWORD,
} = {}) {
  return {
    extractJobsAfterSearch: async (page) => {
      const jobs = await extractElempleoJobsFromHtml(await page.content());
      return enrichElempleoJobsWithDetails({
        jobs,
        profile,
        now,
        maxDetailViewsPerKeyword,
        fetchDetailText: async (job) => fetchElempleoDetailText(page, job.url),
      });
    },
  };
}
