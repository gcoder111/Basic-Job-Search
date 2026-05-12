import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  enrichElempleoJobsWithDetails,
  extractElempleoJobsFromHtml,
  selectElempleoDetailCandidates,
} from "../app/adapters/auth-elempleo.adapter.js";
import { filterCandidateJobs } from "../app/services/filter-jobs.service.js";
import { loadSearchProfile } from "../app/services/load-search-profile.js";

const complianceResultsFixturePath = path.join(process.cwd(), "results", "elempleo-compliance-page.html");
const riskDetailFixturePath = path.join(
  process.cwd(),
  "results",
  "elempleo-analista-junior-riesgos-detail.txt",
);

test("Elempleo risk-and-compliance candidate is discarded before detail enrichment", async () => {
  const profile = await loadSearchProfile({ repoRoot: process.cwd() });
  const html = await fs.readFile(complianceResultsFixturePath, "utf8");
  const jobs = await extractElempleoJobsFromHtml(html);
  const targetJob = jobs.filter(
    (job) =>
      job.url ===
      "https://www.elempleo.com/co/ofertas-trabajo/analista-junior-de-riesgos-y-cumplimiento-bogota-1886709549",
  );

  const result = filterCandidateJobs({
    jobs: targetJob,
    profile,
    now: "2026-05-12T12:00:00.000Z",
  });

  assert.equal(result.keptJobs.length, 0);
  assert.equal(result.discardedJobs[0].discardReason, "missing-description-signals");
});

test("Elempleo enrichment opens detail only for candidates with strong title matches", async () => {
  const profile = await loadSearchProfile({ repoRoot: process.cwd() });
  const detailText = await fs.readFile(riskDetailFixturePath, "utf8");
  const fetchedUrls = [];

  const enrichedJobs = await enrichElempleoJobsWithDetails({
    jobs: [
      {
        title: "Analista junior de riesgos y cumplimiento - bogota",
        company: "RISK CONSULTING COLOMBIA SAS",
        location: "Bogota",
        publicationDateRaw: "Hace 2 dias",
        description: "Trabajo en equipo | Analista administrativo",
        url: "https://www.elempleo.com/co/ofertas-trabajo/analista-junior-de-riesgos-y-cumplimiento-bogota-1886709549",
      },
      {
        title: "Analista administrativo",
        company: "Empresa X",
        location: "Bogota",
        publicationDateRaw: "Hace 2 dias",
        description: "Trabajo en equipo | Analista administrativo",
        url: "https://www.elempleo.com/co/ofertas-trabajo/analista-administrativo-1",
      },
    ],
    profile,
    now: "2026-05-12T12:00:00.000Z",
    fetchDetailText: async (job) => {
      fetchedUrls.push(job.url);
      return detailText;
    },
  });

  assert.deepEqual(fetchedUrls, [
    "https://www.elempleo.com/co/ofertas-trabajo/analista-junior-de-riesgos-y-cumplimiento-bogota-1886709549",
  ]);
  assert.equal(enrichedJobs[0].detailDescription.includes("debida diligencia"), true);
  assert.equal(enrichedJobs[1].detailDescription, undefined);
});

test("Elempleo selects promising single-title-match cards for detail enrichment when the card already hints at fit", async () => {
  const profile = await loadSearchProfile({ repoRoot: process.cwd() });
  const candidates = selectElempleoDetailCandidates({
    jobs: [
      {
        title: "Analista gestion de riesgos",
        company: "Empresa confidencial",
        location: "Bogota",
        modality: "Hibrido",
        publicationDateRaw: "Ayer",
        description: "analista de riesgos | Administrador de empresas, Ingeniero industrial",
        url: "https://www.elempleo.com/co/ofertas-trabajo/analista-gestion-de-riesgos-1886710001",
      },
    ],
    profile,
    now: "2026-05-12T12:00:00.000Z",
  });

  assert.equal(candidates.length, 1);
  assert.equal(
    candidates[0].job.url,
    "https://www.elempleo.com/co/ofertas-trabajo/analista-gestion-de-riesgos-1886710001",
  );
});

test("Elempleo risk-and-compliance candidate survives after detail enrichment", async () => {
  const profile = await loadSearchProfile({ repoRoot: process.cwd() });
  const html = await fs.readFile(complianceResultsFixturePath, "utf8");
  const detailText = await fs.readFile(riskDetailFixturePath, "utf8");
  const jobs = await extractElempleoJobsFromHtml(html);
  const targetJob = jobs.filter(
    (job) =>
      job.url ===
      "https://www.elempleo.com/co/ofertas-trabajo/analista-junior-de-riesgos-y-cumplimiento-bogota-1886709549",
  );
  const enrichedJobs = await enrichElempleoJobsWithDetails({
    jobs: targetJob,
    profile,
    now: "2026-05-12T12:00:00.000Z",
    fetchDetailText: async () => detailText,
  });

  const result = filterCandidateJobs({
    jobs: enrichedJobs,
    profile,
    now: "2026-05-12T12:00:00.000Z",
  });

  assert.equal(result.keptJobs.length, 1);
  assert.equal(result.keptJobs[0].matchedSignals.modality.includes("hibrido"), true);
});

test("Elempleo single-title risk candidate survives after detail enrichment when the detail confirms the fit", async () => {
  const profile = await loadSearchProfile({ repoRoot: process.cwd() });
  const detailText = [
    "Analista gestion de riesgos",
    "Bogota - Hibrido",
    "Descripcion del cargo",
    "Prestigiosa empresa requiere analista de gestion de riesgos.",
    "Profesional universitario preferiblemente en Ingenieria industrial o administracion.",
    "Experiencia 2 anos de experiencia en gestion de riesgos operativos, SAGRILAFT y PTEE.",
  ].join(" ");
  const jobs = [
    {
      title: "Analista gestion de riesgos",
      company: "Empresa confidencial",
      location: "Bogota",
      modality: "Hibrido",
      publicationDateRaw: "Ayer",
      description: "analista de riesgos | Administrador de empresas, Ingeniero industrial",
      url: "https://www.elempleo.com/co/ofertas-trabajo/analista-gestion-de-riesgos-1886710001",
    },
  ];
  const enrichedJobs = await enrichElempleoJobsWithDetails({
    jobs,
    profile,
    now: "2026-05-12T12:00:00.000Z",
    fetchDetailText: async () => detailText,
  });

  const result = filterCandidateJobs({
    jobs: enrichedJobs,
    profile,
    now: "2026-05-12T12:00:00.000Z",
  });

  assert.equal(enrichedJobs[0].detailDescription.includes("analista de gestion de riesgos"), true);
  assert.equal(result.keptJobs.length, 1);
  assert.equal(result.keptJobs[0].matchedSignals.experience.includes("2 anos"), true);
});
