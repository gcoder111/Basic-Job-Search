import fs from "node:fs/promises";
import path from "node:path";
import { sourceFiles } from "../config/source-files.js";
import { parseMarkdownTables } from "../utils/markdown-table.js";
import { normalizeForMatch, normalizeWhitespace, slugify } from "../utils/normalize-text.js";

function canonicalizeOperationalUrl(url) {
  const normalizedUrl = normalizeWhitespace(url);

  if (!normalizedUrl) {
    return "";
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    const protocol = parsedUrl.protocol.toLowerCase();
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = parsedUrl.pathname.toLowerCase().replace(/\/+$/, "") || "/";
    const search = parsedUrl.search.toLowerCase();
    return `${protocol}//${hostname}${pathname}${search}`;
  } catch {
    return normalizeForMatch(normalizedUrl);
  }
}

function inferPortalKey(url) {
  const lowerUrl = normalizeWhitespace(url).toLowerCase();

  if (lowerUrl.includes("linkedin.com")) return "linkedin";
  if (lowerUrl.includes("elempleo.com")) return "elempleo";
  if (lowerUrl.includes("computrabajo.com")) return "computrabajo";
  if (lowerUrl.includes("magneto365.com")) return "magneto";
  if (lowerUrl.includes("adecco.com")) return "adecco";
  if (lowerUrl.includes("michaelpage.com.co")) return "michaelpage";

  try {
    return slugify(new URL(url).hostname);
  } catch {
    return slugify(url);
  }
}

function toBooleanFlag(value) {
  const normalized = normalizeForMatch(value);
  return normalized === "si" || normalized === "yes" || normalized === "true";
}

function getSectionMarkdown(markdown, heading) {
  const lines = String(markdown).split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim().toLowerCase() === heading.toLowerCase());
  if (startIndex === -1) {
    return "";
  }

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex + 1, endIndex).join("\n");
}

function extractUrls(markdown) {
  const matches = String(markdown).match(/https?:\/\/[^\s)]+/gi) || [];
  return matches.map((url) => url.replace(/[.,;]+$/, ""));
}

function deriveDisplayName(url) {
  try {
    return normalizeWhitespace(new URL(url).hostname.replace(/^www\./, ""));
  } catch {
    return normalizeWhitespace(url);
  }
}

function buildFallbackSourceId(url) {
  try {
    const parsedUrl = new URL(url);
    const normalizedPath = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`.replace(/\/+$/, "") || "/";
    const normalizedHost = parsedUrl.hostname.replace(/^www\./, "");
    return slugify(`${normalizedHost}${normalizedPath}`);
  } catch {
    return slugify(url);
  }
}

export async function loadSources({ repoRoot }) {
  const documentPath = path.join(repoRoot, sourceFiles.platformSources);
  const markdown = await fs.readFile(documentPath, "utf8");
  const portalSectionMarkdown = getSectionMarkdown(markdown, "## Portales objetivo");
  const [table] = parseMarkdownTables(portalSectionMarkdown);
  const tableRows = table?.rows || [];
  const tableRowsByUrl = new Map(
    tableRows
      .map((row) => ({
        url: canonicalizeOperationalUrl(row.url_inicio || ""),
        row,
      }))
      .filter(({ url }) => url.startsWith("http"))
      .map(({ url, row }) => [url, row]),
  );
  const plainTextUrls = extractUrls(
    portalSectionMarkdown
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith("|"))
      .join("\n"),
  ).map((url) => canonicalizeOperationalUrl(url)).filter((url) => url.startsWith("http"));
  const tableUrls = tableRows
    .map((row) => canonicalizeOperationalUrl(row.url_inicio || ""))
    .filter((url) => url.startsWith("http"));
  const urls = [...new Set([...plainTextUrls, ...tableUrls])];

  const allSources = urls.map((url) => {
    const row = tableRowsByUrl.get(url);
    const displayName = normalizeWhitespace(row?.nombre_portal) || deriveDisplayName(url);
    const portalKey = normalizeWhitespace(row?.portal_key) || inferPortalKey(url);
    const sourceIdPrefix = slugify(row?.portal_key);

    return {
      sourceId: sourceIdPrefix ? `${sourceIdPrefix}-${buildFallbackSourceId(url)}` : buildFallbackSourceId(url),
      portalKey,
      displayName,
      url,
      requiresAuth: toBooleanFlag(row?.requiere_login),
      sessionStrategy: normalizeWhitespace(row?.estrategia_sesion || "por_definir"),
      testStatus: normalizeWhitespace(row?.estado_pruebas || "pendiente"),
      notes: normalizeWhitespace(row?.notas || ""),
    };
  });

  return { allSources };
}
