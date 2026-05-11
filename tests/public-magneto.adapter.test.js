import test from "node:test";
import assert from "node:assert/strict";
import { extractMagnetoJobsFromHtml } from "../app/adapters/public-magneto.adapter.js";

test("extractMagnetoJobsFromHtml reads title url and company", async () => {
  const jobs = await extractMagnetoJobsFromHtml(`
    <article>
      <a href="https://www.magneto365.com/job/1">Analista de Riesgo</a>
      <span>Empresa B</span>
      <span>Bogota</span>
    </article>
  `);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, "Empresa B");
});
