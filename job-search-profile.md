# Job Search Profile

## Proposito

Este archivo es la fuente de verdad del perfil de busqueda que usaran los agentes para encontrar, filtrar y priorizar ofertas laborales.

Desde aqui se definen:

- las palabras clave para buscar en el titulo
- las variantes validas
- las senales utiles dentro de la descripcion
- las reglas de recencia
- los criterios de prioridad

Si el objetivo de la busqueda cambia, primero se actualiza este archivo y despues la implementacion.

---

## Instrucciones de diligenciamiento

- Escriba primero las palabras clave mas importantes del dominio objetivo.
- Separe terminos de titulo de senales de descripcion.
- Mantenga frases cortas, una por linea.
- Si un criterio deja de aplicar, eliminelo o muevalo a la seccion correcta.

---

## Objetivo de la busqueda

Describa aqui, en 2 a 5 lineas, el tipo de vacantes que el agente debe priorizar.

Ejemplo:

Busco vacantes orientadas a cumplimiento, riesgo, debida diligencia y funciones afines. El objetivo no es encontrar cualquier vacante administrativa, sino una lista corta de oportunidades cercanas al perfil objetivo para revision humana.

---

## Estrategia de uso en portales

Cuando un portal permita buscador o filtros, el agente debe intentar:

- buscar primero por palabras clave principales
- revisar primero el titulo y despues validar la descripcion
- usar ubicacion u otros filtros solo si ayudan a reducir ruido
- revisar siempre la configuracion de navegacion multipagina definida en este archivo antes de ejecutar cada busqueda por keyword

### Navegacion multipagina por keyword

Defina aqui cuantas veces el agente debe avanzar con el boton `Siguiente` cuando el portal soporte navegacion multipagina verificable.

- clicks en `Siguiente`: 7
- instruccion operativa: los agentes deben leer este dato en cada corrida y aplicarlo a cada busqueda por keyword antes de consolidar, filtrar, puntuar y deduplicar resultados

---

## Palabras clave principales para el titulo

Agregue una por linea:

compliance
cumplimiento
riesgo
risk
due diligence
debida diligencia
continuidad de negocio
business continuity
SAGRILAFT
SARLAFT
fraud
etica
PTEE

---

## Palabras clave relacionadas y variantes validas

Agregue una por linea:

risk
operational risk
riesgo operacional
riesgos operacionales
risk matrix
matriz de riesgos
business continuity plan
bcp
listas
listas restrictivas
listas vinculantes
sanctions screening
screening
sarlaft
sagrilaft
ptee

---

## Senales utiles dentro de la descripcion

### Ubicacion objetivo

bogota
bogota d.c.
bogota
bogota d.c.
chia
bogota y alrededores
sabana de bogota

### Uso opcional de ubicacion

- la ubicacion objetivo es una senal opcional para dar contexto y ayudar a priorizar la vacante
- si la vacante confirma una ubicacion objetivo valida, eso suma confianza al analisis, pero no debe ser requisito para conservarla
- si la ubicacion no coincide con la ubicacion objetivo, no se debe descartar la vacante solo por ese motivo
- si la ubicacion no queda clara en la card del portal, el agente puede intentar confirmarla con una validacion adicional cuando eso aporte valor
- si despues de intentar la validacion adicional la ubicacion sigue sin poder determinarse, la vacante no se debe descartar solo por ese motivo
- si una vacante con ubicacion no determinable supera los demas filtros y llega al reporte final, se debe marcar con la nota: "ubicacion no es posible de determinar"

### Experiencia objetivo

1 ano
2 anos
3 anos
4 anos
entre 1 y 4 anos
one year
two years
three years
four years

### Formacion objetivo

ingenieria
ingenieria industrial
administracion
administracion de empresas
professional in engineering
industrial engineering
business administration

### Modalidad objetivo

hibrido
hybrid
presencial
on-site
onsite

### Herramientas, marcos o conocimientos utiles

SAGRILAFT
SARLAFT
Antilavado de activos

---

## Fecha objetivo de publicacion

Defina que tan reciente debe ser una oferta para conservarla.

- hace N horas
- hoy
- ayer
- hace dos dias

---

## Regla minima para conservar una vacante

Describa aqui la regla base.

Ejemplo:

- el titulo contiene al menos una palabra clave principal o una variante valida fuerte
- la descripcion contiene al menos una senal util del perfil
- la ubicacion puede aportar contexto adicional o ayudar a priorizar, pero no es condicion obligatoria para conservar la vacante

---

## Orientacion para prioridad

Defina como interpretar `alta`, `media` y `baja`.

### Prioridad alta

Describa aqui:

- titulo claramente alineado, multiples senales utiles en la descripcion y, cuando exista, ubicacion objetivo que refuerza la confianza

### Prioridad media

Describa aqui:

- titulo alineado, algunas senales utiles claras en la descripcion y contexto suficiente para revision humana

### Prioridad baja

Describa aqui:

- titulo alineado y una senal util minima, pero suficiente para no descartar

---

## Terminos que requieren cuidado

Agregue terminos que generan ruido si aparecen solos:

SGSST
SST
HSEQ
Medio Ambiente
Salud Ocupacional

### Regla de cuarentena para terminos que requieren cuidado

- si una vacante contiene uno o mas terminos que requieren cuidado en el titulo, no debe ir al shortlist principal aunque tambien tenga palabras clave validas
- esa vacante debe seguir pasando por el filtro y scoring normales antes de ser conservada
- si supera el filtro y scoring, debe enviarse al documento `2nd_level_job_posting_to_check.md`
- cada vacante enviada a ese documento debe incluir una nota que explique que fue puesta en cuarentena por contener terminos que requieren cuidado en el titulo
- el documento principal `job_postings_to_check.md` debe conservar solo las vacantes priorizadas sin terminos de cuidado en el titulo

---

## Casos de referencia

### Se debe conservar

- Analista de Compliance en bogota o chia

### Se debe descartar

- Analista de SST
- Analista de cumplimiento con titulo fuerte pero sin senales utiles en la descripcion

---

## Nota de mantenimiento

Si cambian las palabras clave, senales utiles o reglas de prioridad, actualice este archivo antes de pedir cambios en la automatizacion.
