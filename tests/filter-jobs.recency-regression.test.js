import test from "node:test";
import assert from "node:assert/strict";
import { filterCandidateJobs } from "../app/services/filter-jobs.service.js";

test("filterCandidateJobs does not treat weeks or months as recent aliases", () => {
  const result = filterCandidateJobs({
    jobs: [
      {
        title: "Analista de Riesgo",
        description: "Bogota. Ingenieria industrial. Hibrido.",
        publicationDateRaw: "Hace 1 semana",
      },
      {
        title: "Analista de Riesgo",
        description: "Bogota. Ingenieria industrial. Hibrido.",
        publicationDateRaw: "Hace 1 mes",
      },
    ],
    profile: {
      titleKeywords: ["riesgo"],
      locationSignals: ["bogota"],
      experienceSignals: [],
      educationSignals: ["ingenieria industrial"],
      modalitySignals: ["hibrido"],
    },
    now: "2026-05-10T12:00:00.000Z",
  });

  assert.equal(result.keptJobs.length, 0);
  assert.equal(result.discardedJobs.length, 2);
  assert.equal(result.discardedJobs[0].discardReason, "stale-publication-date");
  assert.equal(result.discardedJobs[1].discardReason, "stale-publication-date");
});
