import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeExtractedJobs,
  trimJobsToUniqueUrls,
} from "../app/adapters/public-portal-runtime.js";

test("normalizeExtractedJobs keeps only minimally valid jobs", () => {
  const jobs = normalizeExtractedJobs([
    {
      title: "Analista de Riesgo",
      url: "https://example.com/job/1",
      company: "A",
      description: "Bogota",
      publicationDateRaw: "ayer",
    },
    { title: "", url: "", company: "A" },
  ]);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, "Analista de Riesgo");
});

test("trimJobsToUniqueUrls removes repeated job urls", () => {
  const jobs = trimJobsToUniqueUrls([
    { title: "A", url: "https://example.com/job/1" },
    { title: "B", url: "https://example.com/job/1" },
  ]);

  assert.equal(jobs.length, 1);
});
