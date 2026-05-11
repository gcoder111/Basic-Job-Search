import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { buildExperimentPaths, buildPersistentProfilePaths } from "./auth-result.js";
import { getPortalConfig } from "./portal-auth-config.js";
import {
  buildKeywordSlug,
  collectPageSignals,
  evaluateSearchVerdict,
  persistPortalSearchArtifacts,
  submitPortalSearch,
} from "./post-login-search-helpers.js";
import { getPostLoginSearchConfig } from "./post-login-search-config.js";

async function createSearchContext(rootDir, portalKey, config) {
  if (config.sessionStrategy === "storageState") {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      storageState: buildExperimentPaths(rootDir, portalKey).storageStatePath,
    });

    return {
      browser,
      context,
      close: async () => {
        await context.close();
        await browser.close();
      },
    };
  }

  const context = await chromium.launchPersistentContext(
    buildPersistentProfilePaths(rootDir, portalKey).userDataDir,
    { headless: false },
  );

  return {
    browser: null,
    context,
    close: async () => {
      await context.close();
    },
  };
}

export async function runPortalSearch(rootDir, portalKey, keyword, options = {}) {
  const authConfig = getPortalConfig(portalKey);
  const config = getPostLoginSearchConfig(portalKey);
  const { extractJobsAfterSearch } = options;

  if (!authConfig || !config) {
    throw new Error(`Unsupported portal for post-login search: ${portalKey}`);
  }

  const runtime = await createSearchContext(rootDir, portalKey, config);
  let page;
  let beforeSignals = null;

  try {
    page = runtime.context.pages()[0] || (await runtime.context.newPage());
    await page.goto(config.targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

    beforeSignals = await collectPageSignals(page, runtime.context);
    const authenticatedBeforeSearch = authConfig.detectAuthenticated(beforeSignals);

    await submitPortalSearch(page, config, keyword);
    await page.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const afterSignals = await collectPageSignals(page, runtime.context);
    const authenticatedAfterSearch = authConfig.detectAuthenticated(afterSignals);
    const verdict = evaluateSearchVerdict({
      authenticatedBeforeSearch,
      authenticatedAfterSearch,
      afterSignals,
      config,
    });
    const jobs = extractJobsAfterSearch ? await extractJobsAfterSearch(page) : [];

    const artifacts = await persistPortalSearchArtifacts({
      rootDir,
      portalKey,
      keyword,
      payload: {
        portal: portalKey,
        keyword,
        sessionStrategy: config.sessionStrategy,
        authenticatedBeforeSearch,
        authenticatedAfterSearch,
        verdict,
        beforeSignals,
        afterSignals,
        jobs,
      },
      page,
    });

    return {
      portal: portalKey,
      keyword,
      sessionStrategy: config.sessionStrategy,
      authenticatedBeforeSearch,
      authenticatedAfterSearch,
      verdict,
      beforeSignals,
      afterSignals,
      jobs,
      ...artifacts,
    };
  } catch (error) {
    const afterSignals = page ? await collectPageSignals(page, runtime.context).catch(() => null) : null;
    const payload = {
      portal: portalKey,
      keyword,
      sessionStrategy: config.sessionStrategy,
      authenticatedBeforeSearch: beforeSignals ? authConfig.detectAuthenticated(beforeSignals) : false,
      authenticatedAfterSearch: afterSignals ? authConfig.detectAuthenticated(afterSignals) : false,
      verdict: "search-error",
      beforeSignals,
      afterSignals,
      jobs: [],
      error: {
        name: error?.name || "Error",
        message: error?.message || String(error),
      },
    };

    if (page) {
      const artifacts = await persistPortalSearchArtifacts({
        rootDir,
        portalKey,
        keyword,
        payload,
        page,
      }).catch(() => {});

      return {
        ...payload,
        ...artifacts,
      };
    }

    return payload;
  } finally {
    await runtime.close();
  }
}

async function runFromCli() {
  const [keyword, portalKey] = process.argv.slice(2);

  if (!keyword || !portalKey) {
    throw new Error("Usage: node app/experiments/post-login-search.js <keyword> <portalKey>");
  }

  const workspaceRoot = process.cwd();
  const result = await runPortalSearch(workspaceRoot, portalKey, keyword);
  const aggregatePath = path.join(
    workspaceRoot,
    "results",
    `post-login-search-${buildKeywordSlug(keyword)}.json`,
  );
  const aggregatePayload = { keyword, results: [result] };
  await fs.mkdir(path.dirname(aggregatePath), { recursive: true });
  await fs.writeFile(aggregatePath, JSON.stringify(aggregatePayload, null, 2), "utf8");
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runFromCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
