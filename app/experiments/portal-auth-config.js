export function isElempleoAuthenticated({ currentUrl = "", passwordInputCount = 0, title = "" }) {
  const lowerUrl = currentUrl.toLowerCase();
  const lowerTitle = title.toLowerCase();

  if (lowerUrl.includes("/iniciar-sesion") || lowerUrl.includes("unauthorized")) {
    return false;
  }

  if (lowerTitle.includes("iniciar sesion")) {
    return false;
  }

  return passwordInputCount === 0;
}

export function isLinkedInAuthenticated({ cookieNames = [] }) {
  return cookieNames.includes("li_at");
}

export function isComputrabajoAuthenticated({ currentUrl = "", cookieNames = [], bodyText = "" }) {
  const lowerUrl = currentUrl.toLowerCase();
  const lowerBodyText = bodyText.toLowerCase();
  const lowerCookieNames = cookieNames.map((name) => name.toLowerCase());

  if (lowerUrl.includes("/acceso/") || lowerUrl.includes("returnurl=")) {
    return false;
  }

  if (lowerBodyText.includes("mi area") || lowerBodyText.includes("hoja de vida")) {
    return true;
  }

  return (
    lowerCookieNames.includes("pa_user") ||
    lowerCookieNames.includes("uca") ||
    lowerCookieNames.includes("idsrv")
  );
}

const portalConfigs = {
  linkedin: {
    key: "linkedin",
    displayName: "LinkedIn Jobs",
    targetUrl: "https://www.linkedin.com/jobs/",
    detectAuthenticated: isLinkedInAuthenticated,
  },
  elempleo: {
    key: "elempleo",
    displayName: "Elempleo",
    targetUrl: "https://www.elempleo.com/co/homeusuario",
    detectAuthenticated: isElempleoAuthenticated,
  },
  computrabajo: {
    key: "computrabajo",
    displayName: "Computrabajo",
    targetUrl: "https://candidato.co.computrabajo.com/candidate/home",
    detectAuthenticated: isComputrabajoAuthenticated,
  },
};

export function getPortalConfig(portalKey) {
  return portalConfigs[portalKey];
}
