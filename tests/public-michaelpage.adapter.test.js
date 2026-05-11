import test from "node:test";
import assert from "node:assert/strict";
import { extractMichaelPageJobsFromHtml } from "../app/adapters/public-michaelpage.adapter.js";

test("extractMichaelPageJobsFromHtml reads listing blocks from the bogota page", async () => {
  const jobs = await extractMichaelPageJobsFromHtml(`
    <div class="job-search-results__item">
      <a href="/job-detail/analista-de-riesgo/jobid-123">Analista de Riesgo</a>
      <div class="job-search-results__location">Bogota</div>
      <div class="job-search-results__job-description">SARLAFT y cumplimiento</div>
    </div>
  `);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].location, "Bogota");
});
