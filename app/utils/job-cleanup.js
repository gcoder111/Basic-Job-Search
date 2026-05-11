import { normalizeWhitespace } from "./normalize-text.js";

export function cleanupJob(job = {}) {
  return {
    title: normalizeWhitespace(job.title || ""),
    company: normalizeWhitespace(job.company || ""),
    location: normalizeWhitespace(job.location || ""),
    url: normalizeWhitespace(job.url || ""),
    description: normalizeWhitespace(job.description || ""),
    publicationDateRaw: normalizeWhitespace(job.publicationDateRaw || ""),
  };
}
