import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeJobSearchArtifacts } from "../app/services/report-writer.service.js";

test("writeJobSearchArtifacts writes markdown and run artifacts", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "job-search-report-"));
  const result = await writeJobSearchArtifacts({
    workspaceRoot,
    runRecord: {
      runId: "2026-05-06T12-00-00-000Z",
      keyword: "riesgo",
      selectedJobs: [
        {
          title: "Analista de Riesgo",
          company: "A",
          priority: "high",
          score: 12,
          url: "https://example.com",
          locationNote: "ubicacion no es posible de determinar",
        },
      ],
      quarantinedJobs: [
        {
          title: "Asesor SST en Riesgo",
          company: "B",
          priority: "medium",
          score: 8,
          url: "https://example.com/caution",
          quarantineNote:
            'puesta en cuarentena por contener terminos que requieren cuidado en el titulo: "sst"',
        },
      ],
      discardedJobs: [],
      sourceStatuses: [
        { sourceId: "linkedin", displayName: "LinkedIn", status: "success", note: "" },
        { sourceId: "elempleo", displayName: "Elempleo", status: "needs-user-decision", note: "refresh auth" },
      ],
    },
  });

  const markdown = await fs.readFile(result.markdownPath, "utf8");
  const secondLevelMarkdown = await fs.readFile(result.secondLevelMarkdownPath, "utf8");
  const runJson = JSON.parse(await fs.readFile(result.jsonPath, "utf8"));
  const latestJson = JSON.parse(await fs.readFile(result.latestPath, "utf8"));

  assert.equal(markdown.includes("Analista de Riesgo"), true);
  assert.equal(markdown.includes("ubicacion no es posible de determinar"), true);
  assert.equal(markdown.includes("Asesor SST en Riesgo"), false);
  assert.equal(secondLevelMarkdown.includes("Asesor SST en Riesgo"), true);
  assert.equal(secondLevelMarkdown.includes("puesta en cuarentena por contener terminos que requieren cuidado"), true);
  assert.equal(markdown.includes("Elempleo: refresh auth"), true);
  assert.equal(runJson.runId, "2026-05-06T12-00-00-000Z");
  assert.equal(latestJson.keyword, "riesgo");
});

test("writeJobSearchArtifacts appends markdown reports instead of overwriting prior runs", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "job-search-report-"));

  await writeJobSearchArtifacts({
    workspaceRoot,
    runRecord: {
      runId: "2026-05-06T12-00-00-000Z",
      keyword: "riesgo",
      selectedJobs: [
        {
          title: "Analista de Riesgo",
          company: "A",
          priority: "high",
          score: 12,
          url: "https://example.com/1",
        },
      ],
      quarantinedJobs: [],
      discardedJobs: [],
      sourceStatuses: [],
    },
  });

  await writeJobSearchArtifacts({
    workspaceRoot,
    runRecord: {
      runId: "2026-05-07T12-00-00-000Z",
      keyword: "cumplimiento",
      selectedJobs: [
        {
          title: "Oficial de Cumplimiento",
          company: "B",
          priority: "medium",
          score: 8,
          url: "https://example.com/2",
        },
      ],
      quarantinedJobs: [
        {
          title: "Asesor SST en Riesgo",
          company: "C",
          priority: "medium",
          score: 8,
          url: "https://example.com/caution",
          quarantineNote:
            'puesta en cuarentena por contener terminos que requieren cuidado en el titulo: "sst"',
        },
      ],
      discardedJobs: [],
      sourceStatuses: [],
    },
  });

  const markdown = await fs.readFile(path.join(workspaceRoot, "job_postings_to_check.md"), "utf8");
  const secondLevelMarkdown = await fs.readFile(
    path.join(workspaceRoot, "2nd_level_job_posting_to_check.md"),
    "utf8",
  );

  assert.equal(markdown.includes("Analista de Riesgo"), true);
  assert.equal(markdown.includes("Oficial de Cumplimiento"), true);
  assert.equal(markdown.includes("2026-05-06T12-00-00-000Z"), true);
  assert.equal(markdown.includes("2026-05-07T12-00-00-000Z"), true);
  assert.equal(secondLevelMarkdown.includes("Asesor SST en Riesgo"), true);
});
