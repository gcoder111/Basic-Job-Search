# Elempleo Parser Recovery Options Plan

**Created:** 2026-05-11
**Status:** active
**Scope:** Planificar tres opciones para corregir la extracción de `Elempleo` y recuperar una shortlist real sin ejecutar implementación todavía.

---

## Problem Frame

La corrida autenticada de `Elempleo` ya demostró que la sesión reutilizable funciona, la búsqueda post-login funciona y la navegación multipágina también funciona. El cuello de botella actual está en la extracción de cards de resultados.

Hoy el parser en `app/adapters/auth-elempleo.adapter.js` usa selectores demasiado genéricos:

- toma el primer `span` como empresa
- copia casi todo el `textContent` como `location`
- deja `publicationDateRaw` vacío cuando la fecha visible no vive en `time` ni `.date`

La evidencia más clara quedó en `results/elempleo-post-login-search-compliance.json` y en `data/runs/latest.json`: las cards sí contienen strings como `Hace 1 mes`, `Hace 2 semanas`, `Bogotá`, `Híbrido` y descripciones útiles, pero el parser no los separa. Como `publicationDateRaw` queda vacío, el filtro descarta todo por `stale-publication-date`.

---

## Goal

Definir tres caminos viables para que `Elempleo` produzca una shortlist real:

1. endurecer el parser de card con selectores y heurísticas textuales
2. priorizar metadata estructurada embebida en la card
3. usar un flujo híbrido con confirmación en detalle solo para candidatos prometedores

El plan debe quedar listo para ejecución posterior por `ce-work`.

---

## Scope Boundaries

- No incluye implementación ahora.
- No cambia reglas de negocio en `job-search-profile.md`.
- No cambia el contrato general del batch para otros portales.
- No reemplaza la lógica de scoring, deduplicación o cuarentena; solo mejora la calidad de los datos de entrada para `Elempleo`.
- No convierte esta fase en scraping masivo de detalle de todas las vacantes.

### Deferred to Follow-Up Work

- Ajustes finos de ranking si, después de corregir extracción, la shortlist sigue trayendo demasiado ruido.
- Posible enriquecimiento de detalle para shortlist final en otros portales autenticados.

---

## Context & Research

### Relevant Code and Patterns

- `app/adapters/auth-elempleo.adapter.js`: parser actual demasiado genérico.
- `tests/auth-elempleo.adapter.test.js`: cobertura actual insuficiente; solo valida empresa.
- `app/services/filter-jobs.service.js`: exige `publicationDateRaw` interpretable y al menos una señal no geográfica.
- `app/utils/normalize-date.js`: parser de recencia ya es más estricto que antes; el problema no parece estar aquí sino en la falta de fecha extraída.
- `app/adapters/browser-search.adapter.js`: integra extracción autenticada viva desde `runPortalSearch`.
- `app/experiments/post-login-search.js`: persiste evidencia útil por keyword y portal.

### Institutional Learnings

- `docs/solutions/best-practices/portal-multipage-search-scoring-and-deduplication-2026-05-10.md`
  - documenta que `Elempleo` ya había mostrado un patrón reusable de multipágina
  - recomienda extraer metadata embebida en card cuando exista, especialmente `data-ga4-offerdata`
- `docs/solutions/best-practices/authenticated-portal-location-validation-and-indeterminate-location-handling-2026-05-11.md`
  - reafirma que ubicación es contextual, no excluyente
  - obliga a tratar con honestidad la incertidumbre de ubicación

### Evidence Anchors

- `results/elempleo-post-login-search-compliance.json`
- `results/elempleo-batch-summary-latest.json`
- `data/runs/latest.json`

---

## Key Technical Decisions

- Mantener el batch de `Elempleo` dentro del flujo autenticado existente; el problema se corrige en la extracción, no en la autenticación.
- Corregir primero la extracción de fecha visible y separación de campos antes de tocar scoring o recencia.
- Fortalecer pruebas con HTML más parecido al portal real antes de confiar en una nueva corrida.
- Tratar las tres opciones como tracks mutuamente excluyentes en primera instancia, pero con posibilidad de converger a un diseño híbrido si la opción recomendada deja huecos.

