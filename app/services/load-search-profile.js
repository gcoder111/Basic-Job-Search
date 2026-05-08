import fs from "node:fs/promises";
import path from "node:path";
import { sourceFiles } from "../config/source-files.js";
import { normalizeForMatch, normalizeWhitespace } from "../utils/normalize-text.js";

function headingLevel(line) {
  const match = /^(\s*#{1,6})\s+(.*)$/.exec(line);
  return match ? match[1].trim().length : 0;
}

function headingText(line) {
  const match = /^(\s*#{1,6})\s+(.*)$/.exec(line);
  return match ? normalizeForMatch(match[2]) : "";
}

function headingQueryText(heading) {
  return normalizeForMatch(String(heading).replace(/^#{1,6}\s*/, ""));
}

function isInstructionLine(line) {
  const normalized = normalizeForMatch(line);
  return (
    normalized === "---" ||
    normalized.endsWith(":") ||
    /^(agregue|describa|defina|mantenga|si cambia|cuando un portal permita|si el objetivo|ejemplo)\b/.test(
      normalized,
    )
  );
}

function collectSectionLines(markdown, heading, { required = true } = {}) {
  const lines = String(markdown).split(/\r?\n/);
  const target = headingQueryText(heading);
  const start = lines.findIndex((line) => headingText(line) === target);

  if (start === -1) {
    if (required) {
      throw new Error(`Missing required heading: ${heading}`);
    }

    return [];
  }

  const sectionLevel = headingLevel(lines[start]);
  const items = [];

  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }

    if (line.startsWith("#")) {
      const nextLevel = headingLevel(line);
      if (nextLevel <= sectionLevel) {
        break;
      }
      continue;
    }

    if (isInstructionLine(line)) {
      continue;
    }

    items.push(normalizeWhitespace(line));
  }

  return items.filter(Boolean);
}

export async function loadSearchProfile({ repoRoot }) {
  const documentPath = path.join(repoRoot, sourceFiles.searchProfile);
  const markdown = await fs.readFile(documentPath, "utf8");

  const primaryTitleKeywords = collectSectionLines(
    markdown,
    "## Palabras clave principales para el titulo",
  );
  const relatedTitleKeywords = collectSectionLines(
    markdown,
    "## Palabras clave relacionadas y variantes validas",
  );
  const locationSignals = collectSectionLines(markdown, "### Ubicacion objetivo").map(
    normalizeForMatch,
  );
  const experienceSignals = collectSectionLines(markdown, "### Experiencia objetivo").map(
    normalizeForMatch,
  );
  const educationSignals = collectSectionLines(markdown, "### Formacion objetivo").map(
    normalizeForMatch,
  );
  const modalitySignals = collectSectionLines(markdown, "### Modalidad objetivo").map(
    normalizeForMatch,
  );

  return {
    documentPath,
    primaryTitleKeywords,
    relatedTitleKeywords,
    titleKeywords: [...primaryTitleKeywords, ...relatedTitleKeywords].map(normalizeForMatch),
    locationSignals,
    experienceSignals,
    educationSignals,
    modalitySignals,
  };
}
