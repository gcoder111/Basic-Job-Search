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

### Regla obligatoria de ubicacion

- la ubicacion objetivo es un requisito obligatorio para conservar la vacante
- si la vacante no confirma una ubicacion objetivo valida, se debe descartar aunque el titulo y otras senales sean fuertes
- si la ubicacion no queda clara en la card del portal, el agente debe intentar confirmarla con una validacion adicional antes de conservar la vacante
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

- hoy
- ayer
- hace dos dias

---

## Regla minima para conservar una vacante

Describa aqui la regla base.

Ejemplo:

- el titulo contiene al menos una palabra clave principal o una variante valida fuerte
- la vacante confirma una ubicacion objetivo valida
- o, de forma excepcional, la ubicacion no fue posible de determinar despues de validacion adicional y la vacante aun asi supero los demas filtros
- la descripcion contiene al menos una senal util del perfil

---

## Orientacion para prioridad

Defina como interpretar `alta`, `media` y `baja`.

### Prioridad alta

Describa aqui:

- titulo claramente alineado, ubicacion objetivo confirmada y multiples senales utiles en la descripcion

### Prioridad media

Describa aqui:

- titulo alineado, ubicacion objetivo confirmada y algunas senales utiles claras en la descripcion

### Prioridad baja

Describa aqui:

- titulo alineado, ubicacion objetivo confirmada y una senal util minima, pero suficiente para no descartar

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

- Analista de Compliance en bogota o chia

### Se debe descartar

- Analista de SST
- Analista de cumplimiento en Yumbo si la ubicacion objetivo no coincide

---

## Nota de mantenimiento

Si cambian las palabras clave, senales utiles o reglas de prioridad, actualice este archivo antes de pedir cambios en la automatizacion.
