import test from "node:test";
import assert from "node:assert/strict";
import { extractElempleoJobsFromHtml } from "../app/adapters/auth-elempleo.adapter.js";

test("extractElempleoJobsFromHtml maps post-login cards into jobs", async () => {
  const jobs = await extractElempleoJobsFromHtml(`
    <article>
      <a href="https://www.elempleo.com/co/ofertas-trabajo/analista-de-compliance/1">Analista de Compliance</a>
      <span>Empresa D</span>
      <span>Bogota</span>
      <span>ayer</span>
    </article>
  `);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, "Empresa D");
});
