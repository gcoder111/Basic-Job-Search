export function createAcquireResult(source, { status, note = "", jobs = [] }) {
  return {
    sourceStatus: {
      sourceId: source.sourceId,
      displayName: source.displayName,
      status,
      note,
    },
    jobs,
  };
}
