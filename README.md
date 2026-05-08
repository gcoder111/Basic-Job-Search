# Basic Job Search

Batch local para buscar y priorizar ofertas laborales a partir de `URL_plataformas.md` y `job-search-profile.md`.

## Comandos

```powershell
npm.cmd install
node --test
node app/run.js --cached
powershell -ExecutionPolicy Bypass -File .\scripts\run-job-search.ps1 -Cached
powershell -ExecutionPolicy Bypass -File .\scripts\install-scheduled-task.ps1
```

## Flujo recomendado

1. Diligenciar `URL_plataformas.md`.
2. Diligenciar `job-search-profile.md`.
3. Preparar auth reutilizable para portales con login.
4. Ejecutar una busqueda post-login de validacion.
5. Correr el batch programado.
