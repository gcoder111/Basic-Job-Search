import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { loadSources } from "../app/services/load-sources.service.js";

async function createRepoFixture(files) {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "basic-job-search-sources-"));

  await Promise.all(
    Object.entries(files).map(([relativePath, content]) =>
      fs.writeFile(path.join(repoRoot, relativePath), content, "utf8"),
    ),
  );

  return repoRoot;
}

test("loadSources infers portal metadata from the current platform list", async () => {
  const result = await loadSources({ repoRoot: process.cwd() });

  assert.equal(Array.isArray(result.allSources), true);
  assert.equal(result.allSources.length, 6);

  const linkedin = result.allSources.find((source) => source.url === "https://linkedin.com/jobs");
  assert.ok(linkedin);
  assert.equal(linkedin.sourceId, "linkedin-linkedin-com-jobs");
  assert.equal(linkedin.portalKey, "linkedin");
  assert.equal(linkedin.url, "https://linkedin.com/jobs");
  assert.equal(linkedin.requiresAuth, false);
  assert.equal(linkedin.sessionStrategy, "publico");
  assert.equal(linkedin.testStatus, "pendiente");
  assert.equal(typeof linkedin.displayName, "string");
  assert.notEqual(linkedin.displayName.trim(), "");
  assert.equal(typeof linkedin.notes, "string");
  assert.notEqual(linkedin.notes.trim(), "");

  const elempleo = result.allSources.find(
    (source) => source.url === "https://elempleo.com/co/homeusuario",
  );
  assert.ok(elempleo);
  assert.equal(elempleo.portalKey, "elempleo");
  assert.equal(elempleo.sourceId, "elempleo-elempleo-com-co-homeusuario");
  assert.equal(elempleo.requiresAuth, true);
});

test("loadSources reads explicit portal metadata for all target URLs", async () => {
  const { allSources } = await loadSources({ repoRoot: process.cwd() });
  const metadataByPortal = Object.fromEntries(
    allSources.map((source) => [
      source.portalKey,
      [source.requiresAuth, source.sessionStrategy],
    ]),
  );

  assert.deepEqual(
    metadataByPortal,
    {
      linkedin: [false, "publico"],
      magneto: [false, "publico"],
      computrabajo: [true, "persistentProfile"],
      adecco: [false, "publico"],
      michaelpage: [false, "publico"],
      elempleo: [true, "storageState"],
    },
  );
});

test("loadSources applies defaults and parses accented login flags from a fixture", async () => {
  const repoRoot = await createRepoFixture({
    "URL_plataformas.md": [
      "# URL de Plataformas",
      "",
      "## Portales objetivo",
      "",
      "https://example.com/jobs",
      "",
      "| portal_key | nombre_portal | url_inicio | requiere_login | estrategia_sesion | estado_pruebas | notas |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| | | https://example.com/jobs | sí | | | |",
      "",
    ].join("\n"),
    "job-search-profile.md": "# placeholder\n",
  });

  const { allSources } = await loadSources({ repoRoot });
  assert.deepEqual(allSources, [
    {
      sourceId: "example-com-jobs",
      portalKey: "example-com",
      displayName: "example.com",
      url: "https://example.com/jobs",
      requiresAuth: true,
      sessionStrategy: "por_definir",
      testStatus: "pendiente",
      notes: "",
    },
  ]);
});

test("loadSources ignores URLs that appear outside the operational portal area", async () => {
  const repoRoot = await createRepoFixture({
    "URL_plataformas.md": [
      "# URL de Plataformas",
      "",
      "## Portales objetivo",
      "",
      "https://example.com/jobs",
      "",
      "| portal_key | nombre_portal | url_inicio | requiere_login | estrategia_sesion | estado_pruebas | notas |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| | | https://example.org/careers | no | publico | validado | https://example.com/ignored-notes |",
      "",
      "## Instrucciones de diligenciamiento",
      "",
      "- Visite https://example.com/ignored-instructions only as documentation.",
      "",
      "## Reglas practicas",
      "",
      "- No use https://example.net/ignored-rules for anything else.",
      "",
    ].join("\n"),
    "job-search-profile.md": "# placeholder\n",
  });

  const { allSources } = await loadSources({ repoRoot });

  assert.deepEqual(
    allSources.map((source) => source.url),
    ["https://example.com/jobs", "https://example.org/careers"],
  );
});

test("loadSources keeps fallback sourceIds unique for same-host operational URLs", async () => {
  const repoRoot = await createRepoFixture({
    "URL_plataformas.md": [
      "# URL de Plataformas",
      "",
      "## Portales objetivo",
      "",
      "https://example.com/jobs",
      "",
      "| portal_key | nombre_portal | url_inicio | requiere_login | estrategia_sesion | estado_pruebas | notas |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| | | https://example.com/jobs | no | publico | validado | |",
      "| | | https://example.com/jobs/software | no | publico | validado | |",
      "",
    ].join("\n"),
    "job-search-profile.md": "# placeholder\n",
  });

  const { allSources } = await loadSources({ repoRoot });
  const sourceIds = allSources.map((source) => source.sourceId);

  assert.equal(new Set(sourceIds).size, 2);
  assert.deepEqual(sourceIds, ["example-com-jobs", "example-com-jobs-software"]);
});

test("loadSources canonicalizes operational URLs before matching and preserves table metadata", async () => {
  const repoRoot = await createRepoFixture({
    "URL_plataformas.md": [
      "# URL de Plataformas",
      "",
      "## Portales objetivo",
      "",
      "HTTPS://WWW.Example.com/jobs/",
      "",
      "| portal_key | nombre_portal | url_inicio | requiere_login | estrategia_sesion | estado_pruebas | notas |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| portal-x | Example Portal | https://example.com/jobs/ | si | storageState | validado | https://example.com/notes |",
      "",
    ].join("\n"),
    "job-search-profile.md": "# placeholder\n",
  });

  const { allSources } = await loadSources({ repoRoot });

  assert.deepEqual(allSources, [
    {
      sourceId: "portal-x-example-com-jobs",
      portalKey: "portal-x",
      displayName: "Example Portal",
      url: "https://example.com/jobs",
      requiresAuth: true,
      sessionStrategy: "storageState",
      testStatus: "validado",
      notes: "https://example.com/notes",
    },
  ]);
});

test("loadSources keeps sourceIds unique when portal_key is reused across operational URLs", async () => {
  const repoRoot = await createRepoFixture({
    "URL_plataformas.md": [
      "# URL de Plataformas",
      "",
      "## Portales objetivo",
      "",
      "https://example.com/jobs",
      "",
      "| portal_key | nombre_portal | url_inicio | requiere_login | estrategia_sesion | estado_pruebas | notas |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| portal-x | Example Portal | https://example.com/jobs | no | publico | validado | |",
      "| portal-x | Example Portal | https://example.com/jobs/software | no | publico | validado | |",
      "",
    ].join("\n"),
    "job-search-profile.md": "# placeholder\n",
  });

  const { allSources } = await loadSources({ repoRoot });
  const sourceIds = allSources.map((source) => source.sourceId);

  assert.equal(new Set(sourceIds).size, 2);
  assert.deepEqual(sourceIds, ["portal-x-example-com-jobs", "portal-x-example-com-jobs-software"]);
});
