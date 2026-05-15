import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { loadSearchProfile } from "../app/services/load-search-profile.js";
import { loadSources } from "../app/services/load-sources.service.js";
import { filterCandidateJobs } from "../app/services/filter-jobs.service.js";
import { scoreCandidateJobs } from "../app/services/score-jobs.service.js";
import { dedupeScoredJobs } from "../app/services/dedupe-jobs.service.js";
import { normalizeForMatch, normalizeWhitespace, slugify } from "../app/utils/normalize-text.js";
import {
  createRunDeadline,
  getBudgetedTimeoutMs,
  getRemainingTimeMs,
  throwIfDeadlineExceeded,
} from "../app/utils/run-deadline.js";

const TOTAL_RUN_BUDGET_MS = 10 * 60 * 1000;
const SHUTDOWN_RESERVE_MS = 30 * 1000;
const TIMEOUTS = {
  initialGoto: 15000,
  searchGoto: 15000,
  searchSettle: 1000,
  firstCardVisible: 8000,
  cardClick: 5000,
  detailUrlWait: 1500,
  detailSettle: 400,
  nextClick: 5000,
  nextChangeWait: 5000,
  nextSettle: 800,
};

function cleanText(value) {
  return normalizeWhitespace(String(value || ""));
}

function buildKeywordSlug(keyword) {
  return slugify(keyword || "keyword");
}

function isDeadlineExceededError(error) {
  return error?.name === "RunDeadlineExceededError" || error?.stopReason === "total-time-budget-exhausted";
}

function buildBudgetStage(stage, detail = "") {
  return detail ? `${stage}:${detail}` : stage;
}

function getTimeoutFor(deadline, stage, requestedTimeoutMs) {
  throwIfDeadlineExceeded(deadline, { stage });
  const timeout = getBudgetedTimeoutMs(deadline, Date.now(), requestedTimeoutMs);
  if (timeout <= 0) {
    throwIfDeadlineExceeded(deadline, { stage });
  }

  return timeout;
}

async function gotoWithBudget(page, deadline, url, requestedTimeoutMs, options = {}) {
  const stage = buildBudgetStage("goto", url);
  const timeout = getTimeoutFor(deadline, stage, requestedTimeoutMs);
  await page.goto(url, { ...options, timeout });
}

async function waitForTimeoutWithBudget(page, deadline, stage, requestedTimeoutMs) {
  const timeout = getTimeoutFor(deadline, stage, requestedTimeoutMs);
  await page.waitForTimeout(timeout);
}

function canonicalizeUrl(url) {
  const raw = cleanText(url);
  if (!raw) return "";

  try {
    const absolute = new URL(raw, "https://www.linkedin.com");
    absolute.search = "";
    absolute.hash = "";
    return absolute.toString();
  } catch {
    return raw;
  }
}

function buildFingerprint(url, title, company) {
  return url || `${cleanText(title).toLowerCase()}::${cleanText(company).toLowerCase()}`;
}

function mergeJob(existing, incoming, source, keyword, pageNumber) {
  if (!existing) {
    return {
      ...incoming,
      sourceId: source.sourceId,
      portalKey: source.portalKey,
      sourceDisplayName: source.displayName,
      searchKeywords: [keyword],
      pagesSeen: [pageNumber],
      appearanceCount: 1,
    };
  }

  return {
    ...existing,
    title: cleanText(incoming.title).length > cleanText(existing.title).length ? incoming.title : existing.title,
    company:
      cleanText(incoming.company).length > cleanText(existing.company).length
        ? incoming.company
        : existing.company,
    location:
      cleanText(incoming.location).length > cleanText(existing.location).length
        ? incoming.location
        : existing.location,
    publicationDateRaw: existing.publicationDateRaw || incoming.publicationDateRaw,
    description:
      cleanText(incoming.description).length > cleanText(existing.description).length
        ? incoming.description
        : existing.description,
    locationValidationStatus: existing.locationValidationStatus || incoming.locationValidationStatus,
    searchKeywords: [...new Set([...(existing.searchKeywords || []), keyword])],
    pagesSeen: [...new Set([...(existing.pagesSeen || []), pageNumber])].sort((left, right) => left - right),
    appearanceCount: (existing.appearanceCount || 0) + 1,
  };
}