---

## Alternative Approaches Considered

### Option A: Card parser más estricto con selectores y regex

Extraer cada campo desde HTML visible de la card usando selectores más específicos y, cuando sea necesario, heurísticas controladas de texto.

**Pros**

- Menor costo de adopción
- Menor cambio arquitectónico
- Reusa totalmente el flujo actual

**Cons**

- Más frágil frente a cambios de markup
- Puede seguir mezclando campos si la card es muy plana

### Option B: Metadata-first parser

Buscar primero JSON o `data-*` embebidos en la card y usar texto visible solo como fallback.

**Pros**

- Más robusto y mantenible si el metadata existe
- Mejor separación de fecha, ubicación, modalidad y salario
- Menos dependencia de regex sobre texto humano

**Cons**

- Requiere verificar qué metadata sigue viva en el portal actual
- Puede haber variaciones entre listados o páginas

### Option C: Híbrido con detalle selectivo

Primer pase por cards, shortlist provisional y apertura de detalle solo para candidatos con potencial.

**Pros**

- Máxima calidad en shortlist final
- Permite confirmar fecha, ubicación y señales útiles antes del reporte final

**Cons**

- Más lento
- Más complejo
- Aumenta riesgo operativo en flujos autenticados

---

## Recommendation

La ruta recomendada es:

1. ejecutar primero **Option B**
2. caer a **Option A** si la metadata estructurada ya no existe o llega incompleta
3. dejar **Option C** como mejora posterior solo si la shortlist sigue siendo poco confiable después de arreglar cards

Rationale:

- La evidencia histórica del repo ya sugiere que `data-ga4-offerdata` fue útil en `Elempleo`.
- El fallo actual no parece necesitar detalle por vacante; primero hay que recuperar separación básica de campos.
- Introducir confirmación en detalle antes de estabilizar la card aumentaría complejidad demasiado pronto.

---

## Implementation Units

- U1. **Baseline and Evidence Lock**

**Goal:** Congelar el comportamiento roto actual con pruebas y muestras reales para que cualquier mejora futura sea medible.

**Requirements:** plan quality, regression protection

**Dependencies:** None

**Files:**
- Modify: `tests/auth-elempleo.adapter.test.js`
- Create: `tests/fixtures/elempleo/`
- Reference: `results/elempleo-post-login-search-compliance.json`

**Approach:**
- Construir fixtures de HTML o fragmentos representativos de cards reales.
- Agregar asserts explícitos para `title`, `company`, `location`, `publicationDateRaw`, `description`, y si aplica `modality`.
- Reflejar en pruebas los casos que hoy fallan: fecha visible embebida en texto, ubicación con etiqueta visual, y cards con mucho texto adicional.

**Execution note:** characterization-first

**Patterns to follow:**
- `tests/auth-computrabajo.adapter.test.js`

**Test scenarios:**
- Happy path: card realista con fecha visible `Hace 2 horas` produce `publicationDateRaw = "Hace 2 horas"`.
- Happy path: card realista con `Bogotá` y `Híbrido` separa ambos campos.
- Edge case: card con texto largo y múltiples spans no promueve el primer span incorrecto como empresa.
- Error path: card parcial sin metadata sigue devolviendo campos vacíos controlados, no campos contaminados.

**Verification:**
- Existe una prueba que falla con el parser actual y explica por qué no sale shortlist.

---

- U2. **Option A Plan: Selector + Text Heuristics Parser**

**Goal:** Diseñar la variante que usa HTML visible con extracción más específica y regex controladas.

**Requirements:** recuperar fecha, ubicación, modalidad y empresa desde la card visible

**Dependencies:** U1

**Files:**
- Modify: `app/adapters/auth-elempleo.adapter.js`
- Modify: `tests/auth-elempleo.adapter.test.js`

