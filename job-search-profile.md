# Job Search Profile

## Proposito

Este archivo es la fuente de verdad del perfil de busqueda que usarán los agentes para encontrar, filtrar y priorizar ofertas laborales.

Desde aqui se definen:

- las palabras clave para buscar en el titulo
- las variantes validas
- las señales utiles dentro de la descripcion
- las reglas de recencia
- los criterios de prioridad

Si el objetivo de la busqueda cambia, primero se actualiza este archivo y despues la implementacion.

---

## Instrucciones de diligenciamiento

- Escriba primero las palabras clave mas importantes del dominio objetivo.
- Separe terminos de titulo de señales de descripcion.
- Mantenga frases cortas, una por linea.
- Si un criterio deja de aplicar, elimínelo o muévalo a la seccion correcta.

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
Ética
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

## Señales utiles dentro de la descripcion

### Ubicacion objetivo

bogota
bogota d.c.
bogotá
bogotá d.c.
chia
bogota y alrededores
sabana de bogota

### Experiencia objetivo

1 año
2 años
3 años
4 años
entre 1 y 4 años
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

- hoy
- ayer
- hace dos dias

---

## Regla minima para conservar una vacante

Describa aqui la regla base.

Ejemplo:

- el titulo contiene al menos una palabra clave principal o una variante valida fuerte
- la descripcion contiene al menos una señal util del perfil

---

## Orientacion para prioridad

Defina como interpretar `alta`, `media` y `baja`.

### Prioridad alta

Describa aqui:

- titulo claramente alineado y multiples señales utiles en la descripcion

### Prioridad media

Describa aqui:

- titulo alineado y algunas senales utiles claras en la descripción

### Prioridad baja

Describa aqui:

- titulo alineado y una senal util minima, pero suficiente para no descartar

---

## Terminos que requieren cuidado

Agregue terminos que generan ruido si aparecen solos:

SGSST
SST
HSEQ
Ambiente
Salud Ocupacional


---

## Casos de referencia

### Se debe conservar

- Analista de Compliance

### Se debe descartar

- Analista de SST


---

## Nota de mantenimiento

Si cambian las palabras clave, señales utiles o reglas de prioridad, actualice este archivo antes de pedir cambios en la automatizacion.
