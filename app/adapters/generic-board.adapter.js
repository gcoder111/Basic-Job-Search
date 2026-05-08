import { createAcquireResult } from "./source-adapter.js";

export async function acquireFromGenericBoard(source) {
  return createAcquireResult(source, {
    status: "no-results",
    note: "Public portal adapter not implemented yet for this portal.",
    jobs: [],
  });
}