**Approach:**
- Identificar selectores reales y orden de fallback por campo.
- Para `publicationDateRaw`, aplicar detección explícita de patrones de recencia.
- Para `location` y `modality`, preferir extracción por etiquetas visibles como `Ubicación` y `Modalidad laboral`.
- Mantener `description` como resumen útil, no como copia indiscriminada del bloque entero.

**Patterns to follow:**
- enfoque de campos explícitos usado en `app/adapters/auth-computrabajo.adapter.js`

**Test scenarios:**
- Happy path: card con campos visibles bien formados produce todos los campos clave.
- Edge case: card sin `time` ni `.date` aún extrae `Hace 1 semana` desde texto.
- Edge case: card con ciudad y modalidad repetidas no mezcla ambos valores.
- Integration: una muestra representativa deja de caer en `stale-publication-date` al pasar por `filterCandidateJobs`.

**Verification:**
- El parser textual produce al menos algunas vacantes recientes cuando se reprocesan fixtures reales.

---

- U3. **Option B Plan: Structured Metadata Parser**

**Goal:** Diseñar la variante metadata-first que intenta leer atributos estructurados antes del texto visible.

**Requirements:** usar metadata embebida cuando exista, con fallback al parser visible

**Dependencies:** U1

**Files:**
- Modify: `app/adapters/auth-elempleo.adapter.js`
- Modify: `tests/auth-elempleo.adapter.test.js`
- Optional Create: `app/utils/safe-json.js`

**Approach:**
- Inspeccionar cards reales para detectar `data-ga4-offerdata` u otros `data-*`.
- Parsear JSON defensivamente.
- Mapear campos estructurados a la forma normalizada del job.
- Solo si la metadata falta o viene incompleta, aplicar el extractor textual.

**Patterns to follow:**
- `docs/solutions/best-practices/portal-multipage-search-scoring-and-deduplication-2026-05-10.md`

**Test scenarios:**
- Happy path: card con `data-*` válido produce fecha, ciudad y modalidad correctas sin recurrir al texto visible.
- Edge case: metadata parcial usa fallback solo para los campos faltantes.
- Error path: metadata inválida no rompe extracción; cae a parser textual.
- Integration: una muestra real con metadata válida produce `publicationDateRaw` interpretable por `normalizePublicationDate`.

**Verification:**
- La estrategia metadata-first demuestra mayor precisión y menor contaminación de campos que la opción textual pura.

---

- U4. **Option C Plan: Hybrid Shortlist Confirmation**

**Goal:** Diseñar la variante que abre detalle solo para candidatos prometedores antes de escribir shortlist final.

**Requirements:** confirmar campos críticos sin multiplicar navegación innecesaria

**Dependencies:** U1, plus either U2 or U3 as baseline parser

**Files:**
- Modify: `app/adapters/auth-elempleo.adapter.js`
- Modify: `app/experiments/post-login-search.js`
- Modify: `app/adapters/browser-search.adapter.js`
- Modify: `app/services/filter-jobs.service.js` (only if confirmation metadata requires shape extension)
- Modify: `tests/auth-elempleo.adapter.test.js`
- Create: `tests/elempleo-shortlist-confirmation.test.js`

**Approach:**
- Mantener el pase multipágina sobre cards.
- Generar un conjunto provisional de candidatos por match fuerte de título y primeras señales útiles.
- Abrir solo esos detalles para confirmar fecha, ubicación y fragmentos de descripción.
- Re-scorear solo el conjunto confirmado antes del reporte final.

**Patterns to follow:**
- patrón de evidencia incremental ya usado por `app/experiments/post-login-search.js`

**Test scenarios:**
- Happy path: candidato fuerte con card ambigua se confirma en detalle y sobrevive al shortlist.
- Edge case: detalle inaccesible mantiene trazabilidad y no rompe toda la corrida.
- Error path: si falla confirmación de una vacante, esa vacante se marca con evidencia y no tumba el portal completo.
- Integration: el volumen de aperturas de detalle permanece acotado al subconjunto preseleccionado.

