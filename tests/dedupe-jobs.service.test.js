import test from "node:test";
import assert from "node:assert/strict";
import { dedupeScoredJobs } from "../app/services/dedupe-jobs.service.js";

test("dedupeScoredJobs keeps the highest-scored variant of a duplicated posting", () => {
  const jobs = dedupeScoredJobs({
    jobs: [
      { title: "Analista de Riesgo", company: "A", url: "https://job/1", score: 8 },
      { title: "Analista de Riesgo", company: "A", url: "https://job/1", score: 12 },
    ],
  });

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].score, 12);
});

test("dedupeScoredJobs falls back to title and company when url is missing", () => {
  const jobs = dedupeScoredJobs({
    jobs: [
      { title: "Analista de Riesgo", company: "A", score: 8 },
      { title: "Analista de Riesgo", company: "A", score: 10 },
      { title: "Analista de Riesgo", company: "B", score: 7 },
    ],
  });

  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].score, 10);
  assert.equal(jobs[1].company, "B");
});
