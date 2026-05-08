# AGENTS.md

## Proposito del proyecto

Este proyecto automatiza la `busqueda y priorizacion` de ofertas laborales usando agentes de AI.

En esta etapa el sistema:

- lee portales definidos por el usuario,
- ejecuta busquedas segun un perfil editable,
- extrae resultados,
- filtra vacantes,
- asigna prioridad,
- genera reporte y evidencia.

En esta etapa el sistema `no`:

- aplica automaticamente a vacantes,
- modifica credenciales del usuario,
- elimina portales solo porque fallaron una vez.

---

## Fuentes de verdad

Antes de cambiar codigo, revise estos archivos:

1. `URL_plataformas.md`
2. `job-search-profile.md`
3. `docs/superpowers/specs/2026-05-06-job-search-batch-design.md`
4. `docs/superpowers/plans/2026-05-06-job-search-batch-implementation-plan.md`

### Que decide cada archivo

`URL_plataformas.md`

- define los portales objetivo,
- define URLs operativas,
- indica si un portal requiere login,
- documenta estrategia de sesion esperada,
- guarda notas operativas por portal.

`job-search-profile.md`

- define palabras clave de titulo,
- define señales utiles de descripcion,
- define reglas de recencia,
- define orientacion de prioridad.

### Regla clave

Si un cambio es de negocio, primero se modifica el Markdown fuente de verdad. No codifique criterios de negocio en duro si deben vivir en esos documentos.

---

## Flujo esperado de una corrida

Una corrida debe seguir este orden general:

1. Leer `URL_plataformas.md`.
2. Leer `job-search-profile.md`.
3. Construir la lista de portales y terminos de busqueda.
4. Resolver el modo de acceso por portal.
5. Ejecutar la busqueda por portal.
6. Extraer y normalizar vacantes.
7. Filtrar por titulo, descripcion y recencia.
8. Asignar score y prioridad.
9. Deduplicar resultados.
10. Escribir reporte y artefactos de ejecucion.
11. Escalar al usuario solo los casos que realmente lo requieren.

---

## Politica para portales con login

No asuma que una pestaña del navegador abierta manualmente equivale a una sesion reutilizable.

Cada portal con login debe usar una estrategia explicita:

- `storageState`
- `persistentProfile`
- otra estrategia documentada si se aprueba despues

### Regla de validacion

Un portal autenticado solo se considera realmente soportado cuando:

- la sesion se reutiliza correctamente, y
- se ejecuta una `busqueda real post-login`, y
- esa busqueda produce evidencia verificable.

No basta con “parece que el login sigue vivo”.

---

## Manejo de fallos y reintentos

Si un portal que ya habia funcionado en pruebas falla durante la corrida:

1. no detenga toda la corrida,
2. no lo cierre inmediatamente como bloqueado definitivo,
3. muévalo al final de la cola,
4. continúe con los otros portales,
5. reintente ese portal al final de la corrida.

Si despues del reintento final el portal sigue fallando, deje el caso como:

- `needs-user-decision`

Ese estado debe incluir:

- evidencia util,
- una nota clara de que fallo,
- una pregunta concreta al usuario sobre que hacer.

Ejemplos de decision del usuario:

- refrescar sesion,
- omitir el portal en esta corrida,
- dejarlo pendiente para la siguiente corrida,
- revisar manualmente cambios del portal.

---

## Criterios de priorizacion

La priorizacion debe seguir el perfil cargado desde `job-search-profile.md`.

Como regla general:

- el titulo debe mostrar una coincidencia suficiente con palabras clave principales o variantes validas,
- la descripcion debe aportar señales utiles del perfil,
- la recencia importa,
- la vacante debe puntuar mejor si acumula multiples señales fuertes.

No conserve vacantes solo por una coincidencia superficial del titulo si la descripcion no confirma el ajuste.

---

## Evidencia y artefactos

El sistema debe generar al menos:

- un reporte principal de vacantes priorizadas,
- un JSON consolidado por corrida,
- evidencia tecnica por portal cuando aplique,
- screenshots de debugging para flujos sensibles,
- material de sesion reutilizable separado de los reportes.

### Regla de separacion

Mantenga separados:

- `auth-state/` para sesiones tipo `storageState`,
- `persistent-profiles/` para perfiles persistentes,
- `results/` para capturas y resultados tecnicos,
- `data/runs/` para historial de corridas.

---

## Reglas para futuros agentes

### Haga esto

- lea primero las fuentes de verdad,
- prefiera cambios pequeños y verificables,
- deje evidencia suficiente cuando toque autenticacion,
- conserve la trazabilidad entre portal, keyword y resultado,
- piense en corridas batch locales de Windows como caso principal.

### No haga esto

- no mueva logica de negocio desde Markdown a codigo sin justificacion,
- no borre un portal del flujo solo porque fallo una vez,
- no marque un portal como definitivamente bloqueado sin evidencia,
- no trate como exito un login sin busqueda real posterior,
- no cambie naming o estructura de artefactos de forma arbitraria.

---

## Convenciones operativas

- Use Node.js con ESM.
- Use `node:test` para pruebas.
- Mantenga compatibilidad con PowerShell y Windows.
- Si un parser depende de la estructura real de un portal, deje notas claras y pruebas donde sea posible.
- Si una decision tecnica depende de una limitacion observada en un portal, documentela en codigo o en artefactos del portal.

---

## Antes de cerrar una tarea

Antes de decir que algo esta listo:

1. ejecute las pruebas relevantes,
2. confirme que no se rompieron las fuentes de verdad,
3. verifique que el comportamiento siga alineado con este archivo,
4. documente cualquier limitacion nueva descubierta.

---

## Estado actual del alcance

Estado actual aprobado:

- busqueda automatizada,
- priorizacion,
- soporte para portales con login,
- reintento al final de la corrida para portales previamente validados,
- escalamiento a `needs-user-decision`.

Fuera de alcance por ahora:

- auto-aplicacion a vacantes,
- orquestacion cloud,
- flujos multiusuario,
- reemplazar decision humana cuando un portal autenticado falla repetidamente.
