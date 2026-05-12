import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { extractElempleoJobsFromHtml } from "../app/adapters/auth-elempleo.adapter.js";
import { filterCandidateJobs } from "../app/services/filter-jobs.service.js";
import { loadSearchProfile } from "../app/services/load-search-profile.js";

const metadataFixturePath = path.join(process.cwd(), "tests", "fixtures", "elempleo", "result-card-metadata.html");
const fallbackFixturePath = path.join(process.cwd(), "tests", "fixtures", "elempleo", "result-card-fallback.html");
const complianceResultsFixturePath = path.join(process.cwd(), "results", "elempleo-compliance-page.html");

test("extractElempleoJobsFromHtml prefers structured metadata when available", async () => {
  const html = await fs.readFile(metadataFixturePath, "utf8");
  const jobs = await extractElempleoJobsFromHtml(html);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, "Analista de compliance");
  assert.equal(
    jobs[0].url,
    "https://www.elempleo.com/co/ofertas-trabajo/analista-de-compliance-1886691443",
  );
  assert.equal(jobs[0].company, "Empresa confidencial");
  assert.equal(jobs[0].location, "Bogota");
  assert.equal(jobs[0].modality, "Hibrido");
  assert.equal(jobs[0].publicationDateRaw, "Hace 2 horas");
  assert.equal(jobs[0].description.includes("debida diligencia"), true);
  assert.equal(jobs[0].description.includes("matrices de riesgo"), true);
});

test("extractElempleoJobsFromHtml falls back to visible selectors when metadata is invalid", async () => {
  const html = await fs.readFile(fallbackFixturePath, "utf8");
  const jobs = await extractElempleoJobsFromHtml(html);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, "Especialista de operaciones sarlaft");
  assert.equal(
    jobs[0].url,
    "https://www.elempleo.com/co/ofertas-trabajo/especialista-sarlaft-1886699273",
  );
  assert.equal(jobs[0].company, "Empresa confidencial");
  assert.equal(jobs[0].location, "Bogota");
  assert.equal(jobs[0].modality, "Presencial");
  assert.equal(jobs[0].publicationDateRaw, "Ayer");
  assert.equal(jobs[0].description.includes("monitoreo SARLAFT"), true);
});

test("Elempleo extracted cards survive filtering when title, date and description signals are present", async () => {
  const html = await fs.readFile(metadataFixturePath, "utf8");
  const jobs = await extractElempleoJobsFromHtml(html);
  const profile = await loadSearchProfile({ repoRoot: process.cwd() });
  const result = filterCandidateJobs({
    jobs,
    profile,
    now: "2026-05-12T12:00:00.000Z",
  });

  assert.equal(result.keptJobs.length, 1);
  assert.equal(result.discardedJobs.length, 0);
  assert.equal(result.keptJobs[0].matchedSignals.title.includes("compliance"), true);
  assert.equal(result.keptJobs[0].publicationDateLabel, "Hoy");
});

test("extractElempleoJobsFromHtml keeps the risk-and-compliance card summary weak before detail enrichment", async () => {
  const html = await fs.readFile(complianceResultsFixturePath, "utf8");
  const jobs = await extractElempleoJobsFromHtml(html);
  const targetJob = jobs.find(
    (job) =>
      job.url ===
      "https://www.elempleo.com/co/ofertas-trabajo/analista-junior-de-riesgos-y-cumplimiento-bogota-1886709549",
  );

  assert.ok(targetJob);
  assert.equal(targetJob.description.includes("Trabajo en equipo"), true);
  assert.equal(targetJob.description.includes("debida diligencia"), false);
  assert.equal(targetJob.description.includes("Menos de un año de experiencia"), false);
});
