const configs = {
  linkedin: {
    key: "linkedin",
    displayName: "LinkedIn Jobs",
    sessionStrategy: "storageState",
    targetUrl: "https://www.linkedin.com/jobs/",
    keywordInputSelector: 'input[placeholder*="empleo" i]',
    submitAction: "enter",
    submitButtonSelector: null,
    expectedUrlKeyword: "/jobs/search-results/",
    resultsMarker: "resultados",
  },
  elempleo: {
    key: "elempleo",
    displayName: "Elempleo",
    sessionStrategy: "storageState",
    targetUrl: "https://www.elempleo.com/co/homeusuario",
    keywordInputSelector: "input.js-searchbox-input.tt-input",
    submitAction: "click",
    submitButtonSelector: "button.js-searchHeader",
    expectedUrlKeyword: "/ofertas-empleo/",
    resultsMarker: "ofertas de empleo",
  },
  computrabajo: {
    key: "computrabajo",
    displayName: "Computrabajo",
    sessionStrategy: "persistentProfile",
    targetUrl: "https://candidato.co.computrabajo.com/candidate/home",
    keywordInputSelector: "#prof-cat-search-input",
    submitAction: "click",
    submitButtonSelector: 'button:has-text("Buscar empleos")',
    expectedUrlKeyword: "/trabajo-de-",
    resultsMarker: "ofertas de trabajo",
  },
};

export function getPostLoginSearchConfig(portalKey) {
  return configs[portalKey];
}
