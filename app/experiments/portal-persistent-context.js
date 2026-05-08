import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import {
  buildPersistentProfilePaths,
  ensureExperimentDirectories,
  writeExperimentResult,
} from "./auth-result.js";
import { getPortalConfig } from "./portal-auth-config.js";

export async function capturePersistentPortalContext(rootDir, portalKey, { waitForAuth = false } = {}) {
  const portalConfig = getPortalConfig(portalKey);
  if (!portalConfig) {
    throw new Error(`Unsupported portal for persistent profile capture: ${portalKey}`);
  }

  const paths = buildPersistentProfilePaths(rootDir, portalKey);
  await ensureExperimentDirectories(paths);

  const context = await chromium.launchPersistentContext(paths.userDataDir, { headless: false });
  const page = context.pages()[0] || (await context.newPage());

  try {
    await page.goto(portalConfig.targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

    if (waitForAuth) {
      await page.waitForTimeout(30000);
    }

    const payload = {
      portal: portalKey,
      targetUrl: portalConfig.targetUrl,
      userDataDir: paths.userDataDir,
      savedAt: new Date().toISOString(),
    };
    await writeExperimentResult(paths.resultPath, payload);
    return payload;
  } finally {
    await context.close();
  }
}

async function runFromCli() {
  const [portalKey, ...flags] = process.argv.slice(2);
  if (!portalKey) {
    throw new Error("Usage: node app/experiments/portal-persistent-context.js <portalKey> [--wait-for-auth]");
  }

  const result = await capturePersistentPortalContext(process.cwd(), portalKey, {
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
