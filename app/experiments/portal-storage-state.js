import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import {
  buildExperimentPaths,
  ensureExperimentDirectories,
  writeExperimentResult,
} from "./auth-result.js";
import { getPortalConfig } from "./portal-auth-config.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectAuthSignals(page, context) {
  return {
    currentUrl: page.url(),
    title: await page.title(),
    cookieNames: context ? (await context.cookies()).map((cookie) => cookie.name) : [],
    passwordInputCount: await page.locator('input[type="password"]').count().catch(() => 0),
  };
}

export async function waitForAuthenticatedSignals({
  portalConfig,
  collectAuthSignals: collectSignals,
  timeoutMs = 180000,
  pollIntervalMs = 1000,
}) {
  const deadline = Date.now() + timeoutMs;
  let authSignals = null;

  while (Date.now() <= deadline) {
    authSignals = await collectSignals();
    if (portalConfig.detectAuthenticated(authSignals)) {
      return {
        authenticated: true,
        authSignals,
      };
    }

    if (Date.now() + pollIntervalMs > deadline) {
      break;
    }

    await sleep(pollIntervalMs);
  }

  return {
    authenticated: false,
    authSignals,
  };
}

export function assertAuthenticatedStorageCapture({ portalConfig, authSignals }) {
  const authenticated = portalConfig.detectAuthenticated(authSignals);

  if (!authenticated) {
    throw new Error(
      `${portalConfig.displayName} storageState capture is not authenticated. Refresh the session and complete a real login before saving.`,
    );
  }

  return true;
}

export async function capturePortalStorageState(
  rootDir,
  portalKey,
  { waitForAuth = false, waitTimeoutMs = 180000, pollIntervalMs = 1000 } = {},
) {
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

    const { authSignals } = waitForAuth
      ? await waitForAuthenticatedSignals({
          portalConfig,
          collectAuthSignals: () => collectAuthSignals(page, context),
          timeoutMs: waitTimeoutMs,
          pollIntervalMs,
        })
      : {
          authenticated: portalConfig.detectAuthenticated(await collectAuthSignals(page, context)),
          authSignals: await collectAuthSignals(page, context),
        };
    assertAuthenticatedStorageCapture({ portalConfig, authSignals });
    await context.storageState({ path: paths.storageStatePath });

    const payload = {
      portal: portalKey,
      targetUrl: portalConfig.targetUrl,
      storageStatePath: paths.storageStatePath,
      authenticated: true,
      authSignals,
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

  const waitTimeoutFlag = flags.find((flag) => flag.startsWith("--wait-timeout-ms="));
  const waitTimeoutMs = waitTimeoutFlag ? Number.parseInt(waitTimeoutFlag.split("=")[1], 10) : 180000;
  const result = await capturePortalStorageState(process.cwd(), portalKey, {
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
