# Job Search Batch Design

**Goal:** Construir un proceso batch local programado que recorra portales de empleo definidos por el usuario, ejecute búsquedas según un perfil editable, filtre y priorice vacantes, y deje evidencia útil cuando un portal falle.

**Architecture:** El sistema leerá dos documentos fuente de verdad: `URL_plataformas.md` para portales objetivo y `job-search-profile.md` para términos, señales y reglas de priorización. Un orquestador ejecutará búsquedas por portal usando adaptadores de acceso público o autenticado, normalizará resultados, aplicará filtro y scoring, y generará un reporte final junto con evidencia técnica por portal.

**Tech Stack:** Node.js, Playwright para automatización web, archivos Markdown como configuración editable, ejecución batch local programada en Windows.

---

## Alcance aprobado

- El sistema cubre solo `búsqueda y priorización` de vacantes.
- No automatiza aplicación a vacantes en esta primera versión.
- Debe correr como `batch local programado`.
- Debe soportar `portales con login`.

## Enfoque de autenticación

- El sistema no asumirá que una pestaña abierta manualmente ya garantiza acceso reutilizable.
- Cada portal con login tendrá una estrategia explícita de sesión:
  - `storageState` cuando el portal soporte reutilización estable de sesión.
  - `persistentProfile` cuando el portal requiera un perfil persistente del navegador.
- La validación correcta de un portal autenticado no será solo “se logró entrar”, sino “se logró entrar y ejecutar una búsqueda real”.

## Orquestación y recuperación activa

- La corrida debe seguir avanzando aunque falle un portal.
- Si un portal previamente validado pierde acceso durante una corrida:
  - se mueve al final de la cola,
  - el agente continúa con los demás portales,
  - al final ejecuta un reintento acotado.
- Si el portal sigue fallando después del reintento final, el sistema lo deja en estado `needs-user-decision`.
- Ese estado debe acompañarse de evidencia útil y una pregunta clara al usuario sobre el siguiente paso.

## Componentes principales

### 1. Documentos de entrada

- `URL_plataformas.md`
  - define portales objetivo,
  - notas operativas,
  - si requieren login,
  - estrategia de sesión esperada.
- `job-search-profile.md`
  - define términos de búsqueda,
  - señales útiles,
  - reglas de recencia,
  - criterios de prioridad.

### 2. Orquestador batch

- Lee los documentos fuente.
- Construye el plan de ejecución por portal.
- Ejecuta adaptadores por portal.
- Reordena portales fallidos al final si antes habían sido validados.
- Consolida resultados y decisiones pendientes.

### 3. Adaptadores de portal

- Encapsulan el acceso y la búsqueda real por portal.
- Diferencian portales públicos de portales autenticados.
- Registran evidencia de login, navegación, búsqueda y error.

### 4. Extracción y normalización

- Captura:
  - título,
  - empresa,
  - URL,
  - descripción,
  - fecha visible,
  - señales útiles.
- Normaliza fechas y texto para que el filtro y el scoring sean consistentes.

### 5. Filtro y scoring

- Conserva vacantes con coincidencia suficiente en título.
- Exige además señales útiles en descripción.
- Prioriza por combinación de:
  - fuerza del match en título,
  - señales en descripción,
  - recencia,
  - ajuste global al perfil.

### 6. Reporte y evidencia

- Genera un reporte principal estilo lista priorizada.
- Guarda artefactos de ejecución por portal.
- Deja constancia de portales con decisión pendiente del usuario.

## Criterios operativos

- Los documentos Markdown deben poder editarse sin tocar código.
- Una corrida fallida en un portal no debe tumbar el proceso completo.
- El sistema debe maximizar cobertura útil antes de escalar decisiones al usuario.
- Los portales que funcionaron en pruebas deben tratarse como recuperables antes de considerarlos pendientes de decisión.

## Testing esperado

- Carga y validación de `URL_plataformas.md`.
- Carga y validación de `job-search-profile.md`.
- Clasificación de portales por modo de acceso.
- Filtro por título, descripción y recencia.
- Scoring y priorización.
- Reordenamiento de portales fallidos al final de la corrida.
- Escalamiento a `needs-user-decision` cuando se agoten reintentos razonables.

## Entregables iniciales

- Plantilla editable de `URL_plataformas.md`.
- Plantilla editable de `job-search-profile.md`.
- Plan de implementación posterior basado en esta especificación.
