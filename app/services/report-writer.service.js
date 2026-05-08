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

export async function writeJobSearchArtifacts({ workspaceRoot, runRecord }) {
  const dataRunsDir = path.join(workspaceRoot, "data", "runs");
  await fs.mkdir(dataRunsDir, { recursive: true });

  const markdownPath = path.join(workspaceRoot, "job_postings_to_check.md");
  const jsonPath = path.join(dataRunsDir, `${runRecord.runId}.json`);
  const latestPath = path.join(dataRunsDir, "latest.json");

  const markdown = [
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

  await fs.writeFile(markdownPath, markdown, "utf8");
  await fs.writeFile(jsonPath, JSON.stringify(runRecord, null, 2), "utf8");
  await fs.writeFile(latestPath, JSON.stringify(runRecord, null, 2), "utf8");

  return {
    markdownPath,
    jsonPath,
    latestPath,
  };
}
