import test from "node:test";
import assert from "node:assert/strict";
import { scoreCandidateJobs } from "../app/services/score-jobs.service.js";

test("scoreCandidateJobs assigns a high priority to strong matches", () => {
  const jobs = scoreCandidateJobs({
    jobs: [
      {
        matchedSignals: {
          title: ["riesgo", "risk"],
          location: ["bogota"],
          experience: ["2 anos"],
          education: ["ingenieria industrial"],
          modality: ["hibrido"],
          recency: ["ayer"],
        },
      },
    ],
  });

  assert.equal(jobs[0].priority, "high");
  assert.equal(jobs[0].score > 0, true);
  assert.equal(jobs[0].scoreBreakdown.titleMatch > 0, true);
});

test("scoreCandidateJobs distinguishes medium and low priority matches", () => {
  const jobs = scoreCandidateJobs({
    jobs: [
      {
        matchedSignals: {
          title: ["riesgo"],
          location: [],
          experience: [],
          education: [],
          modality: [],
          recency: ["ayer"],
        },
      },
      {
        matchedSignals: {
          title: ["riesgo"],
          location: ["bogota"],
          experience: [],
          education: [],
          modality: [],
          recency: [],
        },
      },
    ],
  });

  assert.equal(jobs[0].priority, "low");
  assert.equal(jobs[1].priority, "medium");
});
