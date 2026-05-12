import test from "node:test";
import assert from "node:assert/strict";
import { extractElempleoDetailFromText } from "../app/adapters/auth-elempleo-detail.adapter.js";

test("extractElempleoDetailFromText recovers useful risk-and-compliance signals", () => {
  const detail = extractElempleoDetailFromText(`
    Analista Junior de Riesgos y Cumplimiento - Bogota
    Bogota - Hibrido
    Menos de un ano de experiencia
    Descripcion del cargo
    Apoyar la gestion integral de riesgos y cumplimiento.
    Investigar y documentar antecedentes de terceros en procesos de debida diligencia.
  `);

  assert.equal(detail.modality, "Hibrido");
  assert.equal(detail.experience.includes("Menos de un ano de experiencia"), true);
  assert.equal(detail.description.includes("debida diligencia"), true);
});
