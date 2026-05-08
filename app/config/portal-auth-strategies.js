const validatedPortalStrategies = {
  linkedin: {
    portalKey: "linkedin",
    sessionStrategy: "storageState",
    authArtifactName: "linkedin.json",
  },
  elempleo: {
    portalKey: "elempleo",
    sessionStrategy: "storageState",
    authArtifactName: "elempleo.json",
  },
  computrabajo: {
    portalKey: "computrabajo",
    sessionStrategy: "persistentProfile",
    authArtifactName: "computrabajo",
  },
};

export function getPortalAuthStrategy(portalKey) {
  return validatedPortalStrategies[portalKey] || null;
}