function parsePublicationDate(metaText = "") {
  const normalized = cleanText(metaText);
  const match = normalized.match(/(?:^|·)\s*(hoy|ayer|hace\s+[^·]+?)\s*(?:·|$)/i);
  return cleanText(match?.[1] || "");
}

function parseLocation(metaText = "") {
  const normalized = cleanText(metaText);
  if (!normalized) return "";
  return cleanText(normalized.split("·")[0] || "");
}

function buildQuarantineNote(matchedTerms) {
  return `puesta en cuarentena por contener terminos que requieren cuidado en el titulo: ${matchedTerms
    .map((term) => `"${term}"`)
    .join(", ")}`;
}

function partitionByCautionTerms(jobs = [], cautionTerms = []) {
  const normalizedTerms = cautionTerms.map((term) => normalizeForMatch(term)).filter(Boolean);
  const selectedJobs = [];
  const quarantinedJobs = [];

  for (const job of jobs) {
    const normalizedTitle = normalizeForMatch(job?.title || "");
    const matchedTerms = normalizedTerms.filter((term) => normalizedTitle.includes(term));
    if (matchedTerms.length > 0) {
      quarantinedJobs.push({
        ...job,
        quarantineNote: buildQuarantineNote(matchedTerms),
      });
      continue;
    }

    selectedJobs.push(job);
  }

  return { selectedJobs, quarantinedJobs };
}

function renderSelectedJobs(jobs = []) {
  if (jobs.length === 0) {
    return "_No se seleccionaron vacantes._";
  }

  return jobs
    .map((job, index) =>
      [
        `## ${index + 1}. ${job.title}`,
        `- Empresa: ${job.company}`,
        `- Prioridad: ${job.priority}`,
        `- Puntaje: ${job.score}`,
        `- URL: ${job.url}`,
        ...(job.locationNote ? [`- Nota: ${job.locationNote}`] : []),
        "",
      ].join("\n"),
    )
    .join("\n");
}

function renderQuarantinedJobs(jobs = []) {
  if (jobs.length === 0) {
    return "_No se enviaron vacantes a cuarentena._";
  }

  return jobs
    .map((job, index) =>
      [
        `## ${index + 1}. ${job.title}`,
        `- Empresa: ${job.company}`,
        `- Prioridad: ${job.priority}`,
        `- Puntaje: ${job.score}`,
        `- URL: ${job.url}`,
        ...(job.quarantineNote ? [`- Nota: ${job.quarantineNote}`] : []),
        ...(job.locationNote ? [`- Nota adicional: ${job.locationNote}`] : []),
        "",
      ].join("\n"),
    )
    .join("\n");
}

function renderPendingStatuses(statuses = []) {
  const pending = statuses.filter((status) => status.status === "needs-user-decision");

  if (pending.length === 0) {
    return "_Sin decisiones pendientes._";
  }

  return pending.map((status) => `- ${status.displayName}: ${status.note}`).join("\n");
}

function renderPrimaryReport(runRecord) {
  return [
    "# Job Postings To Check",
    "",
    `- Run ID: ${runRecord.runId}`,
    `- Keyword: ${runRecord.keyword}`,
    "",
    "## Vacantes priorizadas",
    "",
    renderSelectedJobs(runRecord.selectedJobs),
    "",
    "## Portales con decision pendiente",
    "",
    renderPendingStatuses(runRecord.sourceStatuses),
    "",
  ].join("\n");
}

function renderSecondLevelReport(runRecord) {
  return [
    "# 2nd Level Job Posting To Check",
    "",
    `- Run ID: ${runRecord.runId}`,
    `- Keyword: ${runRecord.keyword}`,
    "",
    "## Vacantes en cuarentena",
    "",
    renderQuarantinedJobs(runRecord.quarantinedJobs),
    "",
  ].join("\n");
}

async function getCurrentActivePage(page) {
  const text = await page.locator(".jobs-search-pagination__indicator-button--active").first().textContent().catch(() => "1");
  const numeric = Number.parseInt(String(text || "1").replace(/\D+/g, ""), 10);
  return Number.isFinite(numeric) ? numeric : 1;
}

