import { filterRequirements, publicationRecencyRules } from "../config/search-profile.js";
import { normalizePublicationDate } from "../utils/normalize-date.js";
import { normalizeForMatch } from "../utils/normalize-text.js";

function normalizeList(values = []) {
  return values
    .filter((value) => normalizeForMatch(value))
    .map((value) => normalizeForMatch(value));
}

function findMatches(haystack, candidates = []) {
  const normalizedCandidates = normalizeList(candidates);
  const matches = [];

  for (const candidate of normalizedCandidates) {
    if (candidate && haystack.includes(candidate) && !matches.includes(candidate)) {
      matches.push(candidate);
    }
  }

  return matches;
}

function countSignalGroups(matchedSignals) {
  return ["location", "experience", "education", "modality"].reduce(
    (count, signalName) => count + (matchedSignals[signalName].length > 0 ? 1 : 0),
    0,
  );
}

export function filterCandidateJobs({ jobs = [], profile = {}, now = new Date() } = {}) {
  const keptJobs = [];
  const discardedJobs = [];
  const titleKeywords = normalizeList(profile.titleKeywords);
  const locationSignals = normalizeList(profile.locationSignals);
  const experienceSignals = normalizeList(profile.experienceSignals);
  const educationSignals = normalizeList(profile.educationSignals);
  const modalitySignals = normalizeList(profile.modalitySignals);

  for (const job of jobs) {
    const normalizedTitle = normalizeForMatch(job?.title || "");
    const normalizedDescription = normalizeForMatch(job?.description || "");
    const titleMatches = findMatches(normalizedTitle, titleKeywords);

    if (titleMatches.length < filterRequirements.minTitleMatches) {
      discardedJobs.push({ ...job, discardReason: "missing-title-keywords" });
      continue;
    }

    const publicationDate = normalizePublicationDate(job?.publicationDateRaw || job?.publicationDate || "", {
      now,
    });
    if (!publicationDate.isRecent) {
      discardedJobs.push({
        ...job,
        discardReason: "stale-publication-date",
        publicationDateIso: publicationDate.publicationDateIso,
        publicationDateLabel: publicationDate.publicationDateLabel,
      });
      continue;
    }

    const matchedSignals = {
      title: titleMatches,
      location: findMatches(normalizedDescription, locationSignals),
      experience: findMatches(normalizedDescription, experienceSignals),
      education: findMatches(normalizedDescription, educationSignals),
      modality: findMatches(normalizedDescription, modalitySignals),
      recency: [publicationDate.publicationDateLabel].filter(Boolean),
    };

    if (
      countSignalGroups(matchedSignals) < filterRequirements.minDescriptionSignalGroups ||
      matchedSignals.location.length +
        matchedSignals.experience.length +
        matchedSignals.education.length +
        matchedSignals.modality.length ===
        0
    ) {
      discardedJobs.push({
        ...job,
        discardReason: "missing-description-signals",
        publicationDateIso: publicationDate.publicationDateIso,
        publicationDateLabel: publicationDate.publicationDateLabel,
      });
      continue;
    }

    keptJobs.push({
      ...job,
      matchedSignals,
      publicationDateIso: publicationDate.publicationDateIso,
      publicationDateLabel: publicationDate.publicationDateLabel,
      publicationDateDaysAgo: publicationDate.daysAgo,
      recencyWindowDays: publicationRecencyRules.maxAgeDays,
    });
  }

  return { keptJobs, discardedJobs };
}
