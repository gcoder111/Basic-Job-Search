import fs from "node:fs/promises";
import path from "node:path";
import { normalizeForMatch, slugify } from "../utils/normalize-text.js";
import { writeExperimentResult } from "./auth-result.js";

export function buildKeywordSlug(keyword) {
  return slugify(keyword || "keyword");
}

function getUniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function getSearchInputSelectors(config = {}) {
  return getUniqueValues([config.keywordInputSelector, ...(config.keywordInputAlternates || [])]);
}

export function buildPortalDirectSearchUrl(config = {}, keyword = "") {
  if (!config.directSearchUrlPattern) {
    return null;
  }

  return config.directSearchUrlPattern.replace("{keywordSlug}", buildKeywordSlug(keyword));
}

async function canUseSearchInput(page, selector) {
  try {
    return (await page.locator(selector).first().count()) > 0;
  } catch {
    return false;
  }
}

async function trySubmitSearchThroughUi(page, config, keyword, selectors, errors) {
  for (const selector of selectors) {
    if (!(await canUseSearchInput(page, selector))) {
      continue;
    }

    try {
      await page.locator(selector).first().fill(keyword);

      if (config.submitAction === "click" && config.submitButtonSelector) {
        await page.locator(config.submitButtonSelector).first().click();
      } else {
        await page.locator(selector).first().press("Enter");
      }

      return {
        strategy: "ui-submit",
        selectorUsed: selector,
      };
    } catch (error) {
      errors.push({
        selector,
        message: error?.message || String(error),
      });
    }
  }

  return null;
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
  const selectors = getSearchInputSelectors(config);
  const errors = [];

  const currentPageAttempt = await trySubmitSearchThroughUi(page, config, keyword, selectors, errors);
  if (currentPageAttempt) {
    return currentPageAttempt;
  }

  for (const recoveryUrl of getUniqueValues(config.searchEntryUrls || [config.targetUrl])) {
    if (!recoveryUrl || recoveryUrl === page.url()) {
      continue;
    }

    await page.goto(recoveryUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1000);

    const recoveredAttempt = await trySubmitSearchThroughUi(page, config, keyword, selectors, errors);
    if (recoveredAttempt) {
      return {
        ...recoveredAttempt,
        recoveryUrl,
      };
    }
  }

  const directSearchUrl = buildPortalDirectSearchUrl(config, keyword);
  if (directSearchUrl) {
    await page.goto(directSearchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => {});
    return {
      strategy: "direct-url",
      directSearchUrl,
      selectorUsed: null,
    };
  }

  throw new Error(
    `Unable to submit portal search for ${config.displayName || config.key || "portal"} with selectors ${selectors.join(", ")}. Recovery attempts: ${JSON.stringify(errors)}`,
  );
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
