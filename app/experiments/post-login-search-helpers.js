import fs from "node:fs/promises";
import path from "node:path";
import { normalizeForMatch, slugify } from "../utils/normalize-text.js";
import { writeExperimentResult } from "./auth-result.js";

export function buildKeywordSlug(keyword) {
  return slugify(keyword || "keyword");
}

export async function collectPageSignals(page, context) {
  return {
    currentUrl: page.url(),
    title: await page.title(),
    bodyText: await page.locator("body").innerText().catch(() => ""),
    cookieNames: (await context.cookies()).map((cookie) => cookie.name),
    passwordInputCount: await page.locator('input[type="password"]').count().catch(() => 0),
  };
}

export async function submitPortalSearch(page, config, keyword) {
  await page.locator(config.keywordInputSelector).first().fill(keyword);

  if (config.submitAction === "click" && config.submitButtonSelector) {
    await page.locator(config.submitButtonSelector).first().click();
    return;
  }

  await page.locator(config.keywordInputSelector).first().press("Enter");
}

export function evaluateSearchVerdict({ authenticatedBeforeSearch, authenticatedAfterSearch, afterSignals, config }) {
  const bodyText = normalizeForMatch(afterSignals.bodyText || "");
  const url = (afterSignals.currentUrl || "").toLowerCase();
  const hitExpectedUrl = config.expectedUrlKeyword ? url.includes(config.expectedUrlKeyword.toLowerCase()) : false;
  const hitResultsMarker = config.resultsMarker ? bodyText.includes(normalizeForMatch(config.resultsMarker)) : false;

  if (!authenticatedBeforeSearch) {
    return "not-authenticated";
  }

  if (!authenticatedAfterSearch) {
    return "auth-lost";
  }

  if (hitExpectedUrl || hitResultsMarker) {
    return "search-success";
  }

  return "search-unverified";
}

export async function persistPortalSearchArtifacts({
  rootDir,
  portalKey,
  keyword,
  payload,
  page,
}) {
  const resultsDir = path.join(rootDir, "results");
  await fs.mkdir(resultsDir, { recursive: true });

  const keywordSlug = buildKeywordSlug(keyword);
  const jsonPath = path.join(resultsDir, `${portalKey}-post-login-search-${keywordSlug}.json`);
  const screenshotPath = path.join(resultsDir, `${portalKey}-post-login-search-${keywordSlug}.png`);

  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
  await writeExperimentResult(jsonPath, { ...payload, screenshotPath });

  return {
    jsonPath,
    screenshotPath,
  };
}
