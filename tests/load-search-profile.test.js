import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { loadSearchProfile } from "../app/services/load-search-profile.js";

async function createRepoFixture(files) {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "basic-job-search-profile-"));

  await Promise.all(
    Object.entries(files).map(([relativePath, content]) =>
      fs.writeFile(path.join(repoRoot, relativePath), content, "utf8"),
    ),
  );

  return repoRoot;
}

test("loadSearchProfile reads expected sections, normalizes values, and skips instructions", async () => {
  const repoRoot = await createRepoFixture({
    "job-search-profile.md": [
      "# Job Search Profile",
      "",
      "## Estrategia de uso en portales",
      "- revisar siempre la configuracion de navegacion multipagina definida en este archivo antes de ejecutar cada busqueda por keyword",
      "",
      "### Navegacion multipagina por keyword",
      "Defina aqui cuantas veces el agente debe avanzar con el boton `Siguiente` cuando el portal soporte navegacion multipagina verificable.",
      "- clicks en `Siguiente`: 7",
      "- instruccion operativa: los agentes deben leer este dato en cada corrida y aplicarlo a cada busqueda por keyword antes de consolidar, filtrar, puntuar y deduplicar resultados",
      "",
      "## Palabras clave principales para el titulo",
      "Agregue una por linea:",
      "CUMPLIMIENTO",
      "Etica",
      "Ejemplo: Analista de cumplimiento",
      "",
      "## Palabras clave relacionadas y variantes validas",
      "risk",
      "Debida diligencia",
      "Ejemplo: Risk analyst",
      "",
      "## Senales utiles dentro de la descripcion",
      "",
      "### Ubicacion objetivo",
      "Agregue una por linea:",
      "Bogota D.C.",
      "Ejemplo: Medellin",
      "",
      "### Experiencia objetivo",
      "1 ano",
      "Ejemplo: 2 anos",
      "",
      "### Formacion objetivo",
      "Ingenieria industrial",
      "",
      "### Modalidad objetivo",
      "Hibrido",
      "",
      "## Terminos que requieren cuidado",
      "Agregue terminos que generan ruido si aparecen solos:",
      "SST",
      "Medio Ambiente",
      "",
    ].join("\n"),
    "URL_plataformas.md": "# placeholder\n",
  });

  const profile = await loadSearchProfile({ repoRoot });

  assert.deepEqual(profile.primaryTitleKeywords, ["CUMPLIMIENTO", "Etica"]);
  assert.deepEqual(profile.relatedTitleKeywords, ["risk", "Debida diligencia"]);
  assert.deepEqual(profile.titleKeywords, ["cumplimiento", "etica", "risk", "debida diligencia"]);
  assert.deepEqual(profile.locationSignals, ["bogota d.c."]);
  assert.deepEqual(profile.experienceSignals, ["1 ano"]);
  assert.deepEqual(profile.educationSignals, ["ingenieria industrial"]);
  assert.deepEqual(profile.modalitySignals, ["hibrido"]);
  assert.deepEqual(profile.cautionTitleTerms, ["sst", "medio ambiente"]);
  assert.equal(profile.multipageNextClicks, 7);
});

test("loadSearchProfile throws when a required heading is missing", async () => {
  const repoRoot = await createRepoFixture({
    "job-search-profile.md": [
      "# Job Search Profile",
      "",
      "## Palabras clave principales para el titulo",
      "compliance",
      "",
      "## Palabras clave relacionadas y variantes validas",
      "risk",
      "",
      "## Senales utiles dentro de la descripcion",
      "",
      "### Ubicacion objetivo",
      "Bogota D.C.",
      "",
      "### Experiencia objetivo",
      "1 ano",
      "",
      "### Formacion objetivo",
      "Ingenieria industrial",
      "",
    ].join("\n"),
    "URL_plataformas.md": "# placeholder\n",
  });

  await assert.rejects(
    () => loadSearchProfile({ repoRoot }),
    /Missing required heading: ### Modalidad objetivo/,
  );
});
