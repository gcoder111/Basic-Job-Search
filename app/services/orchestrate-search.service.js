import { dedupeScoredJobs } from "./dedupe-jobs.service.js";
import { filterCandidateJobs } from "./filter-jobs.service.js";
import { scoreCandidateJobs } from "./score-jobs.service.js";
import { createSourceStatus, shouldRetryAtEnd } from "./run-state.service.js";

export async function orchestrateSearch({ sources = [], profile = {}, now = new Date(), acquireJobs }) {
  const sourceStatuses = [];
  const candidateJobs = [];
  const retryQueue = [];

  for (const source of sources) {
    const result = await acquireJobs(source, "initial");
    const status = result?.sourceStatus?.status || "success";

    sourceStatuses.push(createSourceStatus(source, status, result?.sourceStatus?.note || ""));
    candidateJobs.push(...(result?.jobs || []));

    if (shouldRetryAtEnd(source, status)) {
      retryQueue.push(source);
    }
  }

  for (const source of retryQueue) {
    const retryResult = await acquireJobs(source, "retry-final");
    const retryStatus = retryResult?.sourceStatus?.status || "success";

    sourceStatuses.push(createSourceStatus(source, retryStatus, retryResult?.sourceStatus?.note || ""));
    candidateJobs.push(...(retryResult?.jobs || []));
  }

  const filtered = filterCandidateJobs({ jobs: candidateJobs, profile, now });
  const scored = scoreCandidateJobs({ jobs: filtered.keptJobs });
  const selectedJobs = dedupeScoredJobs({ jobs: scored });

  return {
    sourceStatuses,
    candidateJobs,
    discardedJobs: filtered.discardedJobs,
    selectedJobs,
  };
}
