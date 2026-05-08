import { priorityThresholds, scoringWeights } from "../config/search-profile.js";

function count(value) {
  return Array.isArray(value) ? value.length : 0;
}

function hasMatches(value) {
  return count(value) > 0;
}

export function scoreCandidateJobs({ jobs = [] } = {}) {
  return jobs.map((job) => {
    const titleCount = count(job?.matchedSignals?.title);
    const breakdown = {
      titleMatch: titleCount > 0 ? scoringWeights.titleBase + Math.max(0, titleCount - 1) * scoringWeights.titleAdditional : 0,
      locationMatch: hasMatches(job?.matchedSignals?.location) ? scoringWeights.location : 0,
      experienceMatch: hasMatches(job?.matchedSignals?.experience) ? scoringWeights.experience : 0,
      educationMatch: hasMatches(job?.matchedSignals?.education) ? scoringWeights.education : 0,
      modalityMatch: hasMatches(job?.matchedSignals?.modality) ? scoringWeights.modality : 0,
      recencyMatch: hasMatches(job?.matchedSignals?.recency) ? scoringWeights.recency : 0,
    };

    const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);

    return {
      ...job,
      scoreBreakdown: breakdown,
      score,
      priority:
        score >= priorityThresholds.high
          ? "high"
          : score >= priorityThresholds.medium
            ? "medium"
            : "low",
    };
  });
}