async function collectAuthenticatedSignals(page, context) {
  return {
    currentUrl: page.url(),
    title: await page.title(),
    cookieNames: (await context.cookies()).map((cookie) => cookie.name),
    passwordInputCount: await page.locator('input[type="password"]').count().catch(() => 0),
  };
}

async function extractCurrentPageJobs(page, deadline) {
  await page
    .locator(".job-card-container")
    .first()
    .waitFor({ timeout: getTimeoutFor(deadline, "first-card-visible", TIMEOUTS.firstCardVisible) });
  const cardCount = await page.locator(".job-card-container").count();
  const jobs = [];

  for (let index = 0; index < cardCount; index += 1) {
    throwIfDeadlineExceeded(deadline, { stage: buildBudgetStage("job-card", String(index + 1)) });
    const card = page.locator(".job-card-container").nth(index);
    const expectedId = await card.getAttribute("data-job-id").catch(() => null);
    const rawHref = await card.locator(".job-card-container__link").first().getAttribute("href").catch(() => "");
    const cardLocation = cleanText(
      await card.locator(".job-card-container__metadata-wrapper li").first().textContent().catch(() => ""),
    );

    await card
      .locator(".job-card-container__link")
      .first()
      .click({ timeout: getTimeoutFor(deadline, buildBudgetStage("job-card-click", String(index + 1)), TIMEOUTS.cardClick) })
      .catch(async () => {
        await card
          .click({ timeout: getTimeoutFor(deadline, buildBudgetStage("job-card-fallback-click", String(index + 1)), TIMEOUTS.cardClick) })
          .catch(() => {});
    });

    if (expectedId) {
      await page
        .waitForURL((url, id) => url.searchParams.get("currentJobId") === id, expectedId, {
          timeout: getTimeoutFor(deadline, buildBudgetStage("detail-url-wait", String(index + 1)), TIMEOUTS.detailUrlWait),
        })
        .catch(() => {});
    }

    await waitForTimeoutWithBudget(
      page,
      deadline,
      buildBudgetStage("detail-settle", String(index + 1)),
      TIMEOUTS.detailSettle,
    );

    const detailTitle = cleanText(await page.locator("h1").first().textContent().catch(() => ""));
    const company = cleanText(
      await page
        .locator(".job-details-jobs-unified-top-card__company-name a, .job-details-jobs-unified-top-card__company-name")
        .first()
        .textContent()
        .catch(() => ""),
    );
    const meta = cleanText(
      await page
        .locator(".job-details-jobs-unified-top-card__primary-description-container")
        .first()
        .textContent()
        .catch(() => ""),
    );
    const description = cleanText(
      await page.locator(".jobs-description__content, .jobs-box__html-content").first().innerText().catch(() => ""),
    );
    const location = parseLocation(meta) || cardLocation;
    const publicationDateRaw = parsePublicationDate(meta);

    jobs.push({
      title: detailTitle,
      company,
      url: canonicalizeUrl(rawHref),
      location,
      publicationDateRaw,
      description,
      locationValidationStatus: location ? "confirmed" : "undetermined",
    });
  }

  return jobs;
}

