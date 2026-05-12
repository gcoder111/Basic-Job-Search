import { JSDOM } from "jsdom";

function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function sliceDescription(text) {
  const normalized = cleanText(text);
  const match = normalized.match(
    /Descripcion del cargo(.*?)(?:Habilidades clave|Que ofrecemos\?|¡Tu experiencia vale mucho!|Profesion|Nivel educativo|Numero de vacantes|Busqueda?s rapidas|$)/i,
  );

  if (match?.[1]) {
    return cleanText(match[1]);
  }

  return normalized;
}

export function extractElempleoDetailFromText(bodyText = "") {
  const text = cleanText(bodyText);
  const modalityMatch = text.match(/\b(H[ií]brido|Presencial|Remoto)\b/i);
  const experienceMatch = text.match(
    /(Menos de un a(?:n|ñ)o de experiencia|Entre \d+\s+meses?\s+y\s+\d+\s+a(?:n|ñ)o[s]?\s+de experiencia|Entre \d+\s+y\s+\d+\s+a(?:n|ñ)o[s]?|[0-9]+\s+a(?:n|ñ)o[s]?\s+de experiencia)/i,
  );
  const educationMatch = text.match(
    /(Administraci[oó]n de Empresas|Derecho|Finanzas|Contadur[ií]a P[uú]blica|Econom[ií]a|Ingenier[ií]a(?: industrial)?)/i,
  );
  const locationMatch = text.match(
    /\b(Bogot[aá](?:\s+D\.?C\.?)?|Ch[ií]a|Bogot[aá]\s+y\s+alrededores|Sabana de Bogot[aá])\b/i,
  );

  return {
    modality: cleanText(modalityMatch?.[1] || ""),
    experience: cleanText(experienceMatch?.[1] || ""),
    education: cleanText(educationMatch?.[1] || ""),
    location: cleanText(locationMatch?.[1] || ""),
    description: sliceDescription(text),
  };
}

export function extractElempleoDetailFromHtml(html = "") {
  const document = new JSDOM(html).window.document;
  return extractElempleoDetailFromText(document.body?.textContent || "");
}
