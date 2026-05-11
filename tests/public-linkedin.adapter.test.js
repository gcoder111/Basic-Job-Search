import test from "node:test";
import assert from "node:assert/strict";
import { extractLinkedinJobsFromHtml } from "../app/adapters/public-linkedin.adapter.js";

test("extractLinkedinJobsFromHtml maps linkedin cards into normalized jobs", async () => {
  const jobs = await extractLinkedinJobsFromHtml(`
    <div class="base-search-card">
      <h3>Analista de Compliance</h3>
      <h4>Empresa A</h4>
      <a href="https://www.linkedin.com/jobs/view/1"></a>
      <time datetime="2026-05-08">ayer</time>
    </div>
  `);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, "Analista de Compliance");
});
