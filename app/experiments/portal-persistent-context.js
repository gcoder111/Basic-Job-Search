import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import {
  buildPersistentProfilePaths,
  ensureExperimentDirectories,
  writeExperimentResult,
} from "./auth-result.js";
import { getPortalConfig } from "./portal-auth-config.js";
import {
  assertAuthenticatedStorageCapture,
  waitForAuthenticatedSignals,
} from "./portal-storage-state.js";

async function collectAuthSignals(page, context) {
  return {
    currentUrl: page.url(),
    title: await page.title(),
    cookieNames: context ? (await context.cookies()).map((cookie) => cookie.name) : [],
    passwordInputCount: await page.locator('input[type="password"]').count().catch(() => 0),
  };
}

export async function capturePersistentPortalContext(
  rootDir,
  portalKey,
  { waitForAuth = false, waitTimeoutMs = 180000, pollIntervalMs = 1000 } = {},
) {
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

    const { authSignals } = waitForAuth
      ? await waitForAuthenticatedSignals({
          portalConfig,
          collectAuthSignals: () => collectAuthSignals(page, context),
          timeoutMs: waitTimeoutMs,
          pollIntervalMs,
        })
      : {
          authSignals: await collectAuthSignals(page, context),
        };
    assertAuthenticatedStorageCapture({ portalConfig, authSignals });

    const payload = {
      portal: portalKey,
      targetUrl: portalConfig.targetUrl,
      userDataDir: paths.userDataDir,
      authenticated: true,
      authSignals,
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

  const waitTimeoutFlag = flags.find((flag) => flag.startsWith("--wait-timeout-ms="));
  const waitTimeoutMs = waitTimeoutFlag ? Number.parseInt(waitTimeoutFlag.split("=")[1], 10) : 180000;
  const result = await capturePersistentPortalContext(process.cwd(), portalKey, {
    waitForAuth: flags.includes("--wait-for-auth"),
    waitTimeoutMs: Number.isFinite(waitTimeoutMs) ? waitTimeoutMs : 180000,
  });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runFromCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
