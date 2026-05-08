import { normalizeForMatch, normalizeWhitespace } from "./normalize-text.js";
import { publicationRecencyRules } from "../config/search-profile.js";

const RELATIVE_DAY_ALIASES = new Map([
  ["0", 0],
  ["hoy", 0],
  ["today", 0],
  ["1", 1],
  ["un", 1],
  ["una", 1],
  ["one", 1],
  ["ayer", 1],
  ["yesterday", 1],
  ["2", 2],
  ["dos", 2],
  ["two", 2],
]);

function startOfUtcDay(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function formatUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseNow(now) {
  if (now instanceof Date) {
    return new Date(now.getTime());
  }

  const parsedNow = new Date(now);
  if (!Number.isNaN(parsedNow.getTime())) {
    return parsedNow;
  }

  return new Date();
}

function parseRelativeDays(normalizedValue) {
  if (!normalizedValue) {
    return null;
  }

  for (const [alias, daysAgo] of RELATIVE_DAY_ALIASES.entries()) {
    if (normalizedValue === alias || normalizedValue.includes(` ${alias} `) || normalizedValue.startsWith(`${alias} `)) {
      return daysAgo;
    }
  }

  const relativeMatch = /(?:hace\s+)?(\d+|un|una|one|two|dos)\s+(?:dias?|days?)(?:\s+atras|\s+ago)?/.exec(
    normalizedValue,
  );
  if (relativeMatch) {
    const token = relativeMatch[1];
    if (/^\d+$/.test(token)) {
      return Number(token);
    }

    return RELATIVE_DAY_ALIASES.get(token) ?? null;
  }

  return null;
}

function buildResult({ isRecent, publicationDateIso, publicationDateLabel, daysAgo }) {
  return {
    isRecent,
    publicationDateIso,
    publicationDateLabel,
    daysAgo,
  };
}

export function normalizePublicationDate(rawValue = "", { now } = {}) {
  const normalizedRawValue = normalizeWhitespace(rawValue);
  const normalizedValue = normalizeForMatch(normalizedRawValue);
  const referenceNow = parseNow(now);
  const today = new Date(startOfUtcDay(referenceNow));
  const maxAgeDays = publicationRecencyRules.maxAgeDays;

  if (!normalizedValue) {
    return buildResult({
      isRecent: false,
      publicationDateIso: null,
      publicationDateLabel: "",
      daysAgo: null,
    });
  }

  if (normalizedValue.includes("hoy") || normalizedValue.includes("today")) {
    return buildResult({
      isRecent: true,
      publicationDateIso: formatUtcDate(today),
      publicationDateLabel: "Hoy",
      daysAgo: 0,
    });
  }

  if (normalizedValue.includes("ayer") || normalizedValue.includes("yesterday")) {
    const publicationDate = new Date(today);
    publicationDate.setUTCDate(publicationDate.getUTCDate() - 1);
    return buildResult({
      isRecent: true,
      publicationDateIso: formatUtcDate(publicationDate),
      publicationDateLabel: "Ayer",
      daysAgo: 1,
    });
  }

  const relativeDays = parseRelativeDays(normalizedValue);
  if (relativeDays !== null) {
    const publicationDate = new Date(today);
    publicationDate.setUTCDate(publicationDate.getUTCDate() - relativeDays);
    return buildResult({
      isRecent: relativeDays <= maxAgeDays,
      publicationDateIso: formatUtcDate(publicationDate),
      publicationDateLabel: relativeDays === 1 ? "Ayer" : `Hace ${relativeDays} dias`,
      daysAgo: relativeDays,
    });
  }

  const parsedDate = new Date(normalizedRawValue);
  if (!Number.isNaN(parsedDate.getTime())) {
    const parsedDateUtc = new Date(startOfUtcDay(parsedDate));
    const diffInDays = Math.floor((startOfUtcDay(today) - startOfUtcDay(parsedDateUtc)) / 86400000);

    return buildResult({
      isRecent: diffInDays >= 0 && diffInDays <= maxAgeDays,
      publicationDateIso: formatUtcDate(parsedDateUtc),
      publicationDateLabel: normalizedRawValue,
      daysAgo: diffInDays >= 0 ? diffInDays : null,
    });
  }

  return buildResult({
    isRecent: false,
    publicationDateIso: null,
    publicationDateLabel: normalizedRawValue,
    daysAgo: null,
  });
}
