import { dedupeScoredJobs } from "./dedupe-jobs.service.js";
import { filterCandidateJobs } from "./filter-jobs.service.js";
import { scoreCandidateJobs } from "./score-jobs.service.js";
import { createSourceStatus, shouldRetryAtEnd } from "./run-state.service.js";
import { normalizeForMatch } from "../utils/normalize-text.js";

function normalizeList(values = []) {
  return values.map((value) => normalizeForMatch(value)).filter(Boolean);
}

function buildQuarantineNote(matchedTerms) {
  return `puesta en cuarentena por contener terminos que requieren cuidado en el titulo: ${matchedTerms
    .map((term) => `"${term}"`)
    .join(", ")}`;
}

function partitionScoredJobsByCautionTerms(jobs = [], cautionTitleTerms = []) {
  const normalizedTerms = normalizeList(cautionTitleTerms);
  const selectedJobs = [];
  const quarantinedJobs = [];

  for (const job of jobs) {
    const normalizedTitle = normalizeForMatch(job?.title || "");
    const matchedTerms = normalizedTerms.filter((term) => normalizedTitle.includes(term));

    if (matchedTerms.length > 0) {
      quarantinedJobs.push({
        ...job,
        quarantineNote: buildQuarantineNote(matchedTerms),
      });
      continue;
    }

    selectedJobs.push(job);
  }

  return { selectedJobs, quarantinedJobs };
}

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
  const dedupedJobs = dedupeScoredJobs({ jobs: scored });
  const { selectedJobs, quarantinedJobs } = partitionScoredJobsByCautionTerms(
    dedupedJobs,
    profile.cautionTitleTerms,
  );

  return {
    sourceStatuses,
    candidateJobs,
    discardedJobs: filtered.discardedJobs,
    selectedJobs,
    quarantinedJobs,
  };
}
