import fs from "node:fs/promises";
import path from "node:path";

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

async function readExistingFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

function renderPrimaryReport(runRecord, { includeTitle = true } = {}) {
  return [
    ...(includeTitle ? ["# Job Postings To Check", ""] : []),
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

function renderSecondLevelReport(runRecord, { includeTitle = true } = {}) {
  return [
    ...(includeTitle ? ["# 2nd Level Job Posting To Check", ""] : []),
    `- Run ID: ${runRecord.runId}`,
    `- Keyword: ${runRecord.keyword}`,
    "",
    "## Vacantes en cuarentena",
    "",
    renderQuarantinedJobs(runRecord.quarantinedJobs),
    "",
  ].join("\n");
}

function appendReport(existingContent, nextSection) {
  const trimmed = existingContent.trim();
  if (!trimmed) {
    return nextSection;
  }

  return `${trimmed}\n\n---\n\n${nextSection}`;
}

export async function writeJobSearchArtifacts({ workspaceRoot, runRecord }) {
  const dataRunsDir = path.join(workspaceRoot, "data", "runs");
  await fs.mkdir(dataRunsDir, { recursive: true });

  const markdownPath = path.join(workspaceRoot, "job_postings_to_check.md");
  const secondLevelMarkdownPath = path.join(workspaceRoot, "2nd_level_job_posting_to_check.md");
  const jsonPath = path.join(dataRunsDir, `${runRecord.runId}.json`);
  const latestPath = path.join(dataRunsDir, "latest.json");

  const existingMarkdown = await readExistingFile(markdownPath);
  const existingSecondLevelMarkdown = await readExistingFile(secondLevelMarkdownPath);
  const markdown = appendReport(
    existingMarkdown,
    renderPrimaryReport(runRecord, { includeTitle: existingMarkdown.trim().length === 0 }),
  );
  const secondLevelMarkdown = appendReport(
    existingSecondLevelMarkdown,
    renderSecondLevelReport(runRecord, {
      includeTitle: existingSecondLevelMarkdown.trim().length === 0,
    }),
  );

  await fs.writeFile(markdownPath, markdown, "utf8");
  await fs.writeFile(secondLevelMarkdownPath, secondLevelMarkdown, "utf8");
  await fs.writeFile(jsonPath, JSON.stringify(runRecord, null, 2), "utf8");
  await fs.writeFile(latestPath, JSON.stringify(runRecord, null, 2), "utf8");

  return {
    markdownPath,
    secondLevelMarkdownPath,
    jsonPath,
    latestPath,
  };
}
