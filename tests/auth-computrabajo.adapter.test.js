import test from "node:test";
import assert from "node:assert/strict";
import { extractComputrabajoJobsFromHtml } from "../app/adapters/auth-computrabajo.adapter.js";

test("extractComputrabajoJobsFromHtml maps post-login results into jobs", async () => {
  const jobs = await extractComputrabajoJobsFromHtml(`
    <article class="box_offer">
      <h2 class="fs18 fwB prB">
        <a class="js-o-link fc_base" href="/ofertas-de-trabajo/oferta-de-trabajo-de-analista-1">
          Analista de Riesgo
        </a>
      </h2>
      <p class="dFlex vm_fx fs16 fc_base mt5">
        <a offer-grid-article-company-url="" class="fc_base t_ellipsis">Empresa C</a>
      </p>
      <p class="fs16 fc_base mt5">
        <span class="mr10">Yumbo, Valle del Cauca</span>
      </p>
      <div class="fs13 mt15">
        <span class="dIB mr10">Presencial y remoto</span>
      </div>
      <p class="fs13 fc_aux mt15">Hace 2 dias</p>
    </article>
  `);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, "Analista de Riesgo");
  assert.equal(jobs[0].url, "https://co.computrabajo.com/ofertas-de-trabajo/oferta-de-trabajo-de-analista-1");
  assert.equal(jobs[0].company, "Empresa C");
  assert.equal(jobs[0].location, "Yumbo, Valle del Cauca");
  assert.equal(jobs[0].publicationDateRaw, "Hace 2 dias");
  assert.equal(jobs[0].description.includes("Yumbo, Valle del Cauca"), true);
});
