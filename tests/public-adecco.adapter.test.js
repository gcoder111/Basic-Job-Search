import test from "node:test";
import assert from "node:assert/strict";
import { extractAdeccoJobsFromHtml } from "../app/adapters/public-adecco.adapter.js";

test("extractAdeccoJobsFromHtml maps public candidate jobs", async () => {
  const jobs = await extractAdeccoJobsFromHtml(`
    <article>
      <a href="https://www.adecco.com/es-co/oferta/1">Analista de cumplimiento</a>
      <span class="job-location">Bogota</span>
      <span class="job-date">ayer</span>
    </article>
  `);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].publicationDateRaw, "ayer");
});