async function persistKeywordArtifacts({ workspaceRoot, page, keyword, payload }) {
  const resultsDir = path.join(workspaceRoot, "results");
  await fs.mkdir(resultsDir, { recursive: true });
  const keywordSlug = buildKeywordSlug(keyword);
  const jsonPath = path.join(resultsDir, `linkedin-post-login-search-${keywordSlug}.json`);
  const screenshotPath = path.join(resultsDir, `linkedin-post-login-search-${keywordSlug}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
  await fs.writeFile(jsonPath, JSON.stringify({ ...payload, screenshotPath }, null, 2), "utf8");
  return {
    jsonPath,
    screenshotPath,
  };
}

async function main() {
  const workspaceRoot = process.cwd();
  const deadline = createRunDeadline({
    totalBudgetMs: TOTAL_RUN_BUDGET_MS,
    reserveMs: SHUTDOWN_RESERVE_MS,
  });
  const profile = await loadSearchProfile({ repoRoot: workspaceRoot });
  const { allSources } = await loadSources({ repoRoot: workspaceRoot });
  const source = allSources.find((item) => item.portalKey === "linkedin");

  if (!source) {
    throw new Error("LinkedIn source not found in URL_plataformas.md");
  }

  const searchedKeywords = profile.primaryTitleKeywords;
  const nextClicksLimit = profile.multipageNextClicks || 0;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: path.join(workspaceRoot, "auth-state", "linkedin.json"),
  });
  const page = await context.newPage();
  const aggregated = new Map();
  const keywordRuns = [];
  let runBudgetExhausted = false;

  try {
    await gotoWithBudget(page, deadline, source.url, TIMEOUTS.initialGoto, { waitUntil: "domcontentloaded" });
    const initialSignals = await collectAuthenticatedSignals(page, context);
    const batchAuthenticated =
      initialSignals.cookieNames.includes("li_at") && initialSignals.passwordInputCount === 0;

    if (!batchAuthenticated) {
      throw new Error("LinkedIn session is not authenticated before batch start.");
    }

    for (const keyword of searchedKeywords) {
      try {
        throwIfDeadlineExceeded(deadline, { stage: buildBudgetStage("keyword-start", keyword) });
      } catch (error) {
        if (isDeadlineExceededError(error)) {
          runBudgetExhausted = true;
          break;
        }

        throw error;
      }

      const searchUrl = `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(keyword)}`;
      await gotoWithBudget(page, deadline, searchUrl, TIMEOUTS.searchGoto, { waitUntil: "domcontentloaded" });
      await waitForTimeoutWithBudget(page, deadline, buildBudgetStage("search-settle", keyword), TIMEOUTS.searchSettle);

      const beforeSignals = await collectAuthenticatedSignals(page, context);
      const authenticatedBeforeSearch =
        beforeSignals.cookieNames.includes("li_at") && beforeSignals.passwordInputCount === 0;
      const pagesVisited = [];
      let nextClicksPerformed = 0;
      let stopReason = "configured-next-click-limit-reached";
      let pageNumber = await getCurrentActivePage(page);
      let keywordJobs = 0;
      let keywordError = null;

      try {
        while (true) {
          throwIfDeadlineExceeded(deadline, { stage: buildBudgetStage("keyword-loop", keyword) });
          const extractedJobs = await extractCurrentPageJobs(page, deadline);
          pagesVisited.push({ pageNumber, url: page.url(), jobs: extractedJobs.length });
          keywordJobs += extractedJobs.length;

          for (const normalized of extractedJobs) {
            if (!normalized.title || !normalized.url.includes("/jobs/view/")) {
              continue;
            }

            const fingerprint = buildFingerprint(normalized.url, normalized.title, normalized.company);
            aggregated.set(
              fingerprint,
              mergeJob(aggregated.get(fingerprint), normalized, source, keyword, pageNumber),
            );
          }

          if (nextClicksPerformed >= nextClicksLimit) {
            stopReason = "configured-next-click-limit-reached";
            break;
          }

          const nextButton = page.locator(".jobs-search-pagination__button--next").first();
          if ((await nextButton.count()) < 1) {
            stopReason = "next-control-missing";
            break;
          }

          const disabled = await nextButton.isDisabled().catch(() => false);
          if (disabled) {
            stopReason = "next-control-disabled";
            break;
          }

          const previousPage = await getCurrentActivePage(page);
          const previousFirstJobId = await page
            .locator(".job-card-container")
            .first()
            .getAttribute("data-job-id")
            .catch(() => null);
          await nextButton.click({
            timeout: getTimeoutFor(deadline, buildBudgetStage("next-click", `${keyword}-page-${pageNumber}`), TIMEOUTS.nextClick),
          });
          await page
            .waitForFunction(
              ({ previousPage, previousFirstJobId }) => {
                const active = document.querySelector(".jobs-search-pagination__indicator-button--active");
                const activeText = (active?.textContent || "").replace(/\D+/g, "");
                const firstCard = document.querySelector(".job-card-container");
                const currentFirstJobId = firstCard?.getAttribute("data-job-id");

                return (
                  (activeText && Number.parseInt(activeText, 10) !== previousPage) ||
                  (!!currentFirstJobId && currentFirstJobId !== previousFirstJobId)
                );
              },
              { previousPage, previousFirstJobId },
              {
                timeout: getTimeoutFor(
                  deadline,
                  buildBudgetStage("next-change-wait", `${keyword}-page-${pageNumber}`),
                  TIMEOUTS.nextChangeWait,
                ),
              },
            )
            .catch(() => {});
          await waitForTimeoutWithBudget(
            page,
            deadline,
            buildBudgetStage("next-settle", `${keyword}-page-${pageNumber}`),
            TIMEOUTS.nextSettle,
          );

          const currentPage = await getCurrentActivePage(page);
          if (currentPage === previousPage) {
            stopReason = "next-click-did-not-change-page";
            break;
          }

          nextClicksPerformed += 1;
          pageNumber = currentPage;
        }
      } catch (error) {
        keywordError = error;
        stopReason = isDeadlineExceededError(error) ? error.stopReason : "search-error";
        runBudgetExhausted = isDeadlineExceededError(error);
      }

      const afterSignals = await collectAuthenticatedSignals(page, context);
      const authenticatedAfterSearch =
        afterSignals.cookieNames.includes("li_at") && afterSignals.passwordInputCount === 0;
      const verdict = keywordError
        ? isDeadlineExceededError(keywordError)
          ? "time-budget-exhausted"
          : "search-error"
        : authenticatedBeforeSearch && authenticatedAfterSearch
          ? "search-success"
          : authenticatedAfterSearch
            ? "search-unverified"
            : "auth-lost";

      const artifacts = await persistKeywordArtifacts({
        workspaceRoot,
        page,
        keyword,
        payload: {
          portal: "linkedin",
          keyword,
          sessionStrategy: "storageState",
          authenticatedBeforeSearch,
          authenticatedAfterSearch,
          verdict,
          pagesVisited,
          nextClicksConfigured: nextClicksLimit,
          nextClicksPerformed,
          stopReason,
          jobs: keywordJobs,
          error: keywordError ? { name: keywordError.name, message: keywordError.message } : null,
        },
      });

      keywordRuns.push({
        keyword,
        verdict,
        authenticatedBeforeSearch,
        authenticatedAfterSearch,
        jobs: keywordJobs,
        pagesVisited,
        nextClicksConfigured: nextClicksLimit,
        nextClicksPerformed,
        stopReason,
        error: keywordError ? keywordError.message : "",
        ...artifacts,
      });

      console.log(
        JSON.stringify(
          {
            portal: "linkedin",
            keyword,
            verdict,
            stopReason,
            jobs: keywordJobs,
            pagesVisited: pagesVisited.length,
            remainingBudgetMs: getRemainingTimeMs(deadline),
          },
          null,
          2,
        ),
      );

      if (runBudgetExhausted) {
        break;
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const aggregatedJobs = [...aggregated.values()];
  const filtered = filterCandidateJobs({ jobs: aggregatedJobs, profile, now: new Date() });
  const scored = scoreCandidateJobs({ jobs: filtered.keptJobs });
  const dedupedJobs = dedupeScoredJobs({ jobs: scored });
  const { selectedJobs, quarantinedJobs } = partitionByCautionTerms(
    dedupedJobs,
    profile.cautionTitleTerms || [],
  );

  const successfulKeywords = keywordRuns.filter((run) => run.verdict === "search-success").length;
  const failedKeywords = keywordRuns.filter((run) => run.verdict !== "search-success").length;
  const sourceStatus = {
    sourceId: source.sourceId,
    displayName: source.displayName,
    status: successfulKeywords > 0 ? "success" : "needs-user-decision",
    note:
      successfulKeywords > 0
        ? `Batch completo ejecutado solo para LinkedIn con ${searchedKeywords.length} keywords y hasta ${nextClicksLimit} clicks en Siguiente por keyword. Keywords exitosas: ${successfulKeywords}. Keywords con incidencia: ${failedKeywords}.${runBudgetExhausted ? " La corrida corto al agotar el presupuesto maximo de 10 minutos." : ""}`
        : `El batch de LinkedIn no logro completar ninguna keyword con exito. Revise los artefactos de results/ y decida si desea refrescar la sesion o ajustar el flujo del portal.${runBudgetExhausted ? " La corrida corto al agotar el presupuesto maximo de 10 minutos." : ""}`,
  };

  const runRecord = {
    runId: new Date().toISOString().replace(/[:.]/g, "-"),
    keyword: "all-primary-keywords",
    portal: "linkedin",
    searchedKeywords,
    multipageNextClicksConfigured: nextClicksLimit,
    selectedJobs,
    quarantinedJobs,
    discardedJobs: filtered.discardedJobs,
    sourceStatuses: [sourceStatus],
  };

  const dataRunsDir = path.join(workspaceRoot, "data", "runs");
  await fs.mkdir(dataRunsDir, { recursive: true });
  const runJsonPath = path.join(dataRunsDir, `${runRecord.runId}.json`);
  const latestJsonPath = path.join(dataRunsDir, "latest.json");
  await fs.writeFile(runJsonPath, JSON.stringify(runRecord, null, 2), "utf8");
  await fs.writeFile(latestJsonPath, JSON.stringify(runRecord, null, 2), "utf8");

  await fs.writeFile(path.join(workspaceRoot, "job_postings_to_check.md"), renderPrimaryReport(runRecord), "utf8");
  await fs.writeFile(
    path.join(workspaceRoot, "2nd_level_job_posting_to_check.md"),
    renderSecondLevelReport(runRecord),
    "utf8",
  );

  await fs.mkdir(path.join(workspaceRoot, "results"), { recursive: true });
  await fs.writeFile(
    path.join(workspaceRoot, "results", "linkedin-keyword-aggregate-latest.json"),
    JSON.stringify(
      {
        portal: "linkedin",
        searchedKeywords,
        multipageNextClicksConfigured: nextClicksLimit,
        keywordRuns,
        rawAppearanceCount: keywordRuns.reduce((sum, run) => sum + run.jobs, 0),
        uniqueAggregatedCount: aggregatedJobs.length,
        jobs: aggregatedJobs,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );

  await fs.writeFile(
    path.join(workspaceRoot, "results", "linkedin-batch-summary-latest.json"),
    JSON.stringify(
      {
        portal: "linkedin",
        searchedKeywords,
        multipageNextClicksConfigured: nextClicksLimit,
        keywordRuns,
        rawAppearanceCount: keywordRuns.reduce((sum, run) => sum + run.jobs, 0),
        totalNextClicksPerformed: keywordRuns.reduce((sum, run) => sum + run.nextClicksPerformed, 0),
        uniqueAggregatedCount: aggregatedJobs.length,
        filteredInCount: filtered.keptJobs.length,
        discardedCount: filtered.discardedJobs.length,
        shortlistedCount: selectedJobs.length,
        quarantinedCount: quarantinedJobs.length,
        runBudgetExhausted,
        totalBudgetMs: TOTAL_RUN_BUDGET_MS,
        shutdownReserveMs: SHUTDOWN_RESERVE_MS,
        runJsonPath,
        latestJsonPath,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        portal: "linkedin",
        searchedKeywords: searchedKeywords.length,
        totalNextClicksPerformed: keywordRuns.reduce((sum, run) => sum + run.nextClicksPerformed, 0),
        rawAppearanceCount: keywordRuns.reduce((sum, run) => sum + run.jobs, 0),
        uniqueAggregatedCount: aggregatedJobs.length,
        filteredInCount: filtered.keptJobs.length,
        discardedCount: filtered.discardedJobs.length,
        shortlistedCount: selectedJobs.length,
        quarantinedCount: quarantinedJobs.length,
        runBudgetExhausted,
        totalBudgetMs: TOTAL_RUN_BUDGET_MS,
        shutdownReserveMs: SHUTDOWN_RESERVE_MS,
        markdownPath: path.join(workspaceRoot, "job_postings_to_check.md"),
        secondLevelMarkdownPath: path.join(workspaceRoot, "2nd_level_job_posting_to_check.md"),
        latestRunPath: latestJsonPath,
        summaryPath: path.join(workspaceRoot, "results", "linkedin-batch-summary-latest.json"),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
