import { normalizeForMatch } from "../utils/normalize-text.js";

function buildFingerprint(job) {
  if (job?.url) {
    return `url:${normalizeForMatch(job.url)}`;
  }

  const title = normalizeForMatch(job?.title || "");
  const company = normalizeForMatch(job?.company || "");
  const location = normalizeForMatch(job?.location || "");

  return `fallback:${title}::${company}::${location}`;
}

function compareJobs(left, right) {
  if ((right?.score ?? 0) !== (left?.score ?? 0)) {
    return (right?.score ?? 0) - (left?.score ?? 0);
  }

  const leftDate = left?.publicationDateIso || "";
  const rightDate = right?.publicationDateIso || "";
  if (rightDate !== leftDate) {
    return rightDate.localeCompare(leftDate);
  }

  return normalizeForMatch(left?.title || "").localeCompare(normalizeForMatch(right?.title || ""));
}

export function dedupeScoredJobs({ jobs = [] } = {}) {
  const byFingerprint = new Map();

  for (const job of jobs) {
    const fingerprint = buildFingerprint(job);
    const existing = byFingerprint.get(fingerprint);

    if (!existing || compareJobs(existing, job) > 0) {
      byFingerprint.set(fingerprint, job);
    }
  }

  return [...byFingerprint.values()].sort(compareJobs);
}
