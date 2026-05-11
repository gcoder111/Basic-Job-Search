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

## Flujo de busqueda real

1. Actualizar `URL_plataformas.md` con `requiere_login`, `estrategia_sesion` y notas reales por portal.
2. Validar `auth-state/` o `persistent-profiles/` para los portales autenticados.
3. Ejecutar validacion portal por portal con `node app/experiments/post-login-search.js <keyword> <portal>`.
4. Correr el batch con una sola keyword usando `node app/run.js --keyword=<keyword>`.
5. Revisar `job_postings_to_check.md`, `data/runs/latest.json` y `results/` para confirmar evidencia.
