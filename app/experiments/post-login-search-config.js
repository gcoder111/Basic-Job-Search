const configs = {
  linkedin: {
    key: "linkedin",
    displayName: "LinkedIn Jobs",
    sessionStrategy: "storageState",
    targetUrl: "https://www.linkedin.com/jobs/",
    searchEntryUrls: ["https://www.linkedin.com/jobs/"],
    keywordInputSelector: 'input[placeholder*="empleo" i]',
    keywordInputAlternates: [],
    submitAction: "enter",
    submitButtonSelector: null,
    directSearchUrlPattern: "https://www.linkedin.com/jobs/search?keywords={keywordQuery}",
    expectedUrlKeyword: "/jobs/search",
    resultsMarker: "jobs in",
  },
  elempleo: {
    key: "elempleo",
    displayName: "Elempleo",
    sessionStrategy: "storageState",
    targetUrl: "https://www.elempleo.com/co/homeusuario",
    searchEntryUrls: ["https://www.elempleo.com/co/homeusuario"],
    keywordInputSelector: "input.js-searchbox-input.tt-input",
    keywordInputAlternates: ["input.js-searchbox-input"],
    submitAction: "click",
    submitButtonSelector: "button.js-searchHeader",
    directSearchUrlPattern: "https://www.elempleo.com/co/ofertas-empleo/trabajo-{keywordSlug}",
    expectedUrlKeyword: "/ofertas-empleo/",
    resultsMarker: "ofertas de empleo",
  },
  computrabajo: {
    key: "computrabajo",
    displayName: "Computrabajo",
    sessionStrategy: "persistentProfile",
    targetUrl: "https://candidato.co.computrabajo.com/candidate/home",
    searchEntryUrls: ["https://candidato.co.computrabajo.com/candidate/home"],
    keywordInputSelector: "#prof-cat-search-input",
    keywordInputAlternates: [],
    submitAction: "click",
    submitButtonSelector: 'button:has-text("Buscar empleos")',
    directSearchUrlPattern: null,
    expectedUrlKeyword: "/trabajo-de-",
    resultsMarker: "ofertas de trabajo",
  },
};

export function getPostLoginSearchConfig(portalKey) {
  return configs[portalKey];
}
