import { createAcquireResult } from "./source-adapter.js";

export async function acquireFromAtsPage(source) {
  return createAcquireResult(source, {
    status: "no-results",
    note: "Company ATS adapter not implemented yet.",
    jobs: [],
  });
}