**Verification:**
- La confirmación selectiva mejora calidad de shortlist sin convertir la corrida en navegación exhaustiva.

---

- U5. **Decision Gate and Rollout Plan**

**Goal:** Dejar preparado cómo elegir entre las tres opciones antes de implementar.

**Requirements:** decisión explícita, medible y reversible

**Dependencies:** U2, U3, U4 planned

**Files:**
- Modify: `docs/superpowers/plans/2026-05-11-elempleo-parser-recovery-options-plan.md`
- Optional Modify: `README.md`

**Approach:**
- Comparar Option A y Option B sobre el mismo fixture realista.
- Seleccionar una opción primaria con criterios explícitos:
  - precisión de `publicationDateRaw`
  - precisión de `location`
  - estabilidad de `company`
  - legibilidad de `description`
- Tratar Option C solo como fase 2 si la opción primaria no produce shortlist confiable.

**Test scenarios:**
- Test expectation: none -- unidad de decisión y rollout, no cambio de comportamiento directo.

**Verification:**
- Existe una decisión documentada sobre qué opción ejecutar primero y bajo qué criterio se escalaría a la híbrida.

---

## System-Wide Impact

- **Interaction graph:** `auth-elempleo.adapter.js` alimenta `browser-search.adapter.js`, luego `orchestrate-search.service.js`, luego `filter-jobs.service.js`, `score-jobs.service.js` y `report-writer.service.js`.
- **Error propagation:** extracción mala hoy no lanza excepción; degrada silenciosamente la shortlist. El arreglo debe reducir ese fallo silencioso.
- **State lifecycle risks:** cambios en el shape del job deben seguir siendo compatibles con filtro, score y artefactos JSON.
- **API surface parity:** no tocar comportamiento de `Computrabajo` ni de portales públicos.
- **Integration coverage:** hace falta validar no solo unit tests del parser, sino re-procesamiento real de una evidencia guardada de `Elempleo`.
- **Unchanged invariants:** se mantiene el requisito de búsqueda real post-login, multipágina por keyword, consolidación previa al filtro y cuarentena por términos de cuidado.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| La metadata estructurada ya no existe o cambia por página | Mantener fallback textual y no depender de una sola fuente |
| La heurística textual confunde ciudad, modalidad o salario | Separar pruebas por campo y usar fixtures realistas |
| La corrección de fecha reviva demasiado ruido viejo | Mantener parser de recencia estricto y validar contra `Hace 1 semana` / `Hace 1 mes` |
| La opción híbrida vuelva la corrida lenta o frágil | Mantenerla como fase posterior y limitar aperturas al shortlist provisional |
| El parser mejore fecha pero degrade empresa o descripción | Comparar opciones sobre el mismo set de fixtures antes de elegir |

---

## Phased Delivery

### Phase 1

- U1 baseline y pruebas reales
- U3 metadata-first parser
- decisión inicial: seguir con B o caer a A

### Phase 2

- U2 textual fallback más fuerte si la metadata no basta
- revalidación de shortlist sobre evidencia real

### Phase 3

- U4 híbrido con detalle selectivo solo si la shortlist sigue débil

---

## Documentation / Operational Notes

- Al ejecutar cualquiera de las opciones más adelante, conservar evidencia comparativa en `results/` para antes/después.
- Si aparece nueva limitación observada del portal, documentarla en `docs/solutions/`.
- No actualizar `URL_plataformas.md` por este trabajo salvo que cambie realmente la estrategia de sesión o notas operativas del portal.

---

## Sources & References

- `app/adapters/auth-elempleo.adapter.js`
- `tests/auth-elempleo.adapter.test.js`
- `results/elempleo-post-login-search-compliance.json`
- `results/elempleo-batch-summary-latest.json`
- `data/runs/latest.json`
- `docs/solutions/best-practices/portal-multipage-search-scoring-and-deduplication-2026-05-10.md`
- `docs/solutions/best-practices/authenticated-portal-location-validation-and-indeterminate-location-handling-2026-05-11.md`
