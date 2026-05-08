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
      "## Palabras clave principales para el titulo",
      "Agregue una por linea:",
      "CUMPLIMIENTO",
      "Ética",
      "Ejemplo: Analista de cumplimiento",
      "",
      "## Palabras clave relacionadas y variantes validas",
      "risk",
      "Debida diligencia",
      "Ejemplo: Risk analyst",
      "",
      "## Señales utiles dentro de la descripcion",
      "",
      "### Ubicacion objetivo",
      "Agregue una por linea:",
      "Bogotá D.C.",
      "Ejemplo: Medellín",
      "",
      "### Experiencia objetivo",
      "1 año",
      "Ejemplo: 2 años",
      "",
      "### Formacion objetivo",
      "Ingeniería industrial",
      "",
      "### Modalidad objetivo",
      "Híbrido",
      "",
    ].join("\n"),
    "URL_plataformas.md": "# placeholder\n",
  });

  const profile = await loadSearchProfile({ repoRoot });

  assert.deepEqual(profile.primaryTitleKeywords, ["CUMPLIMIENTO", "Ética"]);
  assert.deepEqual(profile.relatedTitleKeywords, ["risk", "Debida diligencia"]);
  assert.deepEqual(profile.titleKeywords, ["cumplimiento", "etica", "risk", "debida diligencia"]);
  assert.deepEqual(profile.locationSignals, ["bogota d.c."]);
  assert.deepEqual(profile.experienceSignals, ["1 ano"]);
  assert.deepEqual(profile.educationSignals, ["ingenieria industrial"]);
  assert.deepEqual(profile.modalitySignals, ["hibrido"]);
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
      "## Señales utiles dentro de la descripcion",
      "",
      "### Ubicacion objetivo",
      "Bogotá D.C.",
      "",
      "### Experiencia objetivo",
      "1 año",
      "",
      "### Formacion objetivo",
      "Ingeniería industrial",
      "",
    ].join("\n"),
    "URL_plataformas.md": "# placeholder\n",
  });

  await assert.rejects(
    () => loadSearchProfile({ repoRoot }),
    /Missing required heading: ### Modalidad objetivo/,
  );
});
