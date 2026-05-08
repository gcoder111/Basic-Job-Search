import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import {
  buildExperimentPaths,
  ensureExperimentDirectories,
  writeExperimentResult,
} from "./auth-result.js";
import { getPortalConfig } from "./portal-auth-config.js";

export async function capturePortalStorageState(rootDir, portalKey, { waitForAuth = false } = {}) {
  const portalConfig = getPortalConfig(portalKey);
  if (!portalConfig) {
    throw new Error(`Unsupported portal for storage state capture: ${portalKey}`);
  }

  const paths = buildExperimentPaths(rootDir, portalKey);
  await ensureExperimentDirectories(paths);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(portalConfig.targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

    if (waitForAuth) {
      await page.waitForTimeout(30000);
    }

    await context.storageState({ path: paths.storageStatePath });

    const payload = {
      portal: portalKey,
      targetUrl: portalConfig.targetUrl,
      storageStatePath: paths.storageStatePath,
      savedAt: new Date().toISOString(),
    };
    await writeExperimentResult(paths.resultPath, payload);
    return payload;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function runFromCli() {
  const [portalKey, ...flags] = process.argv.slice(2);
  if (!portalKey) {
    throw new Error("Usage: node app/experiments/portal-storage-state.js <portalKey> [--wait-for-auth]");
  }

  const result = await capturePortalStorageState(process.cwd(), portalKey, {
    waitForAuth: flags.includes("--wait-for-auth"),
  });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runFromCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
