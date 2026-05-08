export function createSourceStatus(source, status, note = "") {
  return {
    sourceId: source.sourceId,
    displayName: source.displayName,
    portalKey: source.portalKey,
    status,
    note,
  };
}

export function shouldRetryAtEnd(source, status) {
  return source.testStatus === "validado" && (status === "retry-later" || status === "auth-lost");
}
