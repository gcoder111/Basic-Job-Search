import test from "node:test";
import assert from "node:assert/strict";
import { orchestrateSearch } from "../app/services/orchestrate-search.service.js";

test("orchestrateSearch retries a previously validated failing portal at the end", async () => {
  const seen = [];
  const result = await orchestrateSearch({
    sources: [
      { sourceId: "elempleo", portalKey: "elempleo", displayName: "Elempleo", testStatus: "validado" },
      { sourceId: "linkedin", portalKey: "linkedin", displayName: "LinkedIn", testStatus: "validado" },
    ],
    profile: {
      titleKeywords: ["riesgo"],
      locationSignals: ["bogota"],
      experienceSignals: [],
      educationSignals: [],
      modalitySignals: [],
    },
    now: "2026-05-06T12:00:00.000Z",
    acquireJobs: async (source, phase) => {
      seen.push(`${source.sourceId}:${phase}`);

      if (source.sourceId === "elempleo" && phase === "initial") {
        return { sourceStatus: { status: "retry-later", note: "session lost" }, jobs: [] };
      }

      if (source.sourceId === "elempleo" && phase === "retry-final") {
        return { sourceStatus: { status: "needs-user-decision", note: "refresh auth" }, jobs: [] };
      }

      return {
        sourceStatus: { status: "success", note: "" },
        jobs: [
          {
            title: "Analista de Riesgo",
            company: "A",
            url: "https://example.com/a",
            description: "Bogota",
            publicationDateRaw: "ayer",
          },
        ],
      };
    },
  });

  assert.deepEqual(seen, ["elempleo:initial", "linkedin:initial", "elempleo:retry-final"]);
  assert.equal(result.sourceStatuses.some((status) => status.status === "needs-user-decision"), true);
  assert.equal(result.selectedJobs.length, 1);
  assert.equal(result.selectedJobs[0].priority, "medium");
});
