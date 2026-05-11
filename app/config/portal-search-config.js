export const portalSearchConfig = {
  linkedin: {
    accessMode: "public",
  },
  magneto: {
    accessMode: "public",
  },
  computrabajo: {
    accessMode: "authenticated",
  },
  adecco: {
    accessMode: "public",
  },
  michaelpage: {
    accessMode: "public",
  },
  elempleo: {
    accessMode: "authenticated",
  },
};

export function getPortalSearchConfig(portalKey) {
  return portalSearchConfig[portalKey] || null;
}

export function listSearchablePortals() {
  return Object.keys(portalSearchConfig);
}
