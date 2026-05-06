# URL de Plataformas

## Proposito

Este archivo es la fuente de verdad de los portales y URLs que el agente debe recorrer en cada corrida programada.

Si una URL deja de ser relevante, cambia de portal o requiere una observacion nueva, se actualiza aqui antes de cambiar codigo.

---

## Instrucciones de diligenciamiento

- Agregue una fila por portal o por URL operativa distinta.
- Use una URL inicial real que sirva para entrar al flujo de busqueda.
- Si el portal requiere login, marque `si` en `requiere_login`.
- En `estrategia_sesion` use una de estas opciones iniciales:
  - `storageState`
  - `persistentProfile`
  - `publico`
  - `por_definir`
- En `estado_pruebas` use una de estas opciones:
  - `pendiente`
  - `validado`
  - `inestable`
  - `bloqueado`
- Use `notas` para observaciones como captcha, redirecciones, filtros disponibles o comportamiento raro.

---

## Portales objetivo

https://www.linkedin.com/jobs/ 
https://www.magneto365.com/co/trabajos/buscar 
https://co.computrabajo.com
https://www.adecco.com/es-co/candidatos 
https://www.michaelpage.com.co/jobs/bogot%C3%A1 
https://www.elempleo.com/co/homeusuario

| portal_key | nombre_portal | url_inicio | requiere_login | estrategia_sesion | estado_pruebas | notas |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | pendiente | |

---

## Reglas practicas

- Si un mismo portal tiene una URL publica y otra URL util despues del login, registre la URL que realmente sirve para la busqueda.
- Si un portal ya fue validado pero luego falla en una corrida, no lo elimine de este archivo; actualice sus notas.
- Si un portal exige una sesion reutilizable, este archivo debe seguir siendo la referencia del portal aunque la sesion viva en otro directorio.
- Si no esta claro todavia como automatizar un portal, dejelo en `por_definir` y describa el problema en `notas`.
