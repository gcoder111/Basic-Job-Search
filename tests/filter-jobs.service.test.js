import test from "node:test";
import assert from "node:assert/strict";
import { filterCandidateJobs } from "../app/services/filter-jobs.service.js";

test("filterCandidateJobs keeps only recent jobs with title and description signals", () => {
  const result = filterCandidateJobs({
    jobs: [
      {
        title: "Analista de Riesgo",
        description: "Bogota. Ingenieria industrial. Hibrido.",
        publicationDateRaw: "ayer",
      },
    ],
    profile: {
      titleKeywords: ["riesgo"],
      locationSignals: ["bogota"],
      experienceSignals: [],
      educationSignals: ["ingenieria industrial"],
      modalitySignals: ["hibrido"],
    },
    now: "2026-05-06T12:00:00.000Z",
  });

  assert.equal(result.keptJobs.length, 1);
  assert.equal(result.discardedJobs.length, 0);
  assert.deepEqual(result.keptJobs[0].matchedSignals.location, ["bogota"]);
  assert.deepEqual(result.keptJobs[0].matchedSignals.education, ["ingenieria industrial"]);
  assert.equal(result.keptJobs[0].publicationDateIso, "2026-05-05");
});

test("filterCandidateJobs keeps jobs even when location does not match the optional target list", () => {
  const result = filterCandidateJobs({
    jobs: [
      {
        title: "Analista de cumplimiento",
        description: "Presencial. SAGRILAFT. Hace seguimiento a controles.",
        location: "Yumbo, Valle del Cauca",
        publicationDateRaw: "ayer",
      },
    ],
    profile: {
      titleKeywords: ["cumplimiento"],
      locationSignals: ["bogota", "chia"],
      experienceSignals: [],
      educationSignals: [],
      modalitySignals: ["presencial"],
    },
    now: "2026-05-06T12:00:00.000Z",
  });

  assert.equal(result.keptJobs.length, 1);
  assert.equal(result.discardedJobs.length, 0);
  assert.deepEqual(result.keptJobs[0].matchedSignals.location, []);
});

test("filterCandidateJobs still annotates indeterminable location after additional validation", () => {
  const result = filterCandidateJobs({
    jobs: [
      {
        title: "Analista de cumplimiento",
        description: "Presencial. SAGRILAFT. Seguimiento a controles.",
        publicationDateRaw: "ayer",
        locationValidationStatus: "undetermined",
      },
    ],
    profile: {
      titleKeywords: ["cumplimiento"],
      locationSignals: ["bogota", "chia"],
      experienceSignals: [],
      educationSignals: [],
      modalitySignals: ["presencial"],
    },
    now: "2026-05-06T12:00:00.000Z",
  });

  assert.equal(result.keptJobs.length, 1);
  assert.equal(result.keptJobs[0].locationNote, "ubicacion no es posible de determinar");
  assert.deepEqual(result.keptJobs[0].matchedSignals.location, []);
  assert.equal(result.discardedJobs.length, 0);
});

test("filterCandidateJobs discards stale jobs and jobs without useful description signals", () => {
  const result = filterCandidateJobs({
    jobs: [
      {
        title: "Analista de Riesgo",
        description: "Bogota. Ingenieria industrial. Hibrido.",
        publicationDateRaw: "hace 4 dias",
      },
      {
        title: "Analista de Riesgo",
        description: "Bogota. Sin senales utiles adicionales.",
        publicationDateRaw: "ayer",
      },
    ],
    profile: {
      titleKeywords: ["riesgo"],
      locationSignals: ["bogota"],
      experienceSignals: [],
      educationSignals: ["ingenieria industrial"],
      modalitySignals: ["hibrido"],
    },
    now: "2026-05-06T12:00:00.000Z",
  });

  assert.equal(result.keptJobs.length, 0);
  assert.equal(result.discardedJobs.length, 2);
  assert.equal(result.discardedJobs[0].discardReason, "stale-publication-date");
  assert.equal(result.discardedJobs[1].discardReason, "missing-description-signals");
});
